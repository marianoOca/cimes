// Website multi-item cart resolution. The wizard sends the chosen products +
// quantities; the SERVER resolves each against the city's price list (price
// authority stays server-side) and produces the order summary + total. The
// order stays single-row: `product` becomes a summary line ("2x A, 1x B") and
// `price`/`amount_to_collect` the total, so the pipeline/ticket/sheet are
// unchanged (they already treat product as text and amount as the total).
//
// Frío/calor adds one wrinkle: the monthly abono already includes 4×20L of the
// chosen water type, so those units bill at 0 and only the 5th onward is charged
// (at the list's normal 20L price — that IS the excedente). The abono itself
// rides along as a synthetic line, discounted 50% for the first month.
import { skuByDisplay } from "../catalog/skus.js";
import type { Dispenser } from "../db/leads.js";
import type { Abono, WaterType } from "../providers/abonos.js";
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

export type { Dispenser };

export interface CartOptions {
  dispenser?: Dispenser;
  waterType?: WaterType;
  abono?: Abono | null;
}

export type CartResolution =
  | { ok: true; lines: CartLine[]; total: number; summary: string }
  | { ok: false; error: "unknown_product"; product: string }
  | { ok: false; error: "abono_unavailable"; product: string };

/** Bottles the abono covers per month — every abono type is "4 botellones de 20 lts". */
export const ABONO_INCLUDED_BOTTLES = 4;

/**
 * Stable prefix on the synthetic abono line. The order summary is the only thing
 * the ticket/sheet see, so this is what marks a row as frío/calor downstream
 * (sheets/orders.ts `clientTypeOf`) — don't change it without changing that.
 * Normalized-lowercase because that's how the reader matches it.
 */
export const ABONO_LINE_MARKER = "abono frio/calor";

/** The SKU the abono's included bottles are drawn from. */
export function abonoBottleSku(waterType: WaterType): string {
  return waterType === "bajo_sodio" ? "botellon-20l-na" : "botellon-20l";
}

export function resolveCartLines(
  catalog: PricedCatalog,
  items: CartItemInput[],
  opts: CartOptions = {},
): CartResolution {
  const frioCalor = opts.dispenser === "frio_calor";
  // Never guess an abono price: without one we can't produce a correct total.
  if (frioCalor && !opts.abono) {
    return { ok: false, error: "abono_unavailable", product: "abono" };
  }
  const includedSku = frioCalor ? abonoBottleSku(opts.waterType ?? "comun") : null;

  const lines: CartLine[] = [];
  if (opts.abono && frioCalor) {
    // Synthetic — deliberately skips the catalog lookup below, since an abono is
    // not one of the 9 SKUs and would come back unknown_product.
    lines.push({
      name: `Abono Frío/Calor: ${opts.abono.name} — 1er mes 50% OFF`,
      price: Math.round(opts.abono.price / 2),
      qty: 1,
    });
  }

  for (const it of items) {
    const match = catalog.products.find(
      (p) => p.name.toLowerCase() === it.product.toLowerCase() || p.id === it.product,
    );
    if (!match) return { ok: false, error: "unknown_product", product: it.product };
    const included =
      includedSku && skuByDisplay(match.name)?.key === includedSku
        ? Math.min(it.qty, ABONO_INCLUDED_BOTTLES)
        : 0;
    if (included > 0) {
      lines.push({ name: `${match.name} (incluido en el abono)`, price: 0, qty: included });
    }
    if (it.qty - included > 0) {
      lines.push({ name: match.name, price: match.price, qty: it.qty - included });
    }
  }

  const total = lines.reduce((sum, l) => sum + l.price * l.qty, 0);
  const summary = lines.map((l) => `${l.qty}x ${l.name}`).join(", ");
  return { ok: true, lines, total, summary };
}
