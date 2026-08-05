# PROGRESS

## Current status

Day-1 scaffold done. Backend (core-api + chatbot, `src/`) AND website (`website/`,
Flow B) built: typecheck clean, 37 tests passing (32 backend + 5 website DOM tests
driving the real wizard in jsdom against a stubbed API). WaterService credentials are
now set (`src/.env`, base `https://cimessilva.sistemaws.com/`) and the coverage path is
**verified live** (2026-07-29): login + endpoint #12 return real coverage. Kapso still
not run against the live account. Ops artifacts done
(`ops/DEPLOY.md`, `ops/chatwoot/` compose + wiring guide); actual VPS/Chatwoot deploy
happens when the client's infra is available. All four module docs (01/02/03/04) now
have their build counterpart; test count 38.

**Live WaterService coverage check (2026-07-29).** Read-only smoke against the real API
(`GeocodingProvider.resolve`, endpoint #12) for a Mercedes address: `covered: true`,
`price_list: "6"`, real reparto/weekday/time-window options returned — connection + token
auth + mapping all work.
- **Fixed:** coverage returned **98 delivery options** (every route inside the 10 km
  `COVERAGE_RADIUS_M`). Scoped `providers/geocoding.ts` to the nearest neighbor's serving
  reparto — one option per weekday, week-ordered. Same address now returns **6** options,
  all `reparto 8`. Also fixed a latent alta bug: `pipeline/orders.ts` mapped the chosen
  weekday to the *first* matching option's reparto, which could be a route that doesn't
  serve the address; now every option shares the serving reparto. typecheck clean, 72 tests.
- **Resolved — coverage latency via radius.** `COVERAGE_RADIUS_M` dropped 10000 → **1000**
  (`.env`, `.env.example`, and the `config.ts` default so a missing env can't revert to 10 km).
  The old ~13 s was the #12 geo-query scanning the whole town at 10 km; measured live at 1 km
  it is ~2 s first call, ~0.9 s once the token is cached. **Tradeoff:** radius also controls how
  many of the serving route's delivery days are discoverable — options for the Mercedes test
  address dropped 6 → 2 (martes/viernes) — and may flip outskirt addresses to `covered:false`.
  Watch during real use; bump back toward ~2–3 km if too tight.
- **Write path unverified live.** Coverage (#12, read) is proven live; the **writes are not** —
  `#6 alta`, `#7 contact`, and `#3 ticket` (the order-as-note, fired day-before by the dispatch
  cron) are code-complete and failure-safe (retry queue + operator alert on `error != 0`) but
  have **never executed against real WaterService**. Order model is settled: no order endpoint
  exists — the order travels as the #3 ticket note (`docs/01-core-api §4.5`); our scope ends when
  that note lands. **Next real step:** one live end-to-end alta+contact+ticket with a disposable
  test client, then delete it. Also confirm the dispatch cron is deployed/running.

**Manual-review handoff — covered city, no delivery time (2026-07-30).** New `revision_cobertura`
flow: a covered-city address with **zero offerable delivery times** (no serviceable neighbor/route)
is saved + handed to a human instead of dead-ending. Shared `engine/manual-review.ts`
(`enterManualReview`): AI off (`ai_enabled=false`), label `revision_cobertura`, Chatwoot conversation
`open` + private note, operator ping; idempotent. Wired into: website (`POST /api/manual-review`,
friendly copy + WhatsApp button with the `[REV-COB]` deep-link), the WhatsApp bot coverage step
(replaces the old in-city `mal_lead` dead-end), and an inbound sentinel fallback. AI silence is by
phone-match; the sentinel covers a web-phone ≠ WhatsApp-phone mismatch. Docs updated (00-master §5.3,
01-core-api §9 + §4.5, 04-website §5). typecheck clean, **75 tests** (added `manual-review.test.ts`;
updated the website no-coverage test). Design confirmed with Mariano: trigger = supported city +
zero times; persist auto on fail; AI-off via phone-match; new label blessed into the taxonomy.

**Website address-autocomplete fixed (2026-07-31).** The Dirección field (step 3) stopped
suggesting. Root cause: commit `c42f985` changed the Google Maps loader from eager to a lazy
per-step call that **raced the field render**, leaving `#direccion` unbound (no dropdown, no error,
no network call). Fixes (`website/app.js` + `styles.css`, working-tree): (1) load Maps at the
**product step (step 2)** — ready by step 3, off the landing-page first paint; (2) migrated the
deprecated legacy `places.Autocomplete` → new **`AutocompleteSuggestion`** API with our own dropdown
(keeps freeform typing); (3) restored the ~20 km city restriction via **`locationRestriction`**
(not `locationBias`). Google key verified valid (Places + Places New enabled) — never the problem.
Captured as a do-not-repeat note in `docs/04-website §8` + a `GOOGLE_MAPS_KEY` row in §9.

**Concurrency hardening + coverage-failure UX (2026-07-31).** Reviewed the app for concurrency
(many users hitting website + bot + WaterService + gmaps at once). Verdict: mostly safe by design
(single Node process + event-loop-serialized SQLite + per-lead queue + debounced gmaps). Real gaps
were all at the WaterService edge — fixed the two that matter (working-tree, `src/` + `website/`):
- **Single-flight login** (`waterservice/http.ts`): concurrent callers now await one `GetToken`
  instead of a token stampede that overwrites/401s. Cache the login *promise*, not just the token.
- **20s `AbortSignal.timeout`** on every WaterService `fetch` — an upstream hang had no ceiling and
  the website's coverage fetch has none of its own. (Bounds each fetch, not the whole `wsCall`.)
- **`POST /api/coverage` → 503 `coverage_unavailable`** on upstream failure (not a false `covered:false`).
- **Website coverage-check escalation** (`app.js` `day(attempt)`): LOADING → on 503/error, **attempt 1
  = retry only, no save**; retry-success → normal, no save; **attempt 2 fail = manual-review handoff**
  (WhatsApp + save, same branch as no-slot). Capture fires only when the WhatsApp button shows, so a
  recovered retry never leaves a phantom `revision_cobertura` lead. Full flow tree saved in `04-website §5`.
- **Canister loader** (`app.js` `canisterAnim()` + `styles.css`): spinning bidón, water waves **level**
  inside (clip rotates with the glass, water layer counter-rotates), proportioned from the botellon-12l
  photo, ~70% fill. Shown during the check and each retry.
- Not yet done: outbound concurrency cap / server rate-limit and the non-atomic `getOrCreateLead`
  (§concurrency review options 3 + 4) — low urgency at current scale, left as later hardening.
- Docs updated (`01-core-api §POST /api/coverage` + §13, `04-website §4/§5`). typecheck clean,
  **80 tests** (+`concurrency.test.ts`: single-flight + 503; +3 website retry-flow tests). Uncommitted.

## Last session (2026-07-19)

**Done:**
- Repo scaffold per `00-master §4.1`: `CLAUDE.md` map, rooms, `docs/` copied, git init.
- Kapso build guide + API docs read (§9 mandate) — findings under Decisions.
- Backend service complete in `src/`:
  - `config.ts` (full env table), `db/` (leads/orders/events/jobs/debt schema),
    `time.ts` (AR-tz helpers, `dd/MM/yyyy`, `/Date(ms)/` parsing).
  - `waterservice/` per-endpoint wrappers (#1,2,3,4,5,6,7,8,10,11,12,14,21,28) with
    zod coercion, token cache (`CURRENTTOKENVALUE`), body-`error` checks.
  - `providers/` PriceProvider (waterservice #10 matrix + sheet impl + daily
    consistency check) and GeocodingProvider (#12 default, Google Maps adapter → #4).
  - `copy.es-AR.ts` — every user-facing string, voseo.
  - `kapso/` webhook verify/normalize (HMAC, button/list/flow/media) + send API
    (text/buttons/lists/flow/template, Meta limits enforced).
  - `engine/` conversation orchestrator: per-lead queue, message-ID dedupe, hybrid
    input (deterministic city/product/day matching + AI fallback), stage rendering,
    coverage, handoff (both notify-operator AND tell-user-support), returning-lead
    resume.
  - `ai/` Anthropic SDK tool loop, cached system prompt, exactly the 5 canonical tools.
  - `pipeline/` confirm pipeline (#2 dedupe → #6 alta → #7 contact; #3 deferred) +
    day-before dispatch scheduler reading CURRENT order state; retry queue + operator
    alerts; orders-sheet append/update via jobs.
  - `engines/` follow-ups (1h/8h/23h, business-hours deferral, 24h-window guard,
    sin_respuesta, cycles cap) + debt reminders (#28 nightly sync, #21 re-check,
    suppression, cooldown).
  - `api/` Fastify: `GET /api/prices`, `POST /api/coverage`, `POST /api/orders`,
    `PATCH /api/orders/:id` (operator override), `GET /api/export/events` (CSV),
    webhooks (Kapso signed, Chatwoot token, Meta leadgen hub.challenge + signature),
    IG lead ingestion (Flow D) with utility-template greeting.
  - `crm/mirror.ts` Chatwoot mirror through the jobs queue (never blocks the flow).
- Tests (vitest, 32): time/tz, jobs queue (dedupe/retry/recovery), webhook
  normalize + signatures, follow-up engine, pipeline idempotency + outage replay +
  dispatch, conversation Flow A e2e (guided + free-text fast path, dedupe, media
  fallback, ai_enabled gate).

- Website (`docs/04-website.md`) complete in `website/`: static vanilla HTML/CSS/JS,
  mobile-first, competitor structure cloned (hero, dual CTA, on-page wizard, 3 steps,
  priceless product grid + WhatsApp CTAs, trust, coverage, testimonial placeholders,
  footer, floating WhatsApp widget); own `copy.es-AR.js`; wizard = Flow B
  (city → priced catalog → validated data form → live coverage/day picker → summary →
  confirm, double-click guarded, polite no-coverage paths); `privacy.html` (Meta lead-ads
  prerequisite), SEO meta/OG/JSON-LD LocalBusiness/sitemap/robots, GTM slot marked;
  `config.js` holds `API_BASE_URL` + `WHATSAPP_NUMBER_SALES`. Verified via jsdom tests
  (`src/test/website.test.ts`).

- Ops (`docs/03-crm.md` deploy side): `ops/chatwoot/docker-compose.yml` + `.env.example`
  + `WIRING.md` (inbox creation, labels/attributes with exact slugs, acceptance steps);
  `ops/DEPLOY.md` (backend systemd + reverse proxy, Hostinger upload, day-1 client
  tasks). Backend gap closed: inbound on a resolved/archived conversation reopens it
  (`pending`, or `open` when `derivado`) — `reopenIfArchived` in `src/crm/mirror.ts`.

**Next:**
- On deploy: paste the client's GTM container into `website/index.html`, set real
  `config.js` values, measure mobile Lighthouse (≥90 acceptance — site is lean vanilla,
  measure on the deployed URL).
- Observability leftovers (01 §10.2): daily summary toggle + cost-counter cron not
  built yet — needs client thresholds.
- When credentials arrive: create + publish the delivery-data WhatsApp Flow in Kapso
  (`KAPSO_DELIVERY_FLOW_ID`), submit Meta templates (`ig_lead_greeting`,
  `debt_reminder`, `web_order_confirmation`), point `WATERSERVICE_BASE_URL` at the
  real env and E2E the 10 validation addresses (01 §15 crit 3).

**Blocked / waiting on client:**
- Meta template approvals; Meta app review (`leads_retrieval` + `pages_show_list`).
- WaterService base URL + credentials; per-env IDs (`WS_*`) — phone call.
- `SUPPORT_NUMBER` real value (Lisandro). Kapso account + the two numbers.
- `PRICES_SOURCE` decision (waterservice vs sheet).

## Decisions made

- **Kapso mechanics verified (§9 mandate, 2026-07-18):** Meta Cloud API-compatible
  proxy `POST https://api.kapso.ai/meta/whatsapp/v24.0/{phone_number_id}/messages`,
  header `X-API-Key`; standard Meta payloads (text / interactive button/list /
  template / flow). Inbound: event `whatsapp.message.received` with `message.id/from/
  text.body/interactive`, `phone_number_id`. Signature: HMAC-SHA256 of raw body in
  `X-Webhook-Signature`. **"Kapso-hosted form" = WhatsApp Flow** published in Kapso,
  sent via `interactive.type:"flow"` + `flow_id`; response arrives as
  `interactive.nfm_reply.response_json`. Spec UX fits Kapso — no flow changes.
- Fastify chosen (spec allowed Fastify or Hono).
- `WHATSAPP_NUMBER_SALES/SUPPORT` hold Kapso `phone_number_id`s (send API needs them).
- Extra envs beyond the master table (documented here per §8 note): `KAPSO_BASE_URL`,
  `KAPSO_DELIVERY_FLOW_ID`, `WS_TIPO_LISTA_ID` (#10 matrix param, vendor item 12e),
  `META_VERIFY_TOKEN`/`META_APP_SECRET`/`META_PAGE_ACCESS_TOKEN` (Graph leadgen
  webhook mechanics), `IG_GREETING_TEMPLATE`, `GEOCODING_PROVIDER`, `PORT`, `DB_PATH`,
  `AI_MAX_TOKENS`, `AI_MAX_UNPRODUCTIVE_TURNS`.
- `getPricesForList` resolves from the #10 matrix (carries every list) instead of
  per-client #5 — #5 needs a `ClienteId`, not a list id; wrapper kept for later use.
- Free-text extraction of city/product/day is deterministic in the engine (string
  matching against catalog/options); the AI handles FAQs, glue and address capture
  via its 5 canonical tools — keeps prices/coverage fully out of the model.
- Debt reminders cover WaterService clients the bot knows a phone for (leads with
  `waterservice_client_id`) — #8 returns no phone, and the vendor webhooks PDF is
  still pending. Revisit if the client needs all-client coverage.
- Chatwoot webhooks are unsigned → shared-token check (`X-Chatwoot-Secret` header or
  `?token=`) using `CHATWOOT_WEBHOOK_SECRET`.
- Dynamic stage label `{stage}:{followup_count}` is computed (mirror/sheet), not
  stored in `labels`.

## Open questions

- `PRICES_SOURCE` (waterservice vs sheet) — client confirms; both impls built.
- Does frío/calor abono debt surface in #28/#21 balances? Vendor to confirm.
- Sales/support number-to-flow assignment — confirm with client before go-live.
- Delivery-data Flow field names assumed `nombre/apellido/calle/altura/entre_calles/
  notas` — align when the Flow is actually built in Kapso.

## Session (2026-07-23)

**Repo housekeeping — `documentation/` merged into `docs/`:** the old
`documentation/` folder (raw source material: PRD, WaterService manual,
transcript, commercial proposal, logo) was renamed to `docs/` and the
already-canonical `docs/00-04-*.md` were moved in on top, which nested a
stale duplicate at `docs/docs/`. Removed `docs/docs/` (byte-identical to the
top-level copies — confirmed via diff, safe delete). `docs/` now holds both
the canonical module specs and the raw source material in one place. Fixed
one stale path reference (`website/CONTEXT.md` pointed at
`documentation/logo-cimes.png`; corrected to `assets/logo-cimes.png`, sourced
from `docs/logo-cimes.png`). No other file referenced the old path.

**Kapso built-in inbox vs. self-hosted Chatwoot (decision — keep Chatwoot):**
Kapso has its own inbox (`docs/platform/inbox`) — a shared team view over
WhatsApp conversations (assignment, Active/Ended status, filters), not a
CRM. Per Kapso's own docs it has no labels/tags, no custom fields/
attributes, no per-conversation AI-toggle webhook, no lead panel — the exact
things `03-crm.md` and the `ai_enabled` contract (`00-master.md §5.2`)
depend on. Verdict: keep the self-hosted Chatwoot plan as specced. Revisit
only if the client explicitly wants to drop the labels/custom-attributes/
lead-panel scope to avoid running a second service — that's a scope change
needing a client conversation, not a silent swap.

**Where to run `kapso` CLI commands:** `kapso login` session state lives in
`~/.kapso/cli/` (home directory, machine-wide) and project selection
(`kapso projects use <id>`) is remembered by the CLI itself, not written into
a local project file. Doesn't matter which directory you run `kapso setup`/
`kapso login` from — nothing gets scaffolded into `cimes/`. Recommended: run
from `cimes/` (repo root) for consistency, since it configures project-wide
things (numbers, templates, webhooks), not backend-only code. After running
`kapso setup`, check `git status` in case a future CLI version starts
writing a local config file.

**Fixed:** `src/.env` existed but nothing loaded it (no `dotenv`, no
`--env-file`). Added `--env-file=.env` to the `dev`/`start` scripts
(`src/package.json`) — native Node 22 flag, no new dependency.

## Session (2026-07-23, cont.) — Kapso skills assessed + inbound-webhook bug fixed

Installed Kapso skills (`~/.agents/skills/`, agent-scoped not project files):
- **integrate-whatsapp** = the transport layer (setup links, webhooks, send
  messages/templates/media, WhatsApp Flows create/publish/data-endpoints). This
  is the half we use. Directly relevant scripts: `create-flow.js` +
  `publish-flow.js` (delivery-data Flow → `KAPSO_DELIVERY_FLOW_ID`),
  `create-template.mjs`/`submit-template.mjs` + `template-status.mjs` (the 3
  utility templates), `create.js` (webhooks), `list-platform-phone-numbers.mjs`
  (get phone_number_id + WABA).
- **automate-whatsapp** = builds the brain INSIDE Kapso (workflow graphs, agent
  nodes with a Kapso-side LLM, hosted Cloudflare functions, Project Events).
  Conflicts with our architecture (00 §3: Kapso = transport only, our backend is
  the brain, Claude via Anthropic SDK). Use only as a map of what NOT to build;
  the one useful pattern is `inbound_message` trigger → webhook node forwarding
  to our backend. Do not adopt agent/decide/function nodes.

**BUG FOUND + FIXED (was dead-on-arrival):** `kapso/webhook.ts` parsed inbound
against `message.from`, but Kapso's **payload_version v2** (authoritative:
`integrate-whatsapp/references/webhooks-event-types.md`) has no `message.from` —
the sender is `conversation.phone_number`. Every real inbound failed zod parse →
`normalizeInbound` returned null → the bot would never have replied to anyone.
The online docs page I originally built from showed the older/simplified shape.
Fix: schema now reads `conversation.phone_number` (keeps `message.from` as
fallback), gates on `message.kapso.direction === "inbound"` to drop
sent/delivered/failed echoes, drops the dead body `event_type` (event name is in
the `X-Webhook-Event` header), and pre-fills lead name from
`conversation.kapso.contact_name`. Added 2 regression tests (v2 shape + outbound
echo). Flow `nfm_reply` path left in but flagged unverified — confirm with
`send-test-flow.js` against a real flow-completion capture.

Outbound send (`kapso/send.ts`) verified correct against the reference: base URL,
`X-API-Key`, `/{phone_number_id}/messages`, and all body shapes
(text/buttons/list/flow/template) match. Both signature schemes (Kapso
`X-Webhook-Signature` raw-body HMAC; Meta `sha256=`) correct.

## Session (2026-07-29) — website Maps-autocomplete bug fixed

**BUG FOUND + FIXED:** step-3 address autocomplete (`04-website.md` §3) never
worked on either page. Three compounding causes: (1) the real Maps key was
added to `src/.env` (`GOOGLE_MAPS_API_KEY`, backend-only, used for server-side
Geocoding) — the static website has no build step and can never read that
file; (2) the site's actual hook was a hardcoded placeholder literal inline in
`website/alta/index.html`'s `<head>`, never edited to a real value; (3) even
once edited, it would only have worked on `/alta` — `website/index.html` has
its own copy of the wizard (`#wizard-root`) but never had a Maps-loader block
at all, so the homepage's inline wizard was always going to be silently
plain-text (`attachPlaces()` no-ops when `window.google.maps.places` is
absent, by design — fails quiet, not loud).

Fix: moved the loader out of the per-page inline `<script>` (where it had
already drifted once) into `app.js` (already the single shared script across
both pages), reading a new `GOOGLE_MAPS_KEY` from `config.js` — same
placeholder-until-configured convention as `API_BASE_URL`/
`WHATSAPP_NUMBER_SALES`. Deploy step is now: set `GOOGLE_MAPS_KEY` in
`config.js` to a **browser** key (Maps JavaScript API + Places, HTTP-referrer-
restricted to the domain) — must NOT be the backend's server-side
`GOOGLE_MAPS_API_KEY`, which is unrestricted server-side and would be
publicly exposed if reused here.

**Config hygiene:** `website/config.js` was tracked in git (placeholders only,
so far) with no guard against someone hand-editing it with real deploy values
and committing that by habit — unlike `src/.env`, which `.gitignore` already
excludes. Mirrored the backend's `.env`/`.env.example` split: renamed the
tracked file to `website/config.example.js` (template, placeholders, stays in
git), added `website/config.js` to `.gitignore`, and left a local
(untracked) `website/config.js` in place with the same placeholder content so
the site keeps running as-is until real values are filled. `ops/DEPLOY.md`
step 2.1 updated to the copy-then-fill instruction. Both `index.html` and
`alta/index.html` still just `<script src="config.js">` — unchanged, no
build step added.

## Session (2026-07-29, cont.) — end-to-end HTTPS: DEPLOY.md + backend loopback bind

Follow-up to the Maps-key debugging: generalized to "every connection HTTPS"
since the backend VPS will be internet-exposed too.

**`ops/DEPLOY.md` rewritten with a concrete TLS recipe** (was a one-line
"reverse proxy with TLS in front" with no detail): Caddy chosen over
nginx+certbot (automatic cert issue/renewal/HTTP→HTTPS-redirect in one
Caddyfile, matches this project's low-infra bias elsewhere — SQLite over
Postgres, jobs-table over Redis). Recipe covers DNS prerequisite (Let's
Encrypt can't cert a bare IP), `ufw` (80/443 only), a Caddyfile proxying to
the backend (`127.0.0.1:3000`) and Chatwoot (`127.0.0.1:3001`, already
correctly loopback-bound in its compose) off the same instance. Website
section gained the matching step: Hostinger hPanel AutoSSL + Force-HTTPS.
Framed as a functional requirement, not just hardening — Kapso and Meta both
reject self-signed webhook endpoints.

**BUG FOUND + FIXED:** `src/src/index.ts:109` bound Fastify to `host:
"0.0.0.0"` (all interfaces) — contradicted the loopback-only architecture the
DEPLOY.md rewrite above now documents as fact. As shipped, port 3000 would
have been directly reachable over plain HTTP from the public internet
regardless of Caddy, with `ufw` as the only actual barrier. Fixed to
`"127.0.0.1"`. Hardcoded, not a new `HOST` env var — this backend's only
deployed shape is "behind Caddy on the same box," so a configurable host
would be unused flexibility (would've also needed a `config.ts` schema entry
+ `.env.example` line + a `docs/00-master.md §8` table update, per that
file's own documentation convention, for no real benefit). Confirmed via
`src/test/` that nothing starts the real server, so nothing to break;
`npm run typecheck` + `npm test` (72 passed) both clean after the change.

**Still manual/pending actual VPS:** DNS record, `ufw` rules, Caddy install +
Caddyfile, domain names for `<backend-domain>`/`<chatwoot-domain>` — all
spec'd in `ops/DEPLOY.md`, blocked on the client's infra per the existing
"Blocked / waiting on client" list.

## Session (2026-07-31) — WhatsApp address confirm via map pin

Closed the WhatsApp-vs-web gap on address entry. Diagnosis first (Kapso skill loaded):
day/time was **already** dynamic per address on WhatsApp (shared `runCoverageForLead`
→ #12 → `delivery_options`), just rendered as a post-Flow interactive message — no gap
there. Real gap was address confirmation: web has Google Places typeahead, WhatsApp had
a static Flow form and no location confirmation. Live typeahead is impossible in a
WhatsApp Flow (no on-change on `TextInput`); chose the native **location message**
(`type:location`, WhatsApp renders the map thumbnail from lat/lng we already get from
#12) + Sí/No buttons instead. All native interactive messages — **no dynamic Flow, no
data endpoint, no Kapso Function, no Flows encryption**; backend stays the brain.

New flow (between `datos_entrega` and `dia_entrega`): geocode → send pin + "¿es correcta?"
→ **Sí** → coverage gate (`delivery_options>0` → `dia_entrega`; else manual-review handoff)
→ **No** → free re-entry (full address, Prov. Bs As) → 2nd pin → **Sí** gate / **2nd No or
no-coords** → stop + `enterManualReview` (web parity, AI off, operator pinged). Handoff
copy: "Permitime un momento mientras verifico la cobertura en tu área, ¡gracias!".

Changes: new stage `confirmar_ubicacion` + `location_attempts` column (additive migration);
`sendLocation` in `kapso/send.ts`; `enterLocationConfirm`/`sendLocationConfirm`/
`handleLocationRejected`/`locationConfirmed` in `engine/conversation.ts`; `loc:yes|no`
button routing + re-entry text trigger; 5 es-AR copy strings + a followup key.
typecheck clean, **82 tests** (map-confirm happy step, reject→re-entry→handoff, and
free-typed-address→pin). `flow-delivery-data.json` unchanged (stays a static form).

**Caveats / follow-ups:**
- `type:location` send **verified against the live Kapso API contract** (2026-07-31):
  `sendMessage` OpenAPI lists `location` as supported; `LocationMessage` schema =
  `{latitude, longitude, name?, address?}`, matching `send.ts`. Optional belt-and-suspenders:
  one live smoke send (needs a recipient with an open 24h window).
- Map-confirm now covers **both** address paths: the Flow form **and** free-typed text.
  A text message arriving at `datos_entrega` is captured deterministically as the address
  and routed through the pin flow (no AI in the alta spine). Tradeoff: FAQ/AI answering is
  skipped at `datos_entrega` — a message there is treated as the address (geocode-fails →
  re-entry prompt nudges the user).
- `runCoverageForLead` still applies `mal_lead` + operator alert on a no-neighbors first
  attempt even if the address was just wrong (pre-existing behavior); minor label noise.

## 2026-07-31 — WhatsApp "Otra ciudad" waitlist (AI-driven capture)

Out-of-coverage path on WhatsApp now captures the zone with the AI kept **on**, so it can
answer questions while getting the city — closer to how a person would handle it, and it
also lands a waitlist row in the orders sheet like the website's `POST /api/waitlist`.
Before, tapping **"Otra"** stored the city literally as `"otra"` (zone lost) and dead-ended.

New flow:
- Tap **"Otra"** → branch stage `esperando_zona`, label **`otra_ciudad`** immediately
  (it's a terminal label → follow-ups suppressed from here on), reply `zonePrompt`
  ("Ok! ¿En qué ciudad recibirías el pedido?"), **AI stays on** (`ai_enabled` untouched).
- Free text while `esperando_zona` is routed **straight to the AI** (deterministic
  city/product matching skipped on purpose), with `catalog=null` (no prices for an
  uncovered area).
- The AI follows a new system-prompt rule: **city** → call `registrar_zona(zona)` then
  thank + "no llegamos ahí todavía, te contactamos cuando lleguemos" close; **question
  only** → answer + re-ask the city, stay in state; **city + question** → answer the
  question and do the close in the same turn.
- `registrar_zona(zona)` (new **6th AI tool**) stores the zone as `city`, keeps
  `otra_ciudad`, **queues the waitlist sheet row** (`sheet_append_order`, `order_id:null`,
  dedupe `sheet_waitlist:<lead>`), and sets **`ai_enabled=false`**. Next inbound → mirror
  only; flow ends.

Contract change: the canonical AI-tool set went from 5 → **6** (`registrar_zona` added).
Updated `00-master.md §5.5` and `02-chatbot.md` tool table to match — it's the WhatsApp
analog of `POST /api/waitlist`, existing only because the WhatsApp path keeps the AI on
during capture (the web form doesn't).

Changes: `esperando_zona` in the `Stage` union (branch off `inicio`, **not** in linear
`STAGES` — no DB constraint, `stageIndex/nextStage` unused at runtime); `zonePrompt` copy;
tap-Otra button case (tag + ask, AI on); `esperando_zona` free-text → `runAiTurn`;
`registrar_zona` tool def + handler (`ai/tools.js`); system-prompt waitlist section
(`ai/prompt.ts`). `setCity`'s uncovered branch is now unreachable (matchCity/list ids are
always covered) but left as a defensive net. typecheck clean, **84 tests** (tap-Otra →
otra_ciudad + AI-on + no follow-ups; `esperando_zona` routes to AI; `registrar_zona`
records zone + queues row + AI off). AI turns are mocked in `conversation.test.ts`.

**Notes / caveats:**
- No `mal_lead` on this path — earlier plan dropped per Mariano; `otra_ciudad` alone is
  terminal, which already suppresses follow-ups.
- `comment` and `name` (web form fields) still not collected on WhatsApp — out of scope.
- Capturing the city depends on the model calling `registrar_zona` correctly; the tool +
  routing are unit-tested, but the model's decision (city vs question vs both) isn't
  covered by tests (no live API in CI). Watch it in early real traffic.

## 2026-08-03 — "Otra ciudad" reworked: any BA city, coverage by WaterService (supersedes 2026-07-31)

**Business-logic change:** the shortcut-city list is no longer a coverage gate — it's just
quick-pick buttons/links. **Any Buenos Aires city is served**; coverage is decided solely by
WaterService neighbours at the address step (confirmed with Mariano — WaterService resolves
any city). So the whole **waitlist dead-end is discarded**: "Otra ciudad" now lets the user
type any city, which is snapped to the closest real BA city, and they **continue the normal
order flow exactly like a shortcut-city click**. Genuinely-uncovered addresses are caught
downstream by the existing no-coverage handling (web → `revision_cobertura` manual review;
backend `/api/orders` → `mal_lead` + 422). Website first, then WhatsApp — both done.

Removed: `POST /api/waitlist` + `src/api/waitlist.ts`; the `registrar_zona` AI tool (canonical
set back to **5**); the `esperando_zona` stage; the `otra_ciudad` label; `isCoveredCity`;
website waitlist form + `?waitlist=1`; `coverageNegative` copy. The `isCoveredCity` gates on
`POST /api/orders` and `POST /api/manual-review` are gone (coverage is the only gate).

Added (single source of truth, `src/src/engine/cities.ts`): `BA_CITIES` (~130 canonical names)
+ `matchCity()` — normalize + hand-rolled Levenshtein nearest, snaps typos ("lujann" → "Luján"),
keeps unrecognizable input rather than force a bad match. Endpoints: **`GET /api/cities`** (list
for the website autocomplete) and **`POST /api/resolve-city {text}` → `{city, matched, score}`**
(snap on submit). The WhatsApp engine calls `matchCity` directly; the free-text fast path now
snaps against the full BA list. Website: shortcut links + an inline free-text entry (native
`<datalist>` autocomplete + snap on Enter/Continue → `/alta/?city=<slug>`); boot resolves a
non-shortcut slug via `/api/resolve-city`.

**Pricing (now):** deterministic by city — **`PRICE_LIST_DEFAULT_ID`** (LISTA PRECIOS GENERAL)
for everyone, `CITY_PRICE_LIST_MAP` for per-city exceptions (Lobos → PRECIO LOBOS). `resolveCityListId`
no longer throws; product step + `/api/orders` price by this rule, **not** the neighbour-derived
list (so shown == charged). Set `PRICE_LIST_DEFAULT_ID` + `CITY_PRICE_LIST_MAP={"lobos":"<id>"}`
in `.env` with the real WS `lista_id`s. ~~**Deferred:** `PRECIO CAMPANA ESPECIAL` (frío/calor) +
the new "add a frío-calor dispenser" step between city and product — separate plan.~~ **Both done
2026-08-04, see below.**

typecheck clean, **82 tests** (added `cities.test.ts`; updated conversation/website; removed the
waitlist/registrar_zona/esperando_zona tests). Shortcut cities stay 8 (incl. Escobar). Docs
00/01/02/04 updated to match. **Chatwoot (user-managed):** drop `otra_ciudad` from the label set
(`ops/chatwoot/WIRING.md`).

## 2026-08-03 — "Otra ciudad": second thought on unknown cities (website)

Follow-up to the rework above. The unknown-city path was still broken: `snap()` redirected on
any resolve result (ignoring `matched`), but boot's `resolveCityFromSlug` honored `matched` and
returned null for an unknown slug — so a real non-place (e.g. `monte chico`) redirected to
`/alta/?city=monte-chico` and then **bounced back to the picker**. Fixed by making the list
advisory at the UI too, and giving the user a **second thought** instead of a dead end:

- **`matchCity` now returns `suggestions`** (`engine/cities.ts`) — the **1–3 closest** real BA cities
  (the winner plus any near-equal within `SUGGESTION_BAND`, so "montecito" surfaces both Monte Hermoso
  and Monte Grande), set in **every** branch (a single `[city]` on a match, `[]` only for empty input);
  the closest was computed then discarded below the floor before. `POST /api/resolve-city` returns them
  verbatim (no handler change); the dev stub inherits them.
- **Website `snap()` branches on `matched`** (`website/app.js`): recognized → redirect to the
  canonical city (unchanged); unrecognized → **no redirect**, an inline second thought — one line
  ("No encontramos «…». ¿Quisiste decir…?") then the 1–3 closest cities as `.city-option` links + a
  "Continuar igual con «<typed>»" link — take a suggestion, or proceed with the typed text **as-is**.
  Coverage still decides; a non-place fails at step 4 → `revision_cobertura` (saved for the future).
  The "Otra ciudad" **Continuar is disabled until a city is typed, and stays disabled after a submit**
  (no re-click on the same text; editing the field re-enables it).
- **Boot stops bouncing** unknown slugs: `resolveCityFromSlug` returns `deslug(slug)` on a
  `matched:false` answer, so a direct `/alta/?city=<unknown>` proceeds into the wizard.
- Copy: `cityStep.notInList/didYouMean/proceedAnyway` (`copy.es-AR.js`).

typecheck clean, **90 tests** (cities: `suggestions` incl. the `monte chico` / `montecito`
regressions; website: unknown-city second thought with 1–3 options, unknown-slug proceeds,
Continuar disabled until typed + stays disabled after submit, matched → no nudge). Docs 01/04 updated.

**Scope:** website only — WhatsApp mirror deferred. **Known gap (pre-existing):** a typed unknown
city that *passes* coverage reaches dispatch with `centroDistribucionId: 0` (unmapped
`WS_CENTRO_DISTRIBUCION_MAP`, `pipeline/dispatch.ts`) — rare; separate follow-up.

**Website monolith split (2026-08-03).** `website/app.js` (1263 lines) → 10 `js/*.js` files,
**no behavior change**. Classic scripts (no build — buildless static on Hostinger), each an IIFE
attaching to one shared `window.CIMES_APP` namespace, loaded via ordered `<script>` tags; `/alta`
omits `js/home.js`. Files: `util`, `tracking`, `chrome` (shared page chrome, both pages),
`home` (index-only marketing), `phone`, `places`, `cities` (slug/list/resolve + "Otra ciudad"
combobox + did-you-mean), `wizard` (state/persistence/render helpers), `steps`, `main` (boot). Chose
classic-namespace over ES modules to keep the jsdom+eval test harness + zero tooling (rationale in
the plan). `app.js` **deleted** — the per-file map is in `website/CONTEXT.md`. Test harness evals the
ordered list (`website.test.ts`). typecheck clean, **90 tests** (unchanged; pure reorg). Earlier
PROGRESS entries that say `app.js` are historical — the wizard now lives in `website/js/`.

**Product catalog reworked to 9 fixed SKUs (2026-08-03).** The client closed the product question
(`docs/preguntas_licha.md §5`): CIMES sells exactly 9 SKUs, the **same in every zone**, no matter
what a WaterService price list contains. Before this, `providers/prices.ts` projected *every* priced
article into the catalog, so dispensers/abonos/`Sanitizacion de Dispenser` leaked into the WhatsApp
list and the wizard; separately the AI prompt and the home grid each hardcoded their own divergent
list.

New **`src/src/catalog/skus.ts`** is the single source of truth: display name, WaterService matching
(pinned `articulo_id` first, prefix-tolerant name regex as fallback — CIMES names articles
`"10002  -  BOTELLON 20L"`), free-text aliases, sales order (Botellón 20L first — best margin),
`clientType`. `applyCatalog()` iterates SKUS (not the raw list), which yields the ordering, the
dedupe, the implicit drop of everything else in one pass; `missingSkus()` feeds the alert. Both
providers (WS `#10` and sheet) call it, so the two paths can't drift. A price list is now a source of
**prices only**.

Derived, no longer hardcoded: `ai/prompt.ts` catalog line, `engine/conversation.ts` `matchProduct`
aliases (added the missing gaseosa / agua 2L / isotónica / bajo-sodio cases, dropped dispenser),
`sheets/orders.ts` `clientTypeOf` (keyword fallback kept for legacy rows + the free-text
`confirm_order` path — the only remaining producer of `frio_calor`), and `website/js/wizard.js`
`productImage` (regex chain → display-name map). `dev/stub-backend.ts` now feeds raw WS-shaped rows
through the real filter. `normalizeText` extracted to `src/src/text.ts`.

**Missing-SKU alert:** hidden, not fatal — so `checkCatalogCompleteness()` runs ungated in the daily
`prices_sheet_check` job and pings the operator (`copy.operatorMissingSkusAlert`). A list with prices
but zero catalog SKUs still throws.

**`npm run dump:prices`** (`src/scripts/dump-price-matrix.ts`) — read-only `#10` dump. Run it to (a)
pin the 9 `articulo_id`s (all currently `wsId: null`, i.e. regex path) and (b) identify which
`lista_id` is `LISTA PRECIOS GENERAL` / `PRECIO LOBOS` / `PRECIO CAMPANA ESPECIAL`.

typecheck clean, **115 tests** (new `catalog-skus.test.ts`: prefix tolerance, the NA-vs-plain guard,
AGUA 2L not swallowing AGUA SABORIZADA, non-SKU drops, sales order, pinned-id precedence, alias
table, `missingSkus`; plus a website test asserting all 9 SKUs resolve to a real photo file).

**Open / not done:**
- **1 test red on purpose:** `website.test.ts > every catalog SKU has a product photo` — waiting on
  `website/assets/products/botellon-20l-ms.webp` and `isotonica.webp` (Mariano is adding them). Green
  the moment both files land; no code change needed.
- **`PRICE_LIST_DEFAULT_ID` still absent from `src/.env`** while `CITY_PRICE_LIST_MAP` covers only 7
  cities → `resolveCityListId` throws for Lobos/Escobar and dead-ends the wizard. Set it to the
  GENERAL list id once `dump:prices` reveals it.
- SKU `wsId`s not yet pinned (regex path is fully functional meanwhile).
- Home marketing grid (`website/copy.es-AR.js`, 7 merged cards) deliberately **out of scope** — still
  its own hardcoded list.

## 2026-08-04 — Dispenser step (frío/calor comodato) + WaterService-only prices cached in SQLite

Two pieces that turned out to be one: offering the abono meant reading a third price
list and #11, which would have deepened the site's dependence on WaterService uptime —
so the prices moved into SQLite first.

**Part A — prices.** WaterService is now the only source: `SheetPriceProvider`,
`checkSheetConsistency`, `PRICES_SOURCE` and `PRICES_SHEET_ID` are gone
(`00-master §10a` closed). `GOOGLE_SERVICE_ACCOUNT_JSON` stays — the orders *mirror*
sheet (`sheets/orders.ts`) is a different sheet and untouched. New `ws_price_cache`
table + `db/prices-cache.ts`; `WaterServicePriceProvider` reads it (the in-memory
`MATRIX_TTL_MS` cache is deleted — the DB is the cache). The daily
`prices_sheet_check` job became **`prices_refresh`**: pulls #10 + #11, upserts every
configured list and abono, alerts on failure and on rows older than 48h. **A failed
refresh never deletes** and stale rows are always served — a quote we can't produce is
a lead we never save. The only live call left on the read path is a cache *miss*
(cold DB, or a list id the cron hasn't seen), which fetches once and writes through.

**Part B — the step.** Wizard is **6 steps**: ciudad → **dispenser** → productos →
datos → envío → resumen. Step 2 carries two decisions (dispenser + común/bajo sodio,
defaulting to común) because they're one decision to the visitor and together they pick
the price list, the catalog and the abono. It also owns the `/api/prices` call, moved
one step earlier. `Siguiente` stays **enabled** and prompts when nothing is chosen —
a dead button doesn't say what's missing.

- **List rule:** `resolveCityListId(city, {frioCalor})`. PRECIO CAMPANA ESPECIAL
  (Zárate/Campana/Escobar) applies **only** to a comodato customer; the same city
  buying loose bottles still gets GENERAL. Lobos keeps PRECIO LOBOS either way.
- **No price lives in this repo.** `FRIO_CALOR_CITY_PRICE_LIST_MAP` and
  `FRIO_CALOR_ABONO_MAP` hold **ids**; amounts come from #11 (GENERAL 1/7, CAMPANA
  11/12, LOBOS 13/17) through the cache. `getAbono` returns null rather than guessing,
  and the site then hides the frío/calor card instead of quoting a number.
- **Cart math** (`resolveCartLines`, mirrored client-side): first 4×20L of the chosen
  water bill at 0, 5th onward at that list's normal 20L price — the excedente is not a
  stored number. Abono rides as a synthetic half-price line that bypasses the catalog
  lookup; its `ABONO_LINE_MARKER` is what makes the row `client_type=frio_calor`
  downstream (a frío/calor order always carries botellones, so the SKU scan alone read
  it as `bidon`). An abono with empty `items` is a valid order.
- **Step 3 under frío/calor** prefills the included botellón to **4** (they're already
  paying for those) and the card says the listed price applies from the 5th. Summary
  splits `Subtotal productos` from the abono line before `Total a pagar en la entrega`.
- Water choice filters the catalog: Natural → 20L+12L of that water; Frío/Calor → only
  that water's 20L; Sin dispenser → everything. Non-bottle SKUs always shown.

typecheck clean, **140 tests** (new `prices-cache.test.ts`, `frio-calor-pricing.test.ts`,
frío/calor cases in `orders-cart.test.ts`, 7 new website cases; `bootToProduct` now
passes through step 2 with "Sin dispenser" so the pre-existing walks are unchanged).
Docs 00/01/04 + the BC doc's abono section updated.

**Open / not done:**
- **Visit frequency deliberately not addressed** (weekly / 15 days / monthly). Client
  decision, not a UI one: putting it on the signup page nudges customers off the weekly
  visit CIMES uses to collect payment and check the equipment. Nothing on the site
  mentions cadence.
- **WhatsApp bot doesn't know about abonos yet** — `02-chatbot.md`'s prompt/tools still
  have no frío/calor pricing. Separate task.
- Natural's "mínimo 1 botellón por mes" is still unstated on the site (decided out of
  scope this session).

## 2026-08-04 (cont.) — real price-list ids wired; especial list is an overlay

`--real` QA hit `500 No price list configured` on Lobos: `src/.env` still had the
pre-rework price block (no `PRICE_LIST_DEFAULT_ID`, no frío/calor vars, a stale
`PRICES_SOURCE`, and `campana → 10` pointing at "PRECIO CAMPANA", which we ignore).
Discovered the live ids with `npm run dump:prices` and #11: **6** GENERAL,
**9** LOBOS, **11** CAMPANA ESPECIAL; abonos 1/7 · 11/12 · 13/17 exactly as the client
listed. `src/.env` + `.env.example` now carry those. Escobar is `"belén de escobar"` in
`engine/cities.ts`, so the frío/calor map keys that spelling (bare `"escobar"` kept as
an alias for hand-typed input) — a missed key silently sells the comodato at GENERAL.

Two things the live matrix revealed:

- **PRECIO CAMPANA ESPECIAL prices only the two 20L botellones.** Served as a catalog it
  gave a Campana frío/calor customer a two-product step. `getCatalog` now **merges**:
  city list supplies the catalog, especial overrides what it prices. Verified live —
  Campana + frío/calor → 20L $9.500 / 20L NA $10.000 with 12L and descartables at
  GENERAL, `price_list` still `11`.
- **Cold-DB abonos.** Price lists self-heal on the first `/api/prices` miss, but
  `getAbono` has no read-path fetch, so a fresh deploy would hide the frío/calor card
  until 6am. `index.ts` now enqueues `prices_refresh` immediately when
  `ws_price_cache` is empty.

Also fixed the dispenser badges: the cards reused the hero `.badge` (white on
translucent, for a dark photo) so GRATIS / 50% OFF were invisible on white. Added
light-surface `.badge-free` / `.badge-promo` and dropped the empty icon slot.

143 tests, typecheck clean. Live-verified: Lobos → list 9 (abono $32.000/$33.200),
Campana + frío/calor → 11 ($38.000/$40.000), Campana without dispenser → 6, Mercedes → 6.

**Lobos gap resolved (client rule):** the 9 SKUs sell everywhere, and a SKU the
resolved list doesn't price takes the GENERAL price. Three lists, no more: GENERAL is
the fallback, PRECIO LOBOS and PRECIO CAMPANA ESPECIAL override what they price. Live:
Lobos now returns all 9 (own prices for the four botellones + soda, GENERAL for the
descartables); Campana + frío/calor returns 9 with especial 20L. Gap check narrowed to
match: only GENERAL must be complete, partial zone lists are the expected shape.
Both #10 and #11 land in `ws_price_cache` (verified: rows for lists 6/9/11 and abonos
1/7/11/12/13/17), and the boot refresh now fires when any configured abono id is
missing — not just on an empty cache, which is why a newly added id stayed hidden.

Copy can bold now: `**así**` in `copy.es-AR.js` renders through `App.rich()`
(`js/util.js` — escapes first, so the markers are the only markup a copy edit can
introduce), styled once as `strong` (brand blue, bold). Used for the abono's
first-month price and "otros productos". The frío/calor price moved into
`frioCalor.body` as its first bullet (the product step quotes that same line), and the
card's fine print sits above the photo now.
Mobile (≤720px) turns the dispenser photo into a watermark behind the card — 11%
opacity, desaturated, masked to fade out towards the text — so the water toggle gets
the full row. Replaces the old ≤380px rule that just hid the photo.

Phone mask is data-driven now (`website/js/phone.js`): the area/local split comes from
`coverage.areaCodes`, longest match first, with the local part filling out the 10
national digits — 4-digit (2323), 3-digit (348 Escobar, 230 Pilar, 220 Las Heras) and
Buenos Aires' 2-digit 11 all group and save correctly, with or without a typed trunk 0.
Adding a city to `areaCodes` needs no change in phone.js. Verified every code in the
list round-trips to the right E.164.

## 2026-08-04 (cont.) — city merged into the data step; the lead is saved there

The wizard was `city(1) → dispenser → product → data(4) → day(5, coverage) → summary(6)`,
which had two costs: the visitor didn't see which city they were being quoted for until
four screens in, and **nothing about them reached the backend until the coverage call** —
every drop-out before that was lost outright.

City is no longer a numbered step. It stays where it was (home page + bare `/alta/`), but
it's a router: picking one navigates to `/alta/?city=<slug>`, which now lands directly on
the **data form as step 1 of 5**. New order: `Datos(1) → Dispenser(2) → Productos(3) →
Envío(4, coverage) → Resumen(5)`. The city rides above the form as a header row —
`Ciudad: Mercedes` on the left, **Cambiar** on the right in brand red. Cambiar is a real `<a href>` to
`/alta/` (UTMs carried), not a `data-back` re-render: `?city=` is still in the URL, so
rendering the picker in place would be undone by the next reload.

**Coverage did not move** — still fires on entering Envío, after Productos. Deliberate:
keeping it there left `day()`, the retry escalation and the manual-review handoff
completely untouched, and the handoff still has a cart to report.

**New `POST /api/leads`** (`src/src/api/leads.ts`, modelled on `recordManualReviewLead`
minus the sheet row and the handoff). Submitting step 1 fire-and-forgets name / phone /
city / composed address / cross streets / attribution. It creates or updates the lead by
phone and sets `stage: "datos_entrega"` — and **nothing else**: no sheet row, no Chatwoot
mirror, no WaterService call, no follow-up timers (`scheduleFollowups` only ever runs off
an inbound WhatsApp message). A half-filled web form must not page anyone. Stage is set
explicitly because `stageFromKnownData` assumes product-before-address and would call an
address-but-no-cart lead `producto`.

Changing city keeps `state.data` and drops dispenser/cart/option — name and phone don't
change with the city, everything after them is priced or routed per city. `startWizard`'s
resume router was rewritten for the new order and now reads sessionStorage even on a city
mismatch (it used to throw the whole thing away).

**Worth knowing:** `/api/leads` is unauthenticated and unthrottled, like every other
`/api/*` route (no CORS or rate-limit plugin anywhere). Not a new class of exposure —
`/api/manual-review` already had it — but it now sits one step into the funnel instead of
five, so it will be hit far more. A limiter was left out of scope; say the word.

Also collapsed the seven-field UTM block that was copy-pasted across three route schemas
into `attributionFields` + `pickAttribution` in `server.ts`.

Google Maps needed no work: `loadGoogleMaps()` already calls `attachPlaces()` from its own
`onload` and `attachPlaces` is idempotent per input, so the field binds a moment after
first paint and is a plain typeable input until then. `04-website §8`'s "load Maps at the
product step" rule was rewritten to say what actually prevents the regression (bind from
the loader callback), since there's no earlier step to preload from now.

**155 tests, typecheck clean** (+`test/leads.test.ts`; `website.test.ts` helpers reworked —
`bootToData`/`continueToDay`, and its fetch stub now records at call time rather than on
`json()`, since a fire-and-forget POST never reads its body). Docs updated: `00-master §5.6`,
`01-core-api §9`, `04-website §3/§4/§8`.

**Not verified live.** Everything above is jsdom + `:memory:` SQLite. Still to do:
`./dev.sh` click-through, then a `--real` run confirming an abandoned step 1 leaves one
`leads` row at `datos_entrega` with no `orders`/`jobs` row, and that finishing later
reuses the same `lead_id` instead of making a second lead.

**Catalog-gap alert now tested (2026-08-05).** `checkCatalogCompleteness` had no coverage since the
`prices_sheet_check` → `prices_refresh` move narrowed it to GENERAL only. Three cases added to
`test/frio-calor-pricing.test.ts` (same env-reimport harness, real `WaterServicePriceProvider` over an
in-memory cache, no WaterService mock): GENERAL complete → silent even with 1-SKU zone lists; GENERAL
short two SKUs → one gap naming them, zone lists absent from it; a zone list holding only non-catalog
rows → `no se pudo resolver` (it throws through `applyCatalog`, and the GENERAL-only guard sits after
the resolve, so unresolvable zone lists still alert). Expected names come from `SKUS` rather than
literals, so a display-name edit can't leave the assertions stale.

typecheck clean, **163 tests**. Supersedes the two open items in the 9-SKU entry above: the product
photos landed (`botellon-20l-ms.webp`, `isotonica.webp`), so `website.test.ts > every catalog SKU has
a product photo` is green.
