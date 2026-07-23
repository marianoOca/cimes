# Handoff brief — split the CIMES PRD into module docs

You are picking up a task with no memory of the conversation that produced it. This brief is self-contained: read it fully before touching any file.

## Project context

CIMES is an Argentine water/soda home-delivery company (7 cities around Mercedes, Buenos Aires province). Mariano Oca (developer, communities.tech / FA Automations) is building them a WhatsApp sales bot + internal CRM + public website that replaces their current CRM (Ventry) and integrates with their delivery-management system (WaterService) via its REST API. The commercial proposal has already been sent to the client and is considered final. The technical PRD needs to be reorganized before being handed to Claude Code for implementation.

Two source files exist, both already reviewed and edited by the human (Mariano) — treat them as ground truth, not as drafts to second-guess:

- `propuesta-comercial-cimes.md` — final commercial proposal (Spanish, client-facing). Read it for scope/tone/what was promised, but it is not a build spec.
- `prd-cimes-whatsapp-system.md` — the current PRD (English), status "Draft v2", which is monolithic and needs to be split.

Both files are in the outputs folder of this session. **Read both files in full before starting.**

## The task

Split `prd-cimes-whatsapp-system.md` into a master doc + 4 module docs:

```
docs/
├── 00-master.md        → architecture, stack, contracts between modules,
│                          implementation guardrails, build order
├── 01-core-api.md       → backend: conversation engine core, WaterService client,
│                          PriceProvider, GeocodingProvider, orders sheet, event log,
│                          follow-up engine, debt reminder engine, REST API
├── 02-chatbot.md        → WhatsApp layer: Kapso webhooks, buttons/Flows, signup
│                          stages, es-AR copy, AI (tools, prompt)
├── 03-crm.md             → internal CRM (inbox + labels + lead record) — see scope below
└── 04-website.md         → public self-service website
```

Strip anything Claude Code doesn't need to build correctly: Ventry backstory/history, June conversion numbers, monthly cost breakdowns/comparisons vs Ventry, "why we chose X over Y" narrative. Keep only: what to build, contracts/interfaces, config, acceptance criteria. Claude Code does not need to know CIMES is replacing Ventry to build this — that's business narrative, not spec (the one exception: the CRM should visually/functionally resemble Ventry's UI patterns — kanban-ish label board, notes per lead — so keep *that* specific reference in 03-crm.md, not the pricing/backstory).

## Decisions made in the planning conversation (apply these — do not re-derive or re-litigate)

These override anything in the current monolithic PRD that conflicts with them:

1. **No phases.** The whole thing is one scope. Do not use "Phase 1 / Phase 2" language anywhere. Where the current PRD has an "Out of scope" section discarding features, **delete that section** — instead, organize scope as separate concrete tasks per module doc (the module split itself is what replaces "phases").

2. **Model choice:** launch with **Sonnet** (not Haiku) for the conversational AI, with a config flag to downgrade to Haiku later once prompts stabilize (the deterministic work — prices, coverage, days — is already handled by tools, not the model, so Haiku will likely suffice long-term, but Sonnet is safer during initial tuning). Make `MODEL_DEFAULT` a clean env var either way.

3. **Signup input is hybrid, not form-only.** Structured steps (city, product, delivery day) use buttons/lists; the delivery-data step uses a **Kapso-hosted form** (confirmed capability: Kapso can build richer/longer forms than plain WhatsApp buttons, not just simple button choices — this is a Kapso feature, not just a "WhatsApp Flow" wrapper, so don't undersell it as just buttons). **But free text is always accepted and understood** — if a user free-types their city and product in the first message, the AI extracts it and skips the redundant button step; buttons/forms are the guided path, not the only path. Document Meta's hard limits explicitly wherever this is described: max 3 quick-reply buttons or 10-item lists per message; Flows/forms must be created and published in Kapso/Meta before they can be sent.

4. **Signup stages — simplified to 5, not 7:** `inicio → producto → datos_entrega → dia_entrega → confirmacion → cliente_cerrado`. (The previous draft had separate `producto` and `precio` stages — merge them: picking a product triggers an immediate quote in the same exchange, so there's no separate "precio" stage.)

5. **⚠️ IMPORTANT — WhatsApp flow needs one more pass before being finalized in the docs.** The human explicitly said: *"antes de intentar implementar eso, chequeé la skill de Kapso, y me confirme el flow"* — i.e., before finalizing the exact WhatsApp conversation mechanics (which parts use Kapso's form/Flow builder vs. buttons vs. free text, and the exact API shapes), **whoever builds this must first read Kapso's own build guide**: https://docs.kapso.ai/docs/build-with-ai . Put a prominent note in `02-chatbot.md` (and reference it from `00-master.md`) instructing the implementer to read that Kapso guide first and confirm the flow mechanics match what's described here before writing code — the flow as described in this brief (5 stages, hybrid buttons/form/free-text) is the *intended* UX, not a verified-against-Kapso-capabilities spec. Do not silently "resolve" this by guessing Kapso's API shape.

6. **Support handoff mechanism, corrected:** when the AI can't answer, it should **tell the user to write to a dedicated support number** (not just silently notify the operator). The client (Lisandro) will provide the actual support phone number later. Add `SUPPORT_NUMBER` (or similar) as a required-but-currently-unknown config value with a placeholder, and have the handoff message use it. Keep the "notify operator" behavior too (both, not either/or) — but the user-facing instruction to message the support number is the important addition that was missing.

7. **Latency requirements: remove entirely.** Any non-functional requirement about response time (e.g. "first reply < 5s") should be deleted, not softened. The client does not care about this.

8. **WaterService per-environment IDs (incident type/subtype for driver tickets, `centroDistribucion_id` per city, driver-vs-group assignment) — this is NOT an open technical question to investigate or design around.** It's simply a phone call Mariano needs to have with his client (who will check it directly in his WaterService app/account). **Action:** keep the default values in config exactly as currently drafted (`WS_INCIDENT_TYPE_ID=1`, `WS_INCIDENT_SUBTYPE_ID=28`, etc.) and add a short note (in `01-core-api.md`, near the ticket-creation logic, and in the open-items/notes list) saying: *"Defaults assumed from the manual's example environment. Client will confirm the real values with the WaterService vendor before/during build — no further design work needed here, just use the configured values."* Do not turn this into an elaborate "confirm with vendor via email" workflow — it's a phone call, already understood as low-effort, not a blocker to design around.

9. **Geocoding (endpoint #12) — assume it works, make it swappable, drop the validation gate.** Don't include a "validate against 10 real addresses before trusting it" gate/blocker. Instead: wrap geocoding behind a `GeocodingProvider` interface, WaterService's endpoint #12 as the default implementation, with a Google Maps adapter sitting behind the same interface ready to swap in later via config/flag if needed. No manual validation step required before build.

10. **Kapso Inbox vs. custom CRM decision — no longer an open question, and don't try to answer it "from first principles."** The human was explicit: *"eso no es algo que podamos decidir ahora, kapso tiene su skill de claude con la mejor forma de construir esto. Ni vos ni yo tenemos esa data ahora."* Translation: whether/how to use Kapso's built-in inbox vs. build a custom one is something the Kapso build-with-AI guide (link above) should inform at build time — don't pre-decide it in the docs, and don't present it as a "decision gate/spike" requiring investigation from us. Just note: *"Consult the Kapso build guide (docs.kapso.ai/docs/build-with-ai) for the recommended inbox/conversation-storage pattern before implementing 03-crm.md."*

    Additionally: **the CRM itself is being built for future connection, not necessarily needed at full richness on day one** — human said *"yo creo que eso lo podemos implementar a futuro, o sea, por ahora dejar todo listo para que se pueda conectar el CRM."* So: the core backend/API must be designed so a CRM can attach cleanly (clean data model, REST/webhook access to conversations, labels, lead records), but building out the full CRM UI is a separate, later-priority task — make this explicit in `00-master.md`'s build order (core API and chatbot first; CRM UI can lag).

## CRM scope (v1) — this is now settled, use it as-is in `03-crm.md`

Minimum viable CRM, exact requirements from the human, do not embellish or add scope beyond this list:

- **Conversation list/inbox** (one entry per lead/contact).
- **Per-conversation AI toggle**: a visible on/off switch next to each lead's name/chat — turns the AI on or off for that specific conversation. This is how a human takeover happens: toggle off when escalating to a human, toggle back on to resume automation. This is the *mechanism* for what the core PRD calls "handoff" — make sure `01-core-api.md`'s handoff logic and `03-crm.md`'s toggle description reference the same underlying state field.
- **Archive**: a place/view to move conversations that are no longer relevant (not deletion — an archived state/folder).
- **Visual distinction between AI-sent and human-sent messages** in the transcript (e.g. different color or a small sender indicator per message).
- **Lead info panel** alongside each chat: the data collected so far (name, address, product, etc.) and whether/how it was successfully synced to WaterService (sync status indicator).
- **Labels**, matching the taxonomy already defined in the core PRD (`sin_respuesta`, `interesado`, `cliente_cerrado`, `pedido_cerrado`, `mal_lead`, `otra_ciudad`, `derivado`, plus the dynamic `{stage}:{followup_count}` label).
- **Filter conversations by label.**
- UI look-and-feel/visual design: explicitly deferred, "podemos ver más adelante" — don't design a visual spec, just the functional requirements above.

## Guardrails to include in `00-master.md` ("Implementation guardrails" section)

The end implementer is a less-capable coding model working inside Claude Code — the master doc's guardrails section exists specifically to catch mistakes that model is likely to make. Include at least these (pull the specifics from the current PRD's section 3 and section 8, they're already correct — just make sure they're not lost in the split):

- WaterService always returns HTTP 200; check the `error` field in the body, not the status code.
- WaterService timestamps in responses use .NET format `/Date(1753112501144)/`; request dates use `dd/MM/yyyy` string format. Don't confuse the two directions.
- Auth token goes in header `CURRENTTOKENVALUE`; cache it, re-login on expiry/401.
- **Idempotency:** webhooks can be redelivered — dedupe by message ID. Before creating a new WaterService client (#6), check for an existing one by phone (#2) to avoid duplicate altas.
- **Operator override window:** the order stays editable in the CRM/panel until the driver ticket is actually dispatched (the day before delivery) — the scheduler must read the order's current state *at dispatch time*, not cache it from confirmation time.
- Timezone: `America/Argentina/Buenos_Aires` for all "tomorrow", business-hours, and follow-up-timer logic.
- Per-conversation message queue: don't let concurrent inbound messages to the same lead race each other through the conversation engine.
- **Meta templates must be created and approved in advance** — this is a day-1 task, not something to leave until the feature that uses it is built (debt reminders, IG lead greeting, optional web confirmation all depend on approved templates).
- The AI never computes prices or coverage itself — always via tools/providers (`PriceProvider`, `GeocodingProvider`, WaterService client). No hardcoded or model-recalled prices, ever.
- Copy strings live in a dedicated es-AR module, never inline in code; all code/comments/identifiers in English (this rule from the current PRD's section 0 must survive the split, put it in `00-master.md`).
- Crons (follow-up engine, debt reminder engine, event log) must be idempotent and resume correctly after a process restart — don't rely on in-memory-only timers for anything that must survive a deploy or crash.

## Also carry over unchanged from the current PRD (still valid, just relocate to the right module doc)

- Section 3 (WaterService endpoint map) → `01-core-api.md`.
- Section 4 flows (A/B/D/C, handoff, memory, follow-up engine 4.6, debt reminder engine 4.7) → split: the *business logic* (stages, timers, WaterService writes) goes in `01-core-api.md`; the *WhatsApp-specific mechanics* (which stage uses which Kapso primitive) go in `02-chatbot.md` — but flag 4.6/the whole WhatsApp flow with the Kapso-guide-check note from decision #5 above.
- Section 5 (labels) → shared between `01-core-api.md` (data model) and `03-crm.md` (filter/display).
- Section 6 + 6.1 (orders sheet, event log) → `01-core-api.md`.
- Section 7 (website) → `04-website.md`.
- Section 8 (AI spec) → `02-chatbot.md`, updated per decision #2 (Sonnet default) and #4 (5 stages).
- Section 10 (env config) → distribute per module, or keep centralized in `00-master.md` with a note on which module owns which var — your call, pick whichever keeps each module doc self-contained enough to hand to a different implementer independently.
- Section 12 (acceptance criteria) → distribute per module.
- Section 13 (open questions) → prune per the decisions above (several are now resolved/reframed, see #8, #9, #10) — keep only genuinely open ones: price source of truth (`PRICES_SOURCE`, swappable via `PriceProvider`, per the "let's build around this so it's easily swappable" instruction — this one stays fully open, build the abstraction, don't force a default), coverage radius (settled: **just leave it as a global var defaulted to 10000**, not worth further discussion, one-line note that 10km ≈ whole-city so it's effectively an off-switch until tightened later), website branding (settled: **copy the competitor site's design exactly for v1**, colors/imagery tuning happens after the first build, no redesign scope beyond that).
- Section 14 (milestones) → `00-master.md`, adjusted for the module structure and the guardrail notes (e.g. Meta template approval and Kapso-guide-reading should appear as day-1 items).

## What NOT to do

- Don't re-introduce Phase 1/Phase 2 language anywhere.
- Don't re-litigate any of the 10 decisions above — they're final, from a real conversation with the person who owns this project.
- Don't invent CRM scope beyond the bullet list given.
- Don't add a validation/decision-gate step for geocoding or for Kapso Inbox — both were explicitly resolved (assume-and-abstract, and defer-to-Kapso-guide, respectively).
- Don't carry business narrative (Ventry pricing comparisons, June conversion stats, "why this beats Ventry") into the module docs — that lives in the commercial proposal, not the build spec.
