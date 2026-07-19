// Split from orders.ts additions: create with neighbor id + sheet-row setter.
import type { DB } from "./db.js";
import type { Order } from "./orders.js";

export function setOrderNeighborClient(db: DB, id: string, neighborId: number | null): void {
  db.prepare("UPDATE orders SET neighbor_client_id = ? WHERE id = ?").run(neighborId, id);
}

export function setOrderSheetRow(db: DB, id: string, row: number): void {
  db.prepare("UPDATE orders SET sheet_row = ? WHERE id = ?").run(row, id);
}

export function ordersPendingForDate(db: DB, deliveryDate: string): Order[] {
  return db
    .prepare(
      "SELECT * FROM orders WHERE status = 'pending_dispatch' AND delivery_date = ?",
    )
    .all(deliveryDate) as Order[];
}
