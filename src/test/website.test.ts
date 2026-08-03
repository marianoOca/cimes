// Drives the real website wizard (website/app.js) in jsdom against a stubbed
// backend. Verifies Flow B end-to-end per 04-website §3/§10.
//
// The signup flow is split across two pages that share app.js (URL-driven boot):
//   - index.html  → no ?city → renders the city picker (links to /alta/?city=<slug>)
//   - alta/index.html?city=<slug> → boots straight to the product step
// jsdom has no window.google, so the Direccion field is a plain text input here
// (Google Places attaches only when the Maps SDK is present in the browser).
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { JSDOM } from "jsdom";
import { beforeEach, describe, expect, it, vi } from "vitest";

const websiteDir = join(dirname(fileURLToPath(import.meta.url)), "../../website");
const read = (f: string) => readFileSync(join(websiteDir, f), "utf8");

// app.js was split into ordered js/ files (one shared window.CIMES_APP namespace).
// Eval them in <script>-tag order, exactly as index.html / alta/index.html load them.
// Home marketing (js/home.js) is index-only; /alta omits it.
const CORE = ["js/util.js", "js/tracking.js", "js/chrome.js"];
const WIZARD = [
  "js/phone.js", "js/places.js", "js/cities.js", "js/wizard.js", "js/steps.js", "js/main.js",
];
function evalApp(w: { eval(code: string): void }, file: string) {
  w.eval(read("config.js"));
  w.eval(read("copy.es-AR.js"));
  const files = file === "index.html" ? [...CORE, "js/home.js", ...WIZARD] : [...CORE, ...WIZARD];
  for (const f of files) w.eval(read(f));
}

const catalog = {
  city: "Luján",
  price_list: "5",
  products: [
    { id: "1", name: "Bidon x 20 lts", price: 800 },
    { id: "2", name: "Bidon x 12 lts", price: 500 },
    { id: "3", name: "Soda x 1.5 lts", price: 2600 }, // 4-digit: exercises comma formatting
  ],
};

const coverageOk = {
  covered: true,
  coordinates: { lat: -34.6, lng: -59.4 },
  price_list: "5",
  delivery_options: [{ route: "19", weekday: "sábado", time_window: "entre 10 y 13" }],
};

type Fetch = (url: string, init?: RequestInit) => Promise<unknown>;

function buildPage(fetchImpl: Fetch, url = "https://www.cimes.com.ar/", file = "index.html") {
  const dom = new JSDOM(read(file), { url, runScripts: "outside-only" });
  const w = dom.window as unknown as { eval(code: string): void; fetch: unknown };
  w.fetch = vi.fn(async (u: string, init?: RequestInit) => ({
    ok: true,
    json: async () => fetchImpl(u, init),
  }));
  evalApp(w, file);
  return dom;
}

// Like buildPage but hands the test full control of each Response (ok + json), so a
// coverage call can return a 503 the way the real backend does on an upstream timeout.
function buildRawPage(
  fetchFn: (u: string, init?: RequestInit) => { ok: boolean; json: () => Promise<unknown> },
  citySlug = "lujan",
) {
  const url = `https://www.cimes.com.ar/alta/?city=${citySlug}`;
  const dom = new JSDOM(read("alta/index.html"), { url, runScripts: "outside-only" });
  const w = dom.window as unknown as { eval(code: string): void; fetch: unknown };
  w.fetch = vi.fn(async (u: string, init?: RequestInit) => fetchFn(u, init));
  evalApp(w, "alta/index.html");
  return dom;
}

const tick = () => new Promise((r) => setTimeout(r, 0));
const evalIn = (dom: JSDOM, code: string) =>
  (dom.window as unknown as { eval(c: string): void }).eval(code);

function click(dom: JSDOM, selector: string) {
  const el = dom.window.document.querySelector(selector) as HTMLElement | null;
  if (!el) throw new Error(`no element for ${selector}`);
  el.dispatchEvent(new dom.window.Event("click", { bubbles: true }));
}

function type(dom: JSDOM, id: string, value: string) {
  (dom.window.document.getElementById(id) as HTMLInputElement).value = value;
}

// Like type(), but also fires the 'input' event (drives the autocomplete filter).
function typeInto(dom: JSDOM, id: string, value: string) {
  const el = dom.window.document.getElementById(id) as HTMLInputElement;
  el.value = value;
  el.dispatchEvent(new dom.window.Event("input", { bubbles: true }));
}

// The phone field owns its value internally (a masked "+54 9 area local"
// input) — it only reacts to real keystroke-shaped events, so tests drive it
// through beforeinput like a real keyboard/paste would, one op at a time.
function phoneEvent(dom: JSDOM, id: string, inputType: string, data: string | null) {
  const el = dom.window.document.getElementById(id) as HTMLInputElement;
  const InputEventCtor = (dom.window as unknown as { InputEvent: typeof InputEvent }).InputEvent;
  el.dispatchEvent(new InputEventCtor("beforeinput", { inputType, data, bubbles: true, cancelable: true }));
}
function typeDigits(dom: JSDOM, id: string, chars: string) {
  for (const ch of chars) phoneEvent(dom, id, "insertText", ch);
}
function backspacePhone(dom: JSDOM, id: string, times = 1) {
  for (let i = 0; i < times; i++) phoneEvent(dom, id, "deleteContentBackward", null);
}
function pastePhone(dom: JSDOM, id: string, text: string) {
  phoneEvent(dom, id, "insertFromPaste", text);
}
function phoneGhostPending(dom: JSDOM, fieldId: string) {
  return dom.window.document.querySelector(`[data-field="${fieldId}"] .pm-pending`)!.textContent;
}

// Multi-item cart step: bump a product's quantity, then continue to the data step.
function addToCart(dom: JSDOM, i: number, qty = 1) {
  for (let n = 0; n < qty; n++) click(dom, `[data-inc="${i}"]`);
}
function pickProduct(dom: JSDOM, i = 0, qty = 1) {
  addToCart(dom, i, qty);
  click(dom, "#cart-continue");
}

describe("website: Flow B wizard", () => {
  let orders: unknown[];

  // Cities the "Otra ciudad" autocomplete/snap knows about in these tests.
  const KNOWN_CITIES = ["Necochea", "Navarro", "Tandil", "Lobos"];

  function stub(coverage: unknown = coverageOk): Fetch {
    orders = [];
    return (url: string, init?: RequestInit) => {
      if (url.includes("/api/prices")) return Promise.resolve(catalog);
      if (url.includes("/api/coverage")) return Promise.resolve(coverage);
      if (url.includes("/api/cities")) return Promise.resolve({ cities: KNOWN_CITIES });
      if (url.includes("/api/resolve-city")) {
        const text = String(JSON.parse(String(init?.body)).text || "").trim();
        const exact = KNOWN_CITIES.find((c) => c.toLowerCase() === text.toLowerCase());
        const matched = Boolean(exact);
        // Mirrors matchCity: `suggestions` are always real cities (the 1–3 closest),
        // even below the floor. The stub returns two fixed ones for unrecognized input.
        return Promise.resolve({
          city: matched ? exact : text,
          matched,
          score: matched ? 1 : 0,
          suggestions: matched ? [exact] : ["Necochea", "Navarro"],
        });
      }
      if (url.includes("/api/manual-review")) return Promise.resolve({ ok: true });
      if (url.includes("/api/orders")) {
        orders.push(JSON.parse(String(init?.body)));
        return Promise.resolve({ order_id: "o1", sync_status: "synced" });
      }
      throw new Error(`unexpected fetch ${url}`);
    };
  }

  // Boot the dedicated /alta page for a valid city → lands on the product step
  // once the prices fetch resolves.
  async function bootToProduct(fetchImpl: Fetch, query = "", citySlug = "lujan") {
    const dom = buildPage(fetchImpl, `https://www.cimes.com.ar/alta/?city=${citySlug}${query}`, "alta/index.html");
    await tick();
    return dom;
  }
  // Same as bootToProduct, but for the ghost-mask tests that need to match the
  // spec's literal Mercedes (area 2324) examples rather than Luján's.
  async function bootToProductForCity(fetchImpl: Fetch, citySlug: string) {
    const dom = buildPage(fetchImpl, `https://www.cimes.com.ar/alta/?city=${citySlug}`, "alta/index.html");
    await tick();
    return dom;
  }

  function fillAndSubmitData(dom: JSDOM) {
    type(dom, "firstName", "Ana");
    type(dom, "lastName", "Prueba");
    typeDigits(dom, "phone", "123456"); // completes Luján's prefilled area (2323) to +54 9 2323 12-3456
    type(dom, "direccion", "Rivadavia 770");
    type(dom, "crossStreets", "Mitre y Lavalle");
    click(dom, "#data-next");
  }

  async function runHappyPath(dom: JSDOM) {
    pickProduct(dom);
    fillAndSubmitData(dom);
    await tick();
    click(dom, '[data-option="0"]');
    click(dom, "#confirm");
    await tick();
  }

  beforeEach(() => vi.clearAllMocks());

  it("renders the landing sections from the copy module", () => {
    const dom = buildPage(stub());
    const doc = dom.window.document;
    expect(doc.querySelector(".hero h1")!.textContent).toContain("Agua y soda");
    // One card per product in the copy module (derive the count so adding/removing
    // a product doesn't break this test).
    const productCount = (dom.window as unknown as { CIMES_COPY: { products: { items: unknown[] } } })
      .CIMES_COPY.products.items.length;
    expect(doc.querySelectorAll("#product-grid .card")).toHaveLength(productCount);
    // wa.me deep link with prefilled message on both CTAs + floating widget.
    const wa = doc.querySelector(".wa-float") as HTMLAnchorElement;
    expect(wa.href).toContain("wa.me/5491100000000");
    expect(wa.href).toContain(encodeURIComponent("Hola, quiero darme de alta"));
  });

  it("homepage renders the city picker as links to /alta/, plus an 'Otra Ciudad' option", () => {
    const dom = buildPage(stub());
    const doc = dom.window.document;
    const links = [...doc.querySelectorAll("#wizard-root a.city-option")] as HTMLAnchorElement[];
    expect(links).toHaveLength(8); // the shortcut cities
    const hrefs = links.map((a) => a.getAttribute("href"));
    expect(hrefs).toContain("/alta/?city=lujan");
    expect(hrefs).toContain("/alta/?city=san-andres-de-giles");
    // "Otra Ciudad" is a look-alike option (same .city-option class), inside the list.
    const other = doc.getElementById("city-other") as HTMLButtonElement;
    expect(other).not.toBeNull();
    expect(other.classList.contains("city-option")).toBe(true);
    expect(other.closest(".option-list")).not.toBeNull();
    // The submit exists but is hidden, and there's no input until "Otra Ciudad" is clicked.
    expect((doc.getElementById("city-other-submit") as HTMLButtonElement).hidden).toBe(true);
    expect(doc.getElementById("city-other-input")).toBeNull();
  });

  it("carries captured UTMs onto the city-picker links (new-tab safe)", () => {
    const dom = buildPage(stub(), "https://www.cimes.com.ar/?utm_source=ig");
    const a = dom.window.document.querySelector(
      '#wizard-root a.city-option[href*="city=lujan"]',
    ) as HTMLAnchorElement;
    expect(a.getAttribute("href")).toContain("utm_source=ig");
  });

  it("the /alta page boots straight to the product step for a valid ?city", async () => {
    const dom = await bootToProduct(stub());
    const doc = dom.window.document;
    // Priced catalog for the URL city shows (04 §3 step 2).
    expect(doc.querySelector("#wizard-root")!.textContent).toContain("$800");
    // Slim page: the homepage sections are absent, and the guards kept app.js from throwing.
    expect(doc.getElementById("how-steps")).toBeNull();
    expect(doc.getElementById("product-grid")).toBeNull();
  });

  it("the /alta page shows the city picker when ?city is missing", async () => {
    const dom = buildPage(stub(), "https://www.cimes.com.ar/alta/", "alta/index.html");
    await tick();
    const links = dom.window.document.querySelectorAll("#wizard-root a.city-option");
    expect(links).toHaveLength(8);
  });

  it("the /alta page carries an unrecognized ?city into the wizard (proceed-anyway), not the picker", async () => {
    // A direct /alta/?city=<unknown> link (e.g. from a "continuar igual" nudge) is
    // de-slugged and proceeds — coverage decides downstream, no bounce to step 1.
    const dom = buildPage(stub(), "https://www.cimes.com.ar/alta/?city=monte-chico", "alta/index.html");
    await tick();
    const doc = dom.window.document;
    expect(doc.querySelectorAll("#wizard-root a.city-option")).toHaveLength(0); // not the picker
    expect(doc.querySelector("#wizard-root")!.textContent).toContain("$800"); // product step for "Monte Chico"
  });

  it("completes product → data → day → confirm → success", async () => {
    const dom = await bootToProduct(stub());
    const doc = dom.window.document;

    pickProduct(dom);
    fillAndSubmitData(dom);
    await tick();

    // Day options from the live coverage response.
    expect(doc.querySelector("#wizard-root")!.textContent).toContain("Reparto 19 · sábado entre 10 y 13");
    click(dom, '[data-option="0"]');

    // Summary shows the single-line address plus the URL city.
    expect(doc.querySelector("#wizard-root")!.textContent).toContain("Rivadavia 770, Luján");
    click(dom, "#confirm");
    await tick();

    expect(orders).toHaveLength(1);
    expect(orders[0]).toMatchObject({
      source: "web",
      name: "Ana Prueba",
      phone: "+5492323123456", // canonical E.164 from the masked "+54 9 2323 12-3456"
      city: "Luján",
      address: "Rivadavia 770",
      cross_streets: "Mitre y Lavalle",
      items: [{ product: "Bidon x 20 lts", qty: 1 }],
      delivery_day: "sábado",
    });
    expect(doc.querySelector("#wizard-root")!.textContent).toContain("Te lo llevamos el sábado");
  });

  it("data-step phone: prefilled with the city's area code + a grey digit prediction", async () => {
    const dom = await bootToProductForCity(stub(), "mercedes");
    pickProduct(dom);
    const phone = dom.window.document.getElementById("phone") as HTMLInputElement;
    // Real (typed) part is just the prefilled area code; the rest is only ghost.
    expect(phone.value).toBe("+54 9 2324");
    expect(phone.value + phoneGhostPending(dom, "phone")).toBe("+54 9 2324 __-____");
  });

  it("data-step phone: types digits, groups with a dash at the fixed split point, rejects non-digits", async () => {
    const dom = await bootToProduct(stub()); // Luján, area 2323
    pickProduct(dom);
    const phone = () => (dom.window.document.getElementById("phone") as HTMLInputElement).value;
    typeDigits(dom, "phone", "1"); expect(phone()).toBe("+54 9 2323 1");
    typeDigits(dom, "phone", "2"); expect(phone()).toBe("+54 9 2323 12"); // 2 local digits: no dash yet
    typeDigits(dom, "phone", "3"); expect(phone()).toBe("+54 9 2323 12-3"); // 3rd digit: dash appears
    typeDigits(dom, "phone", "abc"); expect(phone()).toBe("+54 9 2323 12-3"); // letters: rejected, no change
    typeDigits(dom, "phone", "456"); expect(phone()).toBe("+54 9 2323 12-3456"); // complete (10 digits)
    typeDigits(dom, "phone", "9"); expect(phone()).toBe("+54 9 2323 12-3456"); // full: extra digit rejected
  });

  it("data-step phone: paste is digit-filtered the same way as typing", async () => {
    const dom = await bootToProduct(stub());
    pickProduct(dom);
    const phone = () => (dom.window.document.getElementById("phone") as HTMLInputElement).value;
    pastePhone(dom, "phone", "12-3456 (WhatsApp)");
    expect(phone()).toBe("+54 9 2323 12-3456"); // dashes/spaces/parens/letters stripped, digits kept
  });

  it("data-step phone: backspace removes digits from the end, matching the spec's ghost sequence", async () => {
    const dom = await bootToProductForCity(stub(), "mercedes");
    pickProduct(dom);
    const combined = () =>
      (dom.window.document.getElementById("phone") as HTMLInputElement).value + phoneGhostPending(dom, "phone");
    expect(combined()).toBe("+54 9 2324 __-____");
    backspacePhone(dom, "phone");
    expect(combined()).toBe("+54 9 232_ __-____");
    backspacePhone(dom, "phone");
    expect(combined()).toBe("+54 9 23__ __-____");
  });

  it("data-step phone: a first digit of 1 or 0 switches to the Buenos Aires shape (11/15/011 all save as area 11)", async () => {
    const dom = await bootToProduct(stub());
    pickProduct(dom);
    const phone = () => (dom.window.document.getElementById("phone") as HTMLInputElement).value;
    backspacePhone(dom, "phone", 4); // clear Luján's prefilled area entirely
    expect(phone()).toBe("+54 9");
    typeDigits(dom, "phone", "1512345678"); // "15" spelling, 8-digit local (4-4 split)
    expect(phone()).toBe("+54 9 15 1234-5678");
    typeDigits(dom, "phone", "9"); // full at 10 digits: extra rejected
    expect(phone()).toBe("+54 9 15 1234-5678");

    type(dom, "firstName", "Ana");
    type(dom, "lastName", "P");
    type(dom, "direccion", "Rivadavia 770");
    click(dom, "#data-next");
    await tick();
    click(dom, '[data-option="0"]');
    click(dom, "#confirm");
    await tick();
    expect(orders[0]).toMatchObject({ phone: "+5491112345678" }); // "15" normalized to area 11
  });

  it("data-step phone: the 011 trunk spelling also saves as area 11 (one extra typed digit, 3-digit area)", async () => {
    const dom = await bootToProduct(stub());
    pickProduct(dom);
    const phone = () => (dom.window.document.getElementById("phone") as HTMLInputElement).value;
    backspacePhone(dom, "phone", 4);
    typeDigits(dom, "phone", "01112345678"); // "011" + 8-digit local = 11 typed digits
    expect(phone()).toBe("+54 9 011 1234-5678");

    type(dom, "firstName", "Ana");
    type(dom, "lastName", "P");
    type(dom, "direccion", "Rivadavia 770");
    click(dom, "#data-next");
    await tick();
    click(dom, '[data-option="0"]');
    click(dom, "#confirm");
    await tick();
    expect(orders[0]).toMatchObject({ phone: "+5491112345678" });
  });

  it("data-step phone: only '+' is truly fixed — clearing the AR prefix (549) allows a foreign number", async () => {
    const dom = await bootToProduct(stub());
    pickProduct(dom);
    const phone = () => (dom.window.document.getElementById("phone") as HTMLInputElement).value;
    backspacePhone(dom, "phone", 7); // Luján prefill is "549"+"2323" = 7 digits; clear all of it
    expect(phone()).toBe("+"); // nothing left but the fixed "+"
    typeDigits(dom, "phone", "12125551234"); // a US number: no AR grouping, no ghost prediction
    expect(phone()).toBe("+12125551234");
    expect(phoneGhostPending(dom, "phone")).toBe("");

    type(dom, "firstName", "Ana");
    type(dom, "lastName", "P");
    type(dom, "direccion", "Rivadavia 770");
    click(dom, "#data-next");
    await tick();
    click(dom, '[data-option="0"]');
    click(dom, "#confirm");
    await tick();
    expect(orders[0]).toMatchObject({ phone: "+12125551234" }); // saved verbatim, no "549" normalization
  });

  it("data-step phone: blocks Continuar until the full number is typed", async () => {
    const dom = await bootToProduct(stub());
    pickProduct(dom);
    type(dom, "firstName", "Ana");
    type(dom, "lastName", "Prueba");
    type(dom, "direccion", "Rivadavia 770");
    click(dom, "#data-next"); // phone still just "+54 9 2323" — no local digits typed
    await tick();
    expect(dom.window.document.getElementById("data-next")).not.toBeNull(); // still on the form
    expect(dom.window.document.querySelector('[data-field="phone"]')!.className).toContain("invalid");
    expect(orders).toHaveLength(0);
  });

  it("data-step phone: returning to the step (Back from Day) restores the previously typed number", async () => {
    const dom = await bootToProduct(stub());
    pickProduct(dom);
    fillAndSubmitData(dom);
    await tick();
    click(dom, '[data-back="data"]'); // Day step's Back re-renders the data step
    const phone = dom.window.document.getElementById("phone") as HTMLInputElement;
    expect(phone.value).toBe("+54 9 2323 12-3456"); // rebuilt from the saved E.164, not just the area code
  });

  it("formats prices with a thousands comma in the product step", async () => {
    const dom = await bootToProduct(stub());
    // Soda x 1.5 lts @ 2600 renders as $2,600 (comma thousands).
    expect(dom.window.document.querySelector("#wizard-root")!.textContent).toContain("$2,600");
  });

  it("disables Continuar until at least one product is in the cart", async () => {
    const dom = await bootToProduct(stub());
    const cont = () => dom.window.document.getElementById("cart-continue") as HTMLButtonElement;
    expect(cont().disabled).toBe(true);
    addToCart(dom, 0, 1);
    expect(cont().disabled).toBe(false);
    click(dom, '[data-dec="0"]'); // back to 0
    expect(cont().disabled).toBe(true);
  });

  it("carries multiple cart line items + total through to the order", async () => {
    const dom = await bootToProduct(stub());
    const doc = dom.window.document;
    addToCart(dom, 0, 2); // 2x Bidon x 20 lts @ 800 = 1600
    addToCart(dom, 2, 1); // 1x Soda x 1.5 lts @ 2600
    click(dom, "#cart-continue");
    fillAndSubmitData(dom);
    await tick();
    click(dom, '[data-option="0"]');
    const summary = doc.querySelector("#wizard-root")!.textContent!;
    expect(summary).toContain("2x Bidon x 20 lts");
    expect(summary).toContain("1x Soda x 1.5 lts");
    expect(summary).toContain("$4,200"); // 1600 + 2600
    click(dom, "#confirm");
    await tick();
    expect(orders[0]).toMatchObject({
      items: [
        { product: "Bidon x 20 lts", qty: 2 },
        { product: "Soda x 1.5 lts", qty: 1 },
      ],
    });
  });

  it("folds an optional Piso/Depto into the address line", async () => {
    const dom = await bootToProduct(stub());
    pickProduct(dom);
    type(dom, "firstName", "Ana");
    type(dom, "lastName", "Prueba");
    typeDigits(dom, "phone", "123456");
    type(dom, "direccion", "Rivadavia 770");
    type(dom, "piso", "3 B");
    click(dom, "#data-next");
    await tick();
    click(dom, '[data-option="0"]');
    click(dom, "#confirm");
    await tick();
    expect(orders[0]).toMatchObject({ address: "Rivadavia 770, 3 B" });
  });

  it("client-side validation blocks empty/invalid fields", async () => {
    const dom = await bootToProduct(stub());
    pickProduct(dom);
    typeDigits(dom, "phone", "abc"); // letters rejected outright; phone stays incomplete
    click(dom, "#data-next");
    await tick();
    // Still on the form; no coverage call happened.
    expect(dom.window.document.getElementById("data-next")).not.toBeNull();
    expect(orders).toHaveLength(0);
  });

  it("hands off to WhatsApp manual review when a covered city has no offerable time", async () => {
    const dom = await bootToProduct(stub({ covered: false, coordinates: null, price_list: null, delivery_options: [] }));
    pickProduct(dom);
    type(dom, "firstName", "Ana");
    type(dom, "lastName", "Prueba");
    typeDigits(dom, "phone", "123456");
    type(dom, "direccion", "Lejana 1");
    click(dom, "#data-next");
    await tick();
    const root = dom.window.document.querySelector("#wizard-root")!;
    expect(root.textContent).toContain("Estás en nuestra zona"); // manual-review copy, not a dead end
    const wa = root.querySelector('a[data-wa-loc="manual_review"]') as HTMLAnchorElement | null;
    expect(wa).not.toBeNull();
    expect(decodeURIComponent(wa!.href)).toContain("[REV-COB]"); // sentinel in the deep link
  });

  it("'Otra Ciudad': click reveals an inline input + submit, which snaps via /api/resolve-city", async () => {
    const dom = buildPage(stub());
    await tick(); // GET /api/cities warms the suggestion list
    const doc = dom.window.document;

    click(dom, "#city-other");
    // The option became an input (same .city-option class); the submit now shows.
    const input = doc.getElementById("city-other-input") as HTMLInputElement;
    expect(input).not.toBeNull();
    expect(input.classList.contains("city-option")).toBe(true);
    expect(doc.getElementById("city-other")).toBeNull(); // the button was replaced in place
    expect((doc.getElementById("city-other-submit") as HTMLButtonElement).hidden).toBe(false);

    typeInto(dom, "city-other-input", "necochea");
    const fetchSpy = (dom.window as unknown as { fetch: ReturnType<typeof vi.fn> }).fetch;
    click(dom, "#city-other-submit");
    await tick();
    expect(fetchSpy.mock.calls.some((c) => String(c[0]).includes("/api/resolve-city"))).toBe(true);
    expect(doc.getElementById("city-second-thought")).toBeNull(); // recognized city → redirect, no nudge
  });

  it("'Otra Ciudad': an unrecognized city offers up to 3 closest options instead of dead-ending", async () => {
    const dom = buildPage(stub());
    await tick();
    click(dom, "#city-other");
    typeInto(dom, "city-other-input", "monte chico");
    click(dom, "#city-other-submit");
    await tick();

    const doc = dom.window.document;
    // Rendered inline (still on the city step) — no navigation to a broken URL.
    expect(doc.getElementById("city-second-thought")).not.toBeNull();
    // Continuar stays disabled after submit — can't be re-clicked on the same text.
    expect((doc.getElementById("city-other-submit") as HTMLButtonElement).disabled).toBe(true);
    // One link per suggestion (the stub returns two), each to its canonical slug.
    const dym0 = doc.getElementById("city-did-you-mean-0") as HTMLAnchorElement;
    const dym1 = doc.getElementById("city-did-you-mean-1") as HTMLAnchorElement;
    expect(dym0.getAttribute("href")).toBe("/alta/?city=necochea");
    expect(dym1.getAttribute("href")).toBe("/alta/?city=navarro");
    // Continuar igual carries the typed city as-is.
    const proceed = doc.getElementById("city-proceed-anyway") as HTMLAnchorElement;
    expect(proceed.getAttribute("href")).toBe("/alta/?city=monte-chico");
    expect(proceed.textContent).toContain("monte chico");
  });

  it("'Otra Ciudad': Continuar is blocked until a city is actually typed", async () => {
    const dom = buildPage(stub());
    await tick();
    click(dom, "#city-other");
    const submit = dom.window.document.getElementById("city-other-submit") as HTMLButtonElement;
    expect(submit.hidden).toBe(false);
    expect(submit.disabled).toBe(true); // revealed but blocked while the input is empty
    typeInto(dom, "city-other-input", "monte chico");
    expect(submit.disabled).toBe(false); // real text → enabled
    typeInto(dom, "city-other-input", "   ");
    expect(submit.disabled).toBe(true); // cleared back to whitespace → blocked again
  });

  it("'Otra Ciudad': Enter in the input snaps like the submit button", async () => {
    const dom = buildPage(stub());
    await tick();
    click(dom, "#city-other");
    type(dom, "city-other-input", "tandil");
    const fetchSpy = (dom.window as unknown as { fetch: ReturnType<typeof vi.fn> }).fetch;
    const input = dom.window.document.getElementById("city-other-input") as HTMLInputElement;
    input.dispatchEvent(new dom.window.KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
    await tick();
    expect(fetchSpy.mock.calls.some((c) => String(c[0]).includes("/api/resolve-city"))).toBe(true);
  });

  it("'Otra Ciudad': typing filters a styled suggestions dropdown; clicking one snaps it", async () => {
    const dom = buildPage(stub());
    await tick(); // suggestion list ready from GET /api/cities
    click(dom, "#city-other");
    const doc = dom.window.document;

    typeInto(dom, "city-other-input", "nec");
    const labels = [...doc.querySelectorAll(".city-suggestions li")].map((li) => li.textContent);
    expect(labels).toContain("Necochea");

    const fetchSpy = (dom.window as unknown as { fetch: ReturnType<typeof vi.fn> }).fetch;
    const li = [...doc.querySelectorAll(".city-suggestions li")].find(
      (l) => l.textContent === "Necochea",
    )!;
    li.dispatchEvent(new dom.window.MouseEvent("mousedown", { bubbles: true }));
    await tick();
    expect(fetchSpy.mock.calls.some((c) => String(c[0]).includes("/api/resolve-city"))).toBe(true);
  });

  // ---- mid-flow persistence (sessionStorage) ----

  it("resumes the furthest step from sessionStorage after a same-tab reload", async () => {
    const dom = await bootToProduct(stub());
    pickProduct(dom);
    fillAndSubmitData(dom);
    await tick();
    click(dom, '[data-option="0"]'); // reached the summary; option now persisted

    // A same-tab reload keeps sessionStorage: re-running the app scripts re-boots
    // the page (fresh in-memory state; sessionStorage persists the furthest step).
    for (const f of [...CORE, ...WIZARD]) evalIn(dom, read(f));
    await tick();

    const txt = dom.window.document.querySelector("#wizard-root")!.textContent!;
    expect(txt).toContain("Rivadavia 770, Luján"); // jumped straight back to the summary
    expect(txt).toContain("Confirmar pedido");
  });

  it("clears persisted state after a confirmed order", async () => {
    const dom = await bootToProduct(stub());
    await runHappyPath(dom);
    const stored = (dom.window as unknown as { sessionStorage: Storage }).sessionStorage.getItem(
      "cimes_wizard",
    );
    expect(stored).toBeNull();
  });

  // ---- CRO enhancements ----

  it("data step uses mobile-friendly input attributes (tel keyboard + autofill)", async () => {
    const dom = await bootToProduct(stub());
    pickProduct(dom);
    const doc = dom.window.document;
    expect(doc.getElementById("phone")!.getAttribute("type")).toBe("tel");
    expect(doc.getElementById("phone")!.getAttribute("inputmode")).toBe("tel");
    expect(doc.getElementById("firstName")!.getAttribute("autocomplete")).toBe("given-name");
    // Direccion opts out of native autofill so Google Places owns the dropdown.
    expect(doc.getElementById("direccion")!.getAttribute("autocomplete")).toBe("off");
  });

  it("pushes an order_confirmed event to the dataLayer on success", async () => {
    const dom = await bootToProduct(stub());
    await runHappyPath(dom);
    const dl = (dom.window as unknown as { dataLayer: Array<{ event: string }> }).dataLayer;
    expect(dl.some((e) => e.event === "order_confirmed")).toBe(true);
    expect(dl.some((e) => e.event === "wizard_step")).toBe(true);
  });

  it("offers a WhatsApp fallback on the no-coverage screen", async () => {
    const dom = await bootToProduct(stub({ covered: false, coordinates: null, price_list: null, delivery_options: [] }));
    pickProduct(dom);
    type(dom, "firstName", "Ana");
    type(dom, "lastName", "Prueba");
    typeDigits(dom, "phone", "123456");
    type(dom, "direccion", "Lejana 1");
    click(dom, "#data-next");
    await tick();
    const wa = dom.window.document.querySelector('#wizard-root a[href*="wa.me/"]');
    expect(wa).not.toBeNull();
  });

  it("captures UTM params from the URL and attaches them to the order", async () => {
    const dom = await bootToProduct(stub(), "&utm_source=ig&utm_campaign=verano");
    await runHappyPath(dom);
    expect(orders).toHaveLength(1);
    expect(orders[0]).toMatchObject({ utm_source: "ig", utm_campaign: "verano" });
  });

  // Coverage-check failure escalation (04 §5): attempt 1 offers one retry (no save); a retry
  // that succeeds proceeds normally (no save); a second failure hands off to WhatsApp + saves.
  it("coverage failure: first attempt shows a retry and saves no lead", async () => {
    const reviews: unknown[] = [];
    let coverageCalls = 0;
    const dom = buildRawPage((u, init) => {
      if (u.includes("/api/prices")) return { ok: true, json: async () => catalog };
      if (u.includes("/api/coverage")) {
        coverageCalls++;
        return { ok: false, json: async () => ({ error: "coverage_unavailable" }) };
      }
      if (u.includes("/api/manual-review")) {
        reviews.push(JSON.parse(String(init?.body)));
        return { ok: true, json: async () => ({ ok: true }) };
      }
      throw new Error(`unexpected fetch ${u}`);
    });
    await tick();
    pickProduct(dom);
    fillAndSubmitData(dom);
    await tick();

    const root = dom.window.document.querySelector("#wizard-root")!;
    expect(root.textContent).toContain("salpicarle soda"); // retry copy, not the handoff copy
    expect(root.querySelector("[data-retry]")).not.toBeNull();
    expect(root.querySelector('a[data-wa-loc="manual_review"]')).toBeNull(); // no handoff yet
    expect(reviews).toHaveLength(0); // nothing saved on the first failure
    expect(coverageCalls).toBe(1);
  });

  it("coverage retry succeeds: reaches the day picker and still saves no lead", async () => {
    const reviews: unknown[] = [];
    let coverageCalls = 0;
    const dom = buildRawPage((u) => {
      if (u.includes("/api/prices")) return { ok: true, json: async () => catalog };
      if (u.includes("/api/coverage")) {
        coverageCalls++;
        return coverageCalls === 1
          ? { ok: false, json: async () => ({}) }
          : { ok: true, json: async () => coverageOk };
      }
      if (u.includes("/api/manual-review")) {
        reviews.push(1);
        return { ok: true, json: async () => ({ ok: true }) };
      }
      throw new Error(`unexpected fetch ${u}`);
    });
    await tick();
    pickProduct(dom);
    fillAndSubmitData(dom);
    await tick(); // attempt 1 fails → retry panel
    click(dom, "[data-retry]");
    await tick(); // attempt 2 succeeds → day picker

    const root = dom.window.document.querySelector("#wizard-root")!;
    expect(root.textContent).toContain("Reparto 19 · sábado"); // real options
    expect(reviews).toHaveLength(0); // retry-success must never save a review lead
    expect(coverageCalls).toBe(2);
  });

  it("coverage fails twice: hands off to WhatsApp and saves the lead once", async () => {
    const reviews: Array<Record<string, unknown>> = [];
    let coverageCalls = 0;
    const dom = buildRawPage((u, init) => {
      if (u.includes("/api/prices")) return { ok: true, json: async () => catalog };
      if (u.includes("/api/coverage")) {
        coverageCalls++;
        return { ok: false, json: async () => ({}) };
      }
      if (u.includes("/api/manual-review")) {
        reviews.push(JSON.parse(String(init?.body)));
        return { ok: true, json: async () => ({ ok: true }) };
      }
      throw new Error(`unexpected fetch ${u}`);
    });
    await tick();
    pickProduct(dom);
    fillAndSubmitData(dom);
    await tick(); // attempt 1 → retry panel
    click(dom, "[data-retry]");
    await tick(); // attempt 2 → handoff

    const root = dom.window.document.querySelector("#wizard-root")!;
    expect(root.textContent).toContain("Estás en nuestra zona"); // manual-review copy
    const wa = root.querySelector('a[data-wa-loc="manual_review"]') as HTMLAnchorElement;
    expect(wa).not.toBeNull();
    expect(decodeURIComponent(wa.href)).toContain("[REV-COB]");
    expect(root.querySelector("[data-retry]")).toBeNull(); // no second retry offered
    expect(reviews).toHaveLength(1);
    expect(reviews[0]).toMatchObject({ name: "Ana Prueba", city: "Luján", address: "Rivadavia 770" });
    expect(coverageCalls).toBe(2);
  });
});
