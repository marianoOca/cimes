# Chatwoot wiring (03-crm.md — deploy + wire, don't build)

Order: deploy Chatwoot → create inbox → wire backend env → create labels +
custom attributes → verify the toggle. The primary flow must keep working with
Chatwoot down (mirror failures queue + retry — backend `src/crm/mirror.ts`).

## 1. Deploy

```bash
cd ops/chatwoot
cp .env.example .env   # fill SECRET_KEY_BASE, POSTGRES_PASSWORD, FRONTEND_URL, SMTP
docker compose run --rm rails bundle exec rails db:chatwoot_prepare
docker compose up -d
```

Put a reverse proxy (Caddy/nginx) with TLS in front of `127.0.0.1:3001` →
`FRONTEND_URL`. Create the admin account on first visit; invite the operator
as an agent.

## 2. Create the API-channel inbox

Chatwoot UI → Inboxes → Add Inbox → **API** → name "CIMES WhatsApp".
- **Callback URL**: `https://<backend>/webhooks/chatwoot?token=<CHATWOOT_WEBHOOK_SECRET>`
  (Chatwoot's API-channel webhooks are unsigned — the shared token in the URL is
  the verification; same value as the backend env.)
- Note the **inbox ID** (URL: `.../inboxes/<id>`).

Also add an account-level webhook (Settings → Integrations → Webhooks) with the
same URL, subscribed to `message_created`, `conversation_status_changed`,
`conversation_updated`.

## 3. Backend env

Set in the backend's `.env` (names canonical in `docs/00-master.md §8`):

```
CHATWOOT_BASE_URL=https://crm.example.com
CHATWOOT_API_ACCESS_TOKEN=<profile → Access Token of a dedicated bot/admin user>
CHATWOOT_ACCOUNT_ID=1
CHATWOOT_INBOX_ID=<from step 2>
CHATWOOT_WEBHOOK_SECRET=<random string, same as the callback URL token>
```

## 4. Labels + custom attributes (create once, exact slugs)

Labels (Settings → Labels) — the canonical terminal taxonomy (`00-master §5.3`):
`sin_respuesta`, `interesado`, `cliente_cerrado`, `pedido_cerrado`, `mal_lead`,
`otra_ciudad`, `derivado`.

Conversation custom attributes (Settings → Custom Attributes → Conversation):
`stage` (text), `followup_count` (number), `dynamic_label` (text), `city` (text),
`product` (text), `price` (number), `delivery_day` (text), `delivery_window`
(text), `sync_status` (text), `waterservice_client_id` (text), `ticket_id` (text).

The dynamic `{stage}:{followup_count}` is an attribute, NOT a label (would churn).

## 5. Verify (acceptance, 03 §Acceptance)

1. WhatsApp a test lead → conversation appears with the transcript (bot messages
   as API sender, `status=pending`).
2. Flip to `open` → bot stops replying; type an agent reply → it reaches the
   lead's WhatsApp via Kapso.
3. Flip back to `pending` → bot resumes.
4. Edit a label in Chatwoot → lead record's labels update (webhook sync).
5. Resolve the conversation → a new inbound reopens it (`pending`, or `open` if
   `derivado`).
