// Multi-item cart resolution: the server turns {product, qty} lines into an
// order summary + total from the city's price list (price authority server-side).
import { describe, expect, it } from "vitest";
import { resolveCartLines } from "../src/api/orders-cart.js";

const catalog = {
  price_list: "5",
  products: [
    { id: "1", name: "Bidón 20L", price: 2600 },
    { id: "2", name: "Soda en sifón", price: 1200 },
  ],
};

describe("orders-cart: resolveCartLines", () => {
  it("sums the total and builds a summary line for multiple items", () => {
    const r = resolveCartLines(catalog, [
      { product: "Bidón 20L", qty: 2 },
      { product: "Soda en sifón", qty: 1 },
    ]);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.total).toBe(2600 * 2 + 1200);
    expect(r.summary).toBe("2x Bidón 20L, 1x Soda en sifón");
    expect(r.lines).toHaveLength(2);
  });

  it("matches a product by id as well as name", () => {
    const r = resolveCartLines(catalog, [{ product: "2", qty: 3 }]);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.total).toBe(3600);
    expect(r.summary).toBe("3x Soda en sifón");
  });

  it("returns unknown_product when a line is not in the catalog", () => {
    const r = resolveCartLines(catalog, [{ product: "Dispenser", qty: 1 }]);
    expect(r).toEqual({ ok: false, error: "unknown_product", product: "Dispenser" });
  });
});
