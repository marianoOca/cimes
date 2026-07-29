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

Back up `cimes.db` (SQLite, WAL mode) nightly.

### TLS (Caddy)

Backend binds to `127.0.0.1` only (`src/src/index.ts`) — the only way in from
outside is through the reverse proxy below. Not optional hardening: Kapso and
Meta both reject self-signed webhook endpoints, so there's no working deploy
without real TLS in front.

1. DNS: point `<backend-domain>` (e.g. `api.cimes-silva.com.ar`) at the VPS IP
   before requesting a cert — Let's Encrypt can't issue for a bare IP.
2. Firewall: `ufw allow 22,80,443/tcp` then `ufw enable` — nothing else public,
   port 3000 (and Chatwoot's 3001) must never be reachable from outside the box.
3. Install Caddy, then:

   ```caddyfile
   # /etc/caddy/Caddyfile
   <backend-domain> {
     reverse_proxy 127.0.0.1:3000
   }

   <chatwoot-domain> {
     reverse_proxy 127.0.0.1:3001
   }
   ```

   `systemctl reload caddy`. Cert issuance, renewal, and HTTP→HTTPS redirect
   are automatic — no certbot cron, no separate redirect block, and the same
   instance covers Chatwoot (already bound to `127.0.0.1:3001` in its compose).

Public paths needed behind it: `/api/*`, `/webhooks/kapso`, `/webhooks/chatwoot`,
`/webhooks/meta`, `/health`.

Point Kapso's webhook at `https://<backend-domain>/webhooks/kapso` with
`KAPSO_WEBHOOK_SECRET`; create + publish the delivery-data WhatsApp Flow in
Kapso and set `KAPSO_DELIVERY_FLOW_ID`. Same domain (never the bare IP or
port 3000) goes into the website's `API_BASE_URL` below and the Meta leadgen
webhook URL in the day-1 tasks.

## 2. Website (Hostinger)

Upload the contents of `website/` as-is (static files) via Hostinger's file
manager/FTP. Before uploading:
1. Copy `website/config.example.js` to `website/config.js` (gitignored — never
   commit it) and fill real `API_BASE_URL` (`https://<backend-domain>` from
   above — never `http://` or the bare IP), `WHATSAPP_NUMBER_SALES`,
   `GOOGLE_MAPS_KEY` (browser key, HTTP-referrer-restricted — not the backend's
   server-side `GOOGLE_MAPS_API_KEY`).
2. Enable free TLS in Hostinger's hPanel (SSL/AutoSSL) and turn on "Force
   HTTPS" (or an `.htaccess` redirect if that toggle isn't available).
3. Paste the client's GTM container snippet into `index.html` (marked slots).
4. Update `sitemap.xml`/`robots.txt` domain if it isn't `www.cimes.com.ar`.
5. After deploy: run mobile Lighthouse on the live URL (acceptance ≥ 90).

## 3. Chatwoot

See `chatwoot/WIRING.md` (compose stack + inbox wiring + labels/attributes).

## Day-1 external tasks (client-side, gate go-live)

- Meta utility templates approved: `ig_lead_greeting`, `debt_reminder`,
  `web_order_confirmation` (names must match the backend envs/constants).
- Meta app review: `leads_retrieval` + `pages_show_list`; leadgen webhook →
  `https://<backend>/webhooks/meta` with `META_VERIFY_TOKEN`/`META_APP_SECRET`.
- WaterService credentials + per-env IDs (`WS_*`) confirmed with the vendor.
- `SUPPORT_NUMBER` real value; E2E the 10 validation addresses (01 §15 crit 3).
