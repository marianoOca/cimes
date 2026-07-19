// SQLite jobs table + polling loop — the only timer/retry mechanism in the
// service (01 building blocks): follow-up timers, dispatch scheduler, debt
// crons, WaterService/Sheets retry queue, Chatwoot mirror retries.
// Restart-safe: state lives in the DB; the poller reconstructs on boot.
import type { DB } from "../db/db.js";

export interface Job {
  id: number;
  type: string;
  run_at: string;
  payload: string;
  status: "pending" | "running" | "done" | "failed" | "cancelled";
  attempts: number;
  last_error: string | null;
  dedupe_key: string | null;
  created_at: string;
}

export type JobHandler = (payload: Record<string, unknown>, db: DB) => Promise<void>;

const MAX_ATTEMPTS = 8;

export function enqueue(
  db: DB,
  type: string,
  runAt: Date,
  payload: Record<string, unknown> = {},
  dedupeKey?: string,
): number | null {
  try {
    const res = db
      .prepare(
        "INSERT INTO jobs (type, run_at, payload, dedupe_key) VALUES (?, ?, ?, ?)",
      )
      .run(type, runAt.toISOString(), JSON.stringify(payload), dedupeKey ?? null);
    return Number(res.lastInsertRowid);
  } catch (err) {
    // Unique dedupe_key hit — an equivalent pending job already exists.
    if (err instanceof Error && err.message.includes("UNIQUE")) return null;
    throw err;
  }
}

export function cancelJobs(db: DB, type: string, leadId: string): number {
  const res = db
    .prepare(
      `UPDATE jobs SET status = 'cancelled'
       WHERE type = ? AND status = 'pending'
         AND json_extract(payload, '$.lead_id') = ?`,
    )
    .run(type, leadId);
  return res.changes;
}

export class JobRunner {
  private handlers = new Map<string, JobHandler>();
  private timer: NodeJS.Timeout | null = null;
  private running = false;

  constructor(
    private db: DB,
    private pollMs = 5000,
  ) {}

  on(type: string, handler: JobHandler): this {
    this.handlers.set(type, handler);
    return this;
  }

  start(): void {
    // Recover jobs left 'running' by a crash — they never completed.
    this.db
      .prepare("UPDATE jobs SET status = 'pending' WHERE status = 'running'")
      .run();
    this.timer = setInterval(() => void this.tick(), this.pollMs);
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  /** One poll pass. Exposed for tests and manual draining. */
  async tick(): Promise<void> {
    if (this.running) return; // no overlapping passes
    this.running = true;
    try {
      for (;;) {
        const job = this.claimNext();
        if (!job) break;
        await this.run(job);
      }
    } finally {
      this.running = false;
    }
  }

  private claimNext(): Job | null {
    const row = this.db
      .prepare(
        `SELECT * FROM jobs WHERE status = 'pending' AND run_at <= ?
         ORDER BY run_at ASC LIMIT 1`,
      )
      .get(new Date().toISOString()) as Job | undefined;
    if (!row) return null;
    const res = this.db
      .prepare("UPDATE jobs SET status = 'running' WHERE id = ? AND status = 'pending'")
      .run(row.id);
    return res.changes === 1 ? row : null;
  }

  private async run(job: Job): Promise<void> {
    const handler = this.handlers.get(job.type);
    if (!handler) {
      this.db
        .prepare("UPDATE jobs SET status = 'failed', last_error = ? WHERE id = ?")
        .run(`no handler for type ${job.type}`, job.id);
      return;
    }
    try {
      await handler(JSON.parse(job.payload) as Record<string, unknown>, this.db);
      this.db.prepare("UPDATE jobs SET status = 'done' WHERE id = ?").run(job.id);
    } catch (err) {
      const attempts = job.attempts + 1;
      const message = err instanceof Error ? err.message : String(err);
      if (attempts >= MAX_ATTEMPTS) {
        this.db
          .prepare(
            "UPDATE jobs SET status = 'failed', attempts = ?, last_error = ? WHERE id = ?",
          )
          .run(attempts, message, job.id);
      } else {
        // Exponential backoff: 1m, 2m, 4m, ... capped at 1h.
        const delayMs = Math.min(60_000 * 2 ** (attempts - 1), 3_600_000);
        this.db
          .prepare(
            "UPDATE jobs SET status = 'pending', attempts = ?, last_error = ?, run_at = ? WHERE id = ?",
          )
          .run(attempts, message, new Date(Date.now() + delayMs).toISOString(), job.id);
      }
    }
  }
}
