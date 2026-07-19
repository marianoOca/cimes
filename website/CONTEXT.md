# website/ — Public static site + self-service signup wizard

Static, mobile-first site hosted on the client's Hostinger. Implements Flow B
(self-service signup) by `fetch`ing the backend REST endpoints. Spec: `docs/04-website.md`;
endpoint contracts: `docs/00-master.md §5.6`.

## Process

- v1 design copies the competitor site (https://aguaivess.rosmino.com.ar/) exactly,
  with CIMES logo (`documentation/logo-cimes.png`). No redesign scope.
- All copy in Argentine Spanish (voseo), sourced/mirrored from the es-AR copy module keys.
- Backend base URL via `API_BASE_URL` (build-time constant for the static site).
- Must include a privacy-policy page (Meta lead-ads prerequisite — `docs/02-chatbot.md §7`).

## Good output

- Plain static assets deployable by upload to Hostinger; wizard completes
  city → prices → coverage → day → confirm against a running backend.

## Avoid

- No framework/build complexity beyond what a static Hostinger upload supports.
- No third-party analytics on conversation data (site keeps its GTM container only).
