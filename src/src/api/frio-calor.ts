// The frío/calor offer as the website needs it (04 §3): what the abono costs per
// month, what the first month costs with the new-customer 50% off, and what a
// bottle beyond the four included ones costs. The site hardcodes none of it.
import { getPriceProvider } from "../ai/tools.js";
import { skuByDisplay } from "../catalog/skus.js";
import type { DB } from "../db/db.js";
import { getAbono, type WaterType } from "../providers/abonos.js";
import { ABONO_INCLUDED_BOTTLES, abonoBottleSku } from "./orders-cart.js";

export interface FrioCalorOption {
  abono_id: number;
  abono_name: string;
  abono: number;
  /** What they actually pay on delivery day (PROMO 1). */
  abono_first_month: number;
  included_bottles: number;
  /** 5th bottle onward — just the list's normal price for that bottle. */
  excedente: number;
  price_list: string;
}

export type FrioCalorPricing = Record<WaterType, FrioCalorOption> | null;

const WATER_TYPES: WaterType[] = ["comun", "bajo_sodio"];

/** Null when either abono is unconfigured/uncached — the site then hides the option. */
export async function frioCalorPricing(db: DB, city: string): Promise<FrioCalorPricing> {
  const catalog = await getPriceProvider()
    .getCatalog(city, { frioCalor: true })
    .catch(() => null);
  if (!catalog) return null;

  const out = {} as Record<WaterType, FrioCalorOption>;
  for (const waterType of WATER_TYPES) {
    const abono = getAbono(city, waterType, db);
    if (!abono) return null;
    const sku = abonoBottleSku(waterType);
    const bottle = catalog.products.find((p) => skuByDisplay(p.name)?.key === sku);
    if (!bottle) return null;
    out[waterType] = {
      abono_id: abono.id,
      abono_name: abono.name,
      abono: abono.price,
      abono_first_month: Math.round(abono.price / 2),
      included_bottles: ABONO_INCLUDED_BOTTLES,
      excedente: bottle.price,
      price_list: abono.priceList,
    };
  }
  return out;
}
