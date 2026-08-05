// Orders sheet (01 §10): operator-facing mirror, not source of truth. Rows are
// written in real time as part of the pipeline (via the retry-queue jobs).
import { GoogleSpreadsheet, GoogleSpreadsheetWorksheet } from "google-spreadsheet";
import { JWT } from "google-auth-library";
import { config } from "../config.js";
import type { Lead } from "../db/leads.js";
import type { Order } from "../db/orders.js";
import { SKUS } from "../catalog/skus.js";
import { ABONO_LINE_MARKER } from "../api/orders-cart.js";
import { normalizeText } from "../text.js";

export const SHEET_COLUMNS = [
  "timestamp",
  "source",
  "name",
  "phone",
  "city",
  "address",
  "cross_streets",
  "product",
  "price",
  "price_list",
  "route",
  "delivery_day",
  "delivery_window",
  "client_type",
  "amount_to_collect",
  "label",
  "waterservice_client_id",
  "ticket_id",
  "conversation_link",
  "notes",
] as const;

export function clientTypeOf(product: string): "frio_calor" | "bidon" | "soda" {
  const summary = normalizeText(product);
  // An abono line wins over the bottles beside it: a frío/calor order always
  // also carries botellones, so the SKU scan below would misread it as `bidon`.
  if (summary.includes(ABONO_LINE_MARKER)) return "frio_calor";
  // Multi-item carts arrive as a summary ("2x Botellón 20L, 1x Gaseosa 2L"), so
  // take the first catalog SKU named in the string. Longest display name first:
  // "Botellón 20L" is a prefix of "Botellón 20L Bajo Sodio".
  const sku = [...SKUS]
    .sort((a, b) => b.display.length - a.display.length)
    .find((s) => summary.includes(normalizeText(s.display)));
  if (sku) return sku.clientType;
  // Fallback for legacy rows and the free-text confirm_order path.
  const p = product.toLowerCase();
  if (p.includes("dispenser") || p.includes("frio") || p.includes("frío") || p.includes("calor"))
    return "frio_calor";
  if (p.includes("soda") || p.includes("sifon") || p.includes("sifón") || p.includes("saboriz"))
    return "soda";
  return "bidon";
}

async function getSheet(): Promise<GoogleSpreadsheetWorksheet> {
  const creds = JSON.parse(config.GOOGLE_SERVICE_ACCOUNT_JSON) as {
    client_email: string;
    private_key: string;
  };
  const auth = new JWT({
    email: creds.client_email,
    key: creds.private_key,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });
  const doc = new GoogleSpreadsheet(config.ORDERS_SHEET_ID, auth);
  await doc.loadInfo();
  const sheet = doc.sheetsByIndex[0];
  if (!sheet) throw new Error("Orders sheet has no worksheets");
  return sheet;
}

/** Append one row; returns its 1-based row number (for the later ticket update). */
export async function appendOrderRow(
  lead: Lead,
  order: Order | null,
  label: string,
): Promise<number> {
  const sheet = await getSheet();
  const row = await sheet.addRow({
    timestamp: new Date().toISOString(),
    source: lead.source,
    name: lead.name,
    phone: lead.phone,
    city: lead.city,
    address: lead.address,
    cross_streets: lead.cross_streets,
    product: order?.product ?? lead.product,
    price: order?.price ?? lead.price ?? "",
    price_list: lead.price_list,
    route: order?.route ?? lead.route,
    delivery_day: order?.delivery_day ?? lead.delivery_day,
    delivery_window: order?.delivery_window ?? lead.delivery_window,
    client_type: clientTypeOf(order?.product ?? lead.product),
    amount_to_collect: order?.amount_to_collect ?? "",
    label,
    waterservice_client_id: lead.waterservice_client_id ?? "",
    ticket_id: order?.ticket_id ?? "",
    conversation_link: lead.conversation_link,
    notes: lead.notes,
  });
  return row.rowNumber;
}

/** The dispatch scheduler fills ticket_id on the existing row (01 §4.5). */
export async function updateSheetTicket(rowNumber: number, ticketId: string): Promise<void> {
  const sheet = await getSheet();
  const rows = await sheet.getRows();
  const row = rows.find((r) => r.rowNumber === rowNumber);
  if (!row) return;
  row.set("ticket_id", ticketId);
  await row.save();
}
