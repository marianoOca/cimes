# PROGRESS

## Current status

Day-1 scaffold done. Backend (core-api + chatbot, `src/`) built end-to-end: typecheck
clean, 32 tests passing. Not yet run against real Kapso/WaterService — all external
credentials still pending from the client. Website (`04`) and Chatwoot deploy (`03`/ops)
not started.

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

**Next:**
- Website (`docs/04-website.md`) — static site + wizard against the REST endpoints.
- Ops: Chatwoot compose + wiring (`docs/03-crm.md`), VPS deploy notes.
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
