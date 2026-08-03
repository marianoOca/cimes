// Masked phone field. Only the leading "+" is truly fixed, so any country works.
// "digits" is everything typed after the "+". The Argentine-mobile mask (grouping,
// ghost prediction) only activates once digits literally start with "549" (the default
// prefill for AR use) — anything else is a foreign number, shown/saved as plain
// "+" + digits, no grouping, no ghost. Public surface: phoneField, phoneDigitsFromE164.
(function (App) {
  "use strict";
  const esc = App.esc;

  function phoneIsAR(digits) {
    return digits.startsWith("549");
  }
  // First digit after "549" picks the AR shape:
  //  "0" -> 011-trunk-style Buenos Aires: 3-digit area, 8-digit local
  //  "1" -> 11/15 Buenos Aires: 2-digit area, 8-digit local
  //  else -> provincial (Mercedes/Luján/etc.): 4-digit area, 6-digit local
  // All three Buenos Aires spellings (11/15/011) save to the same E.164 area "11".
  function phoneModeOf(arDigits) {
    if (arDigits.startsWith("0348")) return { areaLen: 4, localLen: 7 }; // Escobar: 4-digit "0348" area, 7-digit local
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
    const area = areaLen === 4 ? arDigits.slice(0, 4).replace(/^0/, "") : "11"; // drop Escobar trunk 0 ("0348" -> "348")
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
  App.phoneDigitsFromE164 = phoneDigitsFromE164;

  // Renders + binds a masked phone field: only "+" is fixed, digit-only entry
  // appended/removed from the end, AR grouping + grey "_" prediction for
  // the untyped remainder. bind() must run after the markup is in the DOM.
  App.phoneField = function phoneField(id, label, initialDigits) {
    let digits = initialDigits || "";
    const html =
      `<div class="field phone-mask" data-field="${id}"><label for="${id}">${label}</label>` +
      `<div class="phone-mask-box"><div class="phone-mask-ghost" aria-hidden="true"></div>` +
      `<input id="${id}" type="tel" inputmode="tel" autocomplete="tel" /></div>` +
      `<span class="error"></span></div>`;
    function bind() {
      const wrap = App.root.querySelector(`[data-field="${id}"]`);
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
  };
})(window.CIMES_APP = window.CIMES_APP || {});
