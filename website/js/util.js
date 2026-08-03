// Shared core for the CIMES site: config/copy handles, the wa.me deep link, and the
// two tiny primitives used across landing + wizard (HTML escape, copy-path lookup).
// Loaded first — every other js/ file reads window.CIMES_APP.{COPY,CFG,API,esc,...}.
(function (App) {
  "use strict";
  const COPY = window.CIMES_COPY;
  const CFG = window.CIMES_CONFIG;
  App.COPY = COPY;
  App.CFG = CFG;
  App.API = CFG.API_BASE_URL.replace(/\/$/, "");
  App.waHref =
    "https://wa.me/" +
    CFG.WHATSAPP_NUMBER_SALES +
    "?text=" +
    encodeURIComponent(COPY.dualCta.whatsapp.prefill);

  App.esc = function esc(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
    })[c]);
  };

  App.resolvePath = function resolvePath(obj, path) {
    return path.split(".").reduce((o, k) => (o ? o[k] : undefined), obj);
  };
})(window.CIMES_APP = window.CIMES_APP || {});
