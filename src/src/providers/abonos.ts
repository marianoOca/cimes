// Frío/calor abonos (#11 AbonosTipos). CIMES lends the dispenser in comodato and
// charges a flat monthly abono that includes 4×20L bottles; the 5th bottle onward
// is the list's normal 20L price. New customers get 50% off the first month.
//
// Prices are never stored in this repo: `FRIO_CALOR_ABONO_MAP` holds abono IDS,
// keyed by the resolved price list so the abono automatically follows whichever
// list `resolveCityListId` picked. The amounts come from ws_price_cache.
import { config } from "../config.js";
import { getDb, type DB } from "../db/db.js";
import { readAbono } from "../db/prices-cache.js";
import { resolveCityListId } from "./prices.js";

export type WaterType = "comun" | "bajo_sodio";

export interface Abono {
  id: number;
  name: string;
  /** Full monthly price. The first-month 50% is applied at order time, not here. */
  price: number;
  priceList: string;
}

/** Every abono id this deployment can charge. Feeds the prices_refresh cron. */
export function configuredAbonoIds(): number[] {
  return [
    ...new Set(
      Object.values(config.FRIO_CALOR_ABONO_MAP).flatMap((e) => [e.comun, e.bajo_sodio]),
    ),
  ].filter((id) => Number.isFinite(id));
}

/**
 * The abono for a city + water type, or null when this deployment has no abono
 * configured for that list. Null means "we can't price frío/calor here" — callers
 * hide the option rather than guessing a number.
 */
export function getAbono(
  city: string,
  waterType: WaterType,
  db: DB = getDb(),
): Abono | null {
  const priceList = resolveCityListId(city, { frioCalor: true });
  const id = config.FRIO_CALOR_ABONO_MAP[priceList]?.[waterType];
  if (!id) return null;
  const cached = readAbono(db, id);
  if (!cached) return null;
  return { id: cached.id, name: cached.name, price: cached.price, priceList };
}
