# src/ — Backend service (core API + chatbot layer)

One Node.js + TypeScript service: the conversation engine, WaterService client,
providers, follow-up/debt engines, REST API (`docs/01-core-api.md`) plus the Kapso
WhatsApp layer, AI (tools + prompt), and the es-AR copy module (`docs/02-chatbot.md`).
Spec is canonical in `docs/` — this room never restates contracts.

## Layout

- `src/config.ts` — env parsing (names/defaults: `docs/00-master.md §8`)
- `src/index.ts` — service entrypoint (server + job runner boot)
- `src/db/` — SQLite schema (`db.ts`) + accessors: `leads.ts`, `orders.ts`,
  `orders-update.ts` (sheet-row/neighbor-client patches), `events.ts`
- `src/waterservice/` — `http.ts` (token cache, body-`error` check) +
  `client.ts` (per-endpoint wrappers, zod schemas)
- `src/catalog/skus.ts` — **the 9 SKUs CIMES sells** (same in every zone, per
  `docs/preguntas_licha.md §5`): display names, WaterService matching
  (pinned `articulo_id` first, name regex fallback), free-text aliases, sales
  order. Single source of truth for the catalog — `prices.ts`, `prompt.ts`,
  `conversation.ts` and `sheets/orders.ts` all derive from it.
- `src/text.ts` — `normalizeText` (lowercase + strip accents), shared by the SKU
  matcher and the conversation engine
- `src/providers/` — `types.ts` contracts, `prices.ts` (`PriceProvider`; filters
  every price list down to the catalog SKUs, and resolves the frío/calor list),
  `abonos.ts` (#11 abonos; ids from env, amounts from WaterService),
  `geocoding.ts` (`GeocodingProvider`)
- `src/db/prices-cache.ts` — the local mirror of the WaterService prices. **The
  request path reads only this**; the daily `prices_refresh` job is the sole
  writer, so a WaterService outage can't stop the wizard from quoting
  (`docs/01-core-api.md §2`). WaterService is the only price source — the old
  Google-Sheet `PRICES_SOURCE` implementation is gone (the orders *mirror* sheet
  in `sheets/orders.ts` is unrelated and stays).
- `src/engine/` — `conversation.ts` (entry point, hybrid input, stage
  rendering), `stages.ts`, `coverage.ts`, `handoff.ts`, `leadQueue.ts`,
  `notify.ts` (operator alerts)
- `src/engines/` — `followups.ts`, `debt.ts` (the two timer-driven engines)
- `src/ai/` — `agent.ts` (Anthropic SDK loop + caching), `prompt.ts`, `tools.ts`
  (the 5 canonical tools)
- `src/kapso/` — `webhook.ts` (verify/normalize inbound), `send.ts` (send API,
  renders text/buttons/list/flow/template)
- `src/pipeline/` — `orders.ts` (confirmation pipeline), `dispatch.ts`
  (day-before ticket scheduler)
- `src/jobs/` — `queue.ts`: SQLite jobs table + polling runner (all
  timers/retries in the service)
- `src/sheets/` — `orders.ts`: orders-sheet append/update
- `src/crm/` — `mirror.ts`: Chatwoot mirror (outbound sync + inbound webhook glue)
- `src/api/` — `server.ts` (Fastify routes: `/api/prices`, `/api/coverage`,
  `/api/orders`, export, Kapso/Chatwoot/Meta webhooks), `instagram.ts` (Flow D
  leadgen ingestion)
- `src/copy.es-AR.ts` — ALL user-facing strings (voseo)
- `scripts/dump-price-matrix.ts` — read-only `#10` dump (`npm run dump:prices`):
  pins SKU `articulo_id`s and reveals which `lista_id` is which price list
- `test/` — vitest (`catalog-skus`, `conversation`, `followups`, `jobs`,
  `pipeline`, `time`, `webhook`, `website`)
- `.env` / `.env.example` — local env; loaded from this directory since every
  backend command runs with `src/` as cwd (`cd src && npm run dev`, per root
  `CLAUDE.md`)

## Process

- Read `docs/01-core-api.md` / `docs/02-chatbot.md` before touching the matching area.
- Guardrails: `docs/00-master.md §6` — WaterService body-`error` checks, tz, idempotency.
- Good output: `npm run typecheck` + `npm test` pass; no inline Spanish; no new deps
  beyond the settled building blocks.

## Avoid

- No ORM, no Redis/BullMQ, no LangChain/XState.
- Never call WaterService/Sheets through Kapso.
- Never let the model see two cities' price lists in one context.
