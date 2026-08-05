// The Flow B wizard steps: 1 city → 2 dispenser → 3 product → 4 data → 5 day →
// 6 summary. Shared internals (state, render primitives, persistence) come from
// wizard.js; the city autocomplete from cities.js; phone mask from phone.js;
// address autocomplete from places.js. Assembled onto App.steps for
// wizard.startWizard / main to drive.
(function (App) {
  "use strict";
  const COPY = App.COPY, API = App.API, esc = App.esc, rich = App.rich, track = App.track;
  const attribution = App.attribution, utmQS = App.utmQS, waHref = App.waHref;
  const root = App.root, W = App.W, state = App.state;
  const progress = App.progress, backButton = App.backButton, deadEndActions = App.deadEndActions;
  const bindBack = App.bindBack, loadingPanel = App.loadingPanel, coverageLoading = App.coverageLoading;
  const enterManualReview = App.enterManualReview;
  const money = App.money, addressString = App.addressString, productImage = App.productImage;
  const dispenserImage = App.dispenserImage, visibleProducts = App.visibleProducts;
  const abonoPricing = App.abonoPricing, abonoBottle = App.abonoBottle;
  const INCLUDED = App.ABONO_INCLUDED_BOTTLES;
  const saveState = App.saveState, clearState = App.clearState;
  const phoneField = App.phoneField, phoneDigitsFromE164 = App.phoneDigitsFromE164;
  const loadGoogleMaps = App.loadGoogleMaps, attachPlaces = App.attachPlaces;
  const citySlug = App.citySlug, initCityOther = App.initCityOther;

  // The catalog + the frío/calor offer for this city, in one call. `dispenser`
  // picks the price list (the comodato has its own in some cities), while the
  // `frio_calor` block always describes the comodato so the cards can quote it
  // before anything is chosen. Returns false when the backend can't be reached.
  async function loadPrices(dispenser) {
    const qs = dispenser ? `&dispenser=${encodeURIComponent(dispenser)}` : "";
    try {
      const res = await fetch(`${API}/api/prices?city=${encodeURIComponent(state.city)}${qs}`);
      if (!res.ok) throw new Error("prices failed");
      state.catalog = await res.json();
      state.frioCalor = state.catalog.frio_calor || null;
      return true;
    } catch {
      return false;
    }
  }

  /** "Dispenser Frío/Calor · Bajo en sodio" for the summary row. */
  function dispenserLabel() {
    const d = W.dispenserStep;
    const card =
      state.dispenser === "frio_calor" ? d.frioCalor : state.dispenser === "natural" ? d.natural : d.ninguno;
    return card.title + (state.waterType ? ` · ${d.water[state.waterType]}` : "");
  }

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

    // 2. Dispenser + water type. Both decisions live on one screen because they
    // are one decision to the visitor, and together they determine the price list,
    // which botellones the next step offers, and the abono. This is also where the
    // catalog is fetched — the frío/calor card needs its prices before anything is
    // picked, and the city is already known.
    async dispenser() {
      track("wizard_step", { step: "dispenser", n: 2 });
      const d = W.dispenserStep;
      root.innerHTML = progress(2) + `<h3>${d.title}</h3>` + loadingPanel(W.productStep.loading);
      if (!(await loadPrices())) {
        root.innerHTML = `<p class="status-msg">${W.genericError}</p>` + deadEndActions("city");
        bindBack();
        return;
      }
      // Default to común so a single card click is enough to continue; the toggle
      // is a refinement, not a second required step.
      if (!state.waterType) state.waterType = "comun";

      // No abono prices (unconfigured city, or WaterService never cached) → we
      // can't quote frío/calor honestly, so we don't offer it.
      const offerFrioCalor = Boolean(state.frioCalor);

      // The card is a plain <div>, NOT a <button>: a card holds the water toggle,
      // and nested interactive content is invalid HTML — the parser closes the
      // outer button early and the toggle escapes the card. Selection rides on a
      // real (visually restyled) radio instead, so keyboard and screen readers
      // get the native behaviour and clicking anywhere on the card still works.
      const head = (kind, title, badge, badgeClass) =>
        `<label class="dispenser-head">` +
        `<input class="dispenser-radio" type="radio" name="dispenser" value="${kind}" data-radio="${kind}"` +
        `${state.dispenser === kind ? " checked" : ""} />` +
        `<span class="dispenser-title">${esc(title)}</span>` +
        (badge ? `<span class="badge ${badgeClass}">${esc(badge)}</span>` : "") +
        `</label>`;
      const water = (kind) =>
        `<div class="water-pick">` +
        `<span class="water-label" id="water-label-${kind}">${esc(d.waterLabel)}</span>` +
        `<div class="water-toggle" role="radiogroup" aria-labelledby="water-label-${kind}">` +
        ["comun", "bajo_sodio"]
          .map(
            (t) =>
              `<button type="button" role="radio" data-water="${t}" data-card="${kind}"` +
              ` aria-checked="${state.waterType === t}">${esc(d.water[t])}</button>`,
          )
          .join("") +
        `</div></div>`;
      const bullets = (items) =>
        `<ul class="dispenser-points">` + items.map((t) => `<li>${rich(t)}</li>`).join("") + `</ul>`;
      // The frío/calor bullets quote the abono, so they are re-rendered whenever the
      // water toggle moves. The price is the first of them — an ordinary bullet, with
      // the amount bolded by the copy itself.
      const abonoBullets = () => {
        const p = abonoPricing();
        if (!p) return "";
        return fc
          .body(p.included_bottles, money(p.abono), money(p.abono_first_month))
          .map((t, i) => `<li${i === 0 ? " data-abono-price" : ""}>${rich(t)}</li>`)
          .join("");
      };
      // Image + toggle share the card's bottom row (mt-auto in the reference), so
      // the two cards line up however long their copy runs.
      const media = (kind) =>
        `<div class="dispenser-media">` +
        `<img class="dispenser-img" src="${dispenserImage(kind)}" alt="" loading="lazy" />` +
        water(kind) +
        `</div>`;

      const naturalCard =
        `<div class="dispenser-card" data-dispenser="natural">` +
        head("natural", d.natural.title, d.natural.badge, "badge-free") +
        bullets(d.natural.body) +
        media("natural") +
        `</div>`;

      const fc = d.frioCalor;
      const frioCalorCard = !offerFrioCalor
        ? ""
        : `<div class="dispenser-card dispenser-card-promo" data-dispenser="frio_calor">` +
          head("frio_calor", fc.title, fc.badge, "badge-promo") +
          `<ul class="dispenser-points" data-abono-body></ul>` +
          // Above the photo: it belongs with the bullets it qualifies, and the media
          // row is bottom-aligned so both cards line up.
          `<p class="dispenser-fine" data-abono-fine></p>` +
          media("frio_calor") +
          `</div>`;

      const noneCard =
        `<div class="dispenser-card dispenser-card-wide" data-dispenser="ninguno">` +
        head("ninguno", d.ninguno.title) +
        `<p class="dispenser-body">${rich(d.ninguno.body)}</p>` +
        `</div>`;

      root.innerHTML =
        progress(2) +
        `<h3>${d.title}</h3>` +
        `<p class="wizard-intro">${esc(d.intro)}</p>` +
        // Frío/calor first: it's the offer we want read first, and it degrades to
        // Natural alone when the abono can't be priced.
        `<div class="dispenser-grid">${frioCalorCard}${naturalCard}${noneCard}</div>` +
        `<p class="step-error" data-dispenser-error hidden>${esc(d.errors.required)}</p>` +
        `<div class="wizard-actions"><button class="btn btn-secondary" data-back="city">${W.back}</button>` +
        `<button class="btn btn-primary" id="dispenser-continue">${esc(d.continue)}</button></div>`;
      bindBack();

      const errorEl = root.querySelector("[data-dispenser-error]");
      const cards = Array.prototype.slice.call(root.querySelectorAll("[data-dispenser]"));
      const paintPrice = () => {
        const p = abonoPricing();
        const bodyEl = root.querySelector("[data-abono-body]");
        if (!p || !bodyEl) return;
        bodyEl.innerHTML = abonoBullets();
        root.querySelector("[data-abono-fine]").innerHTML = rich(
          fc.fine(p.included_bottles, money(p.excedente)),
        );
      };
      const paint = () => {
        cards.forEach((c) => {
          const on = c.dataset.dispenser === state.dispenser;
          c.classList.toggle("selected", on);
          c.querySelector("[data-radio]").checked = on;
        });
        root.querySelectorAll("[data-water]").forEach((b) =>
          b.setAttribute("aria-checked", String(b.dataset.water === state.waterType)),
        );
      };
      const choose = (kind) => {
        state.dispenser = kind;
        errorEl.hidden = true;
        paint();
      };
      paintPrice();
      paint();

      cards.forEach((c) => c.addEventListener("click", () => choose(c.dataset.dispenser)));
      // Arrow keys move the native radio group without firing a click.
      root
        .querySelectorAll("[data-radio]")
        .forEach((r) => r.addEventListener("change", () => choose(r.value)));
      // Inside a card, so picking a water also picks that card — but it must not
      // let the card's own handler run afterwards and re-render mid-flight.
      root.querySelectorAll("[data-water]").forEach((b) =>
        b.addEventListener("click", (ev) => {
          ev.stopPropagation();
          state.waterType = b.dataset.water;
          paintPrice();
          choose(b.dataset.card);
        }),
      );

      // Enabled on purpose: clicking it with nothing chosen should say what's
      // missing, not sit there dead.
      document.getElementById("dispenser-continue").addEventListener("click", async () => {
        if (!state.dispenser) {
          errorEl.hidden = false;
          return;
        }
        if (state.dispenser === "ninguno") state.waterType = null;
        // Frío/calor prices off a different list, so re-quote before showing it.
        if (state.dispenser === "frio_calor") {
          root.innerHTML =
            progress(2) + `<h3>${d.title}</h3>` + loadingPanel(W.productStep.loading);
          if (!(await loadPrices("frio_calor"))) {
            root.innerHTML = `<p class="status-msg">${W.genericError}</p>` + deadEndActions("city");
            bindBack();
            return;
          }
        }
        track("dispenser_chosen", { dispenser: state.dispenser, water: state.waterType });
        saveState();
        steps.product();
      });
    },

    // 3. Priced catalog for the selected city, narrowed to what the dispenser
    // choice allows (rendered as returned otherwise).
    async product() {
      track("wizard_step", { step: "product", n: 3 });
      // Start loading Google Maps here — one step before the address field needs it. On
      // /alta this is the first render (loads on arrival); on the landing page it only
      // fires once the visitor engages the wizard, keeping first paint light for bouncers.
      // By the time step 4 renders, the Places API is ready and attachPlaces() binds
      // synchronously (no race). Guarded by mapsRequested, so it loads at most once.
      loadGoogleMaps();
      if (!state.catalog) {
        root.innerHTML =
          progress(3) + `<h3>${W.productStep.title}</h3>` + loadingPanel(W.productStep.loading);
        if (!(await loadPrices(state.dispenser))) {
          root.innerHTML = `<p class="status-msg">${W.genericError}</p>` + deadEndActions("dispenser");
          bindBack();
          return;
        }
      }
      const products = visibleProducts(
        state.catalog.products,
        state.dispenser,
        state.waterType,
      );
      const abono = state.dispenser === "frio_calor" ? abonoPricing() : null;
      const includedName = abono ? abonoBottle(state.waterType) : null;
      // Preserve prior quantities when returning to this step (e.g. Back from data).
      const qty = {};
      (state.cart || []).forEach((c) => {
        const i = products.findIndex((p) => (c.id != null && p.id === c.id) || p.name === c.name);
        if (i >= 0) qty[i] = c.qty;
      });
      // First arrival with an abono: the four included botellones are already
      // part of what they're paying for, so start there rather than at zero and
      // let the stepper add only extras. A returning visitor keeps their own
      // quantity, even if they lowered it.
      if (abono && !state.cart) {
        const i = products.findIndex((p) => p.name === includedName);
        if (i >= 0) qty[i] = INCLUDED;
      }
      const cards = products
        .map(
          (p, i) =>
            `<div class="cart-card">` +
            `<div class="product-img"><img src="${productImage(p.name)}" alt="${esc(p.name)}" width="120" height="120" loading="lazy" /></div>` +
            `<p class="cart-name">${esc(p.name)}</p>` +
            `<p class="cart-price">${money(p.price)}</p>` +
            (p.name === includedName
              ? `<p class="cart-included">${esc(W.productStep.included(INCLUDED))}</p>`
              : "") +
            `<div class="qty-stepper">` +
            `<button type="button" class="qty-btn" data-dec="${i}"${qty[i] ? "" : " disabled"}>&minus;</button>` +
            `<span class="qty" data-qty="${i}">${qty[i] || 0}</span>` +
            `<button type="button" class="qty-btn" data-inc="${i}">+</button>` +
            `</div></div>`,
        )
        .join("");
      root.innerHTML =
        progress(3) +
        `<h3>${W.productStep.title}</h3>` +
        `<div class="wizard-cart">${cards}</div>` +
        `<div class="cart-bar"><span class="cart-total-label">${
          abono ? W.productStep.subtotalProducts : W.productStep.total
        }</span>` +
        `<span class="cart-total" data-cart-total></span></div>` +
        `<div class="wizard-actions"><button class="btn btn-secondary" data-back="dispenser">${W.back}</button>` +
        `<button class="btn btn-primary" id="cart-continue">${W.productStep.continue}</button></div>`;
      bindBack();

      const totalEl = root.querySelector("[data-cart-total]");
      const continueBtn = document.getElementById("cart-continue");
      const refresh = () => {
        // Products only — the bottles the abono doesn't already cover. The abono
        // itself is added at the summary, where the two are shown side by side.
        let total = 0;
        let count = 0;
        products.forEach((p, i) => {
          const n = qty[i] || 0;
          const free = p.name === includedName ? Math.min(n, INCLUDED) : 0;
          total += p.price * (n - free);
          count += n;
        });
        totalEl.textContent = money(total);
        // The abono alone is a valid order — the dispenser is the purchase.
        continueBtn.disabled = count === 0 && !abono;
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
        // An abono on its own is a complete order; anything else needs a product.
        if (!cart.length && !abono) return;
        state.cart = cart;
        track("cart_continue", {
          items: cart.length,
          total: cart.reduce((s, c) => s + c.price * c.qty, 0),
        });
        saveState();
        steps.data();
      });
    },

    // 4. Delivery-data form with client-side validation.
    data() {
      track("wizard_step", { step: "data", n: 4 });
      const d = W.dataStep;
      const prev = state.data || {};
      // Matched on the slug, not the literal name: an unresolved ?city arrives
      // de-slugged ("Belen De Escobar"), and the map is keyed by the pretty name.
      const codes = COPY.coverage.areaCodes;
      const cityKey = citySlug(state.city || "");
      const areaCode = codes[Object.keys(codes).find((c) => citySlug(c) === cityKey)];
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
        progress(4) +
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
      track("wizard_step", { step: "day", n: 5 });
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
            progress(5) +
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
        progress(5) +
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

    // 6. Summary + confirm (double-click guarded).
    summary() {
      track("wizard_step", { step: "summary", n: 6 });
      const s = W.summaryStep;
      // Same split as the server's resolveCartLines: the bottles the abono
      // doesn't already cover, then the discounted first month. With an abono the
      // two are shown as separate subtotals, so it's obvious the monthly fee is
      // not being charged per bottle.
      const abono = state.dispenser === "frio_calor" ? abonoPricing() : null;
      const includedName = abono ? abonoBottle(state.waterType) : null;
      const lines = [];
      state.cart.forEach((c) => {
        const free = c.name === includedName ? Math.min(c.qty, INCLUDED) : 0;
        if (free > 0) {
          lines.push({ label: `${free}x ${c.name}`, amount: 0, note: s.included });
        }
        if (c.qty - free > 0) {
          lines.push({
            label: `${c.qty - free}x ${c.name}`,
            amount: c.price * (c.qty - free),
          });
        }
      });
      const products = lines.reduce((sum, l) => sum + l.amount, 0);
      const total = products + (abono ? abono.abono_first_month : 0);
      root.innerHTML =
        progress(6) +
        `<h3>${s.title}</h3><ul class="summary-list">` +
        lines
          .map(
            (l) =>
              `<li><span>${esc(l.label)}</span><span>${
                l.note ? esc(l.note) : money(l.amount)
              }</span></li>`,
          )
          .join("") +
        (abono
          ? `<li class="summary-subtotal"><span>${s.subtotalProducts}</span><span>${money(products)}</span></li>` +
            `<li class="summary-subtotal"><span>${esc(abono.abono_name)} — ${esc(
              W.dispenserStep.frioCalor.badge,
            )}</span><span>${money(abono.abono_first_month)}</span></li>` +
            `<li class="summary-note"><span>${esc(s.abonoNote(INCLUDED))}</span></li>`
          : "") +
        `<li class="summary-total"><span>${abono ? s.totalOnDelivery : s.total}</span>` +
        `<span>${money(total)}</span></li>` +
        `<li><span>${s.address}</span><span>${esc(addressString(state.data) + ", " + state.city)}</span></li>` +
        `<li><span>${s.day}</span><span>${esc(
          W.dayStep.optionLabel(state.option.route, state.option.weekday, state.option.time_window),
        )}</span></li>` +
        (state.dispenser
          ? `<li><span>${s.dispenser}</span><span>${esc(dispenserLabel())}</span></li>`
          : "") +
        `</ul>` +
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
            dispenser: state.dispenser || undefined,
            water_type: state.waterType || undefined,
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
