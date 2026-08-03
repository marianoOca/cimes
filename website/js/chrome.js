// Shared page chrome — runs on every page (home + /alta). Each block is element-guarded,
// so it no-ops where a page lacks the target nodes (e.g. /alta has no product grid).
(function (App) {
  "use strict";
  const COPY = App.COPY;

  // Static copy from [data-copy] attributes.
  document.querySelectorAll("[data-copy]").forEach((el) => {
    const value = App.resolvePath(COPY, el.dataset.copy);
    if (typeof value === "string") el.textContent = value;
  });

  // Every WhatsApp link points at the sales number with the prefilled message.
  document.querySelectorAll(".wa-link").forEach((a) => (a.href = App.waHref));

  // Footer contact + socials.
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
})(window.CIMES_APP = window.CIMES_APP || {});
