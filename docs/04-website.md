# 04 — WEBSITE: CIMES public self-service site

**Status:** build spec for implementation. Read `00-master.md` first (architecture, contracts, env table, guardrails), then this file.

This module owns the **public static website** for CIMES: a marketing landing that mirrors the structure and conversion patterns of a competitor site, plus a **full on-page self-service signup wizard (Flow B)** that takes a visitor from city selection to a confirmed order **without any WhatsApp interaction and with zero operator input**.

The website is a **pure consumer** of the backend. It renders UI and calls a few REST endpoints owned by `01-core-api.md` (§4). It contains **no business logic of its own** — no price computation, no coverage rules, no WaterService calls. Everything deterministic happens server-side behind the endpoints in §4.

**Workspace:** the site lives in `website/` (`website/CONTEXT.md`), deployed to Hostinger separately from the backend. Log sessions in `PROGRESS.md` — scaffold rules in `00-master.md §4.1`.

---

## 1. Goal & branding

Rebuild the CIMES site following the **structure and conversion patterns of the competitor landing `https://aguaivess.rosmino.com.ar/`**, with CIMES branding, copy, and products.

**Branding is settled — do not treat it as an open design decision:**

- **Copy the competitor site's design (layout, section order, component structure, spacing, conversion patterns) EXACTLY for v1.** Reproduce its structure with CIMES logo, copy, and products swapped in.
- Colors, background, and product imagery tuning happen **after** the first build (the copied design may not match CIMES' colors — that is expected and gets adjusted later).
- **No redesign scope beyond that.** Do not invent a new layout, do not "improve" the competitor's structure. Build the clone, then the client tunes colors/imagery.

Reference: `00-master.md` §10 open item (c) — website branding is SETTLED.

---

## 2. Page sections

The landing is a single mobile-first page (traffic is mostly Instagram mobile). Section order and structure follow the competitor site. All user-facing text comes from the es-AR copy module (§7), never hardcoded inline.

1. **Hero** — brand promise + **primary CTA**. The primary CTA points at the signup wizard (§3 / the "Alta automática" path in §2.2).

2. **Dual CTA block** — the key conversion pattern to reproduce. Two clearly distinct calls to action:
   - **"Alta automática"** → opens / scrolls to the on-page self-service signup wizard (§3). Stays on the site; no WhatsApp.
   - **"Alta por WhatsApp"** → a `wa.me` deep link to the **sales number** with a prefilled message (e.g. "Hola, quiero darme de alta"). The deep-link target number is the value of `WHATSAPP_NUMBER_SALES` (owned by `02-chatbot.md`; see §6) baked into the link at build/config time. Format: `https://wa.me/<number>?text=<url-encoded prefilled message>`.

3. **Self-service signup wizard (auto-alta)** — the full Flow B on-page. Full specification in §3.

4. **"¿Cómo funciona?" — 3 steps** — a simple three-step explainer: (1) completás el formulario → (2) te confirmamos por WhatsApp → (3) recibís tu pedido en tu día de reparto semanal. Copy from the es-AR module.

5. **Product catalog grid** — a marketing grid of products (currently 7 merged cards in `copy.es-AR.js`; the wizard step is the one driven by the 9-SKU registry). 
   - **Prices are OMITTED on this catalog grid** — prices are city-dependent, so this marketing section shows products without prices, each with a **CTA to WhatsApp** (the same `wa.me` sales deep link pattern as §2.2).
   - **Do not confuse this with the wizard's catalog step (§3, step 3).** The wizard step shows the **9 canonical SKUs** (`src/src/catalog/skus.ts`) **WITH the selected city's real prices** fetched from `GET /api/prices?city=`, in sales order (Botellón 20L first). Product photos are keyed off the display name in `js/wizard.js` — keep that map in sync with the registry. This marketing grid is priceless-by-design; the wizard catalog is priced.

6. **Trust section** — quality of the product, retornables / environmental angle (returnable bottles), weekly service reliability. Static copy + imagery.

7. **Coverage areas** — feature the main service cities: **Mercedes, Luján, San Andrés de Giles, San Antonio de Areco, Chivilcoy, Campana, Zárate**. Static display (marketing reassurance; **any Buenos Aires province city is served** — the authoritative coverage check is the live per-address one in the wizard, §3 step 5).

8. **Testimonials** — 3 client testimonials. **The client provides the 3 testimonials** (text + optional name/photo). Build the section with 3 placeholder slots wired to the copy module so the real ones drop in without code changes.

9. **Footer** — contact email, Instagram **`cimes.silva`**, Facebook, TikTok, and a link to the privacy policy (§2.10). Social links and email come from the copy/config, not hardcoded in markup logic.

10. **Privacy policy page** — a simple static privacy-policy page hosted on this site. **Required by Meta before Instagram Instant Forms lead ads can run** — the ad form's privacy policy URL points here (`02-chatbot.md` Flow D). Ship it with the first deploy; es-AR copy.

---

## 3. Self-service signup wizard (Flow B, end-to-end on-page)

This is the core deliverable of the module. The **entire** signup completes on the page — the visitor never needs WhatsApp and no operator touches it. It mirrors the WhatsApp signup stages but runs entirely through the REST endpoints in §4.

### Wizard steps (in order)

1. **City select.** Visitor picks one of the 8 quick-pick cities, or uses **"Otra ciudad"** — an inline **free-text field with a native autocomplete** (`GET /api/cities`, ~130 BA cities); its **Continuar** button stays disabled until a city is typed. On submit the typed city is resolved via **`POST /api/resolve-city`**, with two outcomes:
   - **Recognized** (exact or a typo within the match floor, e.g. `nechochea`) → snapped to the canonical city and the wizard **continues the normal flow** (priced catalog → data → coverage → day → summary) exactly like a quick-pick.
   - **Unrecognized** (a genuine non-place, e.g. `monte chico`) → **no dead-end.** An inline **second thought** appears — one line, *"No encontramos «…». ¿Quisiste decir…?"* — followed by the **1–3 closest real cities** as one-tap links (`suggestions` from the endpoint), plus a **"Continuar igual con «<typed>»"** link that proceeds with the **typed text as-is**. Coverage decides downstream; a real non-place fails coverage at step 5 and is saved for the future (§5). After a submit the **Continuar** button stays disabled (no re-click on the same text); editing the field re-enables it.

   **Any BA province city is accepted; the list is advisory, not a gate** — coverage is decided later at step 5. A direct `/alta/?city=<unknown>` link is de-slugged and proceeds silently (the nudge lives only in the typing flow), never bouncing back to the picker.

2. **Dispenser + water type.** Two decisions on one screen, because to the visitor they are one decision — and together they pick the price list, the catalog, and the abono. Three cards (two side by side, one full-width, mirroring the competitor layout): **Dispenser Natural** (free, comodato), **Dispenser Frío/Calor** (comodato + monthly abono, 50% off the first month), **Sin dispenser**. The two dispenser cards carry an inline **Común / Bajo en sodio** toggle, defaulting to *Común*; *Sin dispenser* has none.

   This step also performs the **`GET /api/prices?city=<city>`** call (moved here from the old step 2 — the frío/calor card needs its prices, and the city is already known). Every number on the card comes from the response's `frio_calor` block; **the site hardcodes no price**. When that block is `null` — the deployment can't price the abono for this city — the **Frío/Calor card is not offered at all** rather than quoted with a guess.

   **Validation differs from the rest of the wizard on purpose:** `Siguiente` stays **enabled**, and pressing it with nothing selected reveals an inline error. A dead button doesn't tell anyone what's missing. On continue with frío/calor the prices are **re-fetched with `&dispenser=frio_calor`**, because that comodato uses its own price list in some cities.

   A comodato can't mix waters, so the choice **filters the next step**: Natural shows the 20L + 12L of the chosen water; Frío/Calor shows only that water's 20L (every abono is 4×20L); Sin dispenser shows everything. Non-bottle SKUs (soda, gaseosa, agua, saborizada, isotónica) are always shown.

3. **Priced catalog (multi-item cart).** Render the catalog from step 2 — narrowed by the dispenser choice — as a card grid (product image + price + a quantity stepper). The response is the catalog for exactly one city's price list — **render it as returned; never mix or cache another city's prices**. The visitor can add **quantities of several products** (a running total is shown) before continuing; prices are formatted with a thousands separator. Product images are mapped from the product name to the local `assets/products/*.webp` photos (CIMES logo fallback when nothing matches).

   **Under frío/calor** the included botellón is **prefilled to 4** — the visitor is already paying for those, so starting at zero would misrepresent what they get — and its card says the listed price applies from the 5th on. The running total is the discounted first abono plus only the bottles beyond the four, mirroring `resolveCartLines` on the server, and it's labelled **"Total a pagar en la entrega"**. An abono with no products at all is a valid order.

4. **Delivery-data form.** Collect: **nombre**, **apellido**, **teléfono (WhatsApp)**, **calle**, **altura**, **entre calles**. Apply **client-side validation** (required fields, phone format) before proceeding. (Server-side validation is enforced independently by the endpoints — see "Validation" below.)

5. **Live coverage check + delivery-day picker.** Call **`POST /api/coverage`** with the composed address + city. While the check runs the site shows an animated **canister loader** (a spinning bidón, water waving level inside — "Verificando cobertura…"); the check can take up to the WaterService fetch timeout (`01-core-api.md` §13), so the loader is not optional. On `covered: true`, render the returned **delivery-day options** — each option is a route + weekday + **time window** (e.g. "Reparto 19 — sábado entre 10 y 13"). Visitor picks one. On `covered: false` **or** zero `delivery_options`, go to the manual-review handoff (§5). **The site does not decide coverage** — it displays whatever the endpoint returns.

   **Upstream failure ≠ no coverage.** If the endpoint answers **503** (WaterService timed out/errored — `01-core-api.md` §`POST /api/coverage`), that means "couldn't check", **not** "not covered", so the site must **never** show the not-covered/handoff copy on a 503. Instead it offers **one retry** (loader shown again). Escalation is: **attempt 1 fails → retry button only, nothing saved**; **retry succeeds → normal flow, still nothing saved** (no phantom review lead); **attempt 2 also fails → the §5 manual-review handoff** (lead saved + WhatsApp), because after two failures a human takes over. Lead capture fires **exactly when the WhatsApp button appears** — never on the retry screen — which is what keeps a recovered retry from leaving a stray `revision_cobertura` lead.

6. **Summary + confirm.** Show an order summary (each cart line `qty × product` + subtotal, the **total**, address, chosen delivery day + window). Visitor confirms. Call **`POST /api/orders`** with the full order (`items: [{product, qty}]`) and `source: "web"`. The server resolves prices + total (§9); the site never sends prices.

7. **Success state.** On a successful `POST /api/orders`, show a success screen with the scheduled delivery, e.g. **"Listo, te lo llevamos el sábado entre 10 y 13"** (copy from the es-AR module, interpolating the confirmed day + window from the order/coverage response).

On confirm, `POST /api/orders` runs the **same confirmation pipeline as Flow A step 8** (WaterService client + attached contact + scheduled driver ticket + orders-sheet row with `source=web` + label `cliente_cerrado`). **That pipeline is specified in `01-core-api.md` — do not re-specify or re-implement it here.** The website's responsibility ends at sending a correct `POST /api/orders` request and rendering the response.

### Validation — client-side AND server-side

- **Client-side:** the wizard validates required fields and formats before advancing each step, for UX (fast feedback, no wasted round-trips).
- **Server-side:** the endpoints (`01-core-api.md`) validate independently and are the authority. **The website must never assume client-side validation is sufficient** — it must handle endpoint rejections/errors gracefully (show a friendly message, let the user correct and retry) and must not proceed past a step whose endpoint call failed.

### State handling

Keep wizard state (selected city, product, form data, chosen day) in memory on the page. Do not persist PII in the browser beyond the session. The backend record is the source of truth once `POST /api/orders` succeeds.

---

## 4. Backend REST contract (consumed, not implemented here)

These endpoints are **owned and implemented by `01-core-api.md`**. This module only calls them. Use these exact shapes; match `00-master.md` §5.6 and `01-core-api.md` — **do not invent variants**. All calls are made against `API_BASE_URL` (§6).

| Endpoint | Website usage |
|---|---|
| `GET /api/cities` | Wizard step 1. Returns the ~130 BA-province cities for the "Otra ciudad" free-text autocomplete. |
| `POST /api/resolve-city` | Wizard step 1. Snaps the typed "Otra ciudad" text to the closest real BA city; the wizard then continues the normal flow. |
| `GET /api/prices?city=<city>[&dispenser=<natural\|frio_calor\|ninguno>]` | Wizard step 2 (and re-fetched on entering step 3 under frío/calor). Returns the product catalog with that city's prices (one city's price list only, never mixed) — `dispenser=frio_calor` selects the comodato's list where the city has one. Also returns a **`frio_calor`** block (`{comun, bajo_sodio}`, each `{abono_id, abono_name, abono, abono_first_month, included_bottles, excedente, price_list}`) always computed from the comodato list, so the cards can quote before anything is chosen; **`null`** when the abono can't be priced. Render as returned. |
| `POST /api/coverage` | Wizard step 5. Body: composed address + city. Returns `covered` (boolean), resolved coordinates, price list id, and available delivery-day options (each: route + weekday + time window). Site renders the day options on `covered: true`; runs §5 on `covered: false`. |
| `POST /api/orders` | Wizard step 6 (confirm). Body: full order — `name` (nombre + apellido), `phone`, `city`, `address` (calle + altura), `cross_streets` (entre calles), `product`, optional **`dispenser`** (`natural\|frio_calor\|ninguno`) + **`water_type`** (`comun\|bajo_sodio`) from step 2, chosen `delivery_day` + `delivery_window`, and **`source: "web"`**. With `dispenser: "frio_calor"` an empty `items` is valid — the abono is the order. Triggers the shared confirmation pipeline (see `01-core-api.md`). Idempotent per lead — a double-submit of the same order must not create two altas. Site must guard the confirm button against double-clicks regardless. |

**Refer to `01-core-api.md` for the exact request/response JSON schemas.** If a field name in this doc and `01-core-api.md` ever disagree, `01-core-api.md` + `00-master.md` §5 win.

---

## 5. No-coverage handling

When the address cannot be served, the flow does **not** dead-end — it ends politely and still records the lead so the operator/analytics see it.

- **Polite on-page message.** Show a friendly "no llegamos a tu zona todavía" style message (from the es-AR copy module). No error state, no operator handoff prompt on the site.
- **Lead is still recorded.** When the address has **no serving neighbour/route** — `covered: false`, **or** `covered: true` with **zero `delivery_options`**, **or** two consecutive upstream failures on the coverage check (see the flow below) — this is the **manual-review handoff**, not a dead end. On this result at wizard step 5 the website POSTs the full lead (name, phone, address, cart) to **`POST /api/manual-review`** (`01-core-api.md` §9). The backend saves the lead, labels it **`revision_cobertura`** (`00-master.md` §5.3), turns the **AI off** (`ai_enabled = false`), mirrors it to Chatwoot (conversation set `open` + a private note with the case detail) and **pings the operator**. The page then shows a friendly message + a **WhatsApp button** — a deep link to the sales number whose prefilled text carries the **`[REV-COB]`** sentinel — so a human can decide "te podemos tomar" / "no llegamos". The **same handoff fires in the WhatsApp bot flow** when its coverage step yields zero delivery options (`01-core-api.md` §4.5). **Because any BA province city is accepted at the city step (§3 step 1), this path applies to any city with no serving neighbours** — the old out-of-city `otra_ciudad` / `POST /api/waitlist` branch is gone (its "Otra ciudad" picker option is now the free-text city entry), as is the old `mal_lead` dead-end for this case.
- **How the lead gets recorded:** recording is a backend concern; the website only sends the lead data via **`POST /api/manual-review`** (above).

**Step-4 coverage-check flow (the full decision tree).** A `503` is "couldn't check", not "not covered" — so a transient WaterService failure gets **one retry** before it hands off, and lead capture fires **only when the WhatsApp button appears** (never on the retry screen), which is what keeps a recovered retry from saving a phantom `revision_cobertura` lead:

```
enter data → LOADING (canister)
  ├─ covered + slots             → day picker                            (unchanged)
  ├─ answered, no slot / no zone → WhatsApp + save                       (unchanged branch)
  └─ timeout / error (attempt 1) → "still checking" + [Reintentar]       ← retry only, NO save
        └─ click Reintentar → LOADING
             ├─ covered + slots            → day picker
             ├─ answered, no slot          → WhatsApp + save
             └─ timeout / error (attempt 2) → WhatsApp + save            ← no more retry
```

Retry escalation applies **only** to the upstream-failure (`503`/network) path — a *successful* check that returns no-slot/not-covered goes straight to WhatsApp + save (retrying would return the identical answer). The `503` contract itself is in `01-core-api.md` §`POST /api/coverage`; the retry copy lives in `wizard.coverageRetry` (`copy.es-AR.js`).

**AI silence (phone-match + sentinel).** Because the lead is saved with `ai_enabled = false` keyed by phone, any WhatsApp message from that number is handled by a human, not the bot. The `[REV-COB]` sentinel in the prefilled text is a fallback: if the customer messages from a different number than the one entered on the web, the inbound handler still recognizes the tag and hands off (`01-core-api.md` §4.5).

---

## 6. No web follow-up sequence

- **Web signups have NO follow-up sequence.** A web visitor either completes the signup or abandons it. The follow-up engine (`01-core-api.md`) is **WhatsApp-only** — it does not chase web signups. Do not build any web-side re-engagement, abandoned-cart recovery, or reminder logic.
- **Optional `WEB_CONFIRMATION_TEMPLATE` (off by default).** A single utility template that confirms the order can optionally be sent for web orders. This is **owned by `01-core-api.md` (the order pipeline decides to send it) and delivered via the chatbot/WhatsApp layer (`02-chatbot.md`)** — see the env ownership in `00-master.md` §8. **The website has no direct role in sending it.** The site's only involvement is that `source: "web"` orders are what the flag gates. Default `false`. Do not implement template sending in the website.

---

## 7. es-AR copy module (no hardcoded inline strings)

Per `00-master.md` §2, all user-facing copy is **Argentine Spanish (voseo)** and lives in a **dedicated es-AR copy module — never hardcoded inline** in markup or JS logic.

- The website ships with its **own es-AR copy module** (e.g. `copy.es-AR.js` or a JSON copy file) holding every visible string: hero promise, CTA labels, the 3 "¿cómo funciona?" steps, product names/descriptions, trust copy, coverage-city labels, testimonials (placeholder slots the client fills), footer, wizard labels/prompts, validation messages, the no-coverage message, and the success message.
- The site deploys separately to Hostinger, so it maintains its own copy file rather than importing the backend's TypeScript module. **Where wording overlaps with the chatbot** (notably the success/confirmation phrasing, e.g. "Listo, te lo llevamos el sábado entre 10 y 13"), keep it consistent with `02-chatbot.md`'s copy, but the website owns its own file.
- All code, identifiers, comments, and file names stay in **English** (`00-master.md` §2).
- **Emphasis inside a copy string:** wrap it in `**dobles asteriscos**`. `App.rich()` (`js/util.js`) escapes the string and turns only those markers into `<strong>`, styled once site-wide (brand blue, bold). It's the only markup a copy edit may introduce — no HTML in the copy module.

---

## 8. Technical requirements

- **Stack:** static **HTML/CSS/JS** (or **Astro** — implementer's choice; both produce a static, Hostinger-deployable site). No server runtime on the website side; dynamic behavior is client-side JS calling the REST endpoints (§4).
- **Mobile-first.** Ads traffic is Instagram mobile. Design and build mobile-first; a desktop layout must also work.
- **Performance: mobile Lighthouse ≥ 90.** This is an acceptance criterion (§10). Keep assets lean, images optimized/compressed, JS minimal, no heavy frameworks or blocking third-party scripts.
- **Deployable to Hostinger shared hosting.** Output must be plain static files uploadable to the client's existing Hostinger. No Node runtime, no server-side rendering at request time.
- **Keep the existing GTM container.** Preserve the client's current Google Tag Manager container on the new site.

### Address autocomplete (Google Places)

The Dirección field (step 4) uses Google Places for suggestions but **must never be a hard dependency** — a plain typed address always works, because the backend geocodes the raw string via WaterService #12 (`01-core-api.md` §3). Three constraints below — each is the fix for a real regression that shipped and broke this field. **Do not undo them.**

1. **Load Maps at the *product* step (step 3) — not lazily at the address step, not eagerly at page load.** Triggering the loader on step 4 *races the field render*: the Maps script loads async, and by the time it's ready the render has moved on, so the input is left **unbound** (no dropdown, no error, no network call — the exact symptom to watch for). Loading eagerly at page init wastes the payload on landing-page bouncers. Step 3 loads it one step early → ready by step 4 → `attachPlaces()` binds **synchronously** when the field renders → and on the landing page it only loads once the visitor engages the wizard.
2. **Use the new `google.maps.places.AutocompleteSuggestion` API — not the legacy `Autocomplete` widget.** Legacy is deprecated and **blocked for Google Cloud projects created after 2025-03-01**; it silently fails to bind. Render our own dropdown on the existing `#direccion` input (that also keeps freeform typing working).
3. **Restrict, don't just bias.** Use `locationRestriction` (a ~20 km box around the selected city's geocoded center) so streets from *other* cities never appear. `locationBias` only re-ranks and still surfaces far-away results. Fall back to country-only (`includedRegionCodes: ['ar']`) if the city geocode fails.

The browser needs its **own** Maps key — see `GOOGLE_MAPS_KEY` in §9.

### SEO

- **Per-page meta + Open Graph tags** (title, description, OG title/description/image) on every page.
- **JSON-LD `LocalBusiness`** structured data (name, areas served = Buenos Aires province / the main cities, contact, social profiles).
- **Keyword targets** woven into copy/meta, e.g. *"soda a domicilio Mercedes"*, *"dispenser de agua Luján"*, *"bidones de agua Campana"* (and equivalents for the other covered cities).
- **`sitemap.xml` + `robots.txt`.**

---

## 9. Environment / configuration this module needs

Full ownership table is `00-master.md` §8. This module's relevant subset:

| Var | Default | Owner | Website's use |
|---|---|---|---|
| `API_BASE_URL` | — | **website** | Backend base URL the static site `fetch`es for `GET /api/prices`, `POST /api/coverage`, `POST /api/orders` (§4). |
| `GOOGLE_MAPS_KEY` | placeholder `"GOOGLE_MAPS_KEY"` | **website** | Browser Maps key for the step-3 address autocomplete. Needs **Maps JavaScript API + Places API (New)** enabled and **HTTP-referrer-restricted** to the site's domain. **Separate from the backend's server-side `GOOGLE_MAPS_API_KEY`** — never put the server key here (it would be publicly exposed). While the value is the placeholder, the field stays a plain text input (autocomplete no-ops). Local dev injects the backend key via `dev.sh` (`MAPS_KEY`). |
| `WHATSAPP_NUMBER_SALES` | — | chatbot | The sales number baked into the "Alta por WhatsApp" `wa.me` deep links (§2.2, §2.5). Website consumes the value; it does not own it. |
| `WEB_CONFIRMATION_TEMPLATE` | `false` | core-api | Gates the optional web-order confirmation template. **Owned by core-api, sent via the chatbot layer** — website has no direct role (§6). Listed here only so the flag's existence and ownership are clear. |

The website **mostly consumes core-api** — its only owned config is `API_BASE_URL`. It needs the value of `WHATSAPP_NUMBER_SALES` for the deep links, but that var is owned by `02-chatbot.md`.

---

## 10. Acceptance criteria (this module)

Subset of the system acceptance criteria (`00-master.md` / PRD), scoped to the website:

1. **(crit 2 — full self-service signup, zero operator input, no WhatsApp)** A web visitor completes the ENTIRE signup on the site — **city → priced catalog → delivery data → live delivery-day options → confirm** — and the order lands in **WaterService + the orders sheet** with **zero operator input and no WhatsApp interaction required**. (The WaterService + sheet write is executed by `POST /api/orders` / `01-core-api.md`; this criterion verifies the website drives that flow end-to-end and shows the success state.)

2. **(crit 8 — deploy, performance, CTAs)** The site is **deployed on Hostinger**, achieves **mobile Lighthouse ≥ 90**, and **both CTAs are functional** — "Alta automática" opens the working on-page wizard, and "Alta por WhatsApp" opens a `wa.me` chat to the sales number with the prefilled message.

3. **No-coverage path works** (§5): a submission whose address has **no serving neighbour** shows the polite on-page message and records the lead with the canonical label **`revision_cobertura`** (via `POST /api/manual-review`) — AI off, operator pinged — with no operator involvement needed to capture it. This applies to **any BA city** (no separate out-of-city branch); the **"Otra ciudad"** free-text entry snaps a recognized city (`POST /api/resolve-city`) and continues the normal flow, or — for an unrecognized city — shows a **second thought** (did-you-mean + "continuar igual") and still proceeds with the typed city, which lands here (`revision_cobertura`) if it fails coverage. A genuine non-place never dead-ends the picker.

4. **Priced catalog is city-correct:** the wizard's catalog step shows only the selected city's prices (from `GET /api/prices?city=`) and never mixes two cities' price lists.

---

## 11. Cross-references

- `00-master.md` — architecture, canonical contracts (§5 REST endpoints §5.6, labels §5.3, lead record §5.1), env ownership (§8), branding decision (§10c).
- `01-core-api.md` — the REST endpoints (§4) and the confirmation pipeline behind `POST /api/orders`; the no-coverage lead-recording path (§5); the exact request/response JSON schemas.
- `02-chatbot.md` — owns `WHATSAPP_NUMBER_SALES` (deep-link target) and the canonical es-AR copy the website keeps consistent with (§7); delivers `WEB_CONFIRMATION_TEMPLATE` if enabled (§6).
