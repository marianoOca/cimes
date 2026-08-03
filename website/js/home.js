// Home-page marketing sections (index.html only): how-it-works, product grid + infinite
// carousel, trust cards. Element-guarded; the carousel no-ops without real layout (jsdom).
(function (App) {
  "use strict";
  const COPY = App.COPY;
  const esc = App.esc;

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
})(window.CIMES_APP = window.CIMES_APP || {});
