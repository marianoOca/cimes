// The Flow B wizard steps: 1 city → 2 product → 3 data → 4 day → 5 summary. Shared
// internals (state, render primitives, persistence) come from wizard.js; the city
// autocomplete from cities.js; phone mask from phone.js; address autocomplete from
// places.js. Assembled onto App.steps for wizard.startWizard / main to drive.
(function (App) {
  "use strict";
  const COPY = App.COPY, API = App.API, esc = App.esc, track = App.track;
  const attribution = App.attribution, utmQS = App.utmQS, waHref = App.waHref;
  const root = App.root, W = App.W, state = App.state;
  const progress = App.progress, backButton = App.backButton, deadEndActions = App.deadEndActions;
  const bindBack = App.bindBack, loadingPanel = App.loadingPanel, coverageLoading = App.coverageLoading;
  const enterManualReview = App.enterManualReview;
  const money = App.money, addressString = App.addressString, productImage = App.productImage;
  const saveState = App.saveState, clearState = App.clearState;
  const phoneField = App.phoneField, phoneDigitsFromE164 = App.phoneDigitsFromE164;
  const loadGoogleMaps = App.loadGoogleMaps, attachPlaces = App.attachPlaces;
  const citySlug = App.citySlug, initCityOther = App.initCityOther;

  const steps = {
    // 1. City select. Shortcut cities are real links to the focused /alta page.
    // "Otra Ciudad" is the last option and looks identical to the rest; clicking
    // it turns that same slot into an inline combobox (see cities.js). Enter or the
    // button snaps the typed city to the closest real BA city and continues the
    // normal flow — coverage is decided later.
    city() {
      track("wizard_step", { step: "city", n: 1 });
      const c = W.cityStep;
      root.innerHTML =
        progress(1) +
        `<h3>${c.title}</h3><div class="option-list">` +
        COPY.coverage.cities
          .map((city) => `<a class="city-option" href="/alta/?city=${citySlug(city)}${utmQS()}">${esc(city)}</a>`)
          .join("") +
        `<button type="button" class="city-option" id="city-other">${esc(c.other)}</button>` +
        `</div>` +
        `<button class="btn btn-primary" id="city-other-submit" hidden>${c.otherSubmit}</button>`;
      initCityOther(document.getElementById("city-other"), document.getElementById("city-other-submit"));
    },

    // 2. Priced catalog for the selected city (rendered as returned).
    async product() {
      track("wizard_step", { step: "product", n: 2 });
      // Start loading Google Maps here — one step before the address field needs it. On
      // /alta this is the first render (loads on arrival); on the landing page it only
      // fires once the visitor engages the wizard, keeping first paint light for bouncers.
      // By the time step 3 renders, the Places API is ready and attachPlaces() binds
      // synchronously (no race). Guarded by mapsRequested, so it loads at most once.
      loadGoogleMaps();
      root.innerHTML = progress(2) + `<h3>${W.productStep.title}</h3>` + loadingPanel(W.productStep.loading);
      try {
        const res = await fetch(`${API}/api/prices?city=${encodeURIComponent(state.city)}`);
        if (!res.ok) throw new Error("prices failed");
        state.catalog = await res.json();
      } catch {
        root.innerHTML = `<p class="status-msg">${W.genericError}</p>` + deadEndActions("city");
        bindBack();
        return;
      }
      const products = state.catalog.products;
      // Preserve prior quantities when returning to this step (e.g. Back from data).
      const qty = {};
      (state.cart || []).forEach((c) => {
        const i = products.findIndex((p) => (c.id != null && p.id === c.id) || p.name === c.name);
        if (i >= 0) qty[i] = c.qty;
      });
      const cards = products
        .map(
          (p, i) =>
            `<div class="cart-card">` +
            `<div class="product-img"><img src="${productImage(p.name)}" alt="${esc(p.name)}" width="120" height="120" loading="lazy" /></div>` +
            `<p class="cart-name">${esc(p.name)}</p>` +
            `<p class="cart-price">${money(p.price)}</p>` +
            `<div class="qty-stepper">` +
            `<button type="button" class="qty-btn" data-dec="${i}"${qty[i] ? "" : " disabled"}>&minus;</button>` +
            `<span class="qty" data-qty="${i}">${qty[i] || 0}</span>` +
            `<button type="button" class="qty-btn" data-inc="${i}">+</button>` +
            `</div></div>`,
        )
        .join("");
      root.innerHTML =
        progress(2) +
        `<h3>${W.productStep.title}</h3>` +
        `<div class="wizard-cart">${cards}</div>` +
        `<div class="cart-bar"><span class="cart-total-label">${W.productStep.total}</span>` +
        `<span class="cart-total" data-cart-total></span></div>` +
        `<div class="wizard-actions"><button class="btn btn-secondary" data-back="city">${W.back}</button>` +
        `<button class="btn btn-primary" id="cart-continue">${W.productStep.continue}</button></div>`;
      bindBack();

      const totalEl = root.querySelector("[data-cart-total]");
      const continueBtn = document.getElementById("cart-continue");
      const refresh = () => {
        let total = 0;
        let count = 0;
        products.forEach((p, i) => {
          total += p.price * (qty[i] || 0);
          count += qty[i] || 0;
        });
        totalEl.textContent = money(total);
        continueBtn.disabled = count === 0;
      };
      refresh();
      root.querySelectorAll("[data-inc]").forEach((b) =>
        b.addEventListener("click", () => {
          const i = Number(b.dataset.inc);
          qty[i] = (qty[i] || 0) + 1;
          root.querySelector(`[data-qty="${i}"]`).textContent = qty[i];
          root.querySelector(`[data-dec="${i}"]`).disabled = false;
          refresh();
        }),
      );
      root.querySelectorAll("[data-dec]").forEach((b) =>
        b.addEventListener("click", () => {
          const i = Number(b.dataset.dec);
          if (!qty[i]) return;
          qty[i] -= 1;
          root.querySelector(`[data-qty="${i}"]`).textContent = qty[i];
          if (!qty[i]) b.disabled = true;
          refresh();
        }),
      );
      continueBtn.addEventListener("click", () => {
        const cart = products
          .map((p, i) => ({ id: p.id, name: p.name, price: p.price, qty: qty[i] || 0 }))
          .filter((c) => c.qty > 0);
        if (!cart.length) return;
        state.cart = cart;
        track("cart_continue", {
          items: cart.length,
          total: cart.reduce((s, c) => s + c.price * c.qty, 0),
        });
        saveState();
        steps.data();
      });
    },

    // 3. Delivery-data form with client-side validation.
    data() {
      track("wizard_step", { step: "data", n: 3 });
      const d = W.dataStep;
      const prev = state.data || {};
      const areaCode = COPY.coverage.areaCodes[state.city];
      // Returning to edit: rebuild the mask's digits from the saved E.164. Fresh
      // entry: prefill the city's own area code (the local number stays blank).
      const initialDigits = prev.phone ? phoneDigitsFromE164(prev.phone) : "549" + (areaCode || "");
      // Semantic input attributes so mobile autofill + the right keyboard work
      // (critical for the in-app-browser paid-social audience, 04 §5.3).
      const field = (id, label, value, attrs) =>
        `<div class="field" data-field="${id}"><label for="${id}">${label}</label>` +
        `<input id="${id}" value="${esc(value || "")}" ${attrs || ""} />` +
        `<span class="error">${d.errors.required}</span></div>`;
      const phone = phoneField("phone", d.phone, initialDigits);
      root.innerHTML =
        progress(3) +
        `<h3>${d.title}</h3>` +
        `<p class="wizard-city">${esc(d.cityLabel)}: <strong>${esc(state.city)}</strong></p>` +
        field("firstName", d.firstName, prev.firstName, 'autocomplete="given-name" autocapitalize="words"') +
        field("lastName", d.lastName, prev.lastName, 'autocomplete="family-name" autocapitalize="words"') +
        phone.html +
        field("direccion", d.direccion, prev.direccion, `autocomplete="off" autocapitalize="words" placeholder="${esc(d.direccionPlaceholder)}"`) +
        field("piso", d.piso, prev.piso, 'autocomplete="off"') +
        field("crossStreets", d.crossStreets, prev.crossStreets, 'autocomplete="off" autocapitalize="words"') +
        `<div class="wizard-actions"><button class="btn btn-secondary" data-back="product">${W.back}</button>` +
        `<button class="btn btn-primary" id="data-next">${d.next}</button></div>`;
      bindBack();
      loadGoogleMaps();
      attachPlaces();
      const phoneApi = phone.bind();
      document.getElementById("data-next").addEventListener("click", () => {
        const values = {};
        const required = ["firstName", "lastName", "direccion"];
        let ok = true;
        for (const id of ["firstName", "lastName", "direccion", "piso", "crossStreets"]) {
          const wrap = root.querySelector(`[data-field="${id}"]`);
          const input = wrap.querySelector("input");
          const errorEl = wrap.querySelector(".error");
          values[id] = input.value.trim();
          const bad = required.includes(id) && values[id] === "";
          errorEl.textContent = d.errors.required;
          wrap.classList.toggle("invalid", bad);
          if (bad) ok = false;
        }
        if (!phoneApi.isComplete()) {
          phoneApi.markInvalid(d.errors.phone);
          ok = false;
        }
        if (!ok) return;
        values.phone = phoneApi.toE164();
        state.data = values;
        saveState();
        steps.day();
      });
    },

    // 4. Live coverage check + delivery-day picker.
    // `attempt` escalates a transient failure: attempt 1 offers one retry, attempt 2 (retry
    // also failed) hands off to a human like a genuine no-slot answer (04 §5).
    async day(attempt = 1) {
      track("wizard_step", { step: "day", n: 4 });
      root.innerHTML = coverageLoading();
      try {
        const res = await fetch(`${API}/api/coverage`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            city: state.city,
            address: addressString(state.data),
            cross_streets: state.data.crossStreets,
          }),
        });
        // 503 = "couldn't check" (upstream timeout/error), NOT "not covered".
        if (!res.ok) throw new Error("coverage failed");
        state.coverage = await res.json();
      } catch {
        if (attempt < 2) {
          // First transient failure — offer one retry before giving up on the auto flow.
          track("coverage_retry", { attempt });
          root.innerHTML =
            progress(4) +
            `<h3>${W.coverageRetry.title}</h3>` +
            `<p class="status-msg">${W.coverageRetry.message}</p>` +
            `<div class="wizard-actions"><button class="btn btn-secondary" data-back="data">${W.back}</button>` +
            `<button class="btn btn-primary" data-retry="1">${W.coverageRetry.button}</button></div>`;
          bindBack();
          root
            .querySelector("[data-retry]")
            .addEventListener("click", () => steps.day(attempt + 1));
          return;
        }
        // Retry also failed → same handoff as a genuine no-slot answer.
        enterManualReview();
        return;
      }
      if (!state.coverage.covered || state.coverage.delivery_options.length === 0) {
        // Covered city, but no delivery time we can offer → hand off to a human (04 §5).
        enterManualReview();
        return;
      }
      track("coverage_result", { covered: true, options: state.coverage.delivery_options.length });
      root.innerHTML =
        progress(4) +
        `<h3>${W.dayStep.title}</h3><div class="option-list">` +
        state.coverage.delivery_options
          .map(
            (o, i) =>
              `<button data-option="${i}">${esc(
                W.dayStep.optionLabel(o.route, o.weekday, o.time_window),
              )}</button>`,
          )
          .join("") +
        `</div>` +
        backButton("data");
      bindBack();
      root.querySelectorAll("[data-option]").forEach((b) =>
        b.addEventListener("click", () => {
          state.option = state.coverage.delivery_options[Number(b.dataset.option)];
          saveState();
          steps.summary();
        }),
      );
    },

    // 5. Summary + confirm (double-click guarded).
    summary() {
      track("wizard_step", { step: "summary", n: 5 });
      const s = W.summaryStep;
      const total = state.cart.reduce((sum, c) => sum + c.price * c.qty, 0);
      root.innerHTML =
        progress(5) +
        `<h3>${s.title}</h3><ul class="summary-list">` +
        state.cart
          .map(
            (c) =>
              `<li><span>${esc(c.qty + "x " + c.name)}</span><span>${money(c.price * c.qty)}</span></li>`,
          )
          .join("") +
        `<li class="summary-total"><span>${s.total}</span><span>${money(total)}</span></li>` +
        `<li><span>${s.address}</span><span>${esc(addressString(state.data) + ", " + state.city)}</span></li>` +
        `<li><span>${s.day}</span><span>${esc(
          W.dayStep.optionLabel(state.option.route, state.option.weekday, state.option.time_window),
        )}</span></li></ul>` +
        `<div class="wizard-actions"><button class="btn btn-secondary" data-back="day">${W.back}</button>` +
        `<button class="btn btn-primary" id="confirm">${s.confirm}</button></div>`;
      bindBack();
      const confirmBtn = document.getElementById("confirm");
      confirmBtn.addEventListener("click", async () => {
        if (state.submitting) return;
        state.submitting = true;
        confirmBtn.disabled = true;
        confirmBtn.textContent = s.sending;
        try {
          const payload = {
            source: "web",
            name: `${state.data.firstName} ${state.data.lastName}`,
            phone: state.data.phone,
            city: state.city,
            address: addressString(state.data),
            cross_streets: state.data.crossStreets,
            items: state.cart.map((c) => ({ product: c.name, qty: c.qty })),
            delivery_day: state.option.weekday,
            delivery_window: state.option.time_window,
          };
          // Attach paid-social attribution (empty object when none captured).
          Object.assign(payload, attribution);
          const res = await fetch(`${API}/api/orders`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          });
          if (!res.ok) throw new Error("order failed");
          await res.json();
          track("order_confirmed", {
            city: state.city,
            items: state.cart.length,
            price: total,
            delivery_day: state.option.weekday,
          });
          clearState();
          root.innerHTML =
            `<h3>${W.successTitle}</h3>` +
            `<p class="status-msg success">${esc(
              W.success(state.option.weekday, state.option.time_window),
            )}</p>` +
            `<p class="wizard-hint">${W.successHint}</p>` +
            `<div class="wizard-actions"><a class="btn btn-whatsapp" data-wa-loc="success" target="_blank" rel="noopener" href="${waHref}">${W.waFallback}</a></div>`;
        } catch {
          state.submitting = false;
          confirmBtn.disabled = false;
          confirmBtn.textContent = s.confirm;
          alert(W.genericError);
        }
      });
    },
  };

  App.steps = steps;
})(window.CIMES_APP = window.CIMES_APP || {});
