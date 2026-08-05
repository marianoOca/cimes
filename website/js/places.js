// Google Maps / Places for the wizard's address-autocomplete field. Loaded lazily
// (only once the wizard reaches the data step) and inert until a real browser key is
// set in config.js. No-op in jsdom / webviews where the SDK is absent, so #direccion
// stays a plain text input the user can type into.
(function (App) {
  "use strict";

  let mapsRequested = false;
  function loadGoogleMaps() {
    if (mapsRequested) return;
    const key = App.CFG.GOOGLE_MAPS_KEY;
    if (!key || key === "GOOGLE_MAPS_KEY") return;
    mapsRequested = true;
    // `loading=async` REQUIRES the callback parameter — that is the only hook Maps
    // guarantees to fire after the API is initialized. The script's own `onload` is
    // too early: at that point `google` and `google.maps` exist but
    // `google.maps.importLibrary` is still undefined, so a load-time bind silently
    // does nothing and the field is left unbound forever (no dropdown, no error, no
    // network call). Do not "simplify" this back to s.onload.
    window.__cimesMapsReady = function () {
      window.google.maps.importLibrary("places").then(attachPlaces);
    };
    const s = document.createElement("script");
    s.async = true;
    s.src =
      "https://maps.googleapis.com/maps/api/js?key=" + key +
      "&libraries=places&language=es&region=AR&loading=async&callback=__cimesMapsReady";
    document.head.appendChild(s);
  }
  App.loadGoogleMaps = loadGoogleMaps;

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
    //
    // Started, NOT awaited: the address field is now the wizard's first screen, so
    // awaiting the geocode here would attach the input listener a second late and
    // silently swallow whatever the visitor typed in the meantime. run() awaits this
    // instead, so the very first query is still restricted — just briefly slower.
    const restrictReady = (async function resolveRestrict() {
      if (!App.state.city || !window.google.maps.Geocoder) return null;
      try {
        const r = await new window.google.maps.Geocoder().geocode({
          address: App.state.city + ", Provincia de Buenos Aires, Argentina",
        });
        const c = r.results && r.results[0] && r.results[0].geometry && r.results[0].geometry.location;
        if (!c) return null;
        const lat = c.lat();
        const lng = c.lng();
        const dLat = 20000 / 111320;
        const dLng = 20000 / (111320 * Math.cos((lat * Math.PI) / 180));
        return { north: lat + dLat, south: lat - dLat, east: lng + dLng, west: lng - dLng };
      } catch (e) {
        return null; // fall back to country-only
      }
    })();

    const close = () => { box.hidden = true; box.innerHTML = ""; };

    async function choose(pred) {
      const typed = input.value;
      const place = pred.toPlace();
      try {
        await place.fetchFields({ fields: ["addressComponents", "location", "formattedAddress"] });
      } catch (e) { /* keep whatever the user typed */ }
      const comp = {};
      (place.addressComponents || []).forEach((c) =>
        (c.types || []).forEach((t) => { comp[t] = c.longText; }),
      );
      // A pick only replaces the visitor's text when it carries the street NUMBER.
      // Google answers "Arribeños 444" with the street itself whenever 444 is not a
      // known address point: the place then has a route and no street_number (and a
      // formattedAddress for the street), so writing either back silently deleted
      // the number they typed. Their text is never worse than a numberless pick.
      const line = comp.street_number
        ? [comp.route, comp.street_number].filter(Boolean).join(" ")
        : "";
      input.value = line || typed;
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
      const restrict = await restrictReady;
      if (mine !== seq) return; // superseded while the city geocode was still resolving
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
  App.attachPlaces = attachPlaces;
})(window.CIMES_APP = window.CIMES_APP || {});
