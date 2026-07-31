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
