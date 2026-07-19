// Append-only event log (01 §10.1). Canonical event types: 00-master §5.8.
import type { DB } from "./db.js";

export type EventType =
  | "lead_created"
  | "stage_entered"
  | "message_in"
  | "message_out"
  | "followup_sent"
  | "followup_reply"
  | "coverage_checked"
  | "label_applied"
  | "order_confirmed"
  | "handoff"
  | "opt_out"
  | "debt_reminder_sent";

export interface EventInput {
  lead_id: string;
  source: string;
  city?: string;
  event_type: EventType;
  stage?: string;
  followup_count?: number;
  metadata?: Record<string, unknown>;
}

export function emitEvent(db: DB, e: EventInput): void {
  db.prepare(
    `INSERT INTO events (lead_id, source, city, event_type, stage, followup_count, metadata)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    e.lead_id,
    e.source,
    e.city ?? "",
    e.event_type,
    e.stage ?? "",
    e.followup_count ?? 0,
    JSON.stringify(e.metadata ?? {}),
  );
}

export interface EventRow {
  id: number;
  timestamp: string;
  lead_id: string;
  source: string;
  city: string;
  event_type: string;
  stage: string;
  followup_count: number;
  metadata: string;
}

/** Complete, chronological range read for CSV export (01 §9). */
export function eventsInRange(db: DB, from: string, to: string): EventRow[] {
  return db
    .prepare(
      `SELECT * FROM events
       WHERE date(timestamp) >= date(?) AND date(timestamp) <= date(?)
       ORDER BY id ASC`,
    )
    .all(from, to) as EventRow[];
}

export function eventsToCsv(rows: EventRow[]): string {
  const header =
    "id,timestamp,lead_id,source,city,event_type,stage,followup_count,metadata";
  const esc = (v: unknown) => `"${String(v).replaceAll('"', '""')}"`;
  const lines = rows.map((r) =>
    [
      r.id,
      r.timestamp,
      r.lead_id,
      r.source,
      r.city,
      r.event_type,
      r.stage,
      r.followup_count,
      esc(r.metadata),
    ].join(","),
  );
  return [header, ...lines].join("\n") + "\n";
}
