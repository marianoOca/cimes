// Stored order (01 §4.6). The dispatch scheduler and operator-override path
// operate on this row; the lead record only mirrors the sync fields.
import { randomUUID } from "node:crypto";
import type { DB } from "./db.js";

export interface Order {
  id: string;
  lead_id: string;
  product: string;
  price: number;
  amount_to_collect: number;
  route: string;
  delivery_day: string;
  delivery_window: string;
  delivery_date: string | null; // YYYY-MM-DD (AR local); dispatch fires the day before
  status: "pending_dispatch" | "dispatched" | "failed";
  ticket_id: string | null;
  neighbor_client_id: number | null;
  sheet_row: number | null;
  created_at: string;
}

export function createOrder(
  db: DB,
  fields: Omit<
    Order,
    "id" | "status" | "ticket_id" | "created_at" | "neighbor_client_id" | "sheet_row"
  >,
): Order {
  const id = randomUUID();
  db.prepare(
    `INSERT INTO orders (id, lead_id, product, price, amount_to_collect, route,
       delivery_day, delivery_window, delivery_date)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    id,
    fields.lead_id,
    fields.product,
    fields.price,
    fields.amount_to_collect,
    fields.route,
    fields.delivery_day,
    fields.delivery_window,
    fields.delivery_date,
  );
  return getOrder(db, id)!;
}

export function getOrder(db: DB, id: string): Order | null {
  return (db.prepare("SELECT * FROM orders WHERE id = ?").get(id) as Order) ?? null;
}

export function getPendingOrderForLead(db: DB, leadId: string): Order | null {
  return (
    (db
      .prepare(
        "SELECT * FROM orders WHERE lead_id = ? AND status = 'pending_dispatch' ORDER BY created_at DESC LIMIT 1",
      )
      .get(leadId) as Order) ?? null
  );
}

/** Operator override (01 §4.5): route/day editable while pending_dispatch. */
export function updatePendingOrder(
  db: DB,
  id: string,
  patch: Partial<
    Pick<Order, "route" | "delivery_day" | "delivery_window" | "delivery_date" | "product" | "price" | "amount_to_collect">
  >,
): Order | null {
  const order = getOrder(db, id);
  if (!order || order.status !== "pending_dispatch") return null;
  const entries = Object.entries(patch);
  if (entries.length > 0) {
    const sets = entries.map(([k]) => `${k} = ?`).join(", ");
    db.prepare(`UPDATE orders SET ${sets} WHERE id = ? AND status = 'pending_dispatch'`).run(
      ...entries.map(([, v]) => v),
      id,
    );
  }
  return getOrder(db, id);
}

export function markDispatched(db: DB, id: string, ticketId: string): void {
  db.prepare("UPDATE orders SET status = 'dispatched', ticket_id = ? WHERE id = ?").run(
    ticketId,
    id,
  );
}
