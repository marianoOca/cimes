// Boot router (loaded last). Runs on both pages — each has a #wizard-root (the wizard is
// inline on / and focused on /alta). ?city present → resume/product; absent → picker. A
// slug that isn't one of the shortcut cities is snapped against the full BA list.
(function (App) {
  "use strict";
  const root = App.root;
  if (!root) return;
  const slug = new URLSearchParams(window.location.search).get("city");
  if (!slug) {
    App.steps.city();
  } else {
    const shortcut = App.slugToCity(slug);
    if (shortcut) App.startWizard(shortcut);
    else App.resolveCityFromSlug(slug).then((city) => (city ? App.startWizard(city) : App.steps.city()));
  }
})(window.CIMES_APP = window.CIMES_APP || {});
