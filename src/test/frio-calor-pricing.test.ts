// The frío/calor price rule (01 §2). PRECIO CAMPANA ESPECIAL exists ONLY for the
// comodato: the same city buying loose bottles must still resolve the normal way.
// Config is parsed at import time, so each case re-imports with its own env.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { openDb } from "../src/db/db.js";
import { writeAbono } from "../src/db/prices-cache.js";

const GENERAL = "5";
const CAMPANA = "9";
const LOBOS = "7";

const ENV = {
  PRICE_LIST_DEFAULT_ID: GENERAL,
  CITY_PRICE_LIST_MAP: JSON.stringify({ lobos: LOBOS }),
  FRIO_CALOR_CITY_PRICE_LIST_MAP: JSON.stringify({
    campana: CAMPANA,
    zarate: CAMPANA,
    escobar: CAMPANA,
  }),
  FRIO_CALOR_ABONO_MAP: JSON.stringify({
    [GENERAL]: { comun: 1, bajo_sodio: 7 },
    [CAMPANA]: { comun: 11, bajo_sodio: 12 },
    [LOBOS]: { comun: 13, bajo_sodio: 17 },
  }),
};

const saved: Record<string, string | undefined> = {};

beforeEach(() => {
  for (const [k, v] of Object.entries(ENV)) {
    saved[k] = process.env[k];
    process.env[k] = v;
  }
  vi.resetModules();
});
afterEach(() => {
  for (const k of Object.keys(ENV)) {
    if (saved[k] === undefined) delete process.env[k];
    else process.env[k] = saved[k];
  }
});

describe("resolveCityListId", () => {
  it("uses PRECIO CAMPANA ESPECIAL only for a frío/calor customer", async () => {
    const { resolveCityListId } = await import("../src/providers/prices.js");
    expect(resolveCityListId("Campana", { frioCalor: true })).toBe(CAMPANA);
    // The same city buying loose bottles is unaffected — this is the whole point.
    expect(resolveCityListId("Campana")).toBe(GENERAL);
    expect(resolveCityListId("Campana", { frioCalor: false })).toBe(GENERAL);
  });

  it("keeps a city's own exception even with frío/calor", async () => {
    const { resolveCityListId } = await import("../src/providers/prices.js");
    expect(resolveCityListId("Lobos")).toBe(LOBOS);
    expect(resolveCityListId("Lobos", { frioCalor: true })).toBe(LOBOS);
  });

  it("falls back to the default for every other city", async () => {
    const { resolveCityListId } = await import("../src/providers/prices.js");
    expect(resolveCityListId("Luján", { frioCalor: true })).toBe(GENERAL);
    expect(resolveCityListId("Mercedes")).toBe(GENERAL);
  });

  it("counts the frío/calor lists among the ones to refresh and check", async () => {
    const { configuredListIds } = await import("../src/providers/prices.js");
    expect(configuredListIds().sort()).toEqual([GENERAL, LOBOS, CAMPANA].sort());
  });
});

describe("getCatalog fallback to GENERAL", () => {
  // The 9 SKUs are sold everywhere; a zone list prices only what differs there.
  // Live, PRECIO LOBOS has no descartables rows and CAMPANA ESPECIAL only the two
  // 20L — served alone either one would shrink the catalog.
  const AT = "2026-08-01T00:00:00Z";
  const seed = async (db: ReturnType<typeof openDb>) => {
    const { writeList } = await import("../src/db/prices-cache.js");
    writeList(
      db,
      GENERAL,
      [
        { id: "13", name: "BOTELLON 20L", price: 8500 },
        { id: "12", name: "BOTELLON 12L", price: 6000 },
        { id: "23", name: "AGUA 2L", price: 800 },
      ],
      AT,
    );
    writeList(db, LOBOS, [{ id: "13", name: "BOTELLON 20L", price: 8000 }], AT);
    writeList(db, CAMPANA, [{ id: "13", name: "BOTELLON 20L", price: 9500 }], AT);
  };
  const pricesOf = (c: { products: { name: string; price: number }[] }) =>
    Object.fromEntries(c.products.map((p) => [p.name, p.price]));

  it("fills a zone list's gaps from GENERAL", async () => {
    const { WaterServicePriceProvider } = await import("../src/providers/prices.js");
    const db = openDb(":memory:");
    await seed(db);
    const catalog = await new WaterServicePriceProvider(db).getCatalog("Lobos");
    expect(catalog.price_list).toBe(LOBOS);
    const priced = pricesOf(catalog);
    expect(priced["Botellón 20L"]).toBe(8000); // Lobos prices this one
    expect(priced["Botellón 12L"]).toBe(6000); // it doesn't — GENERAL fills in
    expect(priced["Agua 2L"]).toBe(800);
  });

  it("lets PRECIO CAMPANA ESPECIAL win where it prices a SKU", async () => {
    const { WaterServicePriceProvider } = await import("../src/providers/prices.js");
    const db = openDb(":memory:");
    await seed(db);
    const catalog = await new WaterServicePriceProvider(db).getCatalog("Campana", {
      frioCalor: true,
    });
    expect(catalog.price_list).toBe(CAMPANA);
    const priced = pricesOf(catalog);
    expect(priced["Botellón 20L"]).toBe(9500); // especial wins
    expect(priced["Botellón 12L"]).toBe(6000); // from GENERAL
    expect(priced["Agua 2L"]).toBe(800); // still sellable in Campana
  });

  it("serves GENERAL alone when nothing overrides it", async () => {
    const { WaterServicePriceProvider } = await import("../src/providers/prices.js");
    const db = openDb(":memory:");
    await seed(db);
    const catalog = await new WaterServicePriceProvider(db).getCatalog("Mercedes");
    expect(catalog.price_list).toBe(GENERAL);
    expect(pricesOf(catalog)["Botellón 20L"]).toBe(8500);
  });
});

describe("getAbono", () => {
  it("follows whichever price list the city resolved to", async () => {
    const { getAbono, configuredAbonoIds } = await import("../src/providers/abonos.js");
    const db = openDb(":memory:");
    expect(configuredAbonoIds().sort((a, b) => a - b)).toEqual([1, 7, 11, 12, 13, 17]);
    for (const id of configuredAbonoIds()) {
      writeAbono(db, { id, name: `abono ${id}`, price: id * 1000 }, "2026-08-01T00:00:00Z");
    }
    expect(getAbono("Campana", "comun", db)!.id).toBe(11);
    expect(getAbono("Campana", "bajo_sodio", db)!.id).toBe(12);
    expect(getAbono("Lobos", "comun", db)!.id).toBe(13);
    expect(getAbono("Luján", "bajo_sodio", db)!.id).toBe(7);
    // Prices come from the cache, never from config.
    expect(getAbono("Campana", "comun", db)!.price).toBe(11000);
  });

  it("returns null rather than guessing when the abono was never cached", async () => {
    const { getAbono } = await import("../src/providers/abonos.js");
    expect(getAbono("Luján", "comun", openDb(":memory:"))).toBeNull();
  });
});
