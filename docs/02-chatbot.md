# 02 — CHATBOT: WhatsApp layer, es-AR copy, AI

**Status:** build spec for implementation. Read `00-master.md` first (architecture, contracts, guardrails, full env table). This doc owns the **WhatsApp transport layer** (Kapso webhooks + send API, buttons/lists/forms), the **signup-stage WhatsApp mechanics**, the **es-AR copy module**, and the **AI** (tools + system prompt).

Business logic — stage state machine, follow-up timers, WaterService writes, order pipeline, coverage/price resolution — lives in `01-core-api.md`. This doc references it and stays on the WhatsApp/AI side. When this doc says "the engine advances the stage" or "the pipeline writes to WaterService," that behavior is specified in `01-core-api.md`; here we specify only what the user sees and how messages are sent/received.

**Workspace:** this layer lives in `src/` alongside `01-core-api.md` (one service); `copy.es-AR.ts` lives there too. Keep the `src/CONTEXT.md` room current and log every session in `PROGRESS.md` — scaffold rules in `00-master.md §4.1`.

---

## ⚠️ READ THIS BEFORE WRITING ANY WHATSAPP CODE (decision 5)

> **The WhatsApp flow described in this document — 5 signup stages, hybrid input (buttons/lists for city/product/day, a Kapso-hosted form for delivery data, and free text always accepted) — is the INTENDED UX. It is NOT a spec verified against Kapso's real API or capabilities.**
>
> Before finalizing the exact WhatsApp mechanics (which parts use Kapso's form/Flow builder vs. quick-reply buttons vs. interactive lists vs. free text, and the exact request/response shapes of Kapso's webhooks and send API), the implementer **MUST first read Kapso's own build guide:**
>
> ### 👉 https://docs.kapso.ai/docs/build-with-ai
>
> Confirm that the flow described here matches what Kapso actually supports **before writing code.** **Do NOT guess Kapso's API shapes.** If the guide says the mechanics must differ (e.g. Kapso wants a different primitive for a step, or its form builder works differently than assumed here), the guide wins — adjust the flow and note the deviation. This same note is referenced from `00-master.md` (§9). (The operator inbox is settled separately — self-hosted Chatwoot, `03-crm.md` — so this guide governs WhatsApp mechanics only.)
>
> **What is fixed and must NOT change:** the 5 stages and their order, the hybrid principle (guided path + free text always accepted), the AI tool names, the es-AR copy living in a dedicated module, and the contracts in `00-master.md` §5. **What the guide may refine:** which Kapso/Meta primitive implements each step, and the exact API payloads.

---

## 1. What this module owns

- **Kapso integration**: inbound webhook handling, outbound send API, the two WhatsApp numbers.
- **WhatsApp interactive primitives**: quick-reply buttons, interactive lists, and Kapso-hosted forms — and when each is used.
- **The 5 signup stages mapped to WhatsApp mechanics** (which primitive each stage uses, plus the free-text fast path).
- **WhatsApp mechanics of the conversation flows** (Flow A inbound lead, Flow D Instagram lead continuation, Flow C existing-client support).
- **Follow-up SEND side** (the copy and the send call; timers live in `01-core-api.md`).
- **Handoff message** (user-facing copy telling the user to write to the support number).
- **The es-AR copy module** (`copy.es-AR.ts`) — the canonical home of every user-facing string; other modules import from it.
- **The AI**: model config, prompt caching, system-prompt contents, tool definitions, message behavior, hard limits.

It does **NOT** own: the stage state machine, follow-up timer scheduling, WaterService/Sheets writes, PriceProvider/GeocodingProvider, the REST endpoints, or the event log. Those are `01-core-api.md`.

---

## 2. Kapso integration

- **Plan:** Kapso Pro. Use Kapso's **webhooks** (inbound messages) + **send API** (outbound messages). Kapso is the WhatsApp transport only.
- **Two numbers**, both connected under Kapso Pro:
  - **Sales** — `WHATSAPP_NUMBER_SALES`. Runs Flow A (inbound leads) and Flow D (Instagram continuation). This is where signup happens.
  - **Support** — `WHATSAPP_NUMBER_SUPPORT`. Runs Flow C (existing clients). This is also the number the handoff message tells users to write to (see `SUPPORT_NUMBER` in §11 — the human-facing support number the client provides later; it may or may not equal `WHATSAPP_NUMBER_SUPPORT`, so keep them as separate config values).
  - *(The sales/support flow-to-number assignment above follows the PRD's structure — confirm it with the client before go-live.)*
- **Interactive primitives available through Kapso** (all are Meta Cloud API features surfaced by Kapso):
  - **Quick-reply buttons** — up to **3** per message.
  - **Interactive lists** — up to **10** items per message.
  - **Kapso-hosted forms** — a Kapso feature for richer/longer multi-field forms than plain buttons allow (used for the delivery-data step; see §4).
- **Inbound webhook handling:**
  - Verify every inbound webhook using `KAPSO_WEBHOOK_SECRET`.
  - **Dedupe by message ID** — webhooks can be redelivered (guardrail, `00-master.md` §6). Drop duplicates before touching the conversation engine.
  - Hand the normalized inbound message to `01-core-api.md`'s conversation engine (which enforces the per-conversation message queue so concurrent messages for one lead don't race).
  - **Non-text inbound (voice notes/audio, images, location pins) → ask the lead to write.** No transcription or media interpretation is built: reply with the `mediaFallback` copy asking the lead to type it. **Incoming WhatsApp calls are not answered** — on the call event, send the `callFallback` copy asking the lead to write instead.
- **Outbound send API:** the AI/engine decides *what* to send; this layer renders it into the correct Kapso primitive (text, buttons, list, or form) and calls the send API. All sends are logged as `message_out` events by the engine (`00-master.md` §5.8).

### Hard rule (from `00-master.md` §3)

**Do NOT route WaterService or Google Sheets calls through Kapso "integration calls."** All WaterService and Sheets traffic goes from the backend directly (`01-core-api.md`). Kapso carries WhatsApp messages only. Nothing in this module calls WaterService or Sheets through Kapso.

---

## 3. Meta hard limits (state these wherever the flow is designed)

These are **Meta Cloud API limits**, not Kapso choices. They constrain every interactive message:

- **Quick-reply buttons: maximum 3 per message.** If more than 3 options exist, use a list instead, or split.
- **Interactive lists: maximum 10 items per message.** If more than 10 options exist, paginate or filter.
- **Flows / Kapso-hosted forms must be created and published in Kapso/Meta BEFORE they can be sent.** You cannot construct a form on the fly at send time — it must already exist and be approved/published. (This is why the delivery-data form is a build-time artifact, and why Meta template approvals are a day-1 task per `00-master.md` §6/§11.)
- **Free-form (non-template) messages only work inside the open 24h customer-service window.** Business-initiated messages outside that window require an approved template. Follow-ups (§8) are engineered to stay inside the free window; the IG greeting (Flow D) and debt reminders are templates.

Whenever a step's option count could exceed these limits (e.g. delivery-day options, §6), the flow must degrade gracefully (list instead of buttons, or "escribime tu zona" free text).

---

## 4. Hybrid input model (decision 3)

Signup input is **hybrid**, not form-only and not buttons-only:

- **Structured steps** — city, product, delivery-day — use **buttons or lists** (the guided, tappable path).
- **The delivery-DATA step** — name, apellido, street, altura, entre calles, optional notes — uses a **Kapso-hosted form.** This is a Kapso feature that builds richer/longer forms than plain WhatsApp buttons. **Do not undersell it as "just buttons" or "just a WhatsApp Flow"** — it is the right primitive for multi-field structured capture in one interaction. It must be created and published in Kapso/Meta before it can be sent (§3).
- **FREE TEXT IS ALWAYS ACCEPTED AND UNDERSTOOD.** The buttons/forms are the *guided* path, not the *only* path. If the user free-types information, the AI extracts it and the engine advances accordingly. Concretely:
  - If the first message is "hola, soy de Luján, quiero un bidón de 20L", the AI extracts city + product, and the engine **SKIPS the redundant city and product button steps** — jumping straight to the quote + delivery-data.
  - If the user types their address as free text instead of using the form, the AI extracts it. The form is offered as the easy path, not enforced.
  - A user can mix modes freely (tap city, free-type product, etc.).

The AI does the **extraction** (free-text → structured fields). The engine (`01-core-api.md`) decides, from what's already known, **which stage to present next** and therefore which primitive to render. This module renders the primitive and sends it.

**Deterministic vs. AI (restate of `00-master.md`):** the structured choices (city/product/day/confirm) are deterministic UI. The AI handles free-text understanding, FAQs, and glue — it does not "parse" critical data by improvisation when a structured primitive is the cleaner capture. But it always *accepts* free text as a fallback.

---

## 5. The 5 signup stages → WhatsApp mechanics

Canonical stages (`00-master.md` §5.4):

```
inicio → producto → datos_entrega → dia_entrega → confirmacion → cliente_cerrado
```

`producto` and price are **merged**: picking a product triggers an **immediate quote in the same exchange** — there is no separate `precio` stage. The AI calls `get_prices(city)` and replies with the quote right after the product is chosen.

| Stage | What the user does | WhatsApp primitive | Free-text fast path |
|---|---|---|---|
| `inicio` | Greeted; asked for **city** | Interactive **list** — the 8 shortcut cities + "Otra" (9 items ≤ 10-item limit ✅) | If the first message already states the city (and maybe product), AI extracts it and the engine skips ahead. **Any BA city is accepted:** "Otra" asks "¿en qué ciudad?" (reusing `zonePrompt`) and **stays at the city step**; the free-text reply is snapped to the closest BA city (`matchCity`) and the flow continues to `producto`. |
| `producto` | Picks a **product**; gets an **immediate quote** | **Buttons** if ≤ 3 products, else **list** (≤ 10). Catalog: bidón 12L, bidón 20L, soda, saborizadas, dispenser frío-calor, dispenser natural → **use a list** (>3 items). | If product already free-typed, skip the picker; AI quotes directly. Prices come ONLY from `get_prices(city)`, that city's list only (`00-master.md` §6). |
| `datos_entrega` | Fills delivery data | **Kapso-hosted form**: `nombre`, `apellido`, `calle`, `altura`, `entre calles`, `notas` (optional). Pre-fill `nombre`/`apellido` from WhatsApp profile / IG form when it looks real. | User may free-type the address instead; AI extracts and fills the same fields. |
| `dia_entrega` | Picks a **delivery day** | **Buttons/list** of available options, each showing route + weekday + time window, e.g. **"Reparto 19 — sábado entre 10 y 13"**. Options come from `get_delivery_options(address)` (→ coverage/#12). **≤ 3 → buttons; up to 10 → list; >10 → list of the soonest 10 or "escribime qué día te queda mejor" free text.** | User may free-type a day preference; AI maps it to an offered option (never invents a day not returned by the tool). |
| `confirmacion` | Reviews summary; **confirms** | Order summary as text (product, price, address, day + window) + a **confirm button** (2 buttons: "Confirmar" / "Modificar" ≤ 3 ✅). | User may reply "sí, dale" as free text → treated as confirm. Confirm calls `confirm_order(order)` → `POST /api/orders` pipeline. |
| `cliente_cerrado` | — (terminal) | Confirmation message sent (copy module). | — |

Notes:
- Between `producto` and `dia_entrega` the engine runs the coverage check. **No-coverage result** (no serving neighbours, any city) → the **manual-review handoff**: label `revision_cobertura`, `ai_enabled=false`, operator notified (`01-core-api.md §4.5/§9`). (Coverage-check business logic is in `01-core-api.md`.)
- Stage transitions, `stage_entered` events, and the dynamic label `{stage}:{followup_count}` are all handled by `01-core-api.md`. This module only renders the right primitive for the current stage.

---

## 6. Delivery-day option formatting

Each option shown to the user is built from one coverage result (route + weekday + time window):

- Format: **`Reparto {reparto} — {weekday} entre {h_min} y {h_max}`**, e.g. `Reparto 19 — sábado entre 10 y 13`.
- Source: `get_delivery_options(address)` → coverage (#12) via core-api. Never fabricate a day/window the tool didn't return.
- **Limit handling (Meta §3):** ≤ 3 options → quick-reply buttons; 4–10 → interactive list; > 10 → list of the soonest 10, or fall back to free text ("escribime qué día te viene mejor y te confirmo").
- The option the user picks writes `route`, `delivery_day`, `delivery_window` on the lead record (`01-core-api.md`).

---

## 7. Conversation flows — WhatsApp mechanics

Business logic (stage state, WaterService writes, follow-up timers) is in `01-core-api.md`. Here: only the WhatsApp mechanics.

### Flow A — Inbound WhatsApp lead (sales number)

The user writes first → free session, no template cost (inside the 24h window). Runs the 5 stages of §5:

1. Greet + ask city (`inicio`) — list.
2. Product + immediate quote (`producto`) — list/buttons, `get_prices`.
3. Delivery data (`datos_entrega`) — Kapso-hosted form (or free text).
4. Coverage check (core-api) → delivery-day options (`dia_entrega`) — buttons/list.
5. Summary + confirm (`confirmacion`) — confirm button → `confirm_order`.
6. Confirmation message (`cliente_cerrado`).

Free-text fast path applies throughout (§4): any data already provided is not re-asked.

### Flow D — Instagram Instant Form → WhatsApp continuation

1. Meta lead ad opens a native **Instant Form inside Instagram** (name/phone pre-filled by Meta, plus city/address/product fields mirroring the website form). **Meta platform setup (this module owns it):**
   - **Ads Manager:** campaign objective **"Leads"**, conversion location **"Instant forms"**; the form's **privacy policy URL points to the privacy page on the new website** (`04-website.md` — a Meta hard prerequisite before the ads can run); enable **"higher intent" mode** if lead quality drops.
   - **Webhook:** subscribe to the Graph API **`leadgen` webhook on the CIMES Facebook Page**, using a **Page access token**; requires permissions **`leads_retrieval` + `pages_show_list`** via Meta **app review — submit day 1, it can take days and is the schedule risk for this flow** (`00-master.md` §11). Advanced access for `leads_retrieval` may additionally require **Meta Business verification** — same day-1 clock. Verify the webhook endpoint per Meta's scheme: answer the `hub.challenge` GET on subscribe and validate `X-Hub-Signature-256` on every POST. Ingestion business logic (fetch → normalize → sheet row) is `01-core-api.md` §4.3.
2. On lead ingestion, core-api normalizes the lead and this module **sends ONE utility template greeting** (a pre-approved utility template — the IG greeting template; mandatory for this flow, not gated by any flag) that **acknowledges the data the user already submitted** (name, city, product) and does **NOT re-ask it** (acceptance crit 10). Template must be pre-approved (§3, `00-master.md` §6).
3. The user's **reply opens the 24h window.** From there the conversation **continues at Flow A** — but skips the stages already satisfied by the form (coverage check already running with the submitted address; go straight to delivery-day or confirm as appropriate). Follow-up engine (§8) applies from the first reply onward.
4. IG cannot complete the order in-app — the WhatsApp continuation is required to close.

### Flow C — Existing client on the support number

1. Runs on `WHATSAPP_NUMBER_SUPPORT`.
2. Core-api looks the client up by phone (WaterService #2/#8). If recognized, the AI answers account/service questions it can **ground in the returned data** (e.g. next visit date) or from the FAQ KB.
3. If it cannot ground an answer → **handoff** (§9): tell the user to write to `SUPPORT_NUMBER` and notify the operator. Support automation is intentionally thin — ground-or-handoff.

---

## 8. Follow-up engine — WhatsApp SEND side

**Timer logic, scheduling, stage-tracking, and the `MAX_FOLLOWUP_CYCLES` cap live in `01-core-api.md` §follow-up engine.** This module owns only the **send**:

- When core-api's timer fires, it asks this layer to send the **stage-specific follow-up copy** from the es-AR copy module (§10) — one string per stage (`inicio`, `producto`, `datos_entrega`, `dia_entrega`, `confirmacion`).
- **All follow-ups ride the open 24h window → $0.** They are free-form messages, not templates. The schedule (`FOLLOWUP_SCHEDULE=1h,8h,23h` from the lead's last message) is timed so the **23h send stays inside Meta's free 24h window** — never send a would-be follow-up as a paid template after the window closes; if the window has closed, the follow-up is skipped (core-api decides; this layer just sends what it's told).
- A lead reply cancels pending follow-ups (core-api). This layer emits `followup_sent` / observes `followup_reply` via the standard event hooks.

---

## 9. Handoff message (decision 6)

Handoff is triggered by `01-core-api.md` (low AI confidence, out-of-KB question, explicit user request, or complaint) OR by the `handoff` tool the AI calls (§10). When it triggers, **both** of these happen:

1. **User-facing:** send the handoff copy (es-AR module) that **tells the user to write to `SUPPORT_NUMBER`** — the dedicated support number. `SUPPORT_NUMBER` is a required-but-currently-unknown config value with a placeholder; the client (Lisandro) provides the real number later. The message must interpolate `SUPPORT_NUMBER`, never hardcode a number.
2. **Operator-facing:** core-api notifies the operator (`OPERATOR_PHONE`) — this is core-api's job; referenced here for completeness.

Handoff also sets the shared **`ai_enabled = false`** field (`00-master.md` §5.2) so the engine stops auto-replying on that conversation. The CRM AI toggle (`03-crm.md`) flips the same field back to resume. **Both notify-operator and tell-user-to-write-support happen — not either/or.**

---

## 10. es-AR copy module (`copy.es-AR.ts`)

**Every user-facing string lives here.** Argentine Spanish, **voseo**, warm, short. Never hardcode a Spanish string inline in logic (`00-master.md` §2 hard rule). Other modules that need copy (website, CRM labels) import from this module — this doc owns it.

Copy surfaces this module must define (one entry each; follow-ups are stage keyed):

| Surface | Notes |
|---|---|
| `greeting` | Opening message (Flow A `inicio`). |
| `cityPrompt` | Ask for city (accompanies the city list). |
| `zonePrompt` | Ask "¿en qué ciudad?" as free text after the user taps "Otra" at `inicio`; the reply is snapped to the closest BA city (§5). |
| `productPrompt` | Ask for product (accompanies the product buttons/list). |
| `quote` | Price quote template — interpolates product + price for the resolved city. |
| `deliveryDataPrompt` | Intro to the Kapso-hosted delivery-data form. |
| `deliveryDayPrompt` | Ask which day (accompanies the day buttons/list). |
| `orderSummaryConfirm` | Order summary + confirm prompt (product, price, address, day + window). |
| `confirmation` | Post-confirm success ("Listo, te lo llevamos el sábado entre 10 y 13"). |
| `followup.inicio` / `followup.producto` / `followup.datos_entrega` / `followup.dia_entrega` / `followup.confirmacion` | Stage-specific follow-up copy (§8). |
| `handoffToSupport` | Handoff message — interpolates `SUPPORT_NUMBER` (§9). |
| `igGreeting` | IG utility-template greeting acknowledging submitted data (Flow D). |
| `debtReminder` | Debt-reminder utility template copy (neutral, no promo — engine in `01-core-api.md`; template send happens through this layer). |
| `debtMentionOpportunistic` | Balance note appended at $0 when a client with debt writes inside the open 24h window (`01-core-api.md` §8, opportunistic mention). |
| `mediaFallback` | Reply to voice notes/audio, images, or location pins: can't process media here — ask the lead to write it as text (§2). |
| `callFallback` | Sent after an incoming WhatsApp call: calls aren't answered on this line — ask the lead to write (§2). |

Keep strings short and tappable-friendly. Voseo throughout ("escribime", "querés", "te llevamos"). Interpolation placeholders are English identifiers inside the string, values injected by the caller.

---

## 11. AI specification

### Model & caching

- **`MODEL_DEFAULT=claude-sonnet-5`** at launch (decision 2). Sonnet is safer during initial prompt tuning; a config flag / env change downgrades to Haiku later once prompts stabilize (deterministic work is in tools, so Haiku will likely suffice long-term). `MODEL_ESCALATION` (default `claude-sonnet-5`) names the model for optional escalation of hard/ambiguous turns.
- **Prompt caching** on: the **system prompt**, the **FAQ knowledge base**, and the **resolved price data**. Cache read is cheap; structure the prompt so the stable prefix (role/tone/catalog/KB/tools) is cached and only the per-conversation tail (the one city's prices, conversation state) varies.
- **Implementation: the official Anthropic TypeScript SDK, called directly** — a plain tool-use loop with `cache_control` blocks on the stable prefix. **No LangChain, no agent frameworks** — they hide the caching control this spec depends on.

### System prompt contents

- **Role**: sales assistant for CIMES, an Argentine water/soda home-delivery company.
- **Tone**: Argentine Spanish, **voseo**, warm, short messages.
- **Catalog**: the product list (bidón 12L/20L, soda, saborizadas, dispenser frío-calor, dispenser natural).
- **Per-city price lists — injected explicitly per conversation.** **THE MODEL MUST NEVER SEE TWO CITIES' PRICES IN ONE CONTEXT.** Inject only the resolved city's price list. This is the single most important correctness rule for the AI (`00-master.md` §6, goal: never quote the wrong city's price).
- **FAQ knowledge base**: frío/calor rental model, weekly visit cadence, bidón deposit vs. rental, bajo sodio, delivery windows, etc.
- **Tool definitions** (below).
- **Refusal-to-guess rule**: prices and coverage come from **tools, not memory**. The model must never state a price or a coverage/day answer it did not get from a tool call. No promises about anything outside the KB.

### Tools (function calling) — canonical names (`00-master.md` §5.5)

Thin wrappers over core-api providers/endpoints. Exact signatures/impl in `01-core-api.md`; the model sees these **five**:

| Tool | Purpose |
|---|---|
| `get_prices(city)` | Returns that city's catalog + prices (via PriceProvider). Only source of prices. |
| `check_coverage(address)` | Returns whether the address is covered + resolved data (via GeocodingProvider/#12). |
| `get_delivery_options(address)` | Returns available delivery-day options (route + weekday + time window). |
| `confirm_order(order)` | Fires the order pipeline (`POST /api/orders`): WaterService client #6 + contact #7 + driver ticket #3 + sheet row + label `cliente_cerrado`. Idempotent per lead. |
| `handoff(reason)` | Sets `ai_enabled=false`, sends the tell-user-to-write-support copy, notifies operator (§9). |

Structured steps (city/product/day/confirm) are **deterministic UI** (buttons/lists/form), not free-text parsing. The AI handles **FAQs, glue, and free-text extraction** (§4).

### Message behavior (explicit fixes — these are requirements, not nice-to-haves)

- The bot **MAY send multiple messages in a row** when natural (e.g. an answer followed by the next question). It is not limited to one reply per inbound message.
- The bot **MAY stay silent** on closers that need no reply — "ok", "gracias", a lone emoji. **It must NOT answer every message compulsively.** Staying silent is a valid action.

### Hard limits

- **Max tokens per reply** — cap it (config).
- **Max turns before suggesting handoff** — after N unproductive turns, suggest/trigger `handoff`.
- **No promises outside the KB.** No prices/coverage/days from memory — always via tools.

---

## 12. Environment variables this module owns

Full centralized table with defaults is in `00-master.md` §8. This module owns:

| Var | Default | Note |
|---|---|---|
| `KAPSO_API_KEY` | — | Kapso Pro API key. |
| `KAPSO_WEBHOOK_SECRET` | — | Verify every inbound Kapso webhook. |
| `WHATSAPP_NUMBER_SALES` | — | Sales line (Flow A / Flow D). |
| `WHATSAPP_NUMBER_SUPPORT` | — | Support line (Flow C). May differ from `SUPPORT_NUMBER`. |
| `ANTHROPIC_API_KEY` | — | Claude API. |
| `MODEL_DEFAULT` | `claude-sonnet-5` | Launch model (Sonnet). Flag-downgrade to Haiku later. |
| `MODEL_ESCALATION` | `claude-sonnet-5` | Optional low-confidence escalation model. Effectively inactive while `MODEL_DEFAULT` is Sonnet; becomes meaningful after the Haiku downgrade. |
| `SUPPORT_NUMBER` | *(placeholder — client provides later)* | **Required-but-currently-unknown.** The handoff message tells the user to write here. Ship with a clear placeholder until Lisandro provides the real number. |

Consumed but owned elsewhere (`01-core-api.md`), referenced by this layer's sends:

| Var | Owner | Why this module touches it |
|---|---|---|
| `OPERATOR_PHONE` | core-api | Handoff notifies the operator (§9) — core-api sends it; listed here for the handoff flow. |
| `WEB_CONFIRMATION_TEMPLATE` | core-api | If enabled, the optional web-order confirmation template is **sent via this chatbot layer** (Meta templates go out through Kapso). |

---

## 13. Acceptance criteria (this module's subset)

1. **(crit 1, chatbot side)** A WhatsApp lead goes from first message to confirmed order using buttons + the delivery-data form, and receives **only their city's prices** — never another city's list in the same context. The free-text fast path works: a lead who states city + product in the first message is not re-asked those via buttons.
2. **(crit 10)** An Instagram Instant Form submission produces the utility-template greeting that **acknowledges the submitted data and never re-asks it**; the user's reply continues the conversation at the correct stage (data already collected is not requested again).
3. The bot **can send multiple messages in a row** when natural, and **stays silent** on closers that need no reply ("ok", "gracias", emoji) — it does not answer every message compulsively.
4. **Handoff message instructs the user to write to `SUPPORT_NUMBER`** (interpolated, not hardcoded) AND the operator is notified (`OPERATOR_PHONE`) — both happen. Handoff sets `ai_enabled=false`.
5. Delivery-day options are shown with route + weekday + time window (e.g. "Reparto 19 — sábado entre 10 y 13"), sourced from `get_delivery_options`, respecting Meta's 3-button / 10-item limits (list or free-text fallback beyond that).
6. Every user-facing string comes from the es-AR copy module; no Spanish string is hardcoded inline. Voseo throughout.
7. Prices and coverage/day answers only ever come from tool calls — the AI never emits a price or coverage answer from memory.

---

*Endpoint numbers (#2, #3, #6, #7, #10, #12 …) refer to the WaterService API manual v1.0.1; the full endpoint map is in `01-core-api.md`. Contracts (lead record, `ai_enabled`, labels, stages, tools, REST endpoints, event types) are defined in `00-master.md` §5 — this module uses those names verbatim.*
