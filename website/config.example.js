// Deploy-time configuration template (04-website §9). Copy to config.js (gitignored)
// and fill real values there before uploading to Hostinger — never commit config.js.
window.CIMES_CONFIG = {
  // Backend base URL the wizard fetches (GET /api/prices, POST /api/coverage, POST /api/orders).
  API_BASE_URL: "https://api.example.com",
  // Sales number for the wa.me deep links (owned by 02-chatbot; consumed here).
  WHATSAPP_NUMBER_SALES: "5491100000000",
  // Maps JavaScript API browser key (Places enabled, HTTP-referrer-restricted to
  // this domain) for the wizard's address autocomplete (04-website §3 step 3).
  // Separate key from the backend's server-side GOOGLE_MAPS_API_KEY (src/.env) —
  // never put that one here, it would expose an unrestricted key publicly.
  GOOGLE_MAPS_KEY: "GOOGLE_MAPS_KEY",
};
