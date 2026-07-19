// Drives the real website wizard (website/app.js) in jsdom against a stubbed
// backend — verifies Flow B end-to-end per 04-website §3/§10.
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
  ],
};

const coverageOk = {
  covered: true,
  coordinates: { lat: -34.6, lng: -59.4 },
  price_list: "5",
  delivery_options: [{ route: "19", weekday: "sábado", time_window: "entre 10 y 13" }],
};

function buildPage(fetchImpl: (url: string, init?: RequestInit) => Promise<unknown>) {
  const dom = new JSDOM(read("index.html"), {
    url: "https://www.cimes.com.ar/",
    runScripts: "outside-only",
  });
  const w = dom.window as unknown as { eval(code: string): void; fetch: unknown };
  w.fetch = vi.fn(async (url: string, init?: RequestInit) => ({
    ok: true,
    json: async () => fetchImpl(url, init),
  }));
  w.eval(read("config.js"));
  w.eval(read("copy.es-AR.js"));
  w.eval(read("app.js"));
  return dom;
}

const tick = () => new Promise((r) => setTimeout(r, 0));

function click(dom: JSDOM, selector: string) {
  const el = dom.window.document.querySelector(selector) as HTMLElement | null;
  if (!el) throw new Error(`no element for ${selector}`);
  el.dispatchEvent(new dom.window.Event("click", { bubbles: true }));
}

function type(dom: JSDOM, id: string, value: string) {
  (dom.window.document.getElementById(id) as HTMLInputElement).value = value;
}

describe("website — Flow B wizard", () => {
  let orders: unknown[];

  function stub(coverage: unknown = coverageOk) {
    orders = [];
    return (url: string, init?: RequestInit) => {
      if (url.includes("/api/prices")) return Promise.resolve(catalog);
      if (url.includes("/api/coverage")) return Promise.resolve(coverage);
      if (url.includes("/api/orders")) {
        orders.push(JSON.parse(String(init?.body)));
        return Promise.resolve({ order_id: "o1", sync_status: "synced" });
      }
      throw new Error(`unexpected fetch ${url}`);
    };
  }

  beforeEach(() => vi.clearAllMocks());

  it("renders the landing sections from the copy module", () => {
    const dom = buildPage(stub());
    const doc = dom.window.document;
    expect(doc.querySelector(".hero h1")!.textContent).toContain("Agua y soda");
    expect(doc.querySelectorAll("#product-grid .card")).toHaveLength(6);
    expect(doc.querySelectorAll("#coverage-cities li")).toHaveLength(7);
    expect(doc.querySelectorAll("#testimonial-items .card")).toHaveLength(3);
    // wa.me deep link with prefilled message on both CTAs + floating widget.
    const wa = doc.querySelector(".wa-float") as HTMLAnchorElement;
    expect(wa.href).toContain("wa.me/5491100000000");
    expect(wa.href).toContain(encodeURIComponent("Hola, quiero darme de alta"));
  });

  it("completes city → priced catalog → data → day → confirm → success", async () => {
    const dom = buildPage(stub());
    const doc = dom.window.document;

    click(dom, '[data-city="Luján"]');
    await tick();
    // Priced catalog shows the city's real prices (04 §3 step 2).
    expect(doc.querySelector("#wizard-root")!.textContent).toContain("$800");

    click(dom, '[data-product="0"]');
    type(dom, "firstName", "Ana");
    type(dom, "lastName", "Prueba");
    type(dom, "phone", "2324 123456");
    type(dom, "street", "Rivadavia");
    type(dom, "number", "770");
    type(dom, "crossStreets", "Mitre y Lavalle");
    click(dom, "#data-next");
    await tick();

    // Day options from the live coverage response.
    expect(doc.querySelector("#wizard-root")!.textContent).toContain("Reparto 19 — sábado entre 10 y 13");
    click(dom, '[data-option="0"]');

    // Summary + confirm.
    expect(doc.querySelector("#wizard-root")!.textContent).toContain("Rivadavia 770");
    click(dom, "#confirm");
    await tick();

    expect(orders).toHaveLength(1);
    expect(orders[0]).toMatchObject({
      source: "web",
      name: "Ana Prueba",
      phone: "2324 123456",
      city: "Luján",
      address: "Rivadavia 770",
      cross_streets: "Mitre y Lavalle",
      product: "Bidon x 20 lts",
      delivery_day: "sábado",
    });
    expect(doc.querySelector("#wizard-root")!.textContent).toContain("Te lo llevamos el sábado");
  });

  it("client-side validation blocks empty/invalid fields", async () => {
    const dom = buildPage(stub());
    click(dom, '[data-city="Luján"]');
    await tick();
    click(dom, '[data-product="0"]');
    type(dom, "phone", "abc");
    click(dom, "#data-next");
    await tick();
    // Still on the form; no coverage call happened.
    expect(dom.window.document.getElementById("data-next")).not.toBeNull();
    expect(orders).toHaveLength(0);
  });

  it("shows the polite no-coverage message on covered:false", async () => {
    const dom = buildPage(stub({ covered: false, coordinates: null, price_list: null, delivery_options: [] }));
    click(dom, '[data-city="Luján"]');
    await tick();
    click(dom, '[data-product="0"]');
    type(dom, "firstName", "Ana");
    type(dom, "lastName", "Prueba");
    type(dom, "phone", "2324123456");
    type(dom, "street", "Lejana");
    type(dom, "number", "1");
    type(dom, "crossStreets", "X e Y");
    click(dom, "#data-next");
    await tick();
    expect(dom.window.document.querySelector("#wizard-root")!.textContent).toContain(
      "No encontramos reparto",
    );
  });

  it("'Otra ciudad' ends politely without an API call", () => {
    const dom = buildPage(stub());
    click(dom, '[data-city="__other"]');
    expect(dom.window.document.querySelector("#wizard-root")!.textContent).toContain(
      "no llegamos a tu ciudad",
    );
  });
});
