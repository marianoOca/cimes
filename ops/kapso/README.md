# Kapso provisioning — Flow + templates

Build-time artifacts submitted to Kapso/Meta via the `integrate-whatsapp` skill
(`~/.agents/skills/integrate-whatsapp`). Run these from the skill dir.

## Current target = SANDBOX (2026-07-23)

| Thing | Value |
|---|---|
| Kapso project | `cimes` (`1cef1ce9-f761-4194-aa58-edefe2cf8d07`) |
| Number kind | **sandbox** (`Sandbox WhatsApp`) |
| `phone_number_id` | `597907523413541` |
| `business_account_id` (WABA) | `2102230076919824` |

**At go-live these must be re-created against the client's production number**
(new `phone_number_id` + WABA). Sandbox flows/templates do not carry over.
Number migration to Kapso is the last go-live step (`docs/00-master.md §11`).

## Env for the skill scripts (NOT the same as our backend `.env`)

The scripts read `KAPSO_API_BASE_URL` (**platform host**, no path) + `KAPSO_API_KEY`.
Our backend `src/.env` uses `KAPSO_BASE_URL` = the **Meta proxy** URL
(`…/meta/whatsapp/v24.0`) for `send.ts` — different var, different value. Do not
overwrite it.

```bash
cd ~/.agents/skills/integrate-whatsapp
export KAPSO_API_BASE_URL="https://api.kapso.ai"
export KAPSO_API_KEY="<value from apps/cimes/src/.env KAPSO_API_KEY>"
```

## 1. Delivery-data Flow (reversible: delete-flow.js)

```bash
node scripts/create-flow.js \
  --phone-number-id 597907523413541 \
  --name "Datos de entrega" \
  --flow-json-file /Users/mar/Workspace/apps/cimes/ops/kapso/flow-delivery-data.json \
  --publish
```

Take the returned flow id → set `KAPSO_DELIVERY_FLOW_ID` in `apps/cimes/src/.env`.
Validate end-to-end before trusting the response path:
`node scripts/send-test-flow.js --phone-number-id 597907523413541 --flow-id <id> --to <your-number>`
(confirms the `nfm_reply` payload shape our webhook parses — still unverified, see
`PROGRESS.md`).

Flow field names (`nombre`, `apellido`, `calle`, `altura`, `entre_calles`, `notas`)
match `src/src/engine/conversation.ts`. If the Kapso builder needs different names,
change both together.

## 2. Templates (IRREVERSIBLE: submits straight to Meta, no draft state)

Positional params — matches `send.ts` (`components[].parameters` = `{{1}}`, `{{2}}`…).
`es_AR`, `UTILITY`.

```bash
for t in ig_lead_greeting debt_reminder web_order_confirmation; do
  node scripts/submit-template.mjs \
    --business-account-id 2102230076919824 \
    --file /Users/mar/Workspace/apps/cimes/ops/kapso/template-$t.json
done
node scripts/template-status.mjs --business-account-id 2102230076919824   # poll APPROVED/PENDING/REJECTED
```

Template name + param order are wired into code — do not rename without matching:
| Template | Sent from | Params (positional) |
|---|---|---|
| `ig_lead_greeting` | `api/instagram.ts` | `{{1}}`=name, `{{2}}`=city, `{{3}}`=product |
| `debt_reminder` | `engines/debt.ts` | `{{1}}`=amount (already `$`-prefixed) |
| `web_order_confirmation` | `index.ts` (web flow) | `{{1}}`=day, `{{2}}`=window |

## 3. Inbound webhook (do AFTER the backend has a public URL)

```bash
node scripts/create.js --scope phone_number --phone-number-id 597907523413541 \
  --events whatsapp.message.received --payload-version v2 \
  --url https://<backend-host>/webhooks/kapso
```

Also set `WHATSAPP_NUMBER_SALES` / `WHATSAPP_NUMBER_SUPPORT` in `src/.env` to the
active `phone_number_id` (sandbox: both = `597907523413541`).
