// Multi-item cart resolution: the server turns {product, qty} lines into an
// order summary + total from the city's price list (price authority server-side).
import { describe, expect, it } from "vitest";
import { resolveCartLines } from "../src/api/orders-cart.js";

const catalog = {
  price_list: "5",
  products: [
    { id: "1", name: "Botellón 20L", price: 2600 },
    { id: "2", name: "Soda en Sifón 1,5L", price: 1200 },
    { id: "3", name: "Botellón 20L Bajo Sodio", price: 3000 },
  ],
};

const abono = {
  id: 1,
  name: "abono mensual de 4 botellones de 20 lts",
  price: 34000,
  priceList: "5",
};

describe("orders-cart: resolveCartLines", () => {
  it("sums the total and builds a summary line for multiple items", () => {
    const r = resolveCartLines(catalog, [
      { product: "Botellón 20L", qty: 2 },
      { product: "Soda en Sifón 1,5L", qty: 1 },
    ]);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.total).toBe(2600 * 2 + 1200);
    expect(r.summary).toBe("2x Botellón 20L, 1x Soda en Sifón 1,5L");
    expect(r.lines).toHaveLength(2);
  });

  it("matches a product by id as well as name", () => {
    const r = resolveCartLines(catalog, [{ product: "2", qty: 3 }]);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.total).toBe(3600);
    expect(r.summary).toBe("3x Soda en Sifón 1,5L");
  });

  it("returns unknown_product when a line is not in the catalog", () => {
    const r = resolveCartLines(catalog, [{ product: "Dispenser", qty: 1 }]);
    expect(r).toEqual({ ok: false, error: "unknown_product", product: "Dispenser" });
  });

  // Frío/calor: the abono already covers 4x20L of the chosen water, so those units
  // bill at 0 and only the 5th onward is charged. First month is half price.
  describe("frío/calor abono", () => {
    const fc = { dispenser: "frio_calor" as const, waterType: "comun" as const, abono };

    it("charges half the abono and nothing for the four included botellones", () => {
      const r = resolveCartLines(catalog, [{ product: "Botellón 20L", qty: 4 }], fc);
      expect(r.ok).toBe(true);
      if (!r.ok) return;
      expect(r.total).toBe(17000);
      expect(r.summary).toContain("Abono Frío/Calor");
      expect(r.summary).toContain("4x Botellón 20L (incluido en el abono)");
    });

    it("charges the 5th botellón at the list price", () => {
      const r = resolveCartLines(catalog, [{ product: "Botellón 20L", qty: 6 }], fc);
      expect(r.ok).toBe(true);
      if (!r.ok) return;
      expect(r.total).toBe(17000 + 2600 * 2);
      expect(r.lines).toEqual([
        { name: expect.stringContaining("Abono Frío/Calor"), price: 17000, qty: 1 },
        { name: "Botellón 20L (incluido en el abono)", price: 0, qty: 4 },
        { name: "Botellón 20L", price: 2600, qty: 2 },
      ]);
    });

    it("only covers the water type that was chosen", () => {
      // Bajo sodio abono: común botellones are NOT included, they're just products.
      const r = resolveCartLines(
        catalog,
        [{ product: "Botellón 20L", qty: 2 }],
        { ...fc, waterType: "bajo_sodio" },
      );
      expect(r.ok).toBe(true);
      if (!r.ok) return;
      expect(r.total).toBe(17000 + 2600 * 2);
    });

    it("prices an abono with no products at all", () => {
      const r = resolveCartLines(catalog, [], fc);
      expect(r.ok).toBe(true);
      if (!r.ok) return;
      expect(r.total).toBe(17000);
    });

    it("never guesses a price when the abono is unavailable", () => {
      const r = resolveCartLines(catalog, [{ product: "Botellón 20L", qty: 1 }], {
        dispenser: "frio_calor",
        waterType: "comun",
        abono: null,
      });
      expect(r).toEqual({ ok: false, error: "abono_unavailable", product: "abono" });
    });

    it("leaves natural and ninguno priced exactly as before", () => {
      const items = [{ product: "Botellón 20L", qty: 6 }];
      for (const dispenser of ["natural", "ninguno"] as const) {
        const r = resolveCartLines(catalog, items, { dispenser });
        expect(r.ok).toBe(true);
        if (!r.ok) return;
        expect(r.total).toBe(2600 * 6);
      }
    });
  });
});
