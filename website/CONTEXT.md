# website/ — Public static site + self-service signup wizard

Static, mobile-first site hosted on the client's Hostinger. Implements Flow B
(self-service signup) by `fetch`ing the backend REST endpoints. Spec: `docs/04-website.md`;
endpoint contracts: `docs/00-master.md §5.6`.

## Layout

`index.html` (landing + wizard mount), `alta/index.html` (focused wizard page) — both
mount an empty `#wizard-root`; `app.js` renders everything into it. `copy.es-AR.js` (all
strings, keyed like the backend module), `config.js` (`API_BASE_URL`), `styles.css`, `assets/`.

`app.js` is one file, organized by name (grep the name, not a line):

- **Boot router** (bottom): reads `?city` → picks the entry step (picker when absent; a
  non-shortcut slug is snapped to a canonical city via `POST /api/resolve-city`).
- **`steps` object** — the wizard screens: `city` (shortcut links + an "Otra ciudad"
  free-text entry with `<datalist>` autocomplete that snaps to the closest BA city),
  `product`, `data`, `day`, `summary`; plus `enterManualReview()` (no-coverage / no-slot handoff).
- **`state` object** — `city`, `cart`, `data`, `option`, `coverage`, `attribution`.
- **Helpers** — `citySlug`/`slugToCity` (URL ⇄ city), `fetchCities`/`resolveCityFromSlug`
  (BA-city autocomplete + snap), `utmQS`/`attribution` (paid-social),
  phone mask (`phoneField`/`phoneToE164`/`phoneModeOf`), `attachPlaces`/`loadGoogleMaps`
  (Google address autocomplete), `track` (dataLayer), `esc`/`field`/`progress`/`bindBack` (render).
- **Backend calls** — `GET /api/prices`, `POST /api/coverage`, `POST /api/orders`,
  `POST /api/manual-review`, `GET /api/cities`, `POST /api/resolve-city`. Local dev fakes
  them: `dev/stub-backend.ts` (real app logic incl. the city matcher; only the
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
