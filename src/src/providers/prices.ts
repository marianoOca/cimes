// PriceProvider (01 §2). PRICES_SOURCE is fully open (00-master §10a) — no
// forced default; both implementations drop in behind the same interface.
// The AI reaches prices ONLY through this provider.
import { GoogleSpreadsheet } from "google-spreadsheet";
import { JWT } from "google-auth-library";
import { config } from "../config.js";
import * as ws from "../waterservice/client.js";
import type { PriceMatrix } from "../waterservice/client.js";
import type { PricedCatalog, PriceProvider } from "./types.js";

function resolveCityListId(city: string): string {
  const listId = config.CITY_PRICE_LIST_MAP[city.toLowerCase()];
  if (!listId) throw new Error(`No price list configured for city: ${city}`);
  return listId;
}

// ---------- waterservice implementation (#10 matrix, daily refresh) ----------

const MATRIX_TTL_MS = 24 * 3_600_000;

export class WaterServicePriceProvider implements PriceProvider {
  private matrix: PriceMatrix | null = null;
  private loadedAt = 0;

  private async getMatrix(): Promise<PriceMatrix> {
    if (!this.matrix || Date.now() - this.loadedAt > MATRIX_TTL_MS) {
      this.matrix = await ws.obtenerMatrizListaDePrecios(config.WS_TIPO_LISTA_ID);
      this.loadedAt = Date.now();
    }
    return this.matrix;
  }

  // The #10 matrix carries every list's prices, so the neighbor-derived
  // listaDePrecios_id resolves locally without a per-client #5 call.
  async getPricesForList(listaDePreciosId: string): Promise<PricedCatalog> {
    const matrix = await this.getMatrix();
    const listId = Number(listaDePreciosId);
    const products = matrix.articulos
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
    if (products.length === 0) {
      throw new Error(`Price list ${listaDePreciosId} not found in matrix`);
    }
    return { price_list: listaDePreciosId, products };
  }

  async getCatalog(city: string): Promise<PricedCatalog> {
    return this.getPricesForList(resolveCityListId(city));
  }
}

// ---------- sheet implementation (PRICES_SHEET_ID, ~15 min refresh) ----------

interface SheetRow {
  list_id: string;
  product_id: string;
  product: string;
  price: number;
}

const SHEET_TTL_MS = 15 * 60_000;

export class SheetPriceProvider implements PriceProvider {
  private rows: SheetRow[] = [];
  private loadedAt = 0;

  private async getRows(): Promise<SheetRow[]> {
    if (this.rows.length === 0 || Date.now() - this.loadedAt > SHEET_TTL_MS) {
      const creds = JSON.parse(config.GOOGLE_SERVICE_ACCOUNT_JSON) as {
        client_email: string;
        private_key: string;
      };
      const auth = new JWT({
        email: creds.client_email,
        key: creds.private_key,
        scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
      });
      const doc = new GoogleSpreadsheet(config.PRICES_SHEET_ID, auth);
      await doc.loadInfo();
      const sheet = doc.sheetsByIndex[0];
      if (!sheet) throw new Error("Prices sheet has no worksheets");
      const rows = await sheet.getRows();
      this.rows = rows.map((r) => ({
        list_id: String(r.get("list_id") ?? ""),
        product_id: String(r.get("product_id") ?? ""),
        product: String(r.get("product") ?? ""),
        price: Number(r.get("price") ?? 0),
      }));
      this.loadedAt = Date.now();
    }
    return this.rows;
  }

  async getPricesForList(listaDePreciosId: string): Promise<PricedCatalog> {
    const rows = await this.getRows();
    const products = rows
      .filter((r) => r.list_id === listaDePreciosId)
      .map((r) => ({ id: r.product_id, name: r.product, price: r.price }));
    if (products.length === 0) {
      throw new Error(`Price list ${listaDePreciosId} not found in sheet`);
    }
    return { price_list: listaDePreciosId, products };
  }

  async getCatalog(city: string): Promise<PricedCatalog> {
    return this.getPricesForList(resolveCityListId(city));
  }
}

// ---------- selection + daily sheet-vs-#10 consistency check ----------

export function createPriceProvider(): PriceProvider {
  if (!config.PRICES_SOURCE) {
    throw new Error(
      "PRICES_SOURCE is not set (open item 00-master §10a) — set 'waterservice' or 'sheet'",
    );
  }
  return config.PRICES_SOURCE === "sheet"
    ? new SheetPriceProvider()
    : new WaterServicePriceProvider();
}

/**
 * Daily consistency check when PRICES_SOURCE=sheet (01 §2): compare the sheet
 * against the #10 matrix; return human-readable mismatch descriptions for the
 * operator alert.
 */
export async function checkSheetConsistency(): Promise<string[]> {
  const sheet = new SheetPriceProvider();
  const wsProvider = new WaterServicePriceProvider();
  const mismatches: string[] = [];
  const listIds = new Set(
    (await sheet["getRows"]()).map((r) => r.list_id).filter(Boolean),
  );
  for (const listId of listIds) {
    const [fromSheet, fromWs] = await Promise.all([
      sheet.getPricesForList(listId),
      wsProvider.getPricesForList(listId).catch(() => null),
    ]);
    if (!fromWs) {
      mismatches.push(`lista ${listId}: no existe en WaterService`);
      continue;
    }
    for (const p of fromSheet.products) {
      const wsProduct = fromWs.products.find(
        (w) => w.id === p.id || w.name.toLowerCase() === p.name.toLowerCase(),
      );
      if (!wsProduct) {
        mismatches.push(`lista ${listId}: "${p.name}" no está en WaterService`);
      } else if (wsProduct.price !== p.price) {
        mismatches.push(
          `lista ${listId}: "${p.name}" planilla $${p.price} vs WaterService $${wsProduct.price}`,
        );
      }
    }
  }
  return mismatches;
}
