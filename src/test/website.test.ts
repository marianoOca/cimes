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
  w.eval(read("config.js"));
  w.eval(read("copy.es-AR.js"));
  w.eval(read("app.js"));
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
  let waitlists: unknown[];

  function stub(coverage: unknown = coverageOk): Fetch {
    orders = [];
    waitlists = [];
    return (url: string, init?: RequestInit) => {
      if (url.includes("/api/prices")) return Promise.resolve(catalog);
      if (url.includes("/api/coverage")) return Promise.resolve(coverage);
      if (url.includes("/api/waitlist")) {
        waitlists.push(JSON.parse(String(init?.body)));
        return Promise.resolve({ ok: true });
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
    expect(doc.querySelectorAll("#product-grid .card")).toHaveLength(8);
    // wa.me deep link with prefilled message on both CTAs + floating widget.
    const wa = doc.querySelector(".wa-float") as HTMLAnchorElement;
    expect(wa.href).toContain("wa.me/5491100000000");
    expect(wa.href).toContain(encodeURIComponent("Hola, quiero darme de alta"));
  });

  it("homepage renders the city picker as links to /alta/", () => {
    const dom = buildPage(stub());
    const doc = dom.window.document;
    const links = [
      ...doc.querySelectorAll("#wizard-root a.city-option:not(.city-option-other)"),
    ] as HTMLAnchorElement[];
    expect(links).toHaveLength(7);
    const hrefs = links.map((a) => a.getAttribute("href"));
    expect(hrefs).toContain("/alta/?city=lujan");
    expect(hrefs).toContain("/alta/?city=san-andres-de-giles");
    // 'Otra ciudad' is now a link to the waitlist form.
    const other = doc.querySelector("#wizard-root a.city-option-other") as HTMLAnchorElement;
    expect(other.getAttribute("href")).toBe("/alta/?waitlist=1");
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

  it("the /alta page shows the city picker when ?city is missing or invalid", () => {
    const dom = buildPage(stub(), "https://www.cimes.com.ar/alta/?city=bogus", "alta/index.html");
    const links = dom.window.document.querySelectorAll(
      "#wizard-root a.city-option:not(.city-option-other)",
    );
    expect(links).toHaveLength(7);
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

  it("'Otra ciudad' links to the waitlist form", () => {
    const dom = buildPage(stub());
    const other = dom.window.document.querySelector(
      "#wizard-root a.city-option-other",
    ) as HTMLAnchorElement;
    expect(other).not.toBeNull();
    expect(other.getAttribute("href")).toContain("/alta/?waitlist=1");
  });

  it("the /alta waitlist form captures an uncovered-zone lead + shows success", async () => {
    const dom = buildPage(stub(), "https://www.cimes.com.ar/alta/?waitlist=1", "alta/index.html");
    const doc = dom.window.document;
    // Standalone form (no product/stepper): the waitlist fields render on boot.
    expect(doc.getElementById("wl-name")).not.toBeNull();
    expect(doc.getElementById("wl-zone")).not.toBeNull();

    type(dom, "wl-name", "Ana Prueba");
    typeDigits(dom, "wl-phone", "2324555000"); // same mask as the data step, no known city to prefill
    type(dom, "wl-zone", "Navarro");
    type(dom, "wl-comment", "Cerca de la plaza");
    click(dom, "#wl-submit");
    await tick();

    expect(waitlists).toHaveLength(1);
    expect(waitlists[0]).toMatchObject({
      source: "web",
      name: "Ana Prueba",
      phone: "+5492324555000", // canonical E.164
      city: "Navarro", // free-text zone
      comment: "Cerca de la plaza",
    });
    expect(doc.querySelector("#wizard-root")!.textContent).toContain("Te anotamos");
  });

  it("waitlist phone: defaults to the bare '+54 9' (no known city), same digit-only mask as the data step", () => {
    const dom = buildPage(stub(), "https://www.cimes.com.ar/alta/?waitlist=1", "alta/index.html");
    const phone = () => (dom.window.document.getElementById("wl-phone") as HTMLInputElement).value;
    expect(phone()).toBe("+54 9"); // no area code known yet
    expect(phone() + phoneGhostPending(dom, "wl-phone")).toBe("+54 9 ____ __-____");
    typeDigits(dom, "wl-phone", "abc"); expect(phone()).toBe("+54 9"); // letters rejected
    typeDigits(dom, "wl-phone", "2324123456"); expect(phone()).toBe("+54 9 2324 12-3456");
    typeDigits(dom, "wl-phone", "9"); expect(phone()).toBe("+54 9 2324 12-3456"); // full: extra rejected
    backspacePhone(dom, "wl-phone", 10);
    expect(phone()).toBe("+54 9"); // back to the bare AR default (549 typed, nothing after)
  });

  it("waitlist phone: only '+' is fixed — clearing the AR default entirely allows a foreign number", () => {
    const dom = buildPage(stub(), "https://www.cimes.com.ar/alta/?waitlist=1", "alta/index.html");
    const phone = () => (dom.window.document.getElementById("wl-phone") as HTMLInputElement).value;
    backspacePhone(dom, "wl-phone", 3); // clear the "549" default entirely
    expect(phone()).toBe("+"); // only the "+" survives
    typeDigits(dom, "wl-phone", "34612345678"); // e.g. a Spanish number
    expect(phone()).toBe("+34612345678");
    expect(phoneGhostPending(dom, "wl-phone")).toBe("");
  });

  it("waitlist form blocks submit when required fields are empty", async () => {
    const dom = buildPage(stub(), "https://www.cimes.com.ar/alta/?waitlist=1", "alta/index.html");
    type(dom, "wl-name", "Ana"); // phone + zone left empty
    click(dom, "#wl-submit");
    await tick();
    expect(waitlists).toHaveLength(0);
    expect(dom.window.document.getElementById("wl-submit")).not.toBeNull(); // still on the form
  });

  // ---- mid-flow persistence (sessionStorage) ----

  it("resumes the furthest step from sessionStorage after a same-tab reload", async () => {
    const dom = await bootToProduct(stub());
    pickProduct(dom);
    fillAndSubmitData(dom);
    await tick();
    click(dom, '[data-option="0"]'); // reached the summary; option now persisted

    // A same-tab reload keeps sessionStorage: re-running app.js re-boots the page.
    evalIn(dom, read("app.js"));
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
});
