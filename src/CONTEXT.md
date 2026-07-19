# src/ — Backend service (core API + chatbot layer)

One Node.js + TypeScript service: the conversation engine, WaterService client,
providers, follow-up/debt engines, REST API (`docs/01-core-api.md`) plus the Kapso
WhatsApp layer, AI (tools + prompt), and the es-AR copy module (`docs/02-chatbot.md`).
Spec is canonical in `docs/` — this room never restates contracts.

## Layout

- `src/config.ts` — env parsing (names/defaults: `docs/00-master.md §8`)
- `src/db/` — SQLite schema + accessors (leads, orders, events, jobs, debt)
- `src/waterservice/` — per-endpoint WaterService wrappers + zod schemas
- `src/providers/` — `PriceProvider`, `GeocodingProvider`
- `src/engine/` — conversation engine, stages, labels, handoff, per-lead queue
- `src/ai/` — Anthropic SDK loop, tools, system prompt
- `src/kapso/` — webhook verify/normalize + send API (render primitives)
- `src/pipeline/` — order confirmation pipeline + dispatch scheduler
- `src/engines/` — follow-up engine, debt-reminder engine
- `src/jobs/` — SQLite jobs table + polling runner (all timers/retries)
- `src/sheets/` — orders-sheet append/update
- `src/api/` — Fastify routes (`/api/prices`, `/api/coverage`, `/api/orders`, export, webhooks)
- `src/copy.es-AR.ts` — ALL user-facing strings (voseo)
- `test/` — vitest

## Process

- Read `docs/01-core-api.md` / `docs/02-chatbot.md` before touching the matching area.
- Guardrails: `docs/00-master.md §6` — WaterService body-`error` checks, tz, idempotency.
- Good output: `npm run typecheck` + `npm test` pass; no inline Spanish; no new deps
  beyond the settled building blocks.

## Avoid

- No ORM, no Redis/BullMQ, no LangChain/XState.
- Never call WaterService/Sheets through Kapso.
- Never let the model see two cities' price lists in one context.
