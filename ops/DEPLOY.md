# Deploy notes

Three deployables, three targets. Order of go-live steps: `docs/00-master.md §11`
(parallel run first; number migration to Kapso is the LAST step once tested).

## 1. Backend (small VPS)

```bash
# Node 22+. On the VPS:
git clone <repo> cimes && cd cimes/src
npm ci
cp .env.example .env   # fill everything; PRICES_SOURCE must be set explicitly
npm run typecheck && npm test
```

Run under systemd (restart-safe; the jobs table reconstructs timers on boot):

```ini
# /etc/systemd/system/cimes.service
[Unit]
Description=CIMES backend
After=network.target

[Service]
WorkingDirectory=/opt/cimes/src
ExecStart=/usr/bin/npm run start
Restart=always
EnvironmentFile=/opt/cimes/src/.env

[Install]
WantedBy=multi-user.target
```

Reverse proxy with TLS in front of `PORT` (default 3000). Public paths needed:
`/api/*`, `/webhooks/kapso`, `/webhooks/chatwoot`, `/webhooks/meta`, `/health`.
Back up `cimes.db` (SQLite, WAL mode) nightly.

Point Kapso's webhook at `https://<backend>/webhooks/kapso` with
`KAPSO_WEBHOOK_SECRET`; create + publish the delivery-data WhatsApp Flow in
Kapso and set `KAPSO_DELIVERY_FLOW_ID`.

## 2. Website (Hostinger)

Upload the contents of `website/` as-is (static files) via Hostinger's file
manager/FTP. Before uploading:
1. Edit `website/config.js` — real `API_BASE_URL` + `WHATSAPP_NUMBER_SALES`.
2. Paste the client's GTM container snippet into `index.html` (marked slots).
3. Update `sitemap.xml`/`robots.txt` domain if it isn't `www.cimes.com.ar`.
4. After deploy: run mobile Lighthouse on the live URL (acceptance ≥ 90).

## 3. Chatwoot

See `chatwoot/WIRING.md` (compose stack + inbox wiring + labels/attributes).

## Day-1 external tasks (client-side, gate go-live)

- Meta utility templates approved: `ig_lead_greeting`, `debt_reminder`,
  `web_order_confirmation` (names must match the backend envs/constants).
- Meta app review: `leads_retrieval` + `pages_show_list`; leadgen webhook →
  `https://<backend>/webhooks/meta` with `META_VERIFY_TOKEN`/`META_APP_SECRET`.
- WaterService credentials + per-env IDs (`WS_*`) confirmed with the vendor.
- `SUPPORT_NUMBER` real value; E2E the 10 validation addresses (01 §15 crit 3).
