// Landing rendering + the Flow B signup wizard (04-website §3). Pure consumer
// of the backend REST endpoints. No business logic here. Wizard state stays
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
  document.querySelectorAll(".wa-link").forEach((a) => (a.href = waHref));

  // Google Maps JS (Places library), for the wizard's address-autocomplete field
  // (attachPlaces(), used on both / and /alta — the wizard is inline on both).
  // Loaded lazily, only once the wizard reaches the data/address step, instead of
  // on every page load — most mobile visitors never reach step 3, so this keeps
  // first paint lighter for the in-app-browser paid-social audience. Inert until
  // a real browser key is set in config.js; attachPlaces() no-ops while
  // window.google.maps.places is absent, so the field stays a plain text input
  // either way.
  let mapsRequested = false;
  function loadGoogleMaps() {
    if (mapsRequested) return;
    const key = CFG.GOOGLE_MAPS_KEY;
    if (!key || key === "GOOGLE_MAPS_KEY") return;
    mapsRequested = true;
    const s = document.createElement("script");
    s.async = true;
    s.src =
      "https://maps.googleapis.com/maps/api/js?key=" + key +
      "&libraries=places&language=es&region=AR&loading=async";
    // With loading=async the script's onload resolves before the places library
    // is materialized, so google.maps.places is still undefined at that point.
    // importLibrary("places") waits for it, then attachPlaces() can bind.
    s.onload = () => {
      const maps = window.google && window.google.maps;
      if (maps && maps.importLibrary) maps.importLibrary("places").then(attachPlaces);
      else attachPlaces();
    };
    document.head.appendChild(s);
  }

  // ---------- measurement (04 §8): dataLayer funnel events + Meta Pixel ----------
  // Self-initializing and guarded: a no-op when GTM/Pixel are absent (tests, or
  // before the ids are configured at deploy).
  function track(event, params) {
    const payload = Object.assign({ event }, params || {});
    (window.dataLayer = window.dataLayer || []).push(payload);
    if (typeof window.fbq === "function") {
      const map = { wizard_start: "InitiateCheckout", order_confirmed: "Lead", whatsapp_click: "Contact" };
      if (map[event]) window.fbq("track", map[event], params || {});
    }
  }

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

  // Delegated tracking for the primary CTA + every WhatsApp link (static + dynamic).
  document.addEventListener("click", (e) => {
    const a = e.target.closest ? e.target.closest("a") : null;
    if (!a) return;
    const href = a.getAttribute("href") || "";
    if (href === "#alta") track("cta_click", { location: "signup" });
    else if (/^https:\/\/wa\.me\//.test(href)) track("whatsapp_click", { location: a.dataset.waLoc || "unknown" });
  });

  // Section renderers are guarded so app.js runs on any page (the homepage has
  // these sections; the focused /alta page omits them).
  const howEl = document.getElementById("how-steps");
  if (howEl)
    howEl.innerHTML = COPY.how.steps
      .map(
        (s, i) =>
          `<li class="step"><span class="step-num">${i + 1}</span>` +
          `<div class="step-body"><h3>${s.title}</h3><p>${s.text}</p></div></li>`,
      )
      .join("");

  const gridEl = document.getElementById("product-grid");
  if (gridEl)
    gridEl.innerHTML = COPY.products.items
      .map(
        (p) =>
          `<div class="card product-card"><div class="product-img"><img src="assets/products/${p.image}" alt="${esc(p.name)}" width="140" height="140" loading="lazy" /></div>` +
          `<h3>${p.name}</h3><p>${p.description}</p></div>`,
      )
      .join("");

  // Products carousel: seamless INFINITE loop (triple-cloned track + edge
  // teleport) with swipe + arrows + dots + gentle autoplay (paused on any
  // interaction). No-op without real layout (e.g. jsdom tests).
  (function initProductCarousel() {
    const track = document.getElementById("product-grid");
    const prev = document.getElementById("prod-prev");
    const next = document.getElementById("prod-next");
    const dotsWrap = document.getElementById("prod-dots");
    if (!track || !prev || !next) return;
    const originals = Array.from(track.children);
    const N = originals.length;
    if (N < 2 || !track.clientWidth) return;

    // Build three identical copies: [clones][originals][clones]. Scrolling stays
    // in the middle copy; nearing either physical edge teleports one copy over,
    // so the user never reaches a beginning or an end.
    originals.forEach((c) => {
      const lead = c.cloneNode(true);
      const tail = c.cloneNode(true);
      lead.setAttribute("aria-hidden", "true");
      tail.setAttribute("aria-hidden", "true");
      track.insertBefore(lead, originals[0]);
      track.appendChild(tail);
    });

    function stepWidth() {
      const cs = getComputedStyle(track);
      const gap = parseFloat(cs.columnGap || cs.gap || "0") || 0;
      return originals[0].getBoundingClientRect().width + gap;
    }
    function copyWidth() {
      return track.scrollWidth / 3;
    }
    function jumpTo(x) {
      track.style.scrollBehavior = "auto";
      track.scrollLeft = x;
      track.style.scrollBehavior = "smooth";
    }
    // Start in the middle (real) copy.
    jumpTo(copyWidth());

    let timer = null;
    function go(dir) {
      track.scrollBy({ left: dir * stepWidth(), behavior: "smooth" });
    }
    function pause() {
      if (timer) { clearInterval(timer); timer = null; }
    }
    function play() {
      if (timer) return;
      const reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      if (reduce) return;
      timer = setInterval(() => go(1), 4500);
    }

    prev.addEventListener("click", () => { go(-1); pause(); });
    next.addEventListener("click", () => { go(1); pause(); });

    let dots = [];
    if (dotsWrap) {
      dotsWrap.innerHTML = originals
        .map((_, i) => `<button type="button" aria-label="Ir al producto ${i + 1}"></button>`)
        .join("");
      dots = Array.from(dotsWrap.children);
      dots.forEach((d, i) =>
        d.addEventListener("click", () => {
          track.scrollTo({ left: copyWidth() + i * stepWidth(), behavior: "smooth" });
          pause();
        }),
      );
    }

    let raf = 0;
    function onScroll() {
      const w = copyWidth();
      const s = stepWidth();
      const x = track.scrollLeft;
      if (x <= s * 0.5) jumpTo(x + w);
      else if (x >= track.scrollWidth - track.clientWidth - s * 0.5) jumpTo(x - w);
      const i = ((Math.round(track.scrollLeft / Math.max(1, s)) % N) + N) % N;
      dots.forEach((d, di) => d.classList.toggle("active", di === i));
    }
    track.addEventListener(
      "scroll",
      () => {
        if (raf) return;
        raf = requestAnimationFrame(() => { raf = 0; onScroll(); });
      },
      { passive: true },
    );
    onScroll();

    ["pointerenter", "focusin", "touchstart"].forEach((e) =>
      track.addEventListener(e, pause, { passive: true }),
    );
    track.addEventListener("pointerleave", play);
    play();
  })();

  const trustEl = document.getElementById("trust-items");
  if (trustEl)
    trustEl.innerHTML = COPY.trust.items
      .map((t) => `<div class="card" data-icon="${t.icon}"><h3><span class="card-ic"></span>${t.title}</h3><p>${t.text}</p></div>`)
      .join("");

  const footer = COPY.footer;
  const email = document.getElementById("footer-email");
  if (email) {
    email.textContent = footer.email;
    email.href = "mailto:" + footer.email;
  }
  const ig = document.getElementById("footer-ig");
  if (ig) ig.href = footer.instagramUrl;
  const fb = document.getElementById("footer-fb");
  if (fb) fb.href = footer.facebookUrl;
  const tt = document.getElementById("footer-tt");
  if (tt) tt.href = footer.tiktokUrl;

  // Floating WhatsApp button + header "Darme de alta" CTA: hidden over the
  // hero, then float with the viewport. Scrolling back up, the WA button
  // docks at the "Alta automática" title instead of drifting back over the
  // hero (no-op pieces skipped when a page lacks them, e.g. /alta or privacy).
  (function initScrollFloats() {
    const waFloat = document.querySelector(".wa-float");
    const navCta = document.querySelector(".nav-cta");
    const dockTitle = document.getElementById("wizard-title") || document.getElementById("alta-title");
    if ((!waFloat && !navCta) || !dockTitle) return;
    const MARGIN = 18;
    function update() {
      const dockY = dockTitle.getBoundingClientRect().top + window.scrollY;
      const floatY = window.scrollY + window.innerHeight - MARGIN - (waFloat ? waFloat.offsetHeight : 0);
      const past = floatY > dockY;
      if (waFloat) {
        if (past) {
          waFloat.style.position = "";
          waFloat.style.top = "";
        } else {
          waFloat.style.position = "absolute";
          waFloat.style.top = dockY + "px";
        }
      }
      if (navCta) navCta.classList.toggle("is-visible", past);
    }
    update();
    let raf = 0;
    function onScroll() {
      if (raf) return;
      raf = requestAnimationFrame(() => { raf = 0; update(); });
    }
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
  })();

  // Canvas background is white by default (matches top-of-page bounce);
  // switch to the footer's slate only once the page is actually scrolled
  // to the bottom, so a fast scroll-up bounce at the top stays white.
  (function initBottomBg() {
    function update() {
      const atBottom = window.scrollY + window.innerHeight >= document.documentElement.scrollHeight - 1;
      document.body.classList.toggle("is-at-bottom", atBottom);
    }
    update();
    let raf = 0;
    function onScroll() {
      if (raf) return;
      raf = requestAnimationFrame(() => { raf = 0; update(); });
    }
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
  })();

  // ---------- wizard (Flow B) ----------

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

  function esc(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
    })[c]);
  }

  // Phone mask: only the leading "+" is truly fixed, so any country works.
  // "digits" is everything typed after the "+". The Argentine-mobile mask
  // (grouping, ghost prediction) only activates once digits literally start
  // with "549" (the default prefill for AR use) — anything else is a foreign
  // number and is shown/saved as plain "+" + digits, no grouping, no ghost.
  function phoneIsAR(digits) {
    return digits.startsWith("549");
  }
  // First digit after "549" picks the AR shape:
  //  "0" -> 011-trunk-style Buenos Aires: 3-digit area, 8-digit local
  //  "1" -> 11/15 Buenos Aires: 2-digit area, 8-digit local
  //  else -> provincial (Mercedes/Luján/etc.): 4-digit area, 6-digit local
  // All three Buenos Aires spellings (11/15/011) save to the same E.164 area "11".
  function phoneModeOf(arDigits) {
    if (arDigits[0] === "0") return { areaLen: 3, localLen: 8 };
    if (arDigits[0] === "1") return { areaLen: 2, localLen: 8 };
    return { areaLen: 4, localLen: 6 };
  }
  // Total digit count (after "+") for the current shape — AR has a known
  // target; a foreign number doesn't, so cap at E.164's 15-digit max.
  function phoneTotal(digits) {
    if (!phoneIsAR(digits)) return 15;
    const m = phoneModeOf(digits.slice(3));
    return 3 + m.areaLen + m.localLen;
  }
  // What the input shows: only digits typed so far, grouped with a "-" once
  // the AR local part passes its fixed split point.
  function phoneReal(digits) {
    if (!phoneIsAR(digits)) return "+" + digits.slice(0, 15);
    const arDigits = digits.slice(3);
    const { areaLen, localLen } = phoneModeOf(arDigits);
    const d = arDigits.slice(0, areaLen + localLen);
    const area = d.slice(0, areaLen);
    const local = d.slice(areaLen);
    let out = "+54 9" + (area ? " " + area : "");
    if (local) {
      const split = localLen - 4;
      out += " " + (local.length > split ? local.slice(0, split) + "-" + local.slice(split) : local);
    }
    return out;
  }
  // Same shape as phoneReal but padded with "_" through the full target length —
  // the grey prediction rendered behind the real, typed digits. No known target
  // for a foreign number, so there's nothing to predict there.
  function phoneFull(digits) {
    if (!phoneIsAR(digits)) return phoneReal(digits);
    const arDigits = digits.slice(3);
    const { areaLen, localLen } = phoneModeOf(arDigits);
    const area = arDigits.slice(0, areaLen).padEnd(areaLen, "_");
    const local = arDigits.slice(areaLen, areaLen + localLen).padEnd(localLen, "_");
    const split = localLen - 4;
    return "+54 9 " + area + " " + local.slice(0, split) + "-" + local.slice(split);
  }
  // Canonical E.164 for storage/dedupe (the phone is the key shared with
  // WhatsApp-sourced leads). Foreign numbers pass through as "+" + digits.
  function phoneToE164(digits) {
    if (!phoneIsAR(digits)) return "+" + digits;
    const arDigits = digits.slice(3);
    const { areaLen, localLen } = phoneModeOf(arDigits);
    const area = areaLen === 4 ? arDigits.slice(0, 4) : "11";
    const local = arDigits.slice(areaLen, areaLen + localLen);
    return "+549" + area + local;
  }
  // A field is complete when its known AR target is fully typed; a foreign
  // number has no known target, so just require a plausible minimum length.
  function phoneIsComplete(digits) {
    return phoneIsAR(digits) ? digits.length === phoneTotal(digits) : digits.length >= 8;
  }
  // Recovers the internal digit representation from a saved E.164 string (used
  // when a user returns to edit the data step after going back from Day/Summary).
  function phoneDigitsFromE164(e164) {
    return String(e164 || "").replace(/\D/g, "");
  }

  // Renders + binds a masked phone field: only "+" is fixed, digit-only entry
  // appended/removed from the end, AR grouping + grey "_" prediction for
  // the untyped remainder. bind() must run after the markup is in the DOM.
  function phoneField(id, label, initialDigits) {
    let digits = initialDigits || "";
    const html =
      `<div class="field phone-mask" data-field="${id}"><label for="${id}">${label}</label>` +
      `<div class="phone-mask-box"><div class="phone-mask-ghost" aria-hidden="true"></div>` +
      `<input id="${id}" type="tel" inputmode="tel" autocomplete="tel" /></div>` +
      `<span class="error"></span></div>`;
    function bind() {
      const wrap = root.querySelector(`[data-field="${id}"]`);
      const input = wrap.querySelector("input");
      const ghost = wrap.querySelector(".phone-mask-ghost");
      const errorEl = wrap.querySelector(".error");
      function render() {
        const real = phoneReal(digits);
        const full = phoneFull(digits);
        input.value = real;
        ghost.innerHTML =
          `<span class="pm-typed">${esc(real)}</span><span class="pm-pending">${esc(full.slice(real.length))}</span>`;
        input.setSelectionRange(real.length, real.length);
        wrap.classList.remove("invalid"); // clear a prior failed-submit flag as the user edits
      }
      // Caret always sits at the end: every example the field follows appends
      // or removes from the end, never mid-string — so navigation keys are
      // no-ops rather than letting the caret drift out of sync with `digits`.
      input.addEventListener("keydown", (e) => {
        if (e.key === "ArrowLeft" || e.key === "ArrowRight" || e.key === "Home") e.preventDefault();
      });
      input.addEventListener("focus", () => input.setSelectionRange(input.value.length, input.value.length));
      input.addEventListener("beforeinput", (e) => {
        e.preventDefault();
        if (/^delete/.test(e.inputType)) {
          digits = digits.slice(0, -1);
          render();
          return;
        }
        const raw = e.data || (e.dataTransfer && e.dataTransfer.getData("text")) || "";
        for (const ch of raw.replace(/\D/g, "")) {
          if (digits.length >= phoneTotal(digits + ch)) break; // full: reject extra digits
          digits += ch;
        }
        render();
      });
      render();
      return {
        isComplete: () => phoneIsComplete(digits),
        markInvalid: (msg) => { errorEl.textContent = msg; wrap.classList.add("invalid"); },
        toE164: () => phoneToE164(digits),
      };
    }
    return { html, bind };
  }

  function backButton(toStep) {
    return `<div class="wizard-actions"><button class="btn btn-secondary" data-back="${toStep}">${W.back}</button></div>`;
  }

  // ---------- /alta split-flow helpers ----------
  function citySlug(c) {
    return c.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim().replace(/\s+/g, "-");
  }
  function slugToCity(slug) {
    const s = String(slug || "").toLowerCase();
    return COPY.coverage.cities.find((c) => citySlug(c) === s) || null;
  }
  // Carry captured attribution onto the /alta link so a new-tab open keeps it.
  function utmQS() {
    const parts = Object.keys(attribution).map(
      (k) => encodeURIComponent(k) + "=" + encodeURIComponent(attribution[k]),
    );
    return parts.length ? "&" + parts.join("&") : "";
  }
  function addressString(d) {
    return d.direccion + (d.piso ? ", " + d.piso : "");
  }
  // Format an integer price with comma thousands separators ($2600 -> $2,600).
  function money(n) {
    return "$" + Math.round(Number(n) || 0).toLocaleString("en-US");
  }
  // Map a catalog product name to a local photo; CIMES logo when nothing matches.
  // Root-relative so it resolves on /alta/ (a subdirectory), not only the home page.
  function productImage(name) {
    const s = String(name || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
    const img = (f) => "/assets/products/" + f;
    if (/soda|sifon/.test(s)) return img("soda-sifon.webp");
    if (/saboriz/.test(s)) return img("saborizada.webp");
    if (/gaseosa/.test(s)) return img("gaseosas.webp");
    if (/jugo|polvo/.test(s)) return img("jugo.webp");
    if (/12/.test(s) && /sodio|menos|\bms\b/.test(s)) return img("botellon-12l-ms.webp");
    if (/20/.test(s)) return img("botellon-20l.webp");
    if (/12/.test(s)) return img("botellon-12l.webp");
    if (/botella|agua/.test(s)) return img("agua-botellas.webp");
    return "/assets/logo-cimes.png";
  }
  // Mid-flow persistence: resume the furthest step after a reload of /alta.
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
  // Google Places autocomplete on the address field. No-op when Maps is absent
  // (jsdom tests, or a webview where the script didn't load): the field stays a
  // plain text input the user can type into.
  // Address autocomplete on the #direccion input, via the NEW Places API
  // (AutocompleteSuggestion) rendered as our own dropdown. The legacy
  // places.Autocomplete widget is deprecated (blocked for new Google projects) and
  // its .pac-container never bound reliably here. We keep #direccion as the real
  // input so FREEFORM addresses still submit (the backend geocodes the raw string
  // via WaterService #12); on picking a suggestion we write back the same
  // "route street_number" line + lat/lng dataset as before. Idempotent per input
  // element (data-pacBound), so it re-binds correctly on every data-step re-render.
  async function attachPlaces() {
    const input = document.getElementById("direccion");
    const places = window.google && window.google.maps && window.google.maps.places;
    if (!input || !places || !places.AutocompleteSuggestion) return;
    if (input.dataset.pacBound) return;
    input.dataset.pacBound = "1";
    input.setAttribute("autocomplete", "off");

    const wrap = input.closest(".field") || input.parentElement;
    if (wrap) wrap.classList.add("pac-anchor");
    const box = document.createElement("ul");
    box.className = "pac-container";
    box.setAttribute("role", "listbox");
    box.hidden = true;
    (wrap || input.parentElement).appendChild(box);

    const { AutocompleteSuggestion, AutocompleteSessionToken } = places;
    let token = new AutocompleteSessionToken();

    // Hard-restrict suggestions to a ~20 km box around the selected city (the old
    // strictBounds behavior) so streets from other cities don't show. Falls back to
    // country-only if the city geocode fails; the backend coverage check is the
    // authority on the address anyway.
    let restrict = null;
    if (state.city && window.google.maps.Geocoder) {
      try {
        const r = await new window.google.maps.Geocoder().geocode({
          address: state.city + ", Provincia de Buenos Aires, Argentina",
        });
        const c = r.results && r.results[0] && r.results[0].geometry && r.results[0].geometry.location;
        if (c) {
          const lat = c.lat();
          const lng = c.lng();
          const dLat = 20000 / 111320;
          const dLng = 20000 / (111320 * Math.cos((lat * Math.PI) / 180));
          restrict = { north: lat + dLat, south: lat - dLat, east: lng + dLng, west: lng - dLng };
        }
      } catch (e) { /* fall back to country-only */ }
    }

    const close = () => { box.hidden = true; box.innerHTML = ""; };

    async function choose(pred) {
      const place = pred.toPlace();
      try {
        await place.fetchFields({ fields: ["addressComponents", "location", "formattedAddress"] });
      } catch (e) { /* keep whatever the user typed */ }
      const comp = {};
      (place.addressComponents || []).forEach((c) =>
        (c.types || []).forEach((t) => { comp[t] = c.longText; }),
      );
      const line = [comp.route, comp.street_number].filter(Boolean).join(" ");
      input.value = line || place.formattedAddress || input.value;
      if (place.location) {
        input.dataset.lat = place.location.lat();
        input.dataset.lng = place.location.lng();
      }
      token = new AutocompleteSessionToken(); // end the billing session after a pick
      close();
    }

    let seq = 0;
    async function run(text) {
      const mine = ++seq;
      if (!text || text.trim().length < 3) return close();
      const req = {
        input: text, includedRegionCodes: ["ar"], language: "es", region: "AR", sessionToken: token,
      };
      if (restrict) req.locationRestriction = restrict;
      let res;
      try {
        res = await AutocompleteSuggestion.fetchAutocompleteSuggestions(req);
      } catch (e) { return close(); }
      if (mine !== seq) return; // a newer keystroke already superseded this
      const preds = (res.suggestions || []).map((s) => s.placePrediction).filter(Boolean);
      if (!preds.length) return close();
      box.innerHTML = "";
      preds.slice(0, 5).forEach((p) => {
        const li = document.createElement("li");
        li.className = "pac-item";
        li.setAttribute("role", "option");
        li.textContent = p.text && p.text.text ? p.text.text : "";
        // mousedown (not click) so it fires before the input's blur closes the box.
        li.addEventListener("mousedown", (ev) => { ev.preventDefault(); choose(p); });
        box.appendChild(li);
      });
      box.hidden = false;
    }

    let debounce;
    input.addEventListener("input", () => {
      delete input.dataset.lat;
      delete input.dataset.lng; // typing invalidates a previously-picked coordinate
      clearTimeout(debounce);
      const text = input.value;
      debounce = setTimeout(() => run(text), 200);
    });
    input.addEventListener("blur", () => setTimeout(close, 150));
    input.addEventListener("keydown", (e) => { if (e.key === "Escape") close(); });
  }

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

  // Dead-end / error actions: Back plus a live WhatsApp fallback so a stuck
  // visitor still has a path forward (the backend already records the lead).
  function deadEndActions(toStep) {
    return `<div class="wizard-actions">` +
      `<button class="btn btn-secondary" data-back="${toStep}">${W.back}</button>` +
      `<a class="btn btn-whatsapp" data-wa-loc="wizard_fallback" target="_blank" rel="noopener" href="${waHref}">${W.waFallback}</a>` +
      `</div>`;
  }

  function bindBack() {
    root.querySelectorAll("[data-back]").forEach((b) =>
      b.addEventListener("click", () => steps[b.dataset.back]()),
    );
  }

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
      // water layer — waves, clipped to the body so it only shows inside the glass. The clip
      // rotates with the bottle (water always contained), but can-water counter-rotates so the
      // surface stays level while the glass spins around it.
      `<g clip-path="url(#bidonBody)">` +
      `<g class="can-water">` +
      `<path class="can-wave can-wave-back" d="M-30,65 q15,-6 30,0 t30,0 t30,0 t30,0 t30,0 t30,0 V150 H-30 Z"/>` +
      `<path class="can-wave can-wave-front" d="M-30,69 q15,-7 30,0 t30,0 t30,0 t30,0 t30,0 t30,0 V150 H-30 Z"/>` +
      `</g>` +
      `</g>` +
      // grey cap + blue outline on top; the whole group shares the body's centre.
      `<rect class="can-cap" x="46" y="24" width="28" height="14" rx="3"/>` +
      `<path class="can-shell" d="${body}"/>` +
      `</g>` +
      `</svg></div>`
    );
  }

  // Shared canister loader panel for backend/data waits (prices, coverage). Not used for
  // quick button submits ("Enviando…"), which stay as button-label swaps.
  function loadingPanel(msg) {
    return canisterAnim() + `<p class="status-msg">${msg}</p>`;
  }

  function coverageLoading() {
    return progress(4) + `<h3>${W.dayStep.title}</h3>` + loadingPanel(W.dayStep.checking);
  }

  // Covered city, but nothing we can offer automatically (no serviceable slot, or the
  // coverage check kept failing) → save the lead server-side and hand off to a human via
  // WhatsApp (04 §5). Capture fires on render, exactly when the WhatsApp button appears.
  function enterManualReview() {
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
        address: addressString(state.data),
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
  }

  const steps = {
    // 1. City select.
    city() {
      track("wizard_step", { step: "city", n: 1 });
      // City options are real links to the focused /alta page (city in the URL).
      root.innerHTML =
        progress(1) +
        `<h3>${W.cityStep.title}</h3><div class="option-list">` +
        COPY.coverage.cities
          .map((c) => `<a class="city-option" href="/alta/?city=${citySlug(c)}${utmQS()}">${esc(c)}</a>`)
          .join("") +
        // "Otra ciudad" navigates to the waitlist form (uncovered-zone lead capture).
        `<a class="city-option city-option-other" href="/alta/?waitlist=1${utmQS()}">${W.cityStep.other}</a></div>`;
    },

    // Waitlist form for uncovered zones (reached via /alta?waitlist=1 or the
    // homepage "Otra ciudad" link). Captures contact and POSTs to /api/waitlist.
    waitlist() {
      track("wizard_step", { step: "waitlist" });
      const w = W.waitlist;
      const e = W.dataStep.errors;
      const prev = state.waitlist || {};
      const field = (id, label, value, attrs) =>
        `<div class="field" data-field="${id}"><label for="${id}">${label}</label>` +
        `<input id="${id}" value="${esc(value || "")}" ${attrs || ""} />` +
        `<span class="error">${e.required}</span></div>`;
      // No known city here, so the phone field starts at the bare "+54 9" default.
      const phone = phoneField("wl-phone", w.phone, prev.phone ? phoneDigitsFromE164(prev.phone) : "549");
      root.innerHTML =
        `<h3>${w.title}</h3>` +
        `<p class="wizard-intro">${esc(w.intro)}</p>` +
        field("wl-name", w.name, prev.name, 'autocomplete="name" autocapitalize="words"') +
        phone.html +
        field("wl-zone", w.zone, prev.zone, `autocapitalize="words" placeholder="${esc(w.zonePlaceholder)}"`) +
        field("wl-comment", w.comment, prev.comment, "") +
        `<div class="wizard-actions"><button class="btn btn-secondary" data-back="city">${W.back}</button>` +
        `<button class="btn btn-primary" id="wl-submit">${w.submit}</button></div>`;
      bindBack();
      const phoneApi = phone.bind();
      const submitBtn = document.getElementById("wl-submit");
      submitBtn.addEventListener("click", async () => {
        if (state.submitting) return;
        const required = { "wl-name": true, "wl-zone": true, "wl-comment": false };
        const values = {};
        let ok = true;
        for (const id of Object.keys(required)) {
          const wrap = root.querySelector(`[data-field="${id}"]`);
          const input = wrap.querySelector("input");
          const errorEl = wrap.querySelector(".error");
          const val = input.value.trim();
          values[id] = val;
          const bad = required[id] && val === "";
          errorEl.textContent = e.required;
          wrap.classList.toggle("invalid", bad);
          if (bad) ok = false;
        }
        if (!phoneApi.isComplete()) {
          phoneApi.markInvalid(e.phone);
          ok = false;
        }
        if (!ok) return;
        state.waitlist = { ...values, phone: phoneApi.toE164() };
        state.submitting = true;
        submitBtn.disabled = true;
        submitBtn.textContent = w.sending;
        try {
          const payload = {
            source: "web",
            name: values["wl-name"],
            phone: phoneApi.toE164(),
            city: values["wl-zone"],
            comment: values["wl-comment"],
          };
          // Attach paid-social attribution (empty object when none captured).
          Object.assign(payload, attribution);
          const res = await fetch(`${API}/api/waitlist`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          });
          if (!res.ok) throw new Error("waitlist failed");
          await res.json();
          track("waitlist_submitted", { zone: values["wl-zone"] });
          root.innerHTML =
            `<h3>${w.successTitle}</h3>` +
            `<p class="status-msg success">${esc(w.success)}</p>` +
            `<div class="wizard-actions"><a class="btn btn-whatsapp" data-wa-loc="waitlist_success" target="_blank" rel="noopener" href="${waHref}">${W.waFallback}</a></div>`;
        } catch {
          state.submitting = false;
          submitBtn.disabled = false;
          submitBtn.textContent = w.submit;
          alert(W.genericError);
        }
      });
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

  // Boot (both pages, no mode flag): ?waitlist → waitlist form; ?city present →
  // product/resume; absent → picker.
  if (root) {
    const params = new URLSearchParams(window.location.search);
    const urlCity = (() => {
      const slug = params.get("city");
      return slug ? slugToCity(slug) : null;
    })();
    if (params.get("waitlist")) {
      steps.waitlist();
    } else if (!urlCity) {
      steps.city();
    } else {
      state.city = urlCity;
      track("wizard_start", { city: urlCity });
      const saved = loadState();
      if (saved && saved.city === urlCity) {
        state.cart = saved.cart || null;
        state.data = saved.data || null;
        state.option = saved.option || null;
        const hasCart = state.cart && state.cart.length;
        if (hasCart && state.data && state.option) steps.summary();
        else if (hasCart && state.data) steps.day();
        else if (hasCart) steps.data();
        else steps.product();
      } else {
        steps.product();
      }
    }
  }
})();
