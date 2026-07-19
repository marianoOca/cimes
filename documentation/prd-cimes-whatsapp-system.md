# PRD — CIMES WhatsApp Sales & Logistics Automation

**Client:** CIMES (cimes-silva.com) — water/soda home delivery, Mercedes (Buenos Aires) + Luján, San Andrés de Giles, San Antonio de Areco, Chivilcoy, Campana, Zárate.

**Date:** 2026-07-10

**Status:** Draft v2 (2026-07-11) — single-scope project, no phases; matches the final commercial proposal

---

## 0. Language policy (IMPORTANT)

- All code, comments, identifiers, commit messages, file names, and internal docs: **English**.
- All user-facing copy (WhatsApp messages, website content, panel UI labels, templates): **Argentine Spanish (voseo)**. Copy strings must live in a dedicated module/config (e.g. `copy.es-AR.ts`), never hardcoded inline.

---

## 1. Problem & goals

CIMES currently runs sales on **Ventry** (white-label GoHighLevel CRM, ~USD 200/mo) plus **WaterService** (delivery/route management used by office + drivers). The two don't talk to each other. Pain points:

1. **Double manual data entry**: every confirmed order is manually re-created in WaterService (client + driver ticket) — ~10 min/order. With 30+ open chats, leads go unanswered.
2. **Manual coverage lookup**: to know which route (reparto) and weekday serves a lead's address, the operator searches the address on the WaterService map and inspects nearby client pins one by one.
3. **Bot failures**: mixes up the two price lists (Mercedes vs Campana), no conversation memory, re-asks data web registrants already submitted, no interactive buttons or location capture, ~30 s response delay, always replies exactly one message.

**June baseline:** ~700 inbound WhatsApp conversations → ~70 closed; ~250 web form registrations.

### Goals (success metrics)

- G1: Zero manual data entry from confirmed order → WaterService (client + ticket created via API).
- G2: Coverage + delivery-day options resolved automatically for every valid address.
- G3: Bot never quotes a price from the wrong city's price list.
- G4: Web registrants are greeted with their data pre-filled; never re-asked name/address/city.
- G5: Operator's morning workflow = review a sheet of ready orders, not read 50 chats.
- G6: Full replacement of Ventry (cancel the ~USD 200/mo subscription).

---

## 2. System architecture

```
Meta Ads / IG ─┬─► WhatsApp (2 numbers) ──► Kapso (WhatsApp API platform, Pro plan)
               │                                 │ webhooks
               └─► Website (Hostinger) ──► Backend service (Node.js + TypeScript, small VPS)
                        │ form POST               ├── Claude API (Haiku 4.5 default)
                        │                         ├── WaterService REST API
                        │                         ├── Google Sheets API (orders sheet)
                        │                         └── SQLite (conversation/order state)
                        └── static site, SEO      
Operator UI: conversation panel (Kapso Inbox if sufficient; else minimal web panel served by backend)
```

**Key stack decisions**

- **WhatsApp layer:** Kapso Pro ($25/mo, 3 numbers, 100k msgs/mo). Use Kapso webhooks + send API. Interactive buttons, lists, and WhatsApp Flows are native Meta Cloud API features exposed through Kapso.
- **Do NOT route WaterService calls through Kapso "integration calls"** (only 1,000/mo included, $0.01 after). All WaterService and Sheets calls go from our backend directly.
- **AI:** Claude Haiku 4.5 (`$1/$5 per MTok`) with prompt caching for the system prompt + price lists. Optional escalation of hard/ambiguous questions to Sonnet. Budget target: ≤ USD 20/mo at current volume.
- **Backend:** single Node.js/TypeScript service on a small VPS. SQLite for state (simple, zero-ops). Google Sheets is the operator-facing mirror, not the source of truth.
- **Website:** static, mobile-first, hosted on client's existing Hostinger. Form POSTs to backend endpoint.

---

## 3. WaterService API integration map

*(Verified against the API manual v1.0.1, 2026-03-03. Manual quirks that apply everywhere: errors return HTTP 200 with `error != 0` in the body — always check the `error` field; timestamps come in .NET format `/Date(1753112501144)/`; request dates use `dd/MM/yyyy`; some numeric fields arrive as strings.)*

**Auth (#1):** `POST /api/Session/GetToken` `{username, password}` → `tokenValido` (40-char) + `vencimiento`. Send on every other call as header `CURRENTTOKENVALUE`. Cache the token, re-login on expiry/auth error. All calls server-side only.

### Endpoints in scope — sales flow

| # | Endpoint | Used for / key facts |
|---|----------|----------------------|
| 1 | `POST /api/Session/GetToken` | Auth (above) |
| 12 | `GET /Repartos/BusquedaClientesCercanosResultJson` `{address, metros}` | **Primary coverage tool.** Geocodes the address itself (returns `coordenadas`) and lists neighbors, each with `listaDePrecios_id`, `visitas[]` (`dia`, `reparto_id`, `nombreReparto`), `ultimasVisitas` (`horarioMin/Max/Prom`, `cantidadVisitas`), `proximaVisita`, `diasProximaVisita`. One call resolves: coverage, route, weekday, **time window**, price list, and coordinates for the alta. Google Geocoding no longer required (keep only as fallback). |
| 4 | `GET /Repartos/ObtenerClientesCercanosPorCoordenadas` `{excluir, latitud, longitud, radioMetros}` | Same data, by coordinates. Fallback/secondary. |
| 5 | `GET /ListaDePrecios/ObtenerListaDePreciosDeCliente` `{ClienteId}` | Article→price map of the nearest client's list. |
| 10 | `GET /ListaDePrecios/ObtenerMatrizListaDePrecios` `{tipoLista_id}` | Full price matrix + list names. Load at startup, refresh daily; cache into the AI prompt per conversation (only the resolved list). |
| 11 | `GET /AbonosTipos/ObtenerAbonosTipos` `{activo: true}` | Frío/calor subscription types + prices (`nombreAbono`, `precio`, `leyendaFacturacion`). |
| 2 | `POST /api/Clientes/BusquedaRapidaResultJson` `{telefono \| datosCliente \| dni \| domicilio}` | Existing-client lookup by phone. Returns `fechaProximaVisita1/2/3`, `usuarioRepartidorHabitual`, `reparto_id`, `etiquetas`. Powers dedupe + the support line ("¿cuándo pasa el repartidor?" answered from data). |
| 8 | `POST /api/Clientes/ObtenerDatosCliente` `{cliente_id}` | Client detail incl. `diaProximaVisita1-3`. |
| 6 | `POST /Clientes/CrearNuevoClientePorChatBot` | **Purpose-built for this.** `cliente {nombre, tipoDeClienteId: 1 (Familia), actividadId: 15 (Consumidor final), condicionIvaId: 2 (Consumidor Final), telefono, email, listaDePreciosId, reparto_id, domicilio {provincia, ciudad, calle, puerta, piso, depto, observaciones, cp, latitud, longitud}}`. `listaDePreciosId`, `reparto_id`, and lat/lng all come from the #12 response. Creates the client in `Borrador` state → returns `cliente_id`. |
| 7 | `POST /api/Clientes/CreateContacto` | Attach WhatsApp number: `tipoContacto_ids: 1` (Primer contacto), `sector_ids: 6` (Titular), `celular`, flags (`enviarAvisoDeProximaVisita` etc. — default false, revisit later). |
| 3 | `POST /api/Incidentes/Save` | **The "driver ticket" is an Incident.** For new-client delivery: `tipoIncidente_ids: 1` (Gestión en ruta) + `subTipoIncidente_ids: 28` (Visita por alta) — ⚠️ type/subtype IDs are **per-environment**; confirm CIMES' actual IDs and keep in config. Payload: `centroDistribucion_id`, `cliente_id`, `titulo`, `descripcion` (HTML: product, time window, amount to collect), `fechaCierreEstimado` (`dd/MM/yyyy` = delivery date), `severidad_ids`, and assignment via `usuarioResponsable_id` (driver's user id — derivable from neighbors' `usuarioRepartidorHabitual`) **or** `grupoResponsable_ids` (mutually exclusive; the other must be null). |

### Endpoints in scope — debt reminder engine (see 4.7)

| # | Endpoint | Used for |
|---|----------|----------|
| 28 | `GET /Facturacion/ObtenerFacturasConSaldoModificado` `{desde, pagina, cantidadXPagina}` | Incremental daily sync of balance changes (paginated via `HasMore`) into a local debt table |
| 21 | `GET /api/Movimientos/ObtenerSaldosDeCliente` `{clienteId}` | Per-client balance verification right before sending a reminder (`saldoCuentaFacturacion`, `fechaUltimoCobro`, `diasVisita`) |
| 14 | `POST /Recibos/ObtenerRecibosDeCobros` | Check "ya pagué" claims against receipts before handing off |
| 29 | `POST /Reportes/ObtenerClientesDashboard` (appendix `filtros`, `idsDiasDeVisitas`) | Optional helper: bulk-list clients by visit weekday |

---

## 4. Conversation flows

### Flow A — Inbound WhatsApp lead (user writes first; free-form session, no template cost)

1. Greet (fast, < 5 s). Ask **city** → interactive list (Mercedes, Luján, Giles, Areco, Chivilcoy, Campana, Zárate, Otra).
   - "Otra" → label `otra_ciudad`, polite no-coverage message, end.
2. Ask **product** → buttons/list from catalog (bidones 12/20L, soda, saborizadas, dispenser frío-calor, dispenser natural). Quote prices **from that city's price list only** (loaded via #10/#5, cached).
3. Answer FAQs via AI (frío/calor rental model, weekly visit cadence, bidón deposit vs rental, bajo sodio, delivery windows). Grounded ONLY in the knowledge base; if unknown → human handoff (see 4.4).
4. Ask **delivery data via WhatsApp Flow form**: full name (pre-filled with the WhatsApp profile name when it looks like a real name), street, number, cross streets (entre calles), optional notes. Structured, required fields — no free-text address parsing.
5. **Coverage check**: one call to #12 with the composed address (radius `COVERAGE_RADIUS_M`, default 1000 m) → returns resolved coordinates + neighbors with route, scheduled weekday, time windows (`horarioProm`), price list id, and usual driver.
   - No neighbors in radius → label `sin_cobertura`/`mal_lead`, notify operator for manual review (edge: genuinely new zones).
   - Resolve the **price list from the nearest neighbors' `listaDePrecios_id`** (location-based — stronger guarantee than a city→list mapping; re-quote if it differs from the provisional city quote).
6. Offer **delivery day options** as buttons, with time window: e.g. `Reparto 19 — sábado entre 10 y 13`.
7. **Order summary + confirm button** (product, price, address, delivery day/window).
8. On confirm:
   a. WaterService: create client via #6 (`reparto_id`, `listaDePreciosId`, lat/lng — all from step 5) → `cliente_id`; attach WhatsApp number via #7.
   b. Driver ticket via #3 (Incidente "Visita por alta"), **dispatched by the scheduler the day before delivery**, assigned to the route's usual driver, description = product, time window, amount to collect.
   c. Append row to orders sheet; set label `cliente_cerrado`.
   d. Send confirmation message to customer.
   e. **Operator override window:** until the ticket dispatches (day before delivery), the order stays editable in the panel — route/day can be changed manually (explicit request from the call: when several routes serve the zone, the operator may want to decide).

### Flow B — Web self-service signup (no WhatsApp involved)

The website completes the **entire** signup, mirroring Flow A's stages on-page via backend REST endpoints:

1. City select → catalog rendered **with that city's prices** (`GET /api/prices?city=`).
2. Delivery data form: name, phone (WhatsApp), street + number + cross streets.
3. Live coverage check (`POST /api/coverage` → WaterService #12) → show available delivery days with time windows; user picks one.
4. Order summary → confirm (`POST /api/orders`) → **same pipeline as Flow A step 8**: WaterService client + scheduled driver ticket + sheet row (`source=web`), label `cliente_cerrado`.
5. No coverage → polite message on-page; lead saved to sheet as `otra_ciudad`/`sin_cobertura`.
6. Optional (config flag `WEB_CONFIRMATION_TEMPLATE`): send one utility template confirming the order ("te lo llevamos el sábado entre 10 y 13"). Accessory, off by default.
7. Optional future work (not in scope): single recovery template for abandoned signups (phone captured, order not confirmed).

No follow-up sequence applies to web signups — they either complete or abandon. Follow-ups (4.6) are WhatsApp-only.

### Flow D — Instagram Instant Forms lead

Meta lead ads open a **native form inside Instagram** (stories/reels/feed) with the user's profile data (name, phone) pre-filled — no browser, no app switch. Ads Manager side: objective "Leads", conversion location "Instant forms"; form mirrors the website fields (city dropdown, address, product); privacy policy URL hosted on the new website; enable "higher intent" mode if lead quality drops.

Ingestion: subscribe to the Graph API **`leadgen` webhook** on the CIMES Facebook Page (permissions `leads_retrieval` + `pages_show_list`, Page access token; **app review required — start day 1, it can take days and is the schedule risk for this flow**). Webhook POST → backend fetches the lead → normalize into the standard lead record → sheet row (`source=instagram`) → **one utility template** greeting with data acknowledged, never re-asked. Reply opens the 24h window → conversation continues at Flow A (coverage check already running with the submitted address); follow-up engine (4.6) applies from their first reply onward. Unlike the website, IG can't complete the order in-app — the WhatsApp continuation is required.

### Flow C — Existing client writes on the support number

- Lookup via #2/#8. If recognized: AI answers account/service questions it can ground (next visit date, general FAQs); otherwise handoff. (Support automation is intentionally thin — see Out of scope.)

### 4.4 Human handoff

Trigger: AI confidence low, question outside knowledge base, explicit user request, or complaint. Action: label `derivado`, stop auto-replies on that conversation, notify operator (WhatsApp message to operator's number with deep link to the conversation in the panel).

### 4.5 Conversation memory

Persist per-contact state in SQLite keyed by phone: name, city, address, product interests, stage, labels, order history. A returning contact (even weeks later) is never re-asked known data.

### 4.6 Follow-up engine (WhatsApp conversations only)

Every WhatsApp lead sits in a **signup stage**: `inicio` → `producto` → `precio` → `datos_entrega` → `dia_entrega` → `confirmacion` → `cliente_cerrado`. When the lead goes silent, timers start from **their last message** (T):

| Timer | Action |
|---|---|
| T+1h | Follow-up 1 — stage-specific copy (from the copy module, e.g. at `datos_entrega`: "Nos faltan solo tus datos de entrega para decirte qué día te lo llevamos") |
| T+8h | Follow-up 2 — deferred to next morning if it falls outside business hours (`BUSINESS_HOURS`, default 09–21) |
| T+23h | Follow-up 3 — sent at 23h, **not** 24h: Meta's free customer-service window closes exactly 24h after the lead's last message; after that any message is a paid template |
| No reply after 3 | Label `sin_respuesta`, bot stops on that chat |

Rules: any lead reply cancels pending timers, advances the stage if applicable, and resets the counter to 0 at the (new) stage. Global cap `MAX_FOLLOWUP_CYCLES=2` full cycles per lead to avoid chasing forever. No follow-ups when the conversation is in a terminal label or `derivado` (human owns it). All follow-ups ride the open 24h window → **$0 cost**.

---

### 4.7 Debt reminder engine (visit-eve balance reminders)

**Context:** payment happens **at the door** when the product is delivered — there is no online payment flow. This is not dunning; it's a reminder so the client has the money ready when the driver arrives (and the driver collects more per route). A fixed-day blast to all debtors was discarded: not actionable, and block-reports would hurt the number's quality rating.

**Engine:**

1. Nightly job: sync balance deltas (#28, `desde` + `HasMore` pagination) into a local debt table.
2. Select: clients whose next visit is **tomorrow** (from `fechaProximaVisita1` via #2/#8, or #29 filtered by `idsDiasDeVisitas`) AND balance > `DEBT_THRESHOLD` AND no reminder within `DEBT_REMINDER_COOLDOWN_DAYS` (default 14) AND not in the suppression list.
3. Re-check balance (#21) immediately before sending — never remind someone who just paid — then morning send (`DEBT_REMINDER_SEND_HOUR`, default 09:00): **utility template**, neutral copy (no promo content, keeps the utility classification): visit tomorrow + pending amount, payable directly to the driver. ~$0.026/msg → e.g. 120 reminders/mo ≈ $3.

**Extras:** opportunistic mention — if a client with debt writes for anything (open 24h window), the bot appends the balance note at $0. Opt-out ("no me manden más recordatorios") → suppression list. "Ya pagué" replies → check #14 receipts, else handoff.

## 5. Labels (state machine)

Two dimensions, shown together in panel and sheet:

1. **Dynamic stage label** `{stage}:{followup_count}` (e.g. `datos_entrega:2` = stuck at delivery data, 2 follow-ups sent). Powers a **funnel report** (daily summary: leads per stage → where conversions die).
2. **Terminal labels** — the taxonomy the operator uses today, auto-applied, manually overridable:

| Label | Auto rule |
|---|---|
| `sin_respuesta` | Follow-up sequence exhausted (3 sends) without reply |
| `interesado` | ≥ 2 user exchanges or asked prices |
| `cliente_cerrado` | Confirmed order (Flow A step 8) |
| `pedido_cerrado` | Delivered — manual toggle in the panel (auto-labeling via #17 is out of scope) |
| `mal_lead` | Operator-defined zones / unreachable address |
| `otra_ciudad` | City outside coverage |
| `derivado` | Human handoff triggered |

---

## 6. Orders sheet (Google Sheets)

Operator-facing mirror, updated in real time by the backend (Sheets API service account). One row per order/lead event.

Columns: `timestamp, source (whatsapp|web), name, phone, city, address, cross_streets, product, price, price_list, route (reparto), delivery_day, delivery_window, client_type (frio_calor|bidon|soda), amount_to_collect, label, waterservice_client_id, ticket_id, conversation_link, notes`.

Note: the client previously built a similar pipeline (styled web form → hidden Google Form → Apps Script → Sheet). We replace that with a direct backend → Sheets API write (more robust, same familiar output). Keep the sheet ID configurable.

### 6.1 Event log (raw analytics capture — no UI)

**Purpose:** make future funnel analysis possible ("at which stage are we losing leads?") by capturing **transitions, not just current state**. Explicitly NOT in scope: dashboards, reports, scheduled digests. Raw capture + export only.

Append-only SQLite table `events` — rows are never updated or deleted:

```
id | timestamp (UTC) | lead_id | source (whatsapp|web|instagram) | city |
event_type | stage | followup_count | metadata (JSON: product, label, template, reason…)
```

**Event types:** `lead_created, stage_entered, message_in, message_out, followup_sent, followup_reply, coverage_checked, label_applied, order_confirmed, handoff, opt_out, debt_reminder_sent`.

Emitted via hooks in the conversation engine / follow-up engine / order pipeline (the same code paths already being built — near-zero marginal cost). Conversation transcripts are retained and linked by `lead_id`, so later qualitative analysis (e.g. feeding the last N conversations that died at `precio` to an LLM to classify drop reasons) is possible without any new capture.

**Export:** operator-triggered only — `GET /api/export/events?from=&to=` → CSV download. Volume is trivial (~15–20k rows/month); retain indefinitely.

---

## 7. Website (clone of https://aguaivess.rosmino.com.ar/ for CIMES)

Rebuild the CIMES site (currently a minimal landing with an embedded LeadConnector/GHL form) following the **structure and conversion patterns of Ivess Rosmino's landing**, with CIMES branding, copy, and products:

1. **Hero** with brand promise + primary CTA.
2. **Dual CTA block** (the key pattern to copy):
   - **"Alta automática"** → on-page registration form.
   - **"Alta por WhatsApp"** → `wa.me` deep link with prefilled message to the sales number.
3. **Self-service signup wizard (auto-alta)** — the full Flow B on-page: city select → catalog with that city's prices → delivery data (nombre, apellido, teléfono WhatsApp, calle + altura + entre calles) → live coverage check with delivery-day picker → summary + confirm. Success state shows the scheduled delivery ("Listo, te lo llevamos el sábado entre 10 y 13"). Client-side + server-side validation. Static site + `fetch` calls to the backend REST endpoints (`/api/prices`, `/api/coverage`, `/api/orders`).
4. **"¿Cómo funciona?" — 3 steps** (form → WhatsApp confirmation → weekly delivery).
5. **Product catalog** grid: bidones retornables 12L/20L, soda en sifón, agua saborizada, dispenser frío-calor, dispenser natural. Prices intentionally omitted on site (city-dependent) — CTA to WhatsApp.
6. **Trust section**: quality, retornables/environment, weekly service.
7. **Coverage areas**: Mercedes, Luján, San Andrés de Giles, San Antonio de Areco, Chivilcoy, Campana, Zárate.
8. **Testimonials** (client provides 3).
9. **Footer**: contact email, IG `cimes.silva`, Facebook, TikTok.

**Technical:** static HTML/CSS/JS (or Astro), mobile-first (ads traffic is IG mobile), Lighthouse ≥ 90 mobile, deployable to Hostinger shared hosting. **SEO:** per-page meta + OG tags, JSON-LD `LocalBusiness`, keyword targets like "soda a domicilio Mercedes", "dispenser de agua Luján", "bidones de agua Campana"; sitemap + robots.txt. Keep existing GTM container.

---

## 8. AI specification

- Model: `claude-haiku-4-5` for all conversational turns. Prompt caching on system prompt + knowledge base + price data (cache read $0.10/MTok). Optional: escalate to Sonnet when the router flags low confidence (rare).
- System prompt contents: role, tone (Argentine Spanish, voseo, warm, short messages), catalog, per-city price lists (structured, city injected explicitly per conversation — the model must never see two cities' prices in one context), FAQ knowledge base, tool definitions, refusal-to-guess rule (prices and coverage come from tools/data, never from model memory).
- Tools (function calling): `get_prices(city)`, `check_coverage(address)`, `get_delivery_options(address)`, `confirm_order(order)`, `handoff(reason)`.
- Structured steps (city, product, address form, day selection, confirm) are **deterministic UI (buttons/Flows)**, not free-text AI parsing. AI handles FAQs and glue, not critical data capture.
- **Message behavior** (explicit fixes to Ventry's flaws): the bot may send **multiple messages** in a row when natural (e.g. answer + follow-up question), and may **stay silent** on closers that need no reply ("ok", "gracias", emoji) — it must not answer every message compulsively.
- Hard limits: max tokens per reply, max turns before handoff suggestion, no promises about anything outside the knowledge base.

---

## 9. Non-functional requirements

- **Latency:** first reply < 5 s; typical turn < 3 s.
- **WhatsApp policy compliance:** business-initiated messages only via approved templates; everything else within the 24 h customer service window. Two numbers (sales + support) connected under Kapso Pro.
- **Monthly cost budget (all-in, current volume ~700 convos + 250 web signups):** Kapso Pro $25 + Meta templates ~$0–7 for optional confirmations plus ~$0.03–0.06 per IG Instant Form lead (web is self-service, needs none) + Claude ~$10–20 + VPS ~$5–10 + debt reminders ~$3–10 ≈ **$45–70** at current volumes (retainer: $90). Alert if projected month-end cost exceeds the retainer (simple counter + daily cron).
- **Reliability:** WaterService/Sheets write failures → retry queue + operator notification; never silently drop a confirmed order.
- **Observability:** structured logs per conversation; daily summary message to operator (orders created, handoffs, failures) — optional toggle.
- **Data:** phone numbers and addresses are PII — store only what's needed, no third-party analytics on chat data.

---

## 10. Configuration (env)

```
KAPSO_API_KEY / KAPSO_WEBHOOK_SECRET
WHATSAPP_NUMBER_SALES / WHATSAPP_NUMBER_SUPPORT
ANTHROPIC_API_KEY
MODEL_DEFAULT=claude-haiku-4-5 / MODEL_ESCALATION=claude-sonnet-5
WATERSERVICE_BASE_URL / WATERSERVICE_USER / WATERSERVICE_PASSWORD
WS_INCIDENT_TYPE_ID=1          # Gestión en ruta — confirm per-environment
WS_INCIDENT_SUBTYPE_ID=28      # Visita por alta — confirm per-environment
WS_SEVERITY_ID=2               # Media
WS_CENTRO_DISTRIBUCION_MAP     # city → centroDistribucion_id
GOOGLE_SERVICE_ACCOUNT_JSON / ORDERS_SHEET_ID
GOOGLE_MAPS_API_KEY            # optional fallback geocoding (primary: #12 resolves addresses)
COVERAGE_RADIUS_M=1000
BUSINESS_HOURS=09-21           # follow-ups outside this range are deferred
FOLLOWUP_SCHEDULE=1h,8h,23h    # from lead's last message; 23h stays inside Meta's free window
MAX_FOLLOWUP_CYCLES=2
WEB_CONFIRMATION_TEMPLATE=false
DEBT_THRESHOLD=0               # minimum balance to trigger a reminder
DEBT_REMINDER_COOLDOWN_DAYS=14
DEBT_REMINDER_SEND_HOUR=09
CITY_PRICE_LIST_MAP            # provisional quote only; final list comes from neighbors' listaDePrecios_id
PRICES_SOURCE=waterservice     # waterservice | sheet (client to confirm which is the maintained source)
PRICES_SHEET_ID                # required if PRICES_SOURCE=sheet; ~15 min refresh + daily consistency check vs #10 with operator alert on mismatch
OPERATOR_PHONE                 # handoff notifications
```

---

## 11. Out of scope (do NOT build)

- Auto `pedido_cerrado` ("delivered") labeling from delivery notes (#17) / WaterService webhooks — discarded from scope; the label stays a manual toggle in the panel.
- Online payments / Mercado Pago links (#20) — collection happens at the door.
- Full support-line automation (incidents #26, service work orders #16) — support line gets FAQ answers + handoff only.
- Abandoned web-signup recovery template.

Keep the codebase from blocking these later: lead ingestion stays source-agnostic (web/WhatsApp/IG normalize into the same lead record) and WaterService client wrappers stay per-endpoint.


---

## 12. Acceptance criteria

1. A WhatsApp lead can go from first message to confirmed order with buttons + address Flow, receiving only their city's prices; the order appears in WaterService (client + scheduled driver ticket) and in the sheet with **zero operator input**.
2. A web visitor completes the entire signup on the site (city → priced catalog → data → live delivery-day options → confirm) and the order lands in WaterService + the sheet with zero operator input and **no WhatsApp interaction required**.
2-bis. A WhatsApp lead that goes silent receives up to 3 stage-appropriate follow-ups within the 24h window; a reply cancels pending ones and resets the counter; after the 3rd unanswered follow-up the chat is labeled `sin_respuesta` and the bot stops.
3. Delivery-day options offered match what the operator would find manually on the WaterService map for 10 sampled addresses (validation set provided by client).
4. A returning contact from ≥ 1 week ago is not re-asked known data.
5. An out-of-coverage address is labeled and answered politely without operator involvement.
6. Handoff: an unanswerable question stops the bot on that chat and notifies the operator within 1 min.
7. Panel (Kapso Inbox or custom): operator can read any conversation, see and change labels, and take over manually.
8. Site deployed on Hostinger, mobile Lighthouse ≥ 90, both CTAs functional.
9. Simulated WaterService outage → order queued, operator notified, replay succeeds.
10. An Instagram Instant Form submission produces a sheet row (`source=instagram`) and a template greeting that acknowledges the submitted data and never re-asks it.
11. A client with outstanding balance and a visit scheduled for tomorrow receives one utility-template reminder in the morning; a client who paid yesterday does not; a suppressed client never does.
12. Every stage transition, follow-up, label change, and order confirmation produces a row in the `events` table, and the CSV export over a date range returns them completely and in order.

---

## 13. Open questions (resolve before/during build)

1. WaterService: base URL + API credentials for CIMES' environment (client requests from vendor); rate limits (not documented); webhooks PDF pending (manual covers REST only).
2. **Per-environment IDs to confirm with vendor:** incident type/subtype for the driver ticket (assumed 1/28 "Gestión en ruta"/"Visita por alta"), `centroDistribucion_id` per city, and whether tickets should be assigned to `usuarioResponsable_id` (driver) or a `grupoResponsable_ids`.
3. Validate #12 geocoding accuracy on ~10 real addresses across the 7 cities (client provides the validation set) before trusting it as sole geocoder.
4. Does Kapso Inbox support custom labels well enough to replace the custom panel in week 1? (Decision gate: day 1 spike. Custom panel is the fallback, scoped minimal: conversation list + transcript + label chips + takeover.)
5. Two price lists mentioned in the call (Mercedes, Campana) — pull the full matrix via #10 and confirm the real list count and `tipoLista_id`s.
6. Sales vs support number: confirm which flows run on which number.
7. Vendor: does frío/calor abono debt surface in invoice balances via #28/#21 (`facturacionAutomatica`)? Required for the debt reminder engine — see 4.7.
8. Price source of truth (client, asked in the proposal): WaterService price matrix (#10) or the team's Google Sheet? Sets `PRICES_SOURCE`. If sheet → enable the daily sheet-vs-#10 consistency check with operator alert.
9. Coverage radius value (client, asked in the proposal): how many meters beyond existing clients should a route stretch to accept a new client? Sets `COVERAGE_RADIUS_M`.
10. Website branding (client, asked in the proposal): structure copies aguaivess.rosmino.com.ar exactly with CIMES logo; final colors/background/product images to be settled — possibly after the first build. No redesign beyond that.

---

## 14. Milestones (1-week target)

| Day | Deliverable |
|---|---|
| 1 | Kapso setup (2 numbers, sandbox), backend skeleton, webhook echo bot; Kapso Inbox spike (decision gate Q2); submit Meta app review for `leads_retrieval` (Flow D dependency) |
| 2 | Conversation engine: city/product buttons, price lists via #10/#5, FAQ AI with caching, event-log hooks (6.1) |
| 3 | Address Flow + coverage/delivery-day via #12/#4 (+ geocode fallback) |
| 4 | Order confirmation → #6/#7/#3 writes + retry queue + sheet append |
| 5 | Website build: self-service wizard + `/api/prices`, `/api/coverage`, `/api/orders` (Flow B) |
| 6 | Panel/labels final, follow-up engine, debt reminder engine (4.7), handoff notifications, operator daily summary; IG `leadgen` webhook (Flow D — goes live when Meta app review clears) |
| 7 | E2E testing with validation addresses, parallel run vs Ventry, deploy, docs |

---

*All numbered endpoint references map to the WaterService API manual v1.0.1 (2026-03-03), "Manual de Usuario API – Integración Chatbot".*
