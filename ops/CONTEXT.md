# ops/ — Deploy: VPS, Chatwoot, Hostinger

Deployment artifacts only: VPS setup for the backend service, self-hosted Chatwoot
(Docker compose, ~2 GB+ RAM or separate instance), Hostinger upload for the website.
Spec: `docs/03-crm.md` (Chatwoot wiring) + `docs/00-master.md §3` (stack) — the
backend mirror code itself lives in `src/` (`docs/01-core-api.md §10.3`).

## What lives here

- Chatwoot `docker-compose.yml` + env template
- Backend service unit / deploy script for the VPS
- Hostinger upload notes/script for `website/`

## Process

- Chatwoot: API-channel inbox; terminal labels + custom attributes created per
  `docs/03-crm.md`. Kapso stays the only WhatsApp transport.
- Secrets stay in env files outside git.

## Avoid

- Chatwoot never talks to WhatsApp directly.
- Primary flow must not depend on Chatwoot being up.
