// Shared wizard internals (Flow B): the in-memory state + DOM root + copy handle,
// mid-flow persistence, formatting helpers, the render primitives every step uses,
// the manual-review handoff, and the resume-furthest-step boot. The steps themselves
// live in steps.js; the boot router in main.js.
(function (App) {
  "use strict";
  const COPY = App.COPY, CFG = App.CFG, API = App.API, esc = App.esc;
  const track = App.track, attribution = App.attribution, waHref = App.waHref;

  const root = document.getElementById("wizard-root");
  const W = COPY.wizard;
  const state = {
    city: null,
    catalog: null, // { price_list, products }: exactly one city's list
    cart: null, // [{ id, name, price, qty }]: multi-item selection
    data: null, // { firstName, lastName, phone, street, number, crossStreets }
    coverage: null,
    option: null,
    submitting: false,
  };
  App.root = root;
  App.W = W;
  App.state = state;

  // ---------- formatting ----------
  App.addressString = function addressString(d) {
    return d.direccion + (d.piso ? ", " + d.piso : "");
  };
  // Format an integer price with comma thousands separators ($2600 -> $2,600).
  function money(n) {
    return "$" + Math.round(Number(n) || 0).toLocaleString("en-US");
  }
  App.money = money;
  // Map a catalog product name to a local photo; CIMES logo when nothing matches.
  // Root-relative so it resolves on /alta/ (a subdirectory), not only the home page.
  App.productImage = function productImage(name) {
    const s = String(name || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
    const img = (f) => "/assets/products/" + f;
    if (/soda|sifon/.test(s)) return img("soda-sifon.webp");
    if (/saboriz/.test(s)) return img("saborizada.webp");
    if (/gaseosa/.test(s)) return img("gaseosas.webp");
    if (/12/.test(s) && /sodio|menos|\bms\b/.test(s)) return img("botellon-12l-ms.webp");
    if (/20/.test(s)) return img("botellon-20l.webp");
    if (/12/.test(s)) return img("botellon-12l.webp");
    if (/botella|agua/.test(s)) return img("agua-botellas.webp");
    return "/assets/logo-cimes.png";
  };

  // ---------- mid-flow persistence: resume the furthest step after a reload of /alta ----------
  function saveState() {
    try {
      sessionStorage.setItem(
        "cimes_wizard",
        JSON.stringify({ city: state.city, cart: state.cart, data: state.data, option: state.option }),
      );
    } catch (e) {}
  }
  function clearState() {
    try { sessionStorage.removeItem("cimes_wizard"); } catch (e) {}
  }
  function loadState() {
    try { return JSON.parse(sessionStorage.getItem("cimes_wizard") || "null"); } catch (e) { return null; }
  }
  App.saveState = saveState;
  App.clearState = clearState;
  App.loadState = loadState;

  // ---------- render primitives ----------
  App.backButton = function backButton(toStep) {
    return `<div class="wizard-actions"><button class="btn btn-secondary" data-back="${toStep}">${W.back}</button></div>`;
  };

  // Numbered stepper (rosmino-style). Falls back to a plain label if steps are
  // not defined.
  function progress(n) {
    const labels = W.steps || [];
    if (!labels.length) return `<p class="wizard-progress">${W.stepOf(n)}</p>`;
    return (
      `<ol class="wizard-stepper" aria-label="Progreso">` +
      labels
        .map((label, i) => {
          const step = i + 1;
          const cls = step === n ? "active" : step < n ? "done" : "";
          return `<li class="${cls}"><span class="dot">${step}</span><span class="label">${esc(label)}</span></li>`;
        })
        .join("") +
      `</ol>`
    );
  }
  App.progress = progress;

  // Dead-end / error actions: Back plus a live WhatsApp fallback so a stuck
  // visitor still has a path forward (the backend already records the lead).
  App.deadEndActions = function deadEndActions(toStep) {
    return `<div class="wizard-actions">` +
      `<button class="btn btn-secondary" data-back="${toStep}">${W.back}</button>` +
      `<a class="btn btn-whatsapp" data-wa-loc="wizard_fallback" target="_blank" rel="noopener" href="${waHref}">${W.waFallback}</a>` +
      `</div>`;
  };

  function bindBack() {
    root.querySelectorAll("[data-back]").forEach((b) =>
      b.addEventListener("click", () => App.steps[b.dataset.back]()),
    );
  }
  App.bindBack = bindBack;

  // Canister loader (04 §5): water waves inside a spinning bidón (shape mirrors the
  // botellon-12l product photo). Water is clipped to the body path and spins together
  // with the outline, so it stays centred and fully inside — never spills past the glass.
  // Purely decorative; motion off under prefers-reduced-motion.
  function canisterAnim() {
    // Body silhouette, proportioned from the botellon-12l photo (width 10 : side 8.5 :
    // total 13.5 : neck 2.8). A squat bidón — total height only ~1.35× the width. Shared
    // by the clip and the outline.
    const body =
      "M48,37 H72 V44 Q94,47 95,55 V113 Q95,120 82,120 H38 Q25,120 25,113 V55 Q26,47 48,44 Z";
    return (
      `<div class="coverage-anim" aria-hidden="true">` +
      `<svg viewBox="10 12 100 120" class="canister">` +
      `<defs><clipPath id="bidonBody"><path d="${body}"/></clipPath></defs>` +
      `<g class="canister-spin">` +
      `<g clip-path="url(#bidonBody)">` +
      `<g class="can-water">` +
      `<path class="can-wave can-wave-back" d="M-30,65 q15,-6 30,0 t30,0 t30,0 t30,0 t30,0 t30,0 V150 H-30 Z"/>` +
      `<path class="can-wave can-wave-front" d="M-30,69 q15,-7 30,0 t30,0 t30,0 t30,0 t30,0 t30,0 V150 H-30 Z"/>` +
      `</g>` +
      `</g>` +
      `<rect class="can-cap" x="46" y="24" width="28" height="14" rx="3"/>` +
      `<path class="can-shell" d="${body}"/>` +
      `</g>` +
      `</svg></div>`
    );
  }
  App.canisterAnim = canisterAnim;

  // Shared canister loader panel for backend/data waits (prices, coverage). Not used for
  // quick button submits ("Enviando…"), which stay as button-label swaps.
  function loadingPanel(msg) {
    return canisterAnim() + `<p class="status-msg">${msg}</p>`;
  }
  App.loadingPanel = loadingPanel;

  App.coverageLoading = function coverageLoading() {
    return progress(4) + `<h3>${W.dayStep.title}</h3>` + loadingPanel(W.dayStep.checking);
  };

  // Covered city, but nothing we can offer automatically (no serviceable slot, or the
  // coverage check kept failing) → save the lead server-side and hand off to a human via
  // WhatsApp (04 §5). Capture fires on render, exactly when the WhatsApp button appears.
  App.enterManualReview = function enterManualReview() {
    track("manual_review", { stage: "address" });
    const waHrefReview =
      "https://wa.me/" +
      CFG.WHATSAPP_NUMBER_SALES +
      "?text=" +
      encodeURIComponent(W.manualReview.waText);
    // Best-effort capture; the human channel is WhatsApp regardless of this call.
    fetch(`${API}/api/manual-review`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        source: "web",
        name: `${state.data.firstName} ${state.data.lastName}`,
        phone: state.data.phone,
        city: state.city,
        address: App.addressString(state.data),
        cross_streets: state.data.crossStreets,
        items: state.cart.map((c) => ({ product: c.name, qty: c.qty })),
        ...attribution,
      }),
    }).catch(() => {});
    root.innerHTML =
      progress(4) +
      `<h3>${W.manualReview.title}</h3>` +
      `<p class="status-msg">${W.manualReview.message}</p>` +
      `<div class="wizard-actions"><button class="btn btn-secondary" data-back="data">${W.back}</button>` +
      `<a class="btn btn-whatsapp" data-wa-loc="manual_review" target="_blank" rel="noopener" href="${waHrefReview}">${W.manualReview.button}</a></div>`;
    bindBack();
  };

  // Resume the furthest reached step for a known city (04 §3 state handling).
  App.startWizard = function startWizard(city) {
    state.city = city;
    track("wizard_start", { city });
    const saved = loadState();
    if (saved && saved.city === city) {
      state.cart = saved.cart || null;
      state.data = saved.data || null;
      state.option = saved.option || null;
      const hasCart = state.cart && state.cart.length;
      if (hasCart && state.data && state.option) App.steps.summary();
      else if (hasCart && state.data) App.steps.day();
      else if (hasCart) App.steps.data();
      else App.steps.product();
    } else {
      App.steps.product();
    }
  };
})(window.CIMES_APP = window.CIMES_APP || {});
