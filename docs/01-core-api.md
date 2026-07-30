# 01 — CORE API (backend)

**Read `00-master.md` first.** This module doc is the backend. It owns: the WaterService client, the `PriceProvider` and `GeocodingProvider` interfaces, the conversation-engine **business logic** (server side), the follow-up engine, the debt-reminder engine, the orders sheet, the event log, and the REST API that the website (`04-website.md`) and chatbot (`02-chatbot.md`) call.

**What lives elsewhere (cross-references):**
- WhatsApp send/receive mechanics — which Kapso primitive renders each step (buttons, lists, Kapso-hosted form, free text), webhook shapes, the AI system prompt and tool wiring, and the **es-AR copy module** — live in `02-chatbot.md`. This doc contains **only business logic**; wherever a message goes to the user, it references a copy key from that module and never hardcodes Spanish inline.
- The CRM (inbox, per-conversation AI toggle, lead panel, label filter/display) lives in `03-crm.md`. It reads the lead record and the `ai_enabled` field this module owns.
- The public site and its wizard live in `04-website.md`; it consumes this module's REST endpoints.
- The canonical contracts (lead record fields, label taxonomy, the 5 signup stages, AI tool names, event types, provider interfaces, REST endpoints, `ai_enabled`) are defined in `00-master.md §5`. This doc implements them and repeats the shapes it owns — the names are canonical, do not rename.

All code, identifiers, and comments in **English**. All user-facing strings in **Argentine Spanish (voseo)**, imported from the es-AR copy module (`02-chatbot.md`), never inline.

**Workspace:** this module's code lives in `src/` (shared with the chatbot layer, `02-chatbot.md` — one service). Keep the `src/CONTEXT.md` room current and log every session in `PROGRESS.md` — scaffold rules in `00-master.md §4.1`.

**Building blocks (settled — use these, don't substitute):**
- **HTTP server:** Fastify or Hono (either). Single Node.js + TypeScript service.
- **State:** SQLite via `better-sqlite3`. No ORM required.
- **Jobs, timers, retries:** one SQLite `jobs` table + a polling loop, written in this codebase. This runs the follow-up timers (§7), debt crons (§8), dispatch scheduler (§4.5), retry queue (§4.5), and mirror retries (§10.3). **No Redis, no BullMQ, no external queue/workflow service.** Must satisfy the restart-safety guardrail (§13).
- **WaterService boundary validation:** `zod` schemas per endpoint — coerce numeric strings, parse `/Date(ms)/` timestamps (§1 quirks).
- **Google Sheets:** `google-spreadsheet` (or official `googleapis`) with the service account.
- **Stage machine:** plain enum + transition function. No XState / state-machine library — 5 linear stages don't need one.
- **AI calls:** official Anthropic TypeScript SDK directly (`02-chatbot.md` §11). No LangChain, no agent frameworks.

Endpoint numbers (#1, #2, #3, #6, #7, #10, #12, #21, #28 …) refer to the **WaterService API manual v1.0.1 (2026-03-03), "Manual de Usuario API – Integración Chatbot"**. This module owns every WaterService call, so the full endpoint map is carried here (§1) as ground truth.

---

## 1. WaterService API integration map

*(Verified against the API manual v1.0.1, 2026-03-03. **Manual quirks that apply to every call — see also the WaterService guardrails in §13:** errors return HTTP 200 with `error != 0` in the body — always check the `error` field, never the HTTP status; response timestamps come in .NET format `/Date(1753112501144)/`; request dates are sent as `dd/MM/yyyy` strings; some numeric fields arrive as strings and must be coerced.)*

**Auth (#1):** `POST /api/Session/GetToken` `{username, password}` → `tokenValido` (40-char) + `vencimiento`. Send on every other call as header **`CURRENTTOKENVALUE`**. Cache the token, re-login on expiry / auth error. **All calls server-side only** (`WATERSERVICE_USER` / `WATERSERVICE_PASSWORD` / `WATERSERVICE_BASE_URL`).

### 1.1 Endpoints in scope — sales flow

| # | Endpoint | Used for / key facts |
|---|----------|----------------------|
| 12 | `GET /Repartos/BusquedaClientesCercanosResultJson` `{address, metros}` | **Primary coverage tool and default `GeocodingProvider` implementation.** Geocodes the address itself (returns `coordenadas`) and lists neighbors, each with `listaDePrecios_id`, `visitas[]` (`dia`, `reparto_id`, `nombreReparto`), `ultimasVisitas` (`horarioMin/Max/Prom`, `cantidadVisitas`), `proximaVisita`, `diasProximaVisita`. **One call resolves: coverage, route, weekday, time window, price list, and coordinates for the alta.** Google Geocoding not required (kept only as a swappable adapter — see §3). `metros` = `COVERAGE_RADIUS_M`. |
| 4 | `GET /Repartos/ObtenerClientesCercanosPorCoordenadas` `{excluir, latitud, longitud, radioMetros}` | Same data, keyed by coordinates. Fallback/secondary — use when you already hold coordinates (e.g. from the Google Maps geocoding adapter) instead of a raw address string. |
| 5 | `GET /ListaDePrecios/ObtenerListaDePreciosDeCliente` `{ClienteId}` | Article→price map of a specific (nearest) client's list. Used by `PriceProvider` (waterservice impl) to resolve the exact prices for the neighbor-derived `listaDePrecios_id`. |
| 10 | `GET /ListaDePrecios/ObtenerMatrizListaDePrecios` `{tipoLista_id}` | Full price matrix + list names. Load at startup, refresh daily; cache only the **resolved** list into the AI prompt per conversation (never two cities' lists at once). Also the reference used by the daily sheet-consistency check when `PRICES_SOURCE=sheet`. |
| 11 | `GET /AbonosTipos/ObtenerAbonosTipos` `{activo: true}` | Frío/calor subscription types + prices (`nombreAbono`, `precio`, `leyendaFacturacion`). Feeds product/quote answers about dispenser rental. |
| 2 | `POST /api/Clientes/BusquedaRapidaResultJson` `{telefono \| datosCliente \| dni \| domicilio}` | Existing-client lookup **by phone**. Returns `fechaProximaVisita1/2/3`, `usuarioRepartidorHabitual`, `reparto_id`, `etiquetas`. Powers (a) **dedupe before #6** and (b) the support line ("¿cuándo pasa el repartidor?" answered from data). |
| 8 | `POST /api/Clientes/ObtenerDatosCliente` `{cliente_id}` | Client detail incl. `diaProximaVisita1-3`. Use when you already have a `cliente_id` and need full detail. |
| 6 | `POST /Clientes/CrearNuevoClientePorChatBot` | **Purpose-built for this bot. The alta.** Payload: `cliente {nombre, tipoDeClienteId: 1 (Familia), actividadId: 15 (Consumidor final), condicionIvaId: 2 (Consumidor Final), telefono, email, listaDePreciosId, reparto_id, domicilio {provincia, ciudad, calle, puerta, piso, depto, observaciones, cp, latitud, longitud}}`. `listaDePreciosId`, `reparto_id`, and `latitud`/`longitud` **all come from the #12 response** — do not re-derive them. Creates the client in **`Borrador`** state → returns `cliente_id`. Note: no flow collects `email` — send it empty/null; raise with the vendor only if #6 rejects that. |
| 7 | `POST /api/Clientes/CreateContacto` | Attach the WhatsApp number to the client just created: `tipoContacto_ids: 1` (Primer contacto), `sector_ids: 6` (Titular), `celular`, notification flags (`enviarAvisoDeProximaVisita` etc. — **default false**, revisit later). |
| 3 | `POST /api/Incidentes/Save` | **The "driver ticket" is an Incident.** For a new-client delivery: `tipoIncidente_ids: WS_INCIDENT_TYPE_ID` (default `1` = Gestión en ruta) + `subTipoIncidente_ids: WS_INCIDENT_SUBTYPE_ID` (default `28` = Visita por alta). Payload: `centroDistribucion_id` (from `WS_CENTRO_DISTRIBUCION_MAP[city]`), `cliente_id`, `titulo`, `descripcion` (HTML: product, time window, amount to collect), `fechaCierreEstimado` (`dd/MM/yyyy` = delivery date), `severidad_ids` (`WS_SEVERITY_ID`, default `2` = Media), and assignment via **`usuarioResponsable_id`** (driver's user id — derivable from neighbors' `usuarioRepartidorHabitual` in the #12 response) **OR** **`grupoResponsable_ids`** (mutually exclusive — the unused one must be null). **Called by the dispatch scheduler the day before delivery, not at order confirmation (§4.5/§4.6).** See the driver-ticket note in §12. |

**Keep the WaterService client wrapped per-endpoint** (one thin wrapper per endpoint, not a generic mega-client): out-of-scope endpoints (#17 delivery notes, #20 payments, #26 incidents, #16 work orders) can then be added later without refactoring.

**Per-environment ID warning (kept, not a blocker):** `tipoIncidente_ids` / `subTipoIncidente_ids` and `centroDistribucion_id` are **per-environment** in WaterService. Keep the drafted defaults exactly as configured (`WS_INCIDENT_TYPE_ID=1`, `WS_INCIDENT_SUBTYPE_ID=28`, `WS_SEVERITY_ID=2`, `WS_CENTRO_DISTRIBUCION_MAP` per city). **Defaults are assumed from the manual's example environment. The client will confirm the real values with the WaterService vendor before/during build — no further design work needed here, just use the configured values.** Do NOT build a vendor-confirmation workflow; it is a phone call. (Same note in §12 near the ticket logic.)

### 1.2 Endpoints in scope — debt reminder engine (see §8)

| # | Endpoint | Used for |
|---|----------|----------|
| 28 | `GET /Facturacion/ObtenerFacturasConSaldoModificado` `{desde, pagina, cantidadXPagina}` | Nightly incremental sync of balance changes, **paginated via `HasMore`**, into the local debt table. |
| 21 | `GET /api/Movimientos/ObtenerSaldosDeCliente` `{clienteId}` | Per-client balance verification **right before sending** a reminder (`saldoCuentaFacturacion`, `fechaUltimoCobro`, `diasVisita`). Never remind someone who just paid. |
| 14 | `POST /Recibos/ObtenerRecibosDeCobros` | Check "ya pagué" claims against receipts before handing off. |
| 29 | `POST /Reportes/ObtenerClientesDashboard` (appendix `filtros`, `idsDiasDeVisitas`) | Optional helper: bulk-list clients by visit weekday (alternative to reading `fechaProximaVisita1` per client via #2/#8). |

---

## 2. `PriceProvider` interface (PRICES_SOURCE — FULLY OPEN, no forced default)

The AI reaches prices **only** through this provider (guardrail §13). No hardcoded or model-recalled prices, ever. The provider is **fully swappable** via `PRICES_SOURCE`; **do not force a default** — this is a genuinely open item (`00-master.md §10a`). Build the abstraction so either implementation drops in cleanly.

```
interface PriceProvider {
  // catalog + prices for a given city (never mixes two cities' lists)
  getCatalog(city: string): Promise<PricedCatalog>;
  // resolve prices for a specific WaterService price-list id (from #12 neighbors)
  getPricesForList(listaDePreciosId: string): Promise<PricedCatalog>;
}
```

**Implementations selected by `PRICES_SOURCE`:**

- **`waterservice`** — prices from WaterService. `getPricesForList` → #5 for the exact neighbor-derived list; full matrix + list names via #10 (loaded at startup, refreshed daily). Abono types via #11.
- **`sheet`** — prices from a Google Sheet (`PRICES_SHEET_ID`), refreshed roughly every ~15 min. When this impl is active, run a **daily consistency check against #10** and, on any mismatch, raise an **operator alert** (to `OPERATOR_PHONE`). The client confirms which source is the maintained one.

Provisional first quote: at `producto` stage, before coverage runs, the provisional price list comes from `CITY_PRICE_LIST_MAP[city]`. The **final** price list is the location-based `listaDePrecios_id` returned by #12 neighbors (§4, coverage). **Re-quote if the resolved list differs from the provisional one.**

---

## 3. `GeocodingProvider` interface (decision 9 — assume it works, swappable, NO validation gate)

```
interface GeocodingProvider {
  // returns coordinates AND (for the #12 impl) the neighbor/coverage payload in one call
  resolve(address: string, radiusMeters: number): Promise<CoverageResult>;
}
```

- **Default implementation = WaterService #12.** It geocodes the address *and* returns neighbors/coverage in a single call, so `resolve` yields coordinates, `listaDePrecios_id`, routes, weekdays, and time windows together.
- **Google Maps adapter** (`GOOGLE_MAPS_API_KEY`) sits behind the **same interface**, swappable via config/flag. When it is active, it geocodes to coordinates, then coverage is resolved via **#4** (by coordinates) instead of #12.

**No manual validation gate.** Do **not** add a "validate against 10 real addresses before trusting it" step. Assume #12 works; keep it swappable. This is settled — do not re-introduce a validation step.

---

## 4. Conversation engine core (server-side business logic)

This is the **server-side** logic of the flows. The WhatsApp rendering of each step (which Kapso primitive) is in `02-chatbot.md`; free-text extraction and the AI tools are also there. The engine here owns state, WaterService/provider calls, stage transitions, and the order pipeline.

**Signup stages (canonical, `00-master.md §5.4):** `inicio → producto → datos_entrega → dia_entrega → confirmacion → cliente_cerrado`. `producto` and price are **merged** — picking a product triggers an immediate quote in the same exchange; there is no separate `precio` stage. `stage` on the lead record always holds one of these values.

### 4.1 Flow A — Inbound WhatsApp lead (user writes first; free 24h session, no template cost)

1. **`inicio`** — greet; resolve **city**. If the user free-typed city (+ product) in their first message, extract and skip the redundant step (hybrid input — see `02-chatbot.md`). City not covered → label `otra_ciudad`, polite no-coverage reply, end.
2. **`producto`** — resolve **product** from the catalog and **quote immediately** in the same exchange via `PriceProvider.getCatalog(city)` (provisional list from `CITY_PRICE_LIST_MAP`). Quote **only that city's price list**.
3. **FAQs** — the AI answers grounded FAQs (frío/calor rental model, weekly visit cadence, bidón deposit vs rental, bajo sodio, delivery windows) from the knowledge base only. Unknown → handoff (§5).
4. **`datos_entrega`** — collect delivery data: full name (pre-filled from WhatsApp profile name when it looks real), street, number, cross streets ("entre calles"), optional notes. (Rendered via the Kapso-hosted form — `02-chatbot.md`.)
5. **Coverage check** — one call through `GeocodingProvider.resolve(address, COVERAGE_RADIUS_M)` (default impl #12) → resolved coordinates + neighbors with route, scheduled weekday, time window (`horarioProm`), `listaDePrecios_id`, and usual driver (`usuarioRepartidorHabitual`).
   - **No neighbors in radius** → label `mal_lead`, notify operator for manual review (edge: genuinely new zones). Do **not** invent a `sin_cobertura` label — the taxonomy is fixed (`00-master.md §5.3`).
   - **Resolve the price list from the nearest neighbors' `listaDePrecios_id`** (location-based — stronger than a city→list map). **Re-quote if it differs** from the provisional city quote (step 2).
   - Emit `coverage_checked` event.
6. **`dia_entrega`** — offer **delivery-day options**, each with route + weekday + time window (e.g. `Reparto 19 — sábado entre 10 y 13`). Sourced from the #12 `visitas[]` / `ultimasVisitas` data.
7. **`confirmacion`** — order summary (product, price, address, delivery day/window) + confirm.
8. **On confirm → the order confirmation pipeline (§4.5).** Runs the WaterService writes, sheet append, label, confirmation message. On success the stage becomes **`cliente_cerrado`**.

### 4.2 Flow B — Web self-service signup (no WhatsApp)

The website completes the entire signup on-page via this module's REST endpoints (§9), mirroring Flow A's stages:

1. City select → catalog **with that city's prices** (`GET /api/prices?city=`).
2. Delivery-data form: name, phone (WhatsApp), street + number + cross streets.
3. Live coverage check (`POST /api/coverage` → GeocodingProvider/#12) → available delivery days with time windows; user picks one.
4. Confirm (`POST /api/orders`) → **the same order pipeline as Flow A (§4.5)** with `source=web`, label `cliente_cerrado`.
5. No coverage → polite on-page message; lead saved with `otra_ciudad` (out-of-city) or `mal_lead` (in-city, no neighbors).
6. **Optional** (`WEB_CONFIRMATION_TEMPLATE`, default `false`): send one utility template confirming the order ("te lo llevamos el sábado entre 10 y 13"). The pipeline decides whether to request it; the actual send goes through the chatbot layer (`02-chatbot.md`).

**No follow-up sequence applies to web signups** — they either complete or abandon. Follow-ups (§7) are WhatsApp-only.

### 4.3 Flow D — Instagram Instant Forms lead (business logic)

Meta platform setup (leadgen webhook subscription, permissions, Ads Manager config) lives in `02-chatbot.md §7`; the app-review submission is a day-1 item (`00-master.md §11`). Business logic here: on webhook, backend fetches the lead → **normalize into the standard lead record** (`source=instagram`) → append sheet row → the chatbot layer sends **one utility template** greeting that acknowledges the submitted data (never re-asked). The user's reply opens the 24h window and the conversation continues at Flow A from the coverage step onward (address already submitted); the **follow-up engine applies from their first reply onward**. IG cannot complete the order in-app — the WhatsApp continuation is required.

### 4.4 Flow C — Existing client writes on the support number

Lookup via #2 (by phone) / #8 (by id). If recognized, the AI answers account/service questions it can ground (e.g. next visit date from `fechaProximaVisita1`, general FAQs); otherwise handoff (§5). Support automation is intentionally thin — **FAQ answers + handoff only. Do NOT automate support incidents (#26) or service work orders (#16); those endpoints stay out of the build** (the per-endpoint client wrapping in §1 keeps them addable later).

### 4.5 Order confirmation pipeline (the shared closer — Flow A step 8, Flow B step 4, `POST /api/orders`)

This is the single pipeline behind order confirmation from **every** source. It MUST be **idempotent per lead** (guardrail §13) and land the full result with **zero operator input**.

**No structured order is sent to WaterService — by design (settled, confirmed with the client).** The WaterService *chatbot* API (manual v1.0.1) has **no order / pedido / venta / abono creation endpoint** — its only writes are #6 (alta), #7 (contact), #3 (incident/ticket), and #20 (MercadoPago link). So the order travels as the **#3 ticket's `descripcion` note** (product summary, time window, amount to collect); CIMES staff/route then convert that note into the real pedido/venta *inside* WaterService. Do **not** look for an order endpoint or re-litigate this. **Scope boundary:** our responsibility ends when that note reaches WaterService correctly and completely — the send succeeding (dispatch cron running + verified live) and the note carrying the right fields are ours; everything downstream of the note is CIMES's.

1. **Dedupe / existing-client check.** Before creating a client, look up an existing WaterService client by phone via **#2**. If found, reuse its `cliente_id` — do not create a duplicate alta.
2. **Create client — #6** (`CrearNuevoClientePorChatBot`) using `reparto_id`, `listaDePreciosId`, and lat/lng **from the coverage (#12) result** → `cliente_id` (client created in `Borrador`). Store on the lead record as `waterservice_client_id`.
3. **Attach contact — #7** (`CreateContacto`): the WhatsApp number, `tipoContacto_ids:1`, `sector_ids:6`.
4. **Schedule the driver ticket — #3 is NOT called here.** The pipeline stores the order (§4.6) with status `pending_dispatch`. The **dispatch scheduler** (daily cron) calls **#3** (`Incidentes/Save`, "Visita por alta") **the day BEFORE the delivery date**, reading the order's **current** state at that moment — so operator edits up to then are picked up (guardrail §13). Ticket fields at dispatch: assigned to the route's usual driver (`usuarioResponsable_id` from neighbors' `usuarioRepartidorHabitual`) or the responsible group; `descripcion` = product, time window, amount to collect; `fechaCierreEstimado` = delivery date (`dd/MM/yyyy`). **`ticket_id` exists only after dispatch** — the scheduler stores it on the order + lead record and updates the sheet row then. **See the driver-ticket note in §12.**
5. **Append orders-sheet row** (§10).
6. **Label `cliente_cerrado`** (§11) and set stage `cliente_cerrado`.
7. **Send confirmation message** to the customer (copy key from es-AR module, sent via `02-chatbot.md`).
8. **Emit `order_confirmed` event** (§10.1).

**Operator override (order edit until dispatch):** until the ticket dispatches (day before delivery), the order stays editable — route/day can be changed manually (explicit client request: when several routes serve a zone, the operator may want to decide). The backend must expose an **order-update path** (route/day mutation on the pending order); the scheduler reads the order's **current** state at dispatch time (guardrail §13). Chatwoot (`03-crm.md`) has no order editor — edits happen directly on the stored order (§4.6) / sheet.

**Failure handling:** any WaterService or Sheets write failure → the order goes to a **retry queue** and the operator is notified (`OPERATOR_PHONE`). Never silently drop a confirmed order. Set `sync_status` on the lead record (`pending`/`synced`/`failed`) so the CRM lead panel can surface it. Replay from the queue must be idempotent (re-running must not create a second client/ticket — hence the #2 check and stored ids).

### 4.6 Stored order (SQLite `orders` table)

The pipeline persists each confirmed order as a row in a SQLite `orders` table. This is what the dispatch scheduler and the operator-override path operate on; the lead record only mirrors the sync fields.

```
id (order_id) | lead_id | product | price | amount_to_collect |
route (reparto_id) | delivery_day | delivery_window |
status (pending_dispatch | dispatched | failed) | ticket_id | created_at
```

For a multi-item web order (§9) `product` holds the summary line (`"2x A, 1x B"`) and `price`/`amount_to_collect` the order total. The schema stays scalar (one row per order); line items are not stored separately.

`POST /api/orders` returns this `order_id`. Operator edits (route/day — §4.5 override) mutate the row while `status = pending_dispatch`; the scheduler flips it to `dispatched` after a successful #3 call and stores `ticket_id`.

---

## 5. Handoff logic

Trigger: AI confidence low, question outside the knowledge base, explicit user request, or complaint. This is the `handoff` AI tool (`00-master.md §5.5`). On handoff:

1. **Set the shared state field `ai_enabled = false`** on the conversation/lead record. This is the **same field** the CRM's per-conversation AI toggle reads/writes (`00-master.md §5.2`; `03-crm.md` toggling off = human takeover, toggling on = resume). There is exactly one field — do not create a variant. While `ai_enabled = false`, the conversation engine does not auto-reply on that conversation.
2. **Apply label `derivado`.**
3. **Notify the operator** (`OPERATOR_PHONE`) — a WhatsApp message with a deep link to the conversation in Chatwoot (§10.3), and flip that Chatwoot conversation to `open`.
4. **Tell the user to write to the support number** (decision 6): the user-facing handoff message instructs the user to message `SUPPORT_NUMBER`. `SUPPORT_NUMBER` is a **required-but-currently-unknown** placeholder — the client (Lisandro) provides the real number later; ship with a clear placeholder. Copy key from the es-AR module.
5. **Emit `handoff` event.**

Both behaviors happen — notify operator **and** tell the user the support number. Not either/or.

---

## 6. Conversation memory (`00-master.md §5.1`; PRD 4.5)

Per-contact state in **SQLite, keyed by phone**: name, city, address, product interests, `stage`, `labels`, `ai_enabled`, order history, and the sync fields (`waterservice_client_id`, `ticket_id`, `sync_status`). A returning contact — even weeks later — is **never re-asked known data**: on inbound, load the existing lead record by phone and resume from what is already known. This is the canonical lead record (`00-master.md §5.1`); `03-crm.md` reads it for the lead panel.

---

## 7. Follow-up engine (WhatsApp only; PRD 4.6) — business logic

The engine re-engages silent WhatsApp leads inside Meta's free 24h window. WhatsApp send mechanics reference `02-chatbot.md`; the timing/state logic is here.

- **Stages it operates over — the 5 working signup stages:** `inicio`, `producto`, `datos_entrega`, `dia_entrega`, `confirmacion`. (`cliente_cerrado` is terminal — no follow-ups.) Copy is stage-specific (e.g. at `datos_entrega`: "Nos faltan solo tus datos de entrega…"), keyed from the es-AR module.
- **Timers start from the lead's last message (T):**

| Timer | Action |
|---|---|
| **T+1h** | Follow-up 1 — stage-specific copy. |
| **T+8h** | Follow-up 2 — **deferred to next morning if it falls outside `BUSINESS_HOURS`** (default `09-21`). |
| **T+23h** | Follow-up 3 — sent at **23h, not 24h**: Meta's free customer-service window closes exactly 24h after the lead's last message; after that any message is a paid template. |
| No reply after 3 | Label `sin_respuesta`; bot stops on that chat. |

- **A lead reply cancels pending timers, advances the stage if applicable, and resets `followup_count` to 0 at the (new) stage.**
- **Global cap `MAX_FOLLOWUP_CYCLES=2`** full cycles per lead — do not chase forever.
- **No follow-ups** when the conversation is in a terminal label (`00-master.md §5.3`) or `derivado` / `ai_enabled=false` (a human owns it).
- **All follow-ups ride the open 24h window → $0** (no paid template).
- Timers are configured via `FOLLOWUP_SCHEDULE` (default `1h,8h,23h`) and `BUSINESS_HOURS`. **Timer state persists in SQLite and is reconstructed on boot** (crons must be idempotent and restart-safe — guardrail §13). Emit `followup_sent` / `followup_reply` events.

---

## 8. Debt reminder engine (PRD 4.7) — visit-eve balance reminders

**Payment happens at the door** when the product is delivered — there is no online payment (no Mercado Pago links / #20 — that stays out of the build). **This is a reminder so the client has the money ready, NOT dunning.** A fixed-day blast to all debtors was discarded: not actionable for the client, and block-reports would hurt the WhatsApp number's quality rating — remind only on visit-eve.

> **Vendor to confirm:** whether frío/calor **abono** debt surfaces in the invoice balances read via #28/#21 (`facturacionAutomatica`). The engine's selection depends on it.

1. **Nightly sync** — pull balance deltas via **#28** (`desde` = last sync watermark), **paginated via `HasMore`**, into a **local debt table**. Idempotent + restart-safe.
2. **Select clients** where **all** hold: next visit is **tomorrow** (from `fechaProximaVisita1` via #2/#8, or #29 filtered by `idsDiasDeVisitas`) **AND** balance `> DEBT_THRESHOLD` (default `0`) **AND** no reminder within `DEBT_REMINDER_COOLDOWN_DAYS` (default `14`) **AND** the client is **not in the suppression list**.
3. **Re-check balance immediately before sending — #21** (`ObtenerSaldosDeCliente`). Never remind someone who just paid.
4. **Morning send** at `DEBT_REMINDER_SEND_HOUR` (default `09`): a **utility template**, neutral copy (visit tomorrow + pending amount, payable directly to the driver — no promo content, keeps the utility classification). Emit `debt_reminder_sent`. Template send goes through `02-chatbot.md`; the template must be pre-approved (day-1 task).
5. **Opportunistic mention** — if a client with debt writes for anything (open 24h window), append the balance note at **$0** (no template).
6. **Opt-out** ("no me manden más recordatorios") → add to the **suppression list**; emit `opt_out`.
7. **"Ya pagué"** → check receipts via **#14**; if the payment is confirmed, acknowledge and suppress the reminder for that cycle; otherwise **handoff** (§5).

"Tomorrow" is computed in `America/Argentina/Buenos_Aires` (guardrail §13).

---

## 9. REST API (consumed by website & chatbot)

Match `00-master.md §5.6` exactly. All are backend endpoints; WaterService/Sheets calls happen server-side.

### `GET /api/prices?city=<city>`
Returns the catalog with **that city's** prices (via `PriceProvider.getCatalog(city)`). Never mixes two cities' lists.
```
200 → {
  city: string,
  price_list: string,                 // resolved listaDePrecios_id used
  products: [ { id, name, price, unit, notes? } ]
}
```

### `POST /api/coverage`
Body: composed address (+ city). Runs `GeocodingProvider.resolve(address, COVERAGE_RADIUS_M)` (default #12).
```
Request:  { city: string, address: string, cross_streets?: string }
200 →     {
  covered: boolean,
  coordinates: { lat: number, lng: number } | null,
  price_list: string | null,          // location-based listaDePrecios_id
  delivery_options: [                  // empty if not covered
    { route: string, weekday: string, time_window: string }
  ]
}
```
Emits a `coverage_checked` event.

**How it resolves (end-to-end call chain).** The runtime path from the browser to WaterService:

1. The browser (website wizard **step 4**) POSTs here — it **never calls WaterService directly**. The whole coverage decision is server-side.
2. This endpoint runs `GeocodingProvider.resolve(address, COVERAGE_RADIUS_M)` (§3).
3. Default provider → WaterService endpoint **#12** (`BusquedaClientesCercanosResultJson`), one authenticated GET (token cached as `CURRENTTOKENVALUE`, re-login on expiry). It geocodes the address *and* returns nearby existing clients ("neighbors") in a single call.
4. Mapping in `providers/geocoding.ts`:
   - `covered` = at least one neighbor within the radius.
   - `delivery_options` = every neighbor's `visitas`, deduped by `reparto_id + weekday` → `{ route, weekday, time_window }` (window built from `horarioMin/horarioMax`).
   - `price_list` = the **nearest** neighbor's `listaDePrecios_id` (distance-sorted).
   - `coordinates` = the geocoded point (falls back to the nearest neighbor's).

Everything here is **deterministic — the AI never decides coverage, delivery days, or price** (`00-master §6`); those come only from #12. Google Maps adapter path (`GEOCODING_PROVIDER=googlemaps`): geocode to coordinates, then coverage via **#4** by coordinates instead (§3).

**Time window provenance.** `time_window` comes only from the neighbor's `ultimasVisitas` hours (`horarioMin`/`horarioMax`); if those are absent, the copy is **"en horario a confirmar"** — a window is **never invented or defaulted to a fixed slot**. `ultimasVisitas` is WaterService's rolling **last-N-visits** aggregate (≈11 observed in live data — count-based, not a calendar window), so the window is a **historical envelope of real arrival times, not a promised slot**, and can be wide (e.g. `11:39`–`17:10`). Delivery options are scoped to the **serving reparto** (nearest neighbor's route), deduped one-per-weekday — not every route in radius (that produced dozens of redundant options and could mis-assign the reparto on alta).

### `POST /api/orders`
Body: the full order. Runs the **order confirmation pipeline (§4.5)**: #6 client + #7 contact + #3 driver ticket (dispatched day-before by the scheduler) + orders-sheet row + label `cliente_cerrado`. **Idempotent per lead** (dedupe by phone via #2; safe to retry).

Multi-item: the website sends `items: [{product, qty}]` (product = catalog name or id). The server resolves each against the city's price list (**prices never client-supplied**), sums the **total**, and stores the order as a single summary line (`product = "2x A, 1x B"`) with `price`/`amount_to_collect` = the total. This keeps the order one row / one ticket / one sheet row (the driver ticket lists the items as text). A single `product: string` is still accepted (legacy single-item / chatbot path). An item not in the price list → `422 { error: "unknown_product" }`.
```
Request:  {
  source: "whatsapp" | "web" | "instagram",
  name, phone, city, address, cross_streets,
  items: [{ product, qty }],   // preferred; or a single `product` string (legacy)
  delivery_day, delivery_window
}
200 →     {
  order_id: string,
  waterservice_client_id: string,
  ticket_status: "scheduled",              // #3 always fires at day-before dispatch (§4.5/§4.6); ticket_id exists only after dispatch
  sync_status: "synced" | "pending" | "failed",
  label: "cliente_cerrado"
}
```

### `POST /api/waitlist`
Uncovered-area lead capture for the website's "Otra ciudad" form (04-website §5). Create/update the lead by phone (#2), store the free-text zone in `city` and the optional comment in `notes`, set label `otra_ciudad`, and queue a lead-only orders-sheet row (same sheet job as Instagram leads). **No coverage check, no order pipeline.** Idempotent per phone (the sheet row dedupes on `sheet_waitlist:<lead_id>`).
```
Request:  {
  source: "web",
  name, phone, city,                    // city = free-text city/zone the visitor typed
  comment?,                             // stored in the lead's notes
  utm_source?, utm_medium?, utm_campaign?, utm_content?, utm_term?, fbclid?, gclid?
}
200 →     { ok: true }
```
Emits `lead_created` (only when the lead is new). No new label/event type — `otra_ciudad` and `lead_created` are the canonical existing values.

### `GET /api/export/events?from=&to=`
Operator-triggered CSV export of the `events` table (§10.1) over a date range, **in order**. `from`/`to` are dates. Returns `text/csv` with all rows in the range in chronological order.

---

## 10. Orders sheet (Google Sheets; PRD section 6)

Operator-facing **mirror, not source of truth**, **updated in real time** by the backend (write the row as part of the pipeline, not on a batch schedule) via the **Sheets API service account** (`GOOGLE_SERVICE_ACCOUNT_JSON`), **not** through Kapso. One row per order/lead event. Sheet id is configurable (`ORDERS_SHEET_ID`).

**Columns (in order):**
```
timestamp, source (whatsapp|web|instagram), name, phone, city, address, cross_streets,
product, price, price_list, route (reparto), delivery_day, delivery_window,
client_type (frio_calor|bidon|soda), amount_to_collect, label,
waterservice_client_id, ticket_id, conversation_link, notes
```

### 10.1 Event log (raw analytics capture — no UI; PRD 6.1)

**Purpose:** capture **transitions, not just current state**, so funnel analysis is possible later. No dashboards, no reports, no scheduled digests — **raw capture + CSV export only.**

Append-only **SQLite table `events`** — rows are never updated or deleted:
```
id | timestamp (UTC) | lead_id | source (whatsapp|web|instagram) | city |
event_type | stage | followup_count | metadata (JSON: product, label, template, reason…)
```

**Event types (canonical, `00-master.md §5.8):**
`lead_created`, `stage_entered`, `message_in`, `message_out`, `followup_sent`, `followup_reply`, `coverage_checked`, `label_applied`, `order_confirmed`, `handoff`, `opt_out`, `debt_reminder_sent`.

Emitted via **hooks** in the conversation engine / follow-up engine / order pipeline (same code paths already being built — near-zero marginal cost). Timestamps stored in **UTC**; local-day logic computed in `America/Argentina/Buenos_Aires`. Conversation transcripts are retained and linked by `lead_id`. Volume is trivial (~15–20k rows/month); retain indefinitely. **Export:** `GET /api/export/events?from=&to=` (§9).

### 10.2 Observability

- **Structured logs per conversation** (the event log is analytics capture; it does not replace per-conversation operational logs).
- **Daily summary message to the operator** — orders created, handoffs, failures — behind an **optional toggle**.
- **Cost counter:** a simple daily cron projects the month-end API/platform spend and alerts the operator if it exceeds a configured threshold.

### 10.3 CRM mirror (Chatwoot — see `03-crm.md`)

The operator inbox is a self-hosted Chatwoot instance on an **API-channel inbox**; this module owns the mirror code. Kapso stays the only WhatsApp transport — Chatwoot never talks to WhatsApp.

- **Outbound mirror:** on first contact create the Chatwoot contact (by phone) + conversation (store the conversation id on the lead record); post every inbound lead message (`incoming`) and every bot/system send (`outgoing`); keep labels (terminal taxonomy), custom attributes (`stage`, `followup_count`, `city`, `product`, `price`, `delivery_day`, `delivery_window`, `sync_status`, `waterservice_client_id`, `ticket_id`) in sync with the lead record.
- **Inbound webhook** (verify `CHATWOOT_WEBHOOK_SECRET`): agent reply → send to the lead via the Kapso layer (`02-chatbot.md`) and record as human-sent `message_out`; `conversation_status_changed` → sync `ai_enabled` (`open`→false, `pending`→true; `resolved` = archived — on a later inbound, reopen to `pending` unless `derivado`/terminal, then `open`); manual label changes → sync to the lead record's `labels`.
- **Handoff (§5) also flips the Chatwoot conversation to `open`.** `ai_enabled` on the lead record stays the canonical gate (`00-master.md` §5.2); Chatwoot status is its UI surface.
- Mirror failures must never block the conversation flow — queue and retry them like other external writes; the lead record is the source of truth.

---

## 11. Labels — data model (PRD section 5)

This module **owns the data model and the auto-apply rules**; `03-crm.md` owns filter/display. Two dimensions, stored on the lead record's `labels` and shown together in the CRM and the sheet.

**Dynamic stage label** — format `{stage}:{followup_count}` (e.g. `datos_entrega:2` = stuck at delivery-data, 2 follow-ups sent). `{stage}` is one of the 5 signup stages. Powers the funnel view (leads per stage → where conversions die); the report/dashboard itself is **not** built — raw capture + CSV export only (§10.1).

**Terminal labels** — auto-applied where noted, manually overridable in the CRM. Every auto-apply emits a `label_applied` event.

| Label | Auto rule |
|---|---|
| `sin_respuesta` | Follow-up sequence exhausted (3 sends) without reply |
| `interesado` | ≥ 2 user exchanges or asked prices |
| `cliente_cerrado` | Confirmed order (order pipeline §4.5) |
| `pedido_cerrado` | Delivered — **manual toggle only** in the CRM. Do **not** build auto-labeling from delivery notes / WaterService webhooks; that is a deliberate task boundary |
| `mal_lead` | Operator-defined bad zone / unreachable address (incl. in-city coverage check with no neighbors) |
| `otra_ciudad` | City outside coverage |
| `derivado` | Human handoff triggered (§5) |

---

## 12. Driver-ticket note & module open items

**Driver-ticket note (decision 8) — restated here next to the #3 logic (see §1.1, §4.5):**
> **Defaults assumed from the manual's example environment (`WS_INCIDENT_TYPE_ID=1`, `WS_INCIDENT_SUBTYPE_ID=28`, and the per-city `WS_CENTRO_DISTRIBUCION_MAP` / severity / driver-vs-group assignment). The client will confirm the real values with the WaterService vendor before/during build — no further design work needed here, just use the configured values.** Do not build a vendor-confirmation workflow; it is a phone call.

**Open items owned or touched by this module:**
- **(a) Price source of truth — FULLY OPEN.** `PRICES_SOURCE` selects the `PriceProvider` impl (`waterservice` #10/#5, or `sheet`). Build the abstraction so either works; **do not force a default.** If `sheet`, run the daily sheet-vs-#10 consistency check with an operator alert on mismatch.
- **(b) Coverage radius — SETTLED.** `COVERAGE_RADIUS_M=10000`. 10 km ≈ whole city, so effectively an off-switch until tightened later. One line, no further discussion.
- **(d) WaterService per-environment IDs — a phone call, not a blocker.** See the driver-ticket note above.
- **(e) Vendor items to confirm at setup (not design blockers):** real price-list count + `tipoLista_id`s (the call mentioned only Mercedes + Campana — pull the full matrix via #10 and confirm); whether frío/calor abono debt surfaces in #28/#21 balances (`facturacionAutomatica` — §8); rate limits (undocumented); webhooks PDF pending (manual covers REST only).

---

## 13. Implementation guardrails (this module)

Full guardrail set is in `00-master.md §6` — **read it.** Because this module owns every WaterService call, the **WaterService-specific** guardrails are restated here:

- **WaterService always returns HTTP 200.** Check the response **body's `error` field** (`error != 0` = failure), never the HTTP status. Treating 200 as success silently accepts failures.
- **Date formats differ by direction.** Response timestamps are .NET format `/Date(1753112501144)/` — parse the epoch-ms out. Request dates are `dd/MM/yyyy` strings. Some numeric fields arrive as strings — coerce explicitly.
- **Auth token** goes in header **`CURRENTTOKENVALUE`** on every non-login call. Cache it; re-login on expiry / 401. All WaterService calls server-side only.
- **Idempotency.** Dedupe inbound WhatsApp messages by message ID. **Before #6 (create client), check for an existing client by phone via #2** to avoid duplicate altas. Pipeline replay must not create a second client/ticket (reuse stored `waterservice_client_id` / `ticket_id`).
- **Operator override window.** A confirmed order stays editable in the CRM until the driver ticket is actually dispatched (day before delivery). **The scheduler reads the order's current state AT dispatch time** — never cache route/day from confirmation time.
- **Timezone `America/Argentina/Buenos_Aires`** for all "tomorrow", business-hours, and follow-up-timer logic. Store event timestamps in UTC; compute local-day logic in this zone.
- **Per-conversation message queue.** Serialize concurrent inbound messages for the same lead through the conversation engine — never let two messages for one lead race.
- **Crons idempotent + restart-safe.** Follow-up engine, debt-reminder engine, and event-log hooks resume correctly after a restart/deploy. Persist timer/sync state in SQLite; do not rely on in-memory-only timers.
- **The AI never computes prices or coverage** — only via `PriceProvider`, `GeocodingProvider`, and the WaterService client.

---

## 14. Environment variables owned by this module

Subset of the master table (`00-master.md §8`); that table is the single source of truth for names/defaults. This module owns:

| Var | Default | Note |
|---|---|---|
| `WATERSERVICE_BASE_URL` | — | CIMES' WaterService environment |
| `WATERSERVICE_USER` | — | Auth (#1) |
| `WATERSERVICE_PASSWORD` | — | Auth (#1) |
| `WS_INCIDENT_TYPE_ID` | `1` | "Gestión en ruta". Per-env default; client confirms with vendor — just use the configured value |
| `WS_INCIDENT_SUBTYPE_ID` | `28` | "Visita por alta". Per-env default; client confirms with vendor |
| `WS_SEVERITY_ID` | `2` | Media |
| `WS_CENTRO_DISTRIBUCION_MAP` | — | city → `centroDistribucion_id`; client confirms per-env values |
| `GOOGLE_SERVICE_ACCOUNT_JSON` | — | Sheets API service account (orders sheet write) |
| `ORDERS_SHEET_ID` | — | Orders sheet id (configurable) |
| `GOOGLE_MAPS_API_KEY` | — | `GeocodingProvider` Google Maps adapter (swappable alt to #12) |
| `COVERAGE_RADIUS_M` | `10000` | Coverage radius (`metros` for #12). 10 km ≈ whole city — effectively an off-switch until tightened |
| `BUSINESS_HOURS` | `09-21` | Follow-ups outside this range defer to next morning |
| `FOLLOWUP_SCHEDULE` | `1h,8h,23h` | Timers from lead's last message; 23h stays inside Meta's free 24h window |
| `MAX_FOLLOWUP_CYCLES` | `2` | Cap full follow-up cycles per lead |
| `DEBT_THRESHOLD` | `0` | Minimum balance to trigger a reminder |
| `DEBT_REMINDER_COOLDOWN_DAYS` | `14` | No repeat reminder within this many days |
| `DEBT_REMINDER_SEND_HOUR` | `09` | Morning send hour |
| `CITY_PRICE_LIST_MAP` | — | Provisional city→list for the first quote; final from #12 neighbors' `listaDePrecios_id` |
| `PRICES_SOURCE` | *(none — fully open)* | Selects `PriceProvider` impl (`waterservice` \| `sheet`). No forced default |
| `PRICES_SHEET_ID` | — | Required if `PRICES_SOURCE=sheet` |
| `OPERATOR_PHONE` | — | Handoff / failure / sheet-mismatch notifications to operator |
| `WEB_CONFIRMATION_TEMPLATE` | `false` | Optional utility template confirming a web order (pipeline decides; sent via chatbot layer) |

**Shared / owned elsewhere but used here:**
- `SUPPORT_NUMBER` — owned by `02-chatbot.md`; **required-but-currently-unknown placeholder** (client provides later). The handoff message (§5) tells the user to write here.
- `MODEL_DEFAULT` / `MODEL_ESCALATION` / `ANTHROPIC_API_KEY` — owned by `02-chatbot.md`; relevant here only if the engine invokes the model directly.
- `CHATWOOT_BASE_URL` / `CHATWOOT_API_ACCESS_TOKEN` / `CHATWOOT_ACCOUNT_ID` / `CHATWOOT_INBOX_ID` / `CHATWOOT_WEBHOOK_SECRET` — owned by `03-crm.md`; consumed by the CRM mirror (§10.3).

---

## 15. Acceptance criteria (this module)

Backend-testable subset of `00-master.md` / PRD §12:

1. **Zero-input pipeline (crit 1 & 2, backend side).** A confirmed order (via `POST /api/orders` from WhatsApp or web) lands a WaterService **client (#6) + scheduled driver ticket (#3 fires at day-before dispatch — §4.5/§4.6) + orders-sheet row** and label `cliente_cerrado`, with **zero operator input**.
2. **Follow-up sequence + reset (crit 2-bis logic).** A silent WhatsApp lead gets up to 3 stage-appropriate follow-ups inside the 24h window; a reply cancels pending timers and resets `followup_count`; after the 3rd unanswered follow-up the lead is labeled `sin_respuesta` and the bot stops. Respects `MAX_FOLLOWUP_CYCLES` and terminal/`derivado` exclusions.
3. **Delivery-day options match manual lookup (crit 3).** For **10 sampled addresses across the covered cities (validation set provided by the client)**, `POST /api/coverage` returns the same route/weekday/time-window options the operator would find manually on the WaterService map.
4. **Returning contact not re-asked (crit 4).** A contact from ≥ 1 week ago is loaded by phone and resumed from known data — no re-asking.
5. **Out-of-coverage labeled (crit 5).** An out-of-coverage address is labeled (`otra_ciudad` for out-of-city, `mal_lead` for in-city no-neighbors) and answered politely without operator involvement.
6. **Handoff within 1 min (crit 6, backend side).** An unanswerable question sets `ai_enabled=false`, labels `derivado`, notifies the operator within 1 minute, and the user-facing message tells the user to write to `SUPPORT_NUMBER`.
7. **WaterService outage → queued + notified + replay (crit 9).** A simulated WaterService outage during confirmation queues the order, notifies the operator, sets `sync_status=failed/pending`, and a later replay succeeds **without** creating duplicate clients/tickets.
8. **Debt reminder eligibility (crit 11).** A client with balance `> DEBT_THRESHOLD` and a visit tomorrow gets one utility-template reminder in the morning; a client who **paid yesterday** does not (caught by the #21 re-check); a **suppressed** client never does.
9. **Event rows + export completeness (crit 12).** Every stage transition, follow-up, label change, and order confirmation produces an `events` row; `GET /api/export/events?from=&to=` returns them **completely and in order**.
10. **IG lead lands in the sheet (crit 10, backend side).** An Instagram Instant Form submission produces an orders-sheet row with `source=instagram` (the greeting-template side is `02-chatbot.md`'s criterion).

---

*Endpoint numbers refer to WaterService API manual v1.0.1 (2026-03-03). Contracts (`ai_enabled`, labels, stages, REST endpoints, AI tools, event types, provider interfaces) are canonical in `00-master.md §5`; this module implements them.*
