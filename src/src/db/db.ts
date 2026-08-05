import Database from "better-sqlite3";
import { config } from "../config.js";

export type DB = Database.Database;

let instance: DB | null = null;

export function getDb(): DB {
  if (!instance) instance = openDb(config.DB_PATH);
  return instance;
}

/** Open (and migrate) a database at the given path. Tests pass ":memory:". */
export function openDb(path: string): DB {
  const db = new Database(path);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  migrate(db);
  return db;
}

function migrate(db: DB): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS leads (
      lead_id TEXT PRIMARY KEY,
      phone TEXT NOT NULL UNIQUE,
      source TEXT NOT NULL CHECK (source IN ('whatsapp','web','instagram')),
      name TEXT NOT NULL DEFAULT '',
      city TEXT NOT NULL DEFAULT '',
      address TEXT NOT NULL DEFAULT '',
      cross_streets TEXT NOT NULL DEFAULT '',
      product TEXT NOT NULL DEFAULT '',
      price REAL,
      price_list TEXT NOT NULL DEFAULT '',
      route TEXT NOT NULL DEFAULT '',
      delivery_day TEXT NOT NULL DEFAULT '',
      delivery_window TEXT NOT NULL DEFAULT '',
      stage TEXT NOT NULL DEFAULT 'inicio',
      followup_count INTEGER NOT NULL DEFAULT 0,
      followup_cycles INTEGER NOT NULL DEFAULT 0,
      labels TEXT NOT NULL DEFAULT '[]',
      ai_enabled INTEGER NOT NULL DEFAULT 1,
      waterservice_client_id TEXT,
      ticket_id TEXT,
      sync_status TEXT NOT NULL DEFAULT 'pending'
        CHECK (sync_status IN ('pending','synced','failed')),
      conversation_link TEXT NOT NULL DEFAULT '',
      chatwoot_conversation_id INTEGER,
      notes TEXT NOT NULL DEFAULT '',
      coverage_json TEXT,
      location_attempts INTEGER NOT NULL DEFAULT 0,
      archived INTEGER NOT NULL DEFAULT 0,
      last_message_at TEXT,
      created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
    );

    CREATE TABLE IF NOT EXISTS orders (
      id TEXT PRIMARY KEY,
      lead_id TEXT NOT NULL REFERENCES leads(lead_id),
      product TEXT NOT NULL,
      price REAL NOT NULL,
      amount_to_collect REAL NOT NULL,
      route TEXT NOT NULL,
      delivery_day TEXT NOT NULL,
      delivery_window TEXT NOT NULL,
      delivery_date TEXT,
      status TEXT NOT NULL DEFAULT 'pending_dispatch'
        CHECK (status IN ('pending_dispatch','dispatched','failed')),
      ticket_id TEXT,
      neighbor_client_id INTEGER,
      sheet_row INTEGER,
      created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
    );

    -- Append-only analytics capture (01 §10.1). Rows are never updated or deleted.
    CREATE TABLE IF NOT EXISTS events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      timestamp TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
      lead_id TEXT NOT NULL,
      source TEXT NOT NULL,
      city TEXT NOT NULL DEFAULT '',
      event_type TEXT NOT NULL,
      stage TEXT NOT NULL DEFAULT '',
      followup_count INTEGER NOT NULL DEFAULT 0,
      metadata TEXT NOT NULL DEFAULT '{}'
    );
    CREATE INDEX IF NOT EXISTS idx_events_ts ON events (timestamp);

    -- All timers/retries: follow-ups, dispatch, debt sync/send, mirror retries (01 building blocks).
    CREATE TABLE IF NOT EXISTS jobs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      type TEXT NOT NULL,
      run_at TEXT NOT NULL,
      payload TEXT NOT NULL DEFAULT '{}',
      status TEXT NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending','running','done','failed','cancelled')),
      attempts INTEGER NOT NULL DEFAULT 0,
      last_error TEXT,
      dedupe_key TEXT,
      created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
    );
    CREATE INDEX IF NOT EXISTS idx_jobs_due ON jobs (status, run_at);
    CREATE UNIQUE INDEX IF NOT EXISTS idx_jobs_dedupe
      ON jobs (dedupe_key) WHERE dedupe_key IS NOT NULL AND status IN ('pending','running');

    -- Inbound WhatsApp dedupe by message ID (guardrail 00 §6).
    CREATE TABLE IF NOT EXISTS processed_messages (
      message_id TEXT PRIMARY KEY,
      processed_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
    );

    -- Local debt table, synced nightly from #28 (01 §8).
    CREATE TABLE IF NOT EXISTS debt_balances (
      waterservice_client_id TEXT PRIMARY KEY,
      balance REAL NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS debt_reminders (
      waterservice_client_id TEXT PRIMARY KEY,
      last_sent_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS debt_suppressions (
      phone TEXT PRIMARY KEY,
      created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
    );

    -- Watermarks / small persistent state (e.g. debt-sync 'desde', daily counters).
    CREATE TABLE IF NOT EXISTS kv (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    -- Local mirror of the WaterService prices (#10 lists, #11 abonos). The request
    -- path reads only from here; the prices_refresh cron is the only writer.
    -- See db/prices-cache.ts.
    CREATE TABLE IF NOT EXISTS ws_price_cache (
      kind       TEXT NOT NULL CHECK (kind IN ('price_list','abono')),
      key        TEXT NOT NULL,
      payload    TEXT NOT NULL,
      fetched_at TEXT NOT NULL,
      PRIMARY KEY (kind, key)
    );
  `);

  // Additive column migrations for DBs created before the column existed
  // (CREATE TABLE IF NOT EXISTS above never adds columns to an existing table).
  const leadCols = new Set(
    (db.prepare("PRAGMA table_info(leads)").all() as { name: string }[]).map((c) => c.name),
  );
  if (!leadCols.has("location_attempts")) {
    db.exec("ALTER TABLE leads ADD COLUMN location_attempts INTEGER NOT NULL DEFAULT 0");
  }
}

export function kvGet(db: DB, key: string): string | null {
  const row = db.prepare("SELECT value FROM kv WHERE key = ?").get(key) as
    | { value: string }
    | undefined;
  return row?.value ?? null;
}

export function kvSet(db: DB, key: string, value: string): void {
  db.prepare(
    "INSERT INTO kv (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
  ).run(key, value);
}
