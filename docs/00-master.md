# 00 — MASTER: CIMES WhatsApp Sales & Logistics System

**Status:** build spec for implementation. This is the entry point. Read this file first, then the module doc for the piece you are building.

This document owns: system summary, language policy, architecture & stack, the module map and build order, the repository scaffold & context-file rules (§4.1), **the contracts every module must agree on**, implementation guardrails, the centralized environment-variable table, open items, and milestones. Everything else references the contracts defined here.

---

## 1. System summary

Build a WhatsApp sales bot + internal CRM + public self-service website for CIMES, an Argentine water/soda home-delivery company operating in 7 cities (Mercedes, Luján, San Andrés de Giles, San Antonio de Areco, Chivilcoy, Campana, Zárate). The system takes a lead from first contact (WhatsApp, website, or Instagram lead form) through coverage check, price quote, and order confirmation, then **writes the confirmed order directly into WaterService** (the client's delivery-management system: creates the client record + a driver ticket) and mirrors it into a Google Sheet the operator reads each morning. A conversational AI (Claude) handles free-text understanding and FAQs; all deterministic work — prices, coverage, delivery days — is done by tools and providers, never by the model. A follow-up engine re-engages silent leads inside WhatsApp's free 24h window, and a debt-reminder engine sends visit-eve balance reminders. An internal CRM lets the operator watch conversations, take over from the AI, and label leads.

---

## 2. Language policy

This is a hard rule, applies to every module:

- **English** for all code, comments, identifiers, commit messages, file names, and internal docs (including these docs).
- **Argentine Spanish (voseo)** for all user-facing copy: WhatsApp messages, website content, CRM UI labels shown to end users, and Meta templates.
- **All user-facing copy strings live in a dedicated es-AR copy module** (e.g. `copy.es-AR.ts`). Never hardcode a Spanish string inline in logic. Modules that emit user-facing text import their strings from this module. `02-chatbot.md` owns the canonical copy module; other modules that need copy (website, CRM labels) reference it.

---

## 3. System architecture

```
Meta Ads / IG ─┬─► WhatsApp (2 numbers) ──► Kapso (WhatsApp API platform, Pro plan)
               │                                 │ webhooks / send API
               └─► Website (static, Hostinger) ─►│
                        │ REST (fetch)            ▼
                        └───────────────► Backend service (Node.js + TypeScript, small VPS)
                                                  ├── Claude API (Sonnet default; see §7)
                                                  ├── WaterService REST API   (called DIRECTLY from backend)
                                                  ├── Google Sheets API        (called DIRECTLY from backend)
                                                  └── SQLite (conversation/order/event state)

Operator UI: self-hosted Chatwoot (03-crm.md) — API-channel inbox mirrored by the backend;
             Kapso stays the only WhatsApp transport.
```

### Stack decisions (fixed)

- **WhatsApp layer:** Kapso Pro. Use Kapso webhooks + send API. Interactive buttons, lists, and forms/Flows are Meta Cloud API features surfaced through Kapso.
- **Do NOT route WaterService or Google Sheets calls through Kapso "integration calls".** Kapso's plan includes only ~1,200 integration calls/mo — backend traffic would blow through that immediately. All WaterService and Sheets traffic goes **from our backend directly**. Kapso is only the WhatsApp transport.
- **AI:** Claude, `MODEL_DEFAULT=claude-sonnet-5` at launch (see §7 / decision on model). Prompt caching on system prompt + resolved price list. A config flag can downgrade to Haiku later once prompts stabilize. The model never computes prices/coverage/days — tools do.
- **Backend:** a single Node.js/TypeScript service on a small VPS. **SQLite** for state (simple, zero-ops). Google Sheets is the **operator-facing mirror, not the source of truth**.
- **Website:** static, mobile-first, hosted on the client's existing Hostinger. The page `fetch`es the backend REST endpoints (§5.6).

---

## 4. Module map & build order

| Doc | Owns |
|---|---|
| `00-master.md` (this) | Architecture, contracts, guardrails, env table, build order, milestones |
| `01-core-api.md` | Backend: conversation-engine core, WaterService client, PriceProvider, GeocodingProvider, orders sheet, event log, follow-up engine, debt-reminder engine, REST API |
| `02-chatbot.md` | WhatsApp layer: Kapso webhooks, buttons/lists/forms, the 5 signup stages, es-AR copy module, AI (tools + system prompt). **Carries the Kapso build-guide note — see §9.** |
| `03-crm.md` | Operator inbox = **self-hosted Chatwoot** (settled — not custom-built): API-channel inbox, status-based AI toggle, archive, AI-vs-human distinction, lead panel via custom attributes, labels + filter. Mirror code lives in `01-core-api.md` §10.3 |
| `04-website.md` | Public static site + self-service signup wizard (Flow B) |

### Build order (no phases — this is a priority ordering, not a phase gate)

1. **Core API + chatbot first.** These two together deliver the primary flow: lead → coverage → quote → confirm → WaterService write → sheet row. Build them in parallel; the chatbot depends on core-api's REST endpoints, providers, and shared state.
2. **Website alongside** core-api (it consumes the same REST endpoints; it can be built in parallel once `GET /api/prices`, `POST /api/coverage`, `POST /api/orders` exist).
3. **CRM (Chatwoot) is later-priority and may lag.** The operator inbox is a self-hosted Chatwoot instance (`03-crm.md` — settled, not custom-built), wired via the backend's mirror (`01-core-api.md` §10.3). The core backend MUST still be designed from day one so the mirror attaches cleanly — clean lead/conversation data model and the shared `ai_enabled` state field (§5.2). The primary flow must not depend on Chatwoot being up (mirror failures queue + retry).

### 4.1 Repository scaffold & AI context files (create FIRST — before any feature code)

This repo is built and maintained by AI sessions across many days. It must be born with a three-layer context structure: a **map** (root `CLAUDE.md`) that routes every task, **rooms** (one `CONTEXT.md` per workspace) that describe the work in that area, and **state** (`PROGRESS.md`) that survives between sessions. Creating these files is the first build step (day-1, §11) — before feature code.

**Target tree** (workspaces are fixed; the internal code layout inside `src/` follows `01`/`02` and may evolve):

```
cimes/
├── CLAUDE.md        # the map — routing only, ≤ ~50 lines (spec below)
├── PROGRESS.md      # cross-session state (spec below)
├── docs/            # THESE module docs (00–04), copied in verbatim — the spec source of truth
├── src/             # the backend service — core API (01) + chatbot layer (02) + copy.es-AR.ts
│   └── CONTEXT.md   # backend room
├── website/         # the public static site (04)
│   └── CONTEXT.md   # website room
└── ops/             # deploy: VPS, Chatwoot compose + wiring config (03), Hostinger upload
    └── CONTEXT.md   # ops room
```

**Root `CLAUDE.md` (the map) — content spec.** Keep it under ~50 lines; it routes, it does not restate. Contains exactly: (1) overview — 2–3 sentences on what the system is; (2) the fixed stack (§3); (3) commands — dev/test/deploy as they come to exist; (4) the workspace list; (5) the routing table below; (6) naming conventions; (7) an avoid-list of the top guardrails (pointing to §6, not copying it).

| Task | Go to | Read |
|---|---|---|
| Contracts, env vars, guardrails, build order | `docs/` | `00-master.md` |
| Engine, providers, WaterService, follow-ups, debt, REST | `src/` | `CONTEXT.md` + `docs/01-core-api.md` |
| WhatsApp mechanics, AI prompt/tools, es-AR copy | `src/` | `CONTEXT.md` + `docs/02-chatbot.md` |
| Website / signup wizard | `website/` | `CONTEXT.md` + `docs/04-website.md` |
| Chatwoot deploy & wiring | `ops/` | `CONTEXT.md` + `docs/03-crm.md` (+ `01 §10.3`) |
| Resume work / "where are we" | repo root | `PROGRESS.md` |

**Workspace `CONTEXT.md` (rooms) — content spec.** One per workspace, under a page: what this workspace is for, the process, what files live here, what good output looks like, what to avoid. Rooms **point** to the owning module doc for the spec — they never copy contract tables, env tables, or flow definitions out of `docs/` (one fact, one location — the contracts stay canonical in this file only).

**`PROGRESS.md` — session persistence.** Sections: *Current status*; *Last session* (done / in progress / blocked / next); *Decisions made* (each with the why); *Open questions*. Discipline: **every session starts** by reading `CLAUDE.md` + `PROGRESS.md`, then verifying them against the actual code (sessions can die mid-task — trust but check); **every session ends** by updating `PROGRESS.md`. Milestone completions (§11) are recorded here.

**Maintenance rules.** These files are living documents: update the room when its workspace changes, the map when the structure changes. Never duplicate a fact between `docs/`, the map, and the rooms — route with pointers instead. English file names throughout; new spec/decision docs go in `docs/` following the `NN-topic.md` pattern.

---

## 5. Contracts between modules

**These names are canonical. Every module doc uses EXACTLY these identifiers.** Do not rename, pluralize, or translate them.

### 5.1 Canonical lead / conversation record

One record per lead/contact, keyed by phone (SQLite; source-agnostic — WhatsApp, web, and Instagram all normalize into this shape). Shared fields:

| Field | Type | Notes |
|---|---|---|
| `lead_id` | string/uuid | Internal id, stable across the lead's life |
| `phone` | string | E.164; the natural key for dedupe and WaterService lookup (#2) |
| `source` | enum | `whatsapp` \| `web` \| `instagram` |
| `name` | string | Pre-filled from WhatsApp profile / IG form when it looks real |
| `city` | string | One of the 7 covered cities, or `otra` |
| `address` | string | Composed street + number |
| `cross_streets` | string | "entre calles" |
| `product` | string | Selected product / interest |
| `price` | number | Quoted price (from PriceProvider, never model-computed) |
| `price_list` | string | Resolved `listaDePrecios_id` (location-based, from #12 neighbors) |
| `route` | string | `reparto` id/name resolved from coverage |
| `delivery_day` | string | Chosen weekday |
| `delivery_window` | string | Time window (`horarioProm`) |
| `stage` | enum | One of the signup stages (§5.4) |
| `followup_count` | int | Follow-ups sent at the current stage |
| `labels` | string[] | Terminal + dynamic labels (§5.3) |
| `ai_enabled` | boolean | **Shared state field — see §5.2** |
| `waterservice_client_id` | string \| null | Set after alta (#6) |
| `ticket_id` | string \| null | Set at ticket dispatch — #3 fires the day before delivery (`01-core-api.md §4.5/§4.6`) |
| `sync_status` | enum | e.g. `pending` \| `synced` \| `failed` — surfaced in the CRM lead panel |
| `conversation_link` | string | Deep link to the conversation in Chatwoot (`03-crm.md`) |
| `notes` | string | Free notes |
| `archived` | boolean | CRM-owned archive flag (`03-crm.md`) — out of the active inbox; never deletion |

`01-core-api.md` owns the schema and the WaterService sync fields. `03-crm.md` reads this record for the lead info panel and writes `labels`, `ai_enabled`, `notes`, and archive state.

### 5.2 Shared state field for per-conversation AI on/off — `ai_enabled`

`ai_enabled` (boolean, on the conversation/lead record) is a **single field with two consumers**:

- **`01-core-api.md` handoff logic** sets `ai_enabled = false` when a handoff triggers (low AI confidence, out-of-KB question, explicit user request, or complaint). While `ai_enabled = false`, the conversation engine does not auto-reply on that conversation.
- **`03-crm.md` AI toggle** is the Chatwoot conversation status: `pending` ↔ `ai_enabled = true` (bot owns it), `open` ↔ `ai_enabled = false` (human takeover), `resolved` = archived. The backend syncs on Chatwoot's `conversation_status_changed` webhook (`01-core-api.md` §10.3).

There is exactly one canonical field — `ai_enabled` on the lead record is what the engine checks; Chatwoot status is its UI surface. The handoff mechanism and the CRM toggle are the same switch. Both docs MUST reference `ai_enabled` by this name.

### 5.3 Label taxonomy

Two dimensions, shown together in the CRM and the sheet.

**Terminal labels** (auto-applied where noted, manually overridable in the CRM):

| Label | Meaning / auto rule |
|---|---|
| `sin_respuesta` | Follow-up sequence exhausted (3 sends) without reply |
| `interesado` | ≥ 2 user exchanges or asked prices |
| `cliente_cerrado` | Confirmed order (order pipeline) |
| `pedido_cerrado` | Delivered — **manual toggle only.** Auto-labeling from delivery data is not built; that is a deliberate task boundary, not a TODO. Do not build any WaterService-webhook/delivery-note auto-labeling for this |
| `mal_lead` | Operator-defined bad zone / unreachable address |
| `otra_ciudad` | City outside coverage |
| `derivado` | Human handoff triggered |
| `revision_cobertura` | **Covered city, but no delivery time we can offer** (no serviceable neighbor/route). Auto-applied by the manual-review handoff (`01 §4.5`): AI off, mirrored to Chatwoot for a human to decide "we can take you" / "we can't". Distinct from `mal_lead` (rejected) — this is *pending a human decision* |

**Dynamic stage label**, format `{stage}:{followup_count}` (e.g. `datos_entrega:2` = stuck at delivery-data, 2 follow-ups sent). `{stage}` is one of the signup stages (§5.4). Powers the funnel view.

### 5.4 The 5 signup stages

```
inicio → producto → datos_entrega → dia_entrega → confirmacion → cliente_cerrado
```

Five working stages (`inicio`, `producto`, `datos_entrega`, `dia_entrega`, `confirmacion`) plus the terminal `cliente_cerrado`. **`producto` and price are merged**: picking a product triggers an immediate quote in the same exchange — there is no separate `precio` stage. `stage` on the lead record (§5.1) always holds one of these values; the follow-up engine and the dynamic label read it.

### 5.5 AI tool names

The chatbot exposes exactly these tools to the model (details, signatures, and prompt in `02-chatbot.md`):

`get_prices`, `check_coverage`, `get_delivery_options`, `confirm_order`, `handoff`, `registrar_zona`

These are thin wrappers over core-api providers/endpoints: `get_prices` → PriceProvider, `check_coverage` / `get_delivery_options` → GeocodingProvider + WaterService coverage (#12), `confirm_order` → `POST /api/orders` pipeline, `handoff` → sets `ai_enabled = false` (§5.2) and notifies the operator. `registrar_zona` → the WhatsApp equivalent of `POST /api/waitlist`: records an out-of-coverage city/zone (label `otra_ciudad` + orders-sheet lead row) and sets `ai_enabled = false`. It exists only for the WhatsApp "Otra ciudad" path, where — unlike the website form — the AI stays on to field questions while capturing the zone conversationally.

### 5.6 REST endpoints core-api exposes (for website & chatbot)

`01-core-api.md` implements these; `04-website.md` and `02-chatbot.md` consume them.

| Endpoint | Purpose (request → response intent) |
|---|---|
| `GET /api/prices?city=` | Return the catalog with the given city's prices. Response: product list with prices from the resolved price list for that city. Never mixes two cities' lists. |
| `POST /api/coverage` | Body: composed address (+ city). Runs GeocodingProvider + WaterService coverage (#12). Response: `covered` boolean, resolved coordinates, price list id, and available delivery-day options each with route + weekday + time window. |
| `POST /api/orders` | Body: full order (name, phone, city, address, cross_streets, chosen delivery day/window, source, and **`items: [{product, qty}]`** — a single `product` string is still accepted for legacy single-item callers). The server sums the total from the city's price list (price authority server-side) and records the order as one summary line (`"2x A, 1x B"`) + total. Runs the **shared confirmation pipeline**: create WaterService client (#6) + attach contact (#7) + create driver ticket (#3, dispatched by scheduler the day before delivery) + append orders-sheet row + set label `cliente_cerrado`. Response: order id + waterservice_client_id + ticket status. Idempotent per lead. |
| `POST /api/waitlist` | Body: name, phone, free-text city/zone, optional comment (+ attribution). Uncovered-area lead capture for the website's "Otra ciudad" form (04-website §5): create/update lead (#2) + set label `otra_ciudad` + append orders-sheet lead row. No coverage check, no order pipeline. Response: `{ ok: true }`. Idempotent per phone. |
| `GET /api/export/events?from=&to=` | Operator-triggered CSV export of the `events` table (§5.8) over a date range, in order. |

### 5.7 Provider interfaces

Just the contract here; `01-core-api.md` details the implementations.

- **`PriceProvider`** — resolves prices. Swappable via `PRICES_SOURCE` (fully open — see §8). Implementations: WaterService price matrix (#10/#5) and a Google Sheet source. The AI reaches prices only through this provider.
- **`GeocodingProvider`** — resolves an address to coordinates. Default implementation = WaterService endpoint #12 (which geocodes and returns neighbors/coverage in one call). A Google Maps adapter sits behind the same interface, swappable via config/flag. No manual validation gate before build — assume #12 works, keep it swappable.

### 5.8 Event-log event types

Append-only SQLite `events` table (never updated/deleted). Emitted via hooks in the conversation/follow-up/order code paths. Event types:

`lead_created`, `stage_entered`, `message_in`, `message_out`, `followup_sent`, `followup_reply`, `coverage_checked`, `label_applied`, `order_confirmed`, `handoff`, `opt_out`, `debt_reminder_sent`

Row shape: `id | timestamp (UTC) | lead_id | source | city | event_type | stage | followup_count | metadata (JSON)`. Owned by `01-core-api.md`; exported via `GET /api/export/events` (§5.6). No dashboards/digests are built — raw capture + CSV export only.

---

## 6. Implementation guardrails

**Read this section before writing any code.** These catch the specific mistakes this build is prone to. Each applies across modules; the owning module repeats the relevant ones.

- **WaterService always returns HTTP 200.** Errors are signalled by `error != 0` in the response **body**, not the HTTP status. Always check the body's `error` field. Treating HTTP 200 as success will silently accept failures.
- **WaterService date formats differ by direction — do not confuse them.** Response timestamps arrive in .NET format `/Date(1753112501144)/` (parse the epoch-ms out of it). Request dates are sent as `dd/MM/yyyy` strings. Also: some numeric fields arrive as strings — coerce explicitly.
- **Auth token** goes in the header `CURRENTTOKENVALUE` on every non-login call. Cache the token; re-login on expiry or on a 401/auth error. All WaterService calls are server-side only.
- **Idempotency — webhooks can be redelivered.** Dedupe inbound WhatsApp messages by message ID. Before creating a WaterService client (#6), look up an existing client by phone (#2) to avoid duplicate altas.
- **Operator override window.** A confirmed order stays editable until the driver ticket is actually dispatched (the day before delivery) — edits happen on the stored order (`01-core-api.md` §4.6). The scheduler MUST read the order's **current** state at dispatch time — never cache route/day from confirmation time.
- **Timezone `America/Argentina/Buenos_Aires`** for all "tomorrow", business-hours, and follow-up-timer logic. Store event timestamps in UTC (§5.8) but compute local-day logic in this zone.
- **Per-conversation message queue.** Concurrent inbound messages to the same lead must be serialized through the conversation engine — never let two messages for one lead race.
- **Meta templates must be created and approved IN ADVANCE (day-1 task).** Debt reminders, the IG lead greeting, and the optional web confirmation all depend on approved utility templates. Template approval takes time and is a schedule risk — submit on day 1.
- **The AI NEVER computes prices or coverage itself.** Always via tools/providers (`PriceProvider`, `GeocodingProvider`, WaterService client). No hardcoded prices, no model-recalled prices, ever.
- **Copy strings live in the dedicated es-AR module (§2), never inline.** All code/identifiers/comments in English.
- **Repo scaffold + session state (§4.1).** The repository starts with the context files (`CLAUDE.md` map, workspace `CONTEXT.md` rooms, `PROGRESS.md`) before feature code. Every session ends by updating `PROGRESS.md`; every session starts by reading the map + progress and verifying them against the code. Keep map/rooms current — stale context files cause drift.
- **Crons must be idempotent and restart-safe.** The follow-up engine, debt-reminder engine, and event-log hooks must resume correctly after a process restart or deploy. Do not rely on in-memory-only timers for anything that must survive a crash — persist timer state (e.g. in SQLite) and reconstruct on boot.
- **Data / PII.** Phone numbers and addresses are PII — store only what's needed. **No third-party analytics on chat/conversation data** (the website keeps its GTM container, but conversation data never reaches it or any other third-party analytics).

---

## 7. AI model

`MODEL_DEFAULT=claude-sonnet-5` at launch — Sonnet is safer during initial prompt tuning. A config flag / env change can downgrade to Haiku later once prompts stabilize (the deterministic work is already in tools, so Haiku will likely suffice long-term). `MODEL_ESCALATION` names the model for optional escalation of hard/ambiguous turns. Message behavior (from the AI spec, kept): the bot may send multiple messages in a row when natural, and may stay silent on closers that need no reply ("ok", "gracias", emoji) — it must not answer every message compulsively. Full AI spec, tools, and system prompt live in `02-chatbot.md`.

---

## 8. Environment configuration (centralized)

All env vars, with the module that owns each. **Each module doc also lists its own subset** so it can be handed off independently — this table is the single source of truth for names, defaults, and ownership.

| Var | Default | Owner | Note |
|---|---|---|---|
| `KAPSO_API_KEY` | — | chatbot | Kapso Pro API key |
| `KAPSO_WEBHOOK_SECRET` | — | chatbot | Verify inbound Kapso webhooks |
| `WHATSAPP_NUMBER_SALES` | — | chatbot | Sales line |
| `WHATSAPP_NUMBER_SUPPORT` | — | chatbot | Support line |
| `ANTHROPIC_API_KEY` | — | chatbot | Claude API |
| `MODEL_DEFAULT` | `claude-sonnet-5` | chatbot | Launch model (Sonnet). Flag-downgrade to Haiku later once prompts stabilize |
| `MODEL_ESCALATION` | `claude-sonnet-5` | chatbot | Model for optional low-confidence escalation. Effectively inactive while `MODEL_DEFAULT` is Sonnet; becomes meaningful after the planned downgrade to Haiku |
| `SUPPORT_NUMBER` | *(placeholder — client provides later)* | chatbot | **Required-but-currently-unknown.** The handoff message tells the user to write here. Lisandro (client) provides the real number later; ship with a clear placeholder |
| `WATERSERVICE_BASE_URL` | — | core-api | CIMES' WaterService environment |
| `WATERSERVICE_USER` | — | core-api | Auth (#1) |
| `WATERSERVICE_PASSWORD` | — | core-api | Auth (#1) |
| `WS_INCIDENT_TYPE_ID` | `1` | core-api | "Gestión en ruta". **Per-environment default (decision below).** |
| `WS_INCIDENT_SUBTYPE_ID` | `28` | core-api | "Visita por alta". **Per-environment default (decision below).** |
| `WS_SEVERITY_ID` | `2` | core-api | Media |
| `WS_CENTRO_DISTRIBUCION_MAP` | — | core-api | city → `centroDistribucion_id` |
| `GOOGLE_SERVICE_ACCOUNT_JSON` | — | core-api | Sheets API service account |
| `ORDERS_SHEET_ID` | — | core-api | Orders sheet |
| `GOOGLE_MAPS_API_KEY` | — | core-api | GeocodingProvider Google Maps adapter (swappable alt to #12) |
| `COVERAGE_RADIUS_M` | `10000` | core-api | Coverage radius. 10 km ≈ whole city, so effectively an off-switch until tightened later |
| `BUSINESS_HOURS` | `09-21` | core-api | Follow-ups outside this range defer to next morning |
| `FOLLOWUP_SCHEDULE` | `1h,8h,23h` | core-api | From lead's last message; 23h stays inside Meta's free 24h window |
| `MAX_FOLLOWUP_CYCLES` | `2` | core-api | Cap full follow-up cycles per lead |
| `WEB_CONFIRMATION_TEMPLATE` | `false` | core-api | Optional utility template confirming a web order (order pipeline decides; sent via chatbot layer) |
| `DEBT_THRESHOLD` | `0` | core-api | Minimum balance to trigger a reminder |
| `DEBT_REMINDER_COOLDOWN_DAYS` | `14` | core-api | No repeat reminder within this many days |
| `DEBT_REMINDER_SEND_HOUR` | `09` | core-api | Morning send hour |
| `CITY_PRICE_LIST_MAP` | — | core-api | Provisional city→list for the first quote; final list comes from #12 neighbors' `listaDePrecios_id` |
| `PRICES_SOURCE` | *(none — fully open)* | core-api | Selects PriceProvider impl (`waterservice` \| `sheet`). No forced default — build the abstraction (§8 open item a) |
| `PRICES_SHEET_ID` | — | core-api | Required if `PRICES_SOURCE=sheet` |
| `OPERATOR_PHONE` | — | core-api | Handoff / failure notifications to operator |
| `API_BASE_URL` | — | website | Backend base URL the static site `fetch`es (§5.6) |
| `CHATWOOT_BASE_URL` | — | crm | Self-hosted Chatwoot instance URL |
| `CHATWOOT_API_ACCESS_TOKEN` | — | crm | Backend → Chatwoot API (mirror, labels, attributes, status) |
| `CHATWOOT_ACCOUNT_ID` | — | crm | Chatwoot account for API calls |
| `CHATWOOT_INBOX_ID` | — | crm | The API-channel inbox |
| `CHATWOOT_WEBHOOK_SECRET` | — | crm | Verify signed Chatwoot webhooks (agent replies, status/label changes) |

**Decision on `WS_INCIDENT_TYPE_ID` / `WS_INCIDENT_SUBTYPE_ID` / `WS_CENTRO_DISTRIBUCION_MAP` / driver-vs-group assignment:** the defaults above are assumed from the manual's example environment. The client will confirm the real values with the WaterService vendor before/during build — **no further design work needed here, just use the configured values.** Do not build a vendor-confirmation workflow; it is a phone call.

---

## 9. Kapso build-guide note (READ BEFORE CODING THE WHATSAPP FLOW)

> The WhatsApp flow described in these docs — **5 signup stages, hybrid input (buttons/lists for city/product/day, a Kapso-hosted form for delivery data, and free text always accepted)** — is the **intended UX, NOT a spec verified against Kapso's real capabilities.**
>
> Before finalizing the exact WhatsApp mechanics (which parts use Kapso's form/Flow builder vs. buttons/lists vs. free text, and the exact API shapes), the implementer MUST first read Kapso's own build guide: **https://docs.kapso.ai/docs/build-with-ai** — and confirm the flow matches Kapso's actual capabilities before writing code. **Do not silently guess Kapso's API shape.**
>
> (The inbox/CRM choice is settled — self-hosted Chatwoot, `03-crm.md` — so the guide governs the WhatsApp flow mechanics only.)

`02-chatbot.md` carries the full version of this note plus the Meta hard limits (max 3 quick-reply buttons **or** 10-item lists per message; Flows/forms must be created and published in Kapso/Meta before they can be sent). This is the pointer; the detail lives there.

**Hybrid input — the guided path is not the only path:** free text is always accepted and understood. If a user free-types their city + product in the first message, the AI extracts them and skips the redundant button step. Buttons/lists/forms are the guided path.

**Support handoff:** when the AI can't answer, it MUST tell the user to write to `SUPPORT_NUMBER` (user-facing instruction) **and** notify the operator (`OPERATOR_PHONE`). Both, not either/or. Handoff also sets `ai_enabled = false` (§5.2).

---

## 10. Open items

Only genuinely open items remain (geocoding validation and the inbox/CRM choice are **not** open — resolved: assume-and-abstract, and self-hosted Chatwoot (`03-crm.md`) respectively).

- **(a) Price source of truth — FULLY OPEN.** `PRICES_SOURCE` selects the PriceProvider implementation (WaterService matrix #10/#5, or a Google Sheet). Build the `PriceProvider` abstraction so either works; **do not force a default.** The client confirms which source is maintained. If `sheet`, enable a daily sheet-vs-#10 consistency check with an operator alert on mismatch.
- **(b) Coverage radius — SETTLED.** `COVERAGE_RADIUS_M=10000`. 10 km ≈ whole city, so it's effectively an off-switch until tightened later. One-line note only; no further discussion.
- **(c) Website branding — SETTLED.** Copy the competitor site's design (https://aguaivess.rosmino.com.ar/) exactly for v1, with CIMES logo. Colors/imagery tuning happens after the first build. No redesign scope beyond that.
- **(d) WaterService per-environment IDs — a phone call, not a blocker.** See the decision in §8: keep the drafted defaults; the client confirms real values with the vendor before/during build. No design work here.

---

## 11. Milestones / build checklist

Ordering, not phases. **Day-1 items are the schedule-critical ones — do them first regardless of build order.**

**Day-1 (do immediately, they gate later work):**
- Create the repository scaffold per §4.1 — `CLAUDE.md` map, workspace `CONTEXT.md` rooms, `PROGRESS.md`, and `docs/` (these five module docs) copied in — before any feature code.
- Submit Meta template approvals (debt reminder, IG lead greeting, optional web confirmation) — approval takes time.
- Read the Kapso build guide (§9) and confirm the WhatsApp flow mechanics + inbox pattern before coding them.
- Kapso setup (2 numbers, sandbox), backend skeleton, webhook echo.
- Start Meta app review for `leads_retrieval` + `pages_show_list` (Instagram lead ingestion dependency). **App review can take days — it is the schedule risk for Flow D**; submit day 1.
- Obtain CIMES' WaterService base URL + API credentials from the vendor (the client requests them). Note: rate limits are undocumented; the vendor's webhooks PDF is still pending (the manual covers REST only).

**Core API + chatbot (primary flow — build first):**
- Conversation engine: city/product buttons+lists, price quote via PriceProvider, FAQ AI with caching, event-log hooks (§5.8).
- Delivery-data form + coverage/delivery-day via GeocodingProvider (#12) → `POST /api/coverage`.
- Order confirmation pipeline → WaterService #6/#7/#3 writes + retry queue + orders-sheet append → `POST /api/orders`.
- Follow-up engine, debt-reminder engine, handoff notifications (`SUPPORT_NUMBER` + `OPERATOR_PHONE`).
- Observability: structured logs per conversation; optional-toggle daily summary message to the operator (orders created, handoffs, failures).
- es-AR copy module wired throughout.

**Website (alongside core-api):**
- Static site cloning the competitor structure; self-service wizard consuming `/api/prices`, `/api/coverage`, `/api/orders` (Flow B).

**CRM (later-priority, may lag):**
- Deploy self-hosted Chatwoot (Docker; VPS sized ~2 GB+ RAM or separate instance), create the API-channel inbox, wire the backend mirror + status/label sync (`01-core-api.md` §10.3), create the terminal labels + custom attributes (`03-crm.md`).

**Throughout / before go-live:**
- E2E test the full flow **with the 10 validation addresses (set provided by the client)** — see acceptance crit 3 in `01-core-api.md §15`.
- **Parallel run:** operate the new system alongside the current sales workflow for a verification period before cutover.
- Write operator/handover docs; deploy to VPS + Hostinger; number migration to Kapso as the last step once tested.

---

*Endpoint numbers (#1, #2, #3, #6, #7, #10, #12, #21, #28 …) refer to the WaterService API manual v1.0.1. `01-core-api.md` carries the full endpoint map.*
