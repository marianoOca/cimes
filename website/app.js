// Landing rendering + the Flow B signup wizard (04-website §3). Pure consumer
// of the backend REST endpoints — no business logic here. Wizard state stays
// in memory; nothing persisted in the browser (04 §3 state handling).
(function () {
  "use strict";
  const COPY = window.CIMES_COPY;
  const CFG = window.CIMES_CONFIG;
  const API = CFG.API_BASE_URL.replace(/\/$/, "");

  // ---------- static sections from the copy module ----------

  function resolvePath(obj, path) {
    return path.split(".").reduce((o, k) => (o ? o[k] : undefined), obj);
  }
  document.querySelectorAll("[data-copy]").forEach((el) => {
    const value = resolvePath(COPY, el.dataset.copy);
    if (typeof value === "string") el.textContent = value;
  });

  const waHref =
    "https://wa.me/" +
    CFG.WHATSAPP_NUMBER_SALES +
    "?text=" +
    encodeURIComponent(COPY.dualCta.whatsapp.prefill);
  document.querySelectorAll(".wa-link, #nav-wa").forEach((a) => (a.href = waHref));

  document.getElementById("how-steps").innerHTML = COPY.how.steps
    .map((s) => `<div class="card"><h3>${s.title}</h3><p>${s.text}</p></div>`)
    .join("");

  document.getElementById("product-grid").innerHTML = COPY.products.items
    .map(
      (p) =>
        `<div class="card product-card"><div class="emoji">${p.emoji}</div><h3>${p.name}</h3><p>${p.description}</p>` +
        `<a class="btn btn-whatsapp" target="_blank" rel="noopener" href="${waHref}">${COPY.products.ctaLabel}</a></div>`,
    )
    .join("");

  document.getElementById("trust-items").innerHTML = COPY.trust.items
    .map((t) => `<div class="card"><h3>${t.title}</h3><p>${t.text}</p></div>`)
    .join("");

  document.getElementById("coverage-cities").innerHTML = COPY.coverage.cities
    .map((c) => `<li>${c}</li>`)
    .join("");

  document.getElementById("testimonial-items").innerHTML = COPY.testimonials.items
    .map((t) => `<div class="card"><p>${t.text}</p><p class="name">${t.name}</p></div>`)
    .join("");

  const footer = COPY.footer;
  const email = document.getElementById("footer-email");
  email.textContent = footer.email;
  email.href = "mailto:" + footer.email;
  document.getElementById("footer-ig").href = footer.instagramUrl;
  document.getElementById("footer-fb").href = footer.facebookUrl;
  document.getElementById("footer-tt").href = footer.tiktokUrl;

  // ---------- wizard (Flow B) ----------

  const root = document.getElementById("wizard-root");
  const W = COPY.wizard;
  const state = {
    city: null,
    catalog: null, // { price_list, products } — exactly one city's list
    product: null,
    data: null, // { firstName, lastName, phone, street, number, crossStreets }
    coverage: null,
    option: null,
    submitting: false,
  };

  function esc(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
    })[c]);
  }

  function backButton(toStep) {
    return `<div class="wizard-actions"><button class="btn btn-secondary" data-back="${toStep}">${W.back}</button></div>`;
  }

  function bindBack() {
    root.querySelectorAll("[data-back]").forEach((b) =>
      b.addEventListener("click", () => steps[b.dataset.back]()),
    );
  }

  const steps = {
    // 1. City select.
    city() {
      root.innerHTML =
        `<h3>${W.cityStep.title}</h3><div class="option-list">` +
        COPY.coverage.cities
          .map((c) => `<button data-city="${esc(c)}">${esc(c)}</button>`)
          .join("") +
        `<button data-city="__other">${W.cityStep.other}</button></div>`;
      root.querySelectorAll("[data-city]").forEach((b) =>
        b.addEventListener("click", () => {
          if (b.dataset.city === "__other") {
            root.innerHTML =
              `<p class="status-msg">${W.noCoverage.city}</p>` + backButton("city");
            bindBack();
            return;
          }
          state.city = b.dataset.city;
          steps.product();
        }),
      );
    },

    // 2. Priced catalog for the selected city (rendered as returned).
    async product() {
      root.innerHTML = `<h3>${W.productStep.title}</h3><p class="status-msg">${W.productStep.loading}</p>`;
      try {
        const res = await fetch(`${API}/api/prices?city=${encodeURIComponent(state.city)}`);
        if (!res.ok) throw new Error("prices failed");
        state.catalog = await res.json();
      } catch {
        root.innerHTML = `<p class="status-msg">${W.genericError}</p>` + backButton("city");
        bindBack();
        return;
      }
      root.innerHTML =
        `<h3>${W.productStep.title}</h3><div class="option-list">` +
        state.catalog.products
          .map(
            (p, i) =>
              `<button data-product="${i}">${esc(p.name)}<span class="price">$${esc(p.price)}</span></button>`,
          )
          .join("") +
        `</div>` +
        backButton("city");
      bindBack();
      root.querySelectorAll("[data-product]").forEach((b) =>
        b.addEventListener("click", () => {
          state.product = state.catalog.products[Number(b.dataset.product)];
          steps.data();
        }),
      );
    },

    // 3. Delivery-data form with client-side validation.
    data() {
      const d = W.dataStep;
      const prev = state.data || {};
      const field = (id, label, value) =>
        `<div class="field" data-field="${id}"><label for="${id}">${label}</label>` +
        `<input id="${id}" value="${esc(value || "")}" autocomplete="off" />` +
        `<span class="error">${d.errors.required}</span></div>`;
      root.innerHTML =
        `<h3>${d.title}</h3>` +
        field("firstName", d.firstName, prev.firstName) +
        field("lastName", d.lastName, prev.lastName) +
        field("phone", d.phone, prev.phone) +
        field("street", d.street, prev.street) +
        field("number", d.number, prev.number) +
        field("crossStreets", d.crossStreets, prev.crossStreets) +
        `<div class="wizard-actions"><button class="btn btn-secondary" data-back="product">${W.back}</button>` +
        `<button class="btn btn-primary" id="data-next">${d.next}</button></div>`;
      bindBack();
      document.getElementById("data-next").addEventListener("click", () => {
        const values = {};
        let ok = true;
        for (const id of ["firstName", "lastName", "phone", "street", "number", "crossStreets"]) {
          const wrap = root.querySelector(`[data-field="${id}"]`);
          const input = wrap.querySelector("input");
          const errorEl = wrap.querySelector(".error");
          values[id] = input.value.trim();
          let bad = values[id] === "";
          if (!bad && id === "phone" && !/^\+?[\d\s-]{8,16}$/.test(values[id])) {
            bad = true;
            errorEl.textContent = d.errors.phone;
          } else {
            errorEl.textContent = d.errors.required;
          }
          wrap.classList.toggle("invalid", bad);
          if (bad) ok = false;
        }
        if (!ok) return;
        state.data = values;
        steps.day();
      });
    },

    // 4. Live coverage check + delivery-day picker.
    async day() {
      root.innerHTML = `<h3>${W.dayStep.title}</h3><p class="status-msg">${W.dayStep.checking}</p>`;
      try {
        const res = await fetch(`${API}/api/coverage`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            city: state.city,
            address: `${state.data.street} ${state.data.number}`,
            cross_streets: state.data.crossStreets,
          }),
        });
        if (!res.ok) throw new Error("coverage failed");
        state.coverage = await res.json();
      } catch {
        root.innerHTML = `<p class="status-msg">${W.genericError}</p>` + backButton("data");
        bindBack();
        return;
      }
      if (!state.coverage.covered || state.coverage.delivery_options.length === 0) {
        // Polite no-coverage path (04 §5); the backend records/labels the lead.
        root.innerHTML = `<p class="status-msg">${W.noCoverage.address}</p>` + backButton("data");
        bindBack();
        return;
      }
      root.innerHTML =
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
          steps.summary();
        }),
      );
    },

    // 5. Summary + confirm (double-click guarded).
    summary() {
      const s = W.summaryStep;
      root.innerHTML =
        `<h3>${s.title}</h3><ul class="summary-list">` +
        `<li><span>${s.product}</span><span>${esc(state.product.name)}</span></li>` +
        `<li><span>${s.price}</span><span>$${esc(state.product.price)}</span></li>` +
        `<li><span>${s.address}</span><span>${esc(`${state.data.street} ${state.data.number}, ${state.city}`)}</span></li>` +
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
          const res = await fetch(`${API}/api/orders`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              source: "web",
              name: `${state.data.firstName} ${state.data.lastName}`,
              phone: state.data.phone,
              city: state.city,
              address: `${state.data.street} ${state.data.number}`,
              cross_streets: state.data.crossStreets,
              product: state.product.name,
              delivery_day: state.option.weekday,
              delivery_window: state.option.time_window,
            }),
          });
          if (!res.ok) throw new Error("order failed");
          await res.json();
          root.innerHTML =
            `<h3>${W.successTitle}</h3><p class="status-msg success">${esc(
              W.success(state.option.weekday, state.option.time_window),
            )}</p>`;
        } catch {
          state.submitting = false;
          confirmBtn.disabled = false;
          confirmBtn.textContent = s.confirm;
          alert(W.genericError);
        }
      });
    },
  };

  steps.city();
})();
