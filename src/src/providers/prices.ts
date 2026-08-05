// PriceProvider (01 §2). WaterService is the only source of truth for prices.
// The AI reaches prices ONLY through this provider.
//
// The request path never calls WaterService: it reads the local mirror in
// `ws_price_cache` (db/prices-cache.ts), refreshed daily by the `prices_refresh`
// cron. A WaterService outage must not dead-end the wizard — a quote we can't
// produce is a lead we never save. The only live call left on the read path is a
// cache MISS (cold DB after a deploy, or a list id the cron hasn't seen yet),
// which fetches once and writes through.
import { config } from "../config.js";
import { applyCatalog, missingSkus } from "../catalog/skus.js";
import { getDb, type DB } from "../db/db.js";
import { readList, writeList, writeAbono } from "../db/prices-cache.js";
import * as ws from "../waterservice/client.js";
import type { PriceMatrix } from "../waterservice/client.js";
import type { PricedCatalog, PricedProduct, PriceProvider } from "./types.js";

// City → price list. Per-city exceptions win (e.g. Lobos → PRECIO LOBOS);
// every other city falls back to PRICE_LIST_DEFAULT_ID (LISTA PRECIOS GENERAL).
// Never throws on an unmapped city — that's the whole point of the "any BA city
// is served" model; only a total misconfiguration (no default at all) throws.
//
// `frioCalor` layers PRECIO CAMPANA ESPECIAL on top, which exists ONLY for the
// comodato: a Campana customer buying loose bottles still gets the normal rule.
export function resolveCityListId(
  city: string,
  opts: { frioCalor?: boolean } = {},
): string {
  const key = city.toLowerCase();
  const listId =
    (opts.frioCalor ? config.FRIO_CALOR_CITY_PRICE_LIST_MAP[key] : "") ||
    config.CITY_PRICE_LIST_MAP[key] ||
    config.PRICE_LIST_DEFAULT_ID;
  if (!listId) throw new Error("No price list configured: set PRICE_LIST_DEFAULT_ID");
  return listId;
}

/** Every price list this deployment can serve. Feeds the refresh + the daily gap check. */
export function configuredListIds(): string[] {
  return [
    ...new Set(
      [
        ...Object.values(config.CITY_PRICE_LIST_MAP),
        ...Object.values(config.FRIO_CALOR_CITY_PRICE_LIST_MAP),
        config.PRICE_LIST_DEFAULT_ID,
      ].filter(Boolean),
    ),
  ];
}

/** One list's rows out of the #10 matrix, unfiltered (catalog/skus applies on read). */
function listFromMatrix(matrix: PriceMatrix, listaDePreciosId: string): PricedProduct[] {
  const listId = Number(listaDePreciosId);
  return matrix.articulos
    .map((a) => {
      const entry = a.precios.find((p) => p.lista_id === listId);
      return entry
        ? {
            id: String(a.articulo_id),
            name: a.nombreArticulo,
            price: entry.precio,
            notes: a.rubro ?? undefined,
          }
        : null;
    })
    .filter((p): p is NonNullable<typeof p> => p !== null);
}

export class WaterServicePriceProvider implements PriceProvider {
  constructor(private readonly db: DB = getDb()) {}

  async getPricesForList(listaDePreciosId: string): Promise<PricedCatalog> {
    const cached = readList(this.db, listaDePreciosId);
    const raw = cached ? cached.products : await this.fetchAndCache(listaDePreciosId);
    if (raw.length === 0) {
      throw new Error(`Price list ${listaDePreciosId} not found in matrix`);
    }
    // The list prices many things; we sell only the 9 catalog SKUs (catalog/skus.ts).
    const products = applyCatalog(raw);
    if (products.length === 0) {
      throw new Error(`Price list ${listaDePreciosId} carries none of the catalog SKUs`);
    }
    return { price_list: listaDePreciosId, products };
  }

  /**
   * The same 9 SKUs are sold in every city. PRECIO LOBOS and PRECIO CAMPANA
   * ESPECIAL price only what differs there — live, Lobos has no descartables rows
   * and CAMPANA ESPECIAL only the two 20L botellones — so LISTA PRECIOS GENERAL
   * fills whatever they omit. `price_list` stays the resolved id.
   */
  async getCatalog(city: string, opts: { frioCalor?: boolean } = {}): Promise<PricedCatalog> {
    const listId = resolveCityListId(city, opts);
    if (listId === config.PRICE_LIST_DEFAULT_ID) return this.getPricesForList(listId);
    const [zone, general] = await Promise.all([
      this.getPricesForList(listId),
      this.getPricesForList(config.PRICE_LIST_DEFAULT_ID),
    ]);
    const zonePrices = new Map(zone.products.map((p) => [p.name, p]));
    // GENERAL prices all 9, so it also supplies the sales order.
    const products = general.products.map((p) => zonePrices.get(p.name) ?? p);
    return { price_list: listId, products };
  }

  /** Cache miss only — never an outage fallback (a cached row is always preferred). */
  private async fetchAndCache(listaDePreciosId: string): Promise<PricedProduct[]> {
    const matrix = await ws.obtenerMatrizListaDePrecios(config.WS_TIPO_LISTA_ID);
    const products = listFromMatrix(matrix, listaDePreciosId);
    if (products.length > 0) {
      writeList(this.db, listaDePreciosId, products, new Date().toISOString());
    }
    return products;
  }
}

export function createPriceProvider(): PriceProvider {
  return new WaterServicePriceProvider();
}

/**
 * The `prices_refresh` cron's payload: pull #10 + #11 and upsert every configured
 * list and abono. Rows are only ever overwritten, never deleted — a failed refresh
 * leaves the last-good prices serving.
 */
export async function refreshPriceCache(db: DB, abonoIds: number[]): Promise<void> {
  const at = new Date().toISOString();
  const matrix = await ws.obtenerMatrizListaDePrecios(config.WS_TIPO_LISTA_ID);
  for (const listId of configuredListIds()) {
    const products = listFromMatrix(matrix, listId);
    if (products.length > 0) writeList(db, listId, products, at);
  }
  if (abonoIds.length === 0) return;
  const abonos = await ws.obtenerAbonosTipos();
  for (const id of abonoIds) {
    const hit = abonos.find((a) => a.id === id);
    if (hit) writeAbono(db, { id: hit.id, name: hit.nombreAbono, price: hit.precio }, at);
  }
}

/**
 * Daily catalog-completeness check. Only LISTA PRECIOS GENERAL has to carry all 9
 * SKUs — a hole there is a hole in every city, since every other list layers on top
 * of it (`getCatalog`). Zone lists are *expected* to be partial, so their gaps are
 * not alerts; a zone list that can't be resolved at all still is.
 */
export async function checkCatalogCompleteness(provider: PriceProvider): Promise<string[]> {
  const gaps: string[] = [];
  for (const listId of configuredListIds()) {
    const catalog = await provider.getPricesForList(listId).catch(() => null);
    if (!catalog) {
      gaps.push(`lista ${listId}: no se pudo resolver`);
      continue;
    }
    if (listId !== config.PRICE_LIST_DEFAULT_ID) continue;
    const missing = missingSkus(catalog.products);
    if (missing.length > 0) {
      gaps.push(`lista ${listId}: falta ${missing.map((s) => s.display).join(", ")}`);
    }
  }
  return gaps;
}
