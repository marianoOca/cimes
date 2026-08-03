// City selection helpers + the "Otra ciudad" autocomplete combobox. The shortcut
// cities are plain links (steps.city); this file owns the free-text path: fetch the
// full BA-city list once, filter it client-side, snap the typed city to the closest
// canonical one via POST /api/resolve-city, and — when nothing matches — offer an
// inline "did you mean?" second thought (closest cities + proceed-anyway). Never a
// dead end; coverage is decided later.
(function (App) {
  "use strict";
  const esc = App.esc;

  function citySlug(c) {
    return c.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim().replace(/\s+/g, "-");
  }
  App.citySlug = citySlug;

  App.slugToCity = function slugToCity(slug) {
    const s = String(slug || "").toLowerCase();
    return App.COPY.coverage.cities.find((c) => citySlug(c) === s) || null;
  };

  // Full BA-city list for the "Otra ciudad" autocomplete (fetched once).
  let baCities = null;
  async function fetchCities() {
    if (baCities) return baCities;
    try {
      const res = await fetch(`${App.API}/api/cities`);
      baCities = res.ok ? (await res.json()).cities || [] : [];
    } catch {
      baCities = [];
    }
    return baCities;
  }
  App.fetchCities = fetchCities;

  // Turn a URL slug back into a human city label ("monte-chico" -> "Monte Chico"),
  // so an unrecognized ?city carries into the wizard as-is (proceed-anyway) rather
  // than bouncing the visitor to the picker.
  function deslug(slug) {
    return String(slug || "")
      .replace(/-/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .replace(/\b\w/g, (ch) => ch.toUpperCase());
  }

  // Snap a non-shortcut ?city slug to a canonical BA city (boot on /alta). An
  // unrecognized slug is carried through de-slugged (proceed-anyway); only a
  // failed request falls back to the picker (null).
  App.resolveCityFromSlug = async function resolveCityFromSlug(slug) {
    try {
      const res = await fetch(`${App.API}/api/resolve-city`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: String(slug).replace(/-/g, " ") }),
      });
      if (!res.ok) return null;
      const data = await res.json();
      return data.matched ? data.city : deslug(slug);
    } catch {
      return null;
    }
  };

  // Wire the "Otra Ciudad" option: first click swaps it for an identically styled
  // combobox (text input + custom suggestions dropdown) and reveals the submit
  // button. Enter or the button snaps the typed city; an unrecognized city gets a
  // "did you mean?" nudge (closest cities + proceed-anyway) instead of a dead end.
  App.initCityOther = function initCityOther(otherBtn, submit) {
    const c = App.W.cityStep;
    const utmQS = App.utmQS;
    // Warm the BA-city list for the autocomplete (filtered client-side on type).
    fetchCities();

    const clearSecondThought = () => {
      const old = document.getElementById("city-second-thought");
      if (old) old.remove();
    };
    // Inline "did you mean?" nudge for an unrecognized city. The 1–3 closest
    // cities and "continuar igual" are all real links, like the shortcut cities:
    // a suggestion snaps to that canonical city; "continuar igual" carries the
    // typed text as-is into the wizard, where coverage decides. Never a dead end.
    const renderSecondThought = (typed, suggestions) => {
      clearSecondThought();
      const list = Array.isArray(suggestions) ? suggestions : [];
      const box = document.createElement("div");
      box.id = "city-second-thought";
      box.className = "city-second-thought";
      box.innerHTML =
        `<p class="status-msg">${esc(c.notInList(typed))}${list.length ? " " + esc(c.didYouMean) : ""}</p>` +
        `<div class="option-list">` +
        list
          .map((city, i) => `<a class="city-option" id="city-did-you-mean-${i}" href="/alta/?city=${citySlug(city)}${utmQS()}">${esc(city)}</a>`)
          .join("") +
        `<a class="city-option" id="city-proceed-anyway" href="/alta/?city=${citySlug(typed)}${utmQS()}">${esc(c.proceedAnyway(typed))}</a>` +
        `</div>`;
      submit.insertAdjacentElement("afterend", box);
      // Focus the safe default (the closest city) so Enter takes it; fall back to
      // proceed-anyway when there are no suggestions (e.g. empty city list).
      (document.getElementById("city-did-you-mean-0") || document.getElementById("city-proceed-anyway")).focus();
    };
    const snap = async (text) => {
      const t = String(text || "").trim();
      if (!t || App.state.submitting) return;
      App.state.submitting = true;
      submit.disabled = true;
      clearSecondThought();
      try {
        const res = await fetch(`${App.API}/api/resolve-city`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: t }),
        });
        if (!res.ok) throw new Error("resolve failed");
        const { city, matched, suggestions } = await res.json();
        App.track("city_other_resolved", { typed: t, city, matched });
        if (matched) {
          // Recognized (exact or typo within the match floor): continue exactly
          // like a shortcut click, canonical city in the URL.
          window.location.href = `/alta/?city=${citySlug(city)}${utmQS()}`;
          return;
        }
        // Unrecognized: give the user a second thought instead of a broken URL —
        // offer the closest cities, but let them proceed with what they typed.
        // Keep Continuar disabled so it can't be re-clicked on the same text; it
        // re-enables only when the user edits the input (the combobox listener).
        App.state.submitting = false;
        renderSecondThought(t, suggestions);
      } catch {
        App.state.submitting = false;
        submit.disabled = false;
        alert(App.W.genericError);
      }
    };

    otherBtn.addEventListener("click", () => {
      const box = document.createElement("div");
      box.className = "city-combobox";
      const input = document.createElement("input");
      input.id = "city-other-input";
      input.className = "city-option"; // same box + text format as the options
      input.setAttribute("autocomplete", "off");
      input.setAttribute("autocapitalize", "words");
      input.setAttribute("role", "combobox");
      input.setAttribute("aria-autocomplete", "list");
      input.setAttribute("aria-expanded", "false");
      input.setAttribute("aria-controls", "city-suggestions");
      input.setAttribute("aria-label", c.other);
      input.placeholder = c.otherPlaceholder; // example, shown in grey
      const menu = document.createElement("ul");
      menu.id = "city-suggestions";
      menu.className = "city-suggestions";
      menu.setAttribute("role", "listbox");
      box.appendChild(input);
      box.appendChild(menu);
      otherBtn.replaceWith(box);
      submit.hidden = false;
      submit.disabled = true; // blocked until the user actually types a city
      input.focus();

      let items = [];
      let active = -1;
      const norm = (s) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
      const close = () => {
        menu.innerHTML = "";
        items = [];
        active = -1;
        input.setAttribute("aria-expanded", "false");
        input.removeAttribute("aria-activedescendant");
      };
      const setActive = (i) => {
        const lis = menu.querySelectorAll("li");
        lis.forEach((li) => li.classList.remove("is-active"));
        active = i;
        if (i >= 0 && lis[i]) {
          lis[i].classList.add("is-active");
          lis[i].scrollIntoView({ block: "nearest" });
          input.setAttribute("aria-activedescendant", `city-sug-${i}`);
        } else {
          input.removeAttribute("aria-activedescendant");
        }
      };
      const render = () => {
        const q = norm(input.value);
        const all = baCities || [];
        items = q
          ? all
              .filter((city) => norm(city).includes(q))
              .sort((a, b) => Number(norm(b).startsWith(q)) - Number(norm(a).startsWith(q)))
              .slice(0, 8)
          : [];
        active = -1;
        menu.innerHTML = items
          .map((city, i) => `<li role="option" id="city-sug-${i}" data-i="${i}">${esc(city)}</li>`)
          .join("");
        input.setAttribute("aria-expanded", items.length ? "true" : "false");
      };
      const pick = (city) => {
        input.value = city;
        close();
        snap(city);
      };
      input.addEventListener("input", () => {
        submit.disabled = !input.value.trim(); // enable Continuar only with real text
        render();
      });
      input.addEventListener("keydown", (e) => {
        if (e.key === "ArrowDown" && items.length) {
          e.preventDefault();
          setActive((active + 1) % items.length);
        } else if (e.key === "ArrowUp" && items.length) {
          e.preventDefault();
          setActive((active - 1 + items.length) % items.length);
        } else if (e.key === "Enter") {
          e.preventDefault(); // Enter == submit, or pick the highlighted suggestion
          if (active >= 0 && items[active]) pick(items[active]);
          else snap(input.value);
        } else if (e.key === "Escape") {
          close();
        }
      });
      // mousedown fires before the input's blur, so the pick isn't cancelled.
      menu.addEventListener("mousedown", (e) => {
        const li = e.target.closest && e.target.closest("li[data-i]");
        if (!li) return;
        e.preventDefault();
        pick(items[Number(li.dataset.i)]);
      });
      input.addEventListener("blur", () => setTimeout(close, 120));
    });

    submit.addEventListener("click", () => {
      const input = document.getElementById("city-other-input");
      if (input) snap(input.value);
    });
  };
})(window.CIMES_APP = window.CIMES_APP || {});
