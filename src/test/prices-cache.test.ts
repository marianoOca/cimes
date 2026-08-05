// The local price mirror (01 §2). The point of the cache is that a WaterService
// outage degrades to "prices are stale", never to "the wizard can't quote" — a
// quote we can't produce is a lead we never save.
import { beforeEach, describe, expect, it, vi } from "vitest";
import { openDb } from "../src/db/db.js";
import { oldestFetchedAt, readAbono, readList, writeAbono, writeList } from "../src/db/prices-cache.js";

const RAW = [
  { id: "1", name: "10002  -  BOTELLON 20L", price: 8500 },
  { id: "2", name: "10001  -  BOTELLON 12L", price: 6000 },
  { id: "3", name: "Sanitizacion de Dispenser", price: 9000 },
];

const MATRIX = {
  articulos: RAW.map((r) => ({
    articulo_id: Number(r.id),
    nombreArticulo: r.name,
    rubro: null,
    precios: [{ lista_id: 5, articulo_id: Number(r.id), precio: r.price }],
  })),
  listas: [{ lista_id: 5, nombre: "LISTA PRECIOS GENERAL" }],
};

const obtenerMatrizListaDePrecios = vi.fn();
const obtenerAbonosTipos = vi.fn();
vi.mock("../src/waterservice/client.js", () => ({
  obtenerMatrizListaDePrecios: (...a: unknown[]) => obtenerMatrizListaDePrecios(...a),
  obtenerAbonosTipos: (...a: unknown[]) => obtenerAbonosTipos(...a),
}));

describe("ws_price_cache", () => {
  let db: ReturnType<typeof openDb>;

  beforeEach(() => {
    db = openDb(":memory:");
    vi.clearAllMocks();
    obtenerMatrizListaDePrecios.mockResolvedValue(MATRIX);
    obtenerAbonosTipos.mockResolvedValue([
      { id: 1, nombreAbono: "abono 4x20", precio: 34000, activo: true },
    ]);
  });

  it("round-trips a price list and an abono", () => {
    writeList(db, "5", [{ id: "1", name: "Botellón 20L", price: 8500 }], "2026-08-01T00:00:00Z");
    writeAbono(db, { id: 1, name: "abono 4x20", price: 34000 }, "2026-08-01T00:00:00Z");
    expect(readList(db, "5")!.products[0]!.price).toBe(8500);
    expect(readAbono(db, 1)!.price).toBe(34000);
    expect(readList(db, "99")).toBeNull();
    expect(readAbono(db, 99)).toBeNull();
  });

  it("overwrites on re-write rather than duplicating", () => {
    writeList(db, "5", [{ id: "1", name: "A", price: 1 }], "2026-08-01T00:00:00Z");
    writeList(db, "5", [{ id: "1", name: "A", price: 2 }], "2026-08-02T00:00:00Z");
    expect(readList(db, "5")!.products[0]!.price).toBe(2);
    expect(readList(db, "5")!.fetchedAt).toBe("2026-08-02T00:00:00Z");
  });

  it("reports the oldest row so a silently-failing cron surfaces", () => {
    expect(oldestFetchedAt(db)).toBeNull();
    writeList(db, "5", [], "2026-08-02T00:00:00Z");
    writeAbono(db, { id: 1, name: "a", price: 1 }, "2026-07-01T00:00:00Z");
    expect(oldestFetchedAt(db)).toBe("2026-07-01T00:00:00Z");
  });

  it("serves a cached list without calling WaterService", async () => {
    const { WaterServicePriceProvider } = await import("../src/providers/prices.js");
    writeList(db, "5", RAW, "2026-08-01T00:00:00Z");
    const catalog = await new WaterServicePriceProvider(db).getPricesForList("5");
    expect(obtenerMatrizListaDePrecios).not.toHaveBeenCalled();
    // Raw rows go through the SKU filter on read, so a list can be cached as-is.
    expect(catalog.products.map((p) => p.name)).toEqual(["Botellón 20L", "Botellón 12L"]);
  });

  it("fetches and writes through on a cache miss only", async () => {
    const { WaterServicePriceProvider } = await import("../src/providers/prices.js");
    const provider = new WaterServicePriceProvider(db);
    await provider.getPricesForList("5");
    expect(obtenerMatrizListaDePrecios).toHaveBeenCalledTimes(1);
    expect(readList(db, "5")).not.toBeNull();
    await provider.getPricesForList("5");
    expect(obtenerMatrizListaDePrecios).toHaveBeenCalledTimes(1); // served from cache
  });

  it("keeps serving the last-good rows when WaterService is down", async () => {
    const { WaterServicePriceProvider, refreshPriceCache } = await import(
      "../src/providers/prices.js"
    );
    writeList(db, "5", RAW, "2026-08-01T00:00:00Z");
    obtenerMatrizListaDePrecios.mockRejectedValue(new Error("ECONNREFUSED"));

    await expect(refreshPriceCache(db, [])).rejects.toThrow();
    const catalog = await new WaterServicePriceProvider(db).getPricesForList("5");
    expect(catalog.products).toHaveLength(2); // the outage changed nothing
  });
});
