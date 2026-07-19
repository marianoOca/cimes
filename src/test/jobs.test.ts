import { describe, expect, it } from "vitest";
import { openDb } from "../src/db/db.js";
import { JobRunner, cancelJobs, enqueue } from "../src/jobs/queue.js";

describe("SQLite jobs queue", () => {
  it("runs due jobs and marks them done", async () => {
    const db = openDb(":memory:");
    const seen: string[] = [];
    const runner = new JobRunner(db);
    runner.on("greet", async (p) => {
      seen.push(String(p.who));
    });
    enqueue(db, "greet", new Date(Date.now() - 1000), { who: "a" });
    enqueue(db, "greet", new Date(Date.now() + 60_000), { who: "later" });
    await runner.tick();
    expect(seen).toEqual(["a"]);
    const statuses = db.prepare("SELECT status FROM jobs ORDER BY id").all() as {
      status: string;
    }[];
    expect(statuses.map((s) => s.status)).toEqual(["done", "pending"]);
  });

  it("dedupes by dedupe_key while pending", () => {
    const db = openDb(":memory:");
    expect(enqueue(db, "t", new Date(), {}, "k1")).not.toBeNull();
    expect(enqueue(db, "t", new Date(), {}, "k1")).toBeNull();
  });

  it("retries with backoff on failure", async () => {
    const db = openDb(":memory:");
    let attempts = 0;
    const runner = new JobRunner(db);
    runner.on("flaky", async () => {
      attempts++;
      throw new Error("boom");
    });
    enqueue(db, "flaky", new Date(Date.now() - 1000), {});
    await runner.tick();
    expect(attempts).toBe(1);
    const job = db.prepare("SELECT status, attempts, run_at FROM jobs").get() as {
      status: string;
      attempts: number;
      run_at: string;
    };
    expect(job.status).toBe("pending");
    expect(job.attempts).toBe(1);
    expect(Date.parse(job.run_at)).toBeGreaterThan(Date.now());
  });

  it("cancels pending jobs for a lead by payload", () => {
    const db = openDb(":memory:");
    enqueue(db, "followup", new Date(Date.now() + 1000), { lead_id: "L1" });
    enqueue(db, "followup", new Date(Date.now() + 2000), { lead_id: "L1" });
    enqueue(db, "followup", new Date(Date.now() + 3000), { lead_id: "L2" });
    expect(cancelJobs(db, "followup", "L1")).toBe(2);
  });

  it("recovers crashed 'running' jobs on start", () => {
    const db = openDb(":memory:");
    enqueue(db, "x", new Date(), {});
    db.prepare("UPDATE jobs SET status = 'running'").run();
    const runner = new JobRunner(db, 1_000_000);
    runner.start();
    runner.stop();
    const job = db.prepare("SELECT status FROM jobs").get() as { status: string };
    expect(job.status).toBe("pending");
  });
});
