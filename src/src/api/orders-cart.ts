// Website multi-item cart resolution. The wizard sends the chosen products +
// quantities; the SERVER resolves each against the city's price list (price
// authority stays server-side) and produces the order summary + total. The
// order stays single-row: `product` becomes a summary line ("2x A, 1x B") and
// `price`/`amount_to_collect` the total, so the pipeline/ticket/sheet are
// unchanged (they already treat product as text and amount as the total).
import type { PricedCatalog } from "../providers/types.js";

export interface CartItemInput {
  product: string; // catalog product name or id
  qty: number;
}

export interface CartLine {
  name: string;
  price: number;
  qty: number;
}

export type CartResolution =
  | { ok: true; lines: CartLine[]; total: number; summary: string }
  | { ok: false; error: "unknown_product"; product: string };

export function resolveCartLines(catalog: PricedCatalog, items: CartItemInput[]): CartResolution {
  const lines: CartLine[] = [];
  for (const it of items) {
    const match = catalog.products.find(
      (p) => p.name.toLowerCase() === it.product.toLowerCase() || p.id === it.product,
    );
    if (!match) return { ok: false, error: "unknown_product", product: it.product };
    lines.push({ name: match.name, price: match.price, qty: it.qty });
  }
  const total = lines.reduce((sum, l) => sum + l.price * l.qty, 0);
  const summary = lines.map((l) => `${l.qty}x ${l.name}`).join(", ");
  return { ok: true, lines, total, summary };
}
