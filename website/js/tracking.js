// Measurement (04 §8): dataLayer funnel events + Meta Pixel, paid-social attribution,
// and delegated CTA/WhatsApp click tracking. Self-initializing and guarded — a no-op
// when GTM/Pixel are absent (tests, or before the ids are configured at deploy).
(function (App) {
  "use strict";
  function track(event, params) {
    const payload = Object.assign({ event }, params || {});
    (window.dataLayer = window.dataLayer || []).push(payload);
    if (typeof window.fbq === "function") {
      const map = { wizard_start: "InitiateCheckout", order_confirmed: "Lead", whatsapp_click: "Contact" };
      if (map[event]) window.fbq("track", map[event], params || {});
    }
  }
  App.track = track;

  // Persist paid-social attribution (UTMs + click ids) so it reaches the order.
  const attribution = (function () {
    try {
      const keys = ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term", "fbclid", "gclid"];
      const params = new URLSearchParams(window.location.search);
      let stored = {};
      try { stored = JSON.parse(sessionStorage.getItem("cimes_attribution") || "{}"); } catch (e) {}
      let found = false;
      keys.forEach((k) => { const v = params.get(k); if (v) { stored[k] = v; found = true; } });
      if (found) { try { sessionStorage.setItem("cimes_attribution", JSON.stringify(stored)); } catch (e) {} }
      return stored;
    } catch (e) { return {}; }
  })();
  App.attribution = attribution;

  // Carry captured attribution onto the /alta link so a new-tab open keeps it.
  App.utmQS = function utmQS() {
    const parts = Object.keys(attribution).map(
      (k) => encodeURIComponent(k) + "=" + encodeURIComponent(attribution[k]),
    );
    return parts.length ? "&" + parts.join("&") : "";
  };

  // Delegated tracking for the primary CTA + every WhatsApp link (static + dynamic).
  document.addEventListener("click", (e) => {
    const a = e.target.closest ? e.target.closest("a") : null;
    if (!a) return;
    const href = a.getAttribute("href") || "";
    if (href === "#alta") track("cta_click", { location: "signup" });
    else if (/^https:\/\/wa\.me\//.test(href)) track("whatsapp_click", { location: a.dataset.waLoc || "unknown" });
  });
})(window.CIMES_APP = window.CIMES_APP || {});
