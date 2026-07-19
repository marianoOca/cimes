# CIMES — WhatsApp Sales & Logistics System

WhatsApp sales bot + internal CRM + public self-service website for CIMES, an Argentine
water/soda home-delivery company (7 cities). Takes a lead from first contact through
coverage check, quote, and order confirmation, then writes the order into WaterService
and mirrors it to a Google Sheet. Claude handles free text; tools/providers do all
deterministic work (prices, coverage, days).

## Fixed stack

- WhatsApp: Kapso Pro (transport only — never WaterService/Sheets through Kapso)
- Backend: single Node.js + TypeScript service, Fastify, SQLite (`better-sqlite3`), zod
- Jobs/timers/retries: SQLite `jobs` table + polling loop (no Redis/BullMQ)
- AI: Anthropic TS SDK directly, `MODEL_DEFAULT=claude-sonnet-5`, prompt caching
- Website: static, Hostinger. CRM: self-hosted Chatwoot (API-channel inbox)

## Commands

- `cd src && npm install` — deps
- `cd src && npm run dev` — run backend locally
- `cd src && npm test` — tests (vitest)
- `cd src && npm run typecheck` — tsc --noEmit

## Workspaces

`docs/` (spec source of truth) · `src/` (backend: core API + chatbot + copy) ·
`website/` (public static site) · `ops/` (deploy: VPS, Chatwoot, Hostinger)

## Routing

| Task | Go to | Read |
|---|---|---|
| Contracts, env vars, guardrails, build order | `docs/` | `00-master.md` |
| Engine, providers, WaterService, follow-ups, debt, REST | `src/` | `CONTEXT.md` + `docs/01-core-api.md` |
| WhatsApp mechanics, AI prompt/tools, es-AR copy | `src/` | `CONTEXT.md` + `docs/02-chatbot.md` |
| Website / signup wizard | `website/` | `CONTEXT.md` + `docs/04-website.md` |
| Chatwoot deploy & wiring | `ops/` | `CONTEXT.md` + `docs/03-crm.md` (+ `01 §10.3`) |
| Resume work / "where are we" | repo root | `PROGRESS.md` |

## Naming

English file names. Spec/decision docs: `docs/NN-topic.md`. Copy module: `src/src/copy.es-AR.ts`.

## Avoid (top guardrails — full list `docs/00-master.md §6`)

- WaterService errors are in the body (`error != 0`), never the HTTP status.
- The AI never computes prices/coverage/days — tools/providers only.
- No Spanish strings inline — everything through `copy.es-AR.ts`.
- Crons idempotent + restart-safe; timer state lives in SQLite.
- Timezone `America/Argentina/Buenos_Aires` for local-day logic; UTC in storage.
- Dedupe inbound messages by message ID; check existing client (#2) before alta (#6).
- End every session updating `PROGRESS.md`; start every session reading it + this map.
