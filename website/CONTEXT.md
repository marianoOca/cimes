# website/ — Public static site + self-service signup wizard

Static, mobile-first site hosted on the client's Hostinger. Implements Flow B
(self-service signup) by `fetch`ing the backend REST endpoints. Spec: `docs/04-website.md`;
endpoint contracts: `docs/00-master.md §5.6`.

## Layout

`index.html` (landing + wizard mount), `alta/index.html` (focused wizard page) — both
mount an empty `#wizard-root`; the ordered `js/` scripts render everything into it.
`copy.es-AR.js` (all strings, keyed like the backend module), `config.js` (`API_BASE_URL`),
`styles.css`, `assets/`.

The wizard is split into `js/*.js` classic scripts (no build step; buildless static on
Hostinger). Each is an IIFE attaching its public surface to one shared `window.CIMES_APP`
namespace; load order matters only for `config.js`/`copy.es-AR.js` (first) and `main.js`
(last). Loaded via `<script>` tags in this order — `/alta` omits `home.js`:

- `js/util.js` — core handles (`COPY`/`CFG`/`API`/`waHref`) + `esc`, `resolvePath`.
- `js/tracking.js` — `track` (dataLayer/Pixel), `attribution`, `utmQS`, delegated CTA/WA click tracking.
- `js/chrome.js` — shared page chrome (both pages): `[data-copy]` bind, `.wa-link` hrefs, footer, scroll-float, bottom-bg.
- `js/home.js` — **index only**: how-steps, product grid + carousel, trust cards.
- `js/phone.js` — masked phone field (`phoneField`, `phoneDigitsFromE164`).
- `js/places.js` — Google Maps/Places address autocomplete (`loadGoogleMaps`, `attachPlaces`).
- `js/cities.js` — `citySlug`/`slugToCity`, `fetchCities`/`resolveCityFromSlug`, and the "Otra ciudad" combobox + "did you mean?" second thought (`initCityOther`).
- `js/wizard.js` — shared wizard internals: `state`/`root`/`W`, persistence, formatting, render helpers (`progress`/`bindBack`/…), `enterManualReview`, `startWizard`.
- `js/steps.js` — the `steps` object: `city` (thin) → `product` → `data` → `day` → `summary`.
- `js/main.js` — boot router: reads `?city` → picker (absent) / resume / snap a non-shortcut slug via `POST /api/resolve-city`.

Backend calls (in `api`/`cities`/`wizard`/`steps`): `GET /api/prices`, `POST /api/coverage`,
`POST /api/orders`, `POST /api/manual-review`, `GET /api/cities`, `POST /api/resolve-city`.
Local dev fakes them: `dev/stub-backend.ts` (real app logic incl. the city matcher; only the
external WaterService/Sheets calls are faked — run via `npm run dev:stub`).

## Process

- v1 design copies the competitor site (https://aguaivess.rosmino.com.ar/) exactly,
  with CIMES logo (`assets/logo-cimes.png`, sourced from `docs/logo-cimes.png`). No redesign scope.
- All copy in Argentine Spanish (voseo), sourced/mirrored from the es-AR copy module keys.
- Backend base URL via `API_BASE_URL` (build-time constant for the static site).
- Must include a privacy-policy page (Meta lead-ads prerequisite — `docs/02-chatbot.md §7`).

## Good output

- Plain static assets deployable by upload to Hostinger; wizard completes
  city → prices → coverage → day → confirm against a running backend.

## Avoid

- No framework/build complexity beyond what a static Hostinger upload supports.
- No third-party analytics on conversation data (site keeps its GTM container only).
