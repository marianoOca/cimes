# 03 — CRM: Chatwoot (self-hosted) as the operator inbox

**Status:** build spec for implementation. Read `00-master.md` first (contracts, shared state, env table), then this file.

**Decision (owner, settled): the internal CRM is NOT custom-built. It is a self-hosted [Chatwoot](https://github.com/chatwoot/chatwoot) instance** (MIT-core, the most widely deployed open-source conversation inbox) wired to our backend. Kapso remains the WhatsApp transport (`02-chatbot.md`); Chatwoot is the operator UI only. This supersedes the earlier "consult the Kapso build guide for the inbox pattern" note — the Kapso guide still governs the WhatsApp *flow mechanics* (see `02-chatbot.md`), but the inbox choice is settled.

Why Chatwoot over alternatives (Zammad, FreeScout, Tiledesk, Chaskiq): it is the only one with **(a)** an **API channel** — a bring-your-own-transport inbox, so Kapso keeps the number and full interactive primitives — and **(b)** a native **bot↔human toggle** (conversation status `pending`/`open`) that maps 1:1 to our `ai_enabled` contract. Do not connect Chatwoot's own WhatsApp channel — it cannot send lists/forms and would fight Kapso for the number's webhook.

**Workspace:** deployment + wiring config live in `ops/` (`ops/CONTEXT.md`); the mirror code itself is `01-core-api.md` §10.3 in `src/`. Log sessions in `PROGRESS.md` — scaffold rules in `00-master.md §4.1`.

---

## Framing — deploy + wire, don't build

The primary flow (lead → coverage → quote → confirm → WaterService write) ships on core API + chatbot and does not depend on this module. Chatwoot can be deployed and wired **after** the primary flow works (build order in `00-master.md` §4). `01-core-api.md` owns the mirror code (its §10.3); this doc specifies the deployment, the mapping, and what the operator gets.

---

## 1. Deployment

- **Self-hosted Chatwoot via Docker** (Rails + PostgreSQL + Redis, all in the compose stack). Runs alongside the backend on the VPS **if sized for it (~2 GB+ RAM)** — otherwise a separate small instance. The backend keeps its own SQLite; **no shared database between backend and Chatwoot** — the API is the only coupling.
- One account, one **API-channel inbox** ("CIMES WhatsApp") — created with a callback URL pointing at the backend's Chatwoot-webhook endpoint. Chatwoot signs webhooks; verify with the generated secret.
- Operator gets an agent login. Chatwoot's stock UI covers the Ventry-style patterns the operator knows (label-filtered views ≈ the kanban-ish board, notes per contact) — **no custom UI is built in v1.**

## 2. Integration contract (implemented in `01-core-api.md` §10.3)

**Message mirror (backend → Chatwoot):**
- On first contact: create Chatwoot contact (keyed by phone) + conversation in the API-channel inbox; store the Chatwoot conversation id on the lead record.
- Every inbound lead message → posted as `incoming`; every bot/system send → posted as `outgoing`. Chatwoot then shows the full transcript with per-message sender — this is the **AI-vs-human visual distinction** (bot messages arrive via API/bot sender; human replies are typed by the agent user).

**Operator replies (Chatwoot → backend → Kapso):**
- Agent replies in Chatwoot fire the API-channel webhook → backend forwards the text to the lead via Kapso (`02-chatbot.md` send layer) and records it as a human-sent `message_out`.

**`ai_enabled` ↔ conversation status (the toggle):**

| Chatwoot status | Meaning | `ai_enabled` |
|---|---|---|
| `pending` | Bot owns the conversation | `true` |
| `open` | Human takeover | `false` |
| `resolved` | **Archive** (retained, out of active inbox) | — (no auto-replies) |

- Core handoff (§5 of `01-core-api.md`) sets `ai_enabled=false` **and** flips the conversation to `open`.
- Operator toggling = changing status in Chatwoot; the `conversation_status_changed` webhook syncs `ai_enabled` back (`open`→false, `pending`→true). **`ai_enabled` on the lead record stays the canonical gate the engine checks** (`00-master.md` §5.2); Chatwoot status is its UI surface.
- A new inbound message on a `resolved` conversation reopens it — the backend webhook handler decides: back to `pending` (bot resumes) unless the lead is `derivado`/terminal, then `open`.

**Labels:** the terminal taxonomy (`00-master.md` §5.3) exists as Chatwoot labels with the same slugs — auto-applied by the backend via API, manually overridable by the operator (label webhook syncs overrides back to the lead record). The **dynamic `{stage}:{followup_count}`** is NOT a label (would churn constantly): `stage` and `followup_count` are **conversation custom attributes**, updated by the backend and filterable in Chatwoot.

**Lead info panel:** contact/conversation **custom attributes** carry the collected data — `city`, `product`, `price`, `delivery_day`, `delivery_window`, plus the sync fields `sync_status` (`pending`/`synced`/`failed`), `waterservice_client_id`, `ticket_id`. Backend updates them as the lead record changes. **Notes per lead** = Chatwoot contact notes.

**Order editing:** not in Chatwoot. The operator-override path (route/day until dispatch) stays on the stored order / sheet per `01-core-api.md` §4.5–4.6.

## 3. Functional requirements — mapped

Exactly the settled v1 scope; every item lands on a stock Chatwoot feature:

| Requirement | How |
|---|---|
| 1. Conversation list/inbox (one entry per lead) | API-channel inbox; contact keyed by phone |
| 2. Per-conversation AI toggle | Status `pending`↔`open` (§2 mapping); visible per conversation |
| 3. Archive (not deletion) | Status `resolved` + Chatwoot's resolved view |
| 4. AI-sent vs human-sent distinction | Per-message sender identity (API/bot vs agent user) |
| 5. Lead info panel + WaterService sync status | Contact/conversation custom attributes + contact notes |
| 6. Labels (canonical taxonomy) | Chatwoot labels (terminal) + custom attributes (dynamic stage) |
| 7. Filter by label | Chatwoot label filters + custom-attribute filters (stage) |

Nothing beyond this list is configured in v1 (no SLA/CSAT/knowledge-base/etc. — Chatwoot ships them, we just don't wire them).

---

## Environment variables

Owned by this module, consumed by the backend mirror (`01-core-api.md` §10.3); listed in the master table (`00-master.md` §8):

| Var | Note |
|---|---|
| `CHATWOOT_BASE_URL` | Self-hosted instance URL |
| `CHATWOOT_API_ACCESS_TOKEN` | Backend → Chatwoot API calls (mirror, labels, attributes, status) |
| `CHATWOOT_ACCOUNT_ID` | Account for all API calls |
| `CHATWOOT_INBOX_ID` | The API-channel inbox |
| `CHATWOOT_WEBHOOK_SECRET` | Verify signed Chatwoot webhooks (agent replies, status/label changes) |

---

## Acceptance criteria

Done when the operator, in Chatwoot, can:

1. **Read any conversation** — full transcript, live. (crit 7)
2. **See and change labels** — terminal labels shown and manually overridable; override persists to the lead record via webhook sync; stage/followup visible as attributes. (crit 7)
3. **Filter** — by terminal label and by stage attribute.
4. **Take over and resume** — flip a conversation to `open` (auto-replies stop, agent replies reach the lead's WhatsApp via Kapso) and back to `pending` (bot resumes). Same `ai_enabled` gate core's handoff drives. (crit 7)
5. **Distinguish AI vs human messages** in the transcript.
6. **See collected data + sync status** — custom attributes incl. `sync_status`/`waterservice_client_id`/`ticket_id`, editable contact notes.
7. **Archive** — resolve a conversation; it leaves the active inbox, stays readable, reopens correctly on a new inbound message (§2).

---

## Cross-references

- **`00-master.md`** — `ai_enabled` contract + status mapping (§5.2), label taxonomy (§5.3), lead record (§5.1), env table (§8), build order (§4).
- **`01-core-api.md`** — §10.3 CRM mirror (the integration code lives there), §5 handoff, §4.5–4.6 order editing (outside Chatwoot).
- **`02-chatbot.md`** — Kapso send layer used for operator replies; Kapso build-guide note (governs WhatsApp mechanics, not this inbox).
