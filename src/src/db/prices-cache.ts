// Local mirror of the WaterService prices (01 §2). The request path reads ONLY
// from here — a WaterService outage must never dead-end the wizard, because a
// quote we can't produce is a lead we never save. The `prices_refresh` cron is
// the only thing that talks to #10/#11; see index.ts.
//
// Rows are never deleted on a failed refresh: a slightly stale price beats no
// price at all. Staleness surfaces through the daily operator alert instead.
import type { DB } from "./db.js";
import type { PricedProduct } from "../providers/types.js";

/** Raw list entries as WaterService returns them, before catalog/skus filtering. */
export interface CachedList {
  products: PricedProduct[];
  fetchedAt: string;
}

export interface CachedAbono {
  id: number;
  name: string;
  price: number;
  fetchedAt: string;
}

interface Row {
  payload: string;
  fetched_at: string;
}

function read(db: DB, kind: string, key: string): Row | null {
  return (
    (db
      .prepare("SELECT payload, fetched_at FROM ws_price_cache WHERE kind = ? AND key = ?")
      .get(kind, key) as Row | undefined) ?? null
  );
}

function write(db: DB, kind: string, key: string, payload: unknown, at: string): void {
  db.prepare(
    `INSERT INTO ws_price_cache (kind, key, payload, fetched_at) VALUES (?, ?, ?, ?)
     ON CONFLICT (kind, key) DO UPDATE SET payload = excluded.payload,
                                           fetched_at = excluded.fetched_at`,
  ).run(kind, key, JSON.stringify(payload), at);
}

export function readList(db: DB, listId: string): CachedList | null {
  const row = read(db, "price_list", listId);
  if (!row) return null;
  return { products: JSON.parse(row.payload) as PricedProduct[], fetchedAt: row.fetched_at };
}

export function writeList(
  db: DB,
  listId: string,
  products: PricedProduct[],
  at: string,
): void {
  write(db, "price_list", listId, products, at);
}

export function readAbono(db: DB, abonoId: number): CachedAbono | null {
  const row = read(db, "abono", String(abonoId));
  if (!row) return null;
  const payload = JSON.parse(row.payload) as { id: number; name: string; price: number };
  return { ...payload, fetchedAt: row.fetched_at };
}

export function writeAbono(
  db: DB,
  abono: { id: number; name: string; price: number },
  at: string,
): void {
  write(db, "abono", String(abono.id), abono, at);
}

/** Oldest `fetched_at` in the cache, or null when it's empty. Feeds the staleness alert. */
export function oldestFetchedAt(db: DB): string | null {
  const row = db.prepare("SELECT MIN(fetched_at) AS oldest FROM ws_price_cache").get() as
    | { oldest: string | null }
    | undefined;
  return row?.oldest ?? null;
}
