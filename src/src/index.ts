// Service entry point: DB, job handlers (the only timer/cron mechanism),
// recurring schedules, HTTP server.
import { config } from "./config.js";
import { copy } from "./copy.es-AR.js";
import { getDb } from "./db/db.js";
import { getLeadById } from "./db/leads.js";
import { getOrder } from "./db/orders.js";
import { setOrderSheetRow } from "./db/orders-update.js";
import { JobRunner, enqueue } from "./jobs/queue.js";
import { buildServer } from "./api/server.js";
import { confirmOrder } from "./pipeline/orders.js";
import { handleDispatchOrder, handleDispatchScan } from "./pipeline/dispatch.js";
import { handleFollowupJob } from "./engines/followups.js";
import { handleDebtSend, handleDebtSync } from "./engines/debt.js";
import { appendOrderRow, updateSheetTicket } from "./sheets/orders.js";
import { checkSheetConsistency } from "./providers/prices.js";
import {
  handleMirrorMessageJob,
  handleMirrorStatusJob,
  handleMirrorSyncJob,
} from "./crm/mirror.js";
import { sendTemplate } from "./kapso/send.js";
import { notifyOperator } from "./engine/notify.js";
import { nextLocalHour } from "./time.js";

const db = getDb();
const runner = new JobRunner(db);

// ---------- one-shot job handlers ----------

runner.on("followup", handleFollowupJob);
runner.on("dispatch_order", handleDispatchOrder);
runner.on("order_sync_retry", async (payload, db) => {
  await confirmOrder(db, String(payload.lead_id));
});
runner.on("sheet_append_order", async (payload, db) => {
  const lead = getLeadById(db, String(payload.lead_id));
  if (!lead) return;
  const order = payload.order_id ? getOrder(db, String(payload.order_id)) : null;
  const row = await appendOrderRow(lead, order, String(payload.label));
  if (order) setOrderSheetRow(db, order.id, row);
});
runner.on("sheet_update_ticket", async (payload) => {
  await updateSheetTicket(Number(payload.row), String(payload.ticket_id));
});
runner.on("send_web_confirmation", async (payload, db) => {
  const lead = getLeadById(db, String(payload.lead_id));
  if (!lead) return;
  await sendTemplate(config.WHATSAPP_NUMBER_SALES, lead.phone, "web_order_confirmation", [
    String(payload.day),
    String(payload.window),
  ]);
});
runner.on("chatwoot_mirror_message", handleMirrorMessageJob);
runner.on("chatwoot_mirror_sync", handleMirrorSyncJob);
runner.on("chatwoot_mirror_status", handleMirrorStatusJob);

// ---------- recurring jobs (each run schedules the next — restart-safe) ----------

function scheduleDaily(type: string, hour: number): void {
  enqueue(db, type, nextLocalHour(hour), {}, `recurring:${type}`);
}

runner.on("dispatch_scan", async (payload, db) => {
  try {
    await handleDispatchScan(payload, db);
  } finally {
    scheduleDaily("dispatch_scan", 7);
  }
});
runner.on("debt_sync", async (payload, db) => {
  try {
    await handleDebtSync(payload, db);
  } finally {
    scheduleDaily("debt_sync", 3);
  }
});
runner.on("debt_send", async (payload, db) => {
  try {
    await handleDebtSend(payload, db);
  } finally {
    scheduleDaily("debt_send", config.DEBT_REMINDER_SEND_HOUR);
  }
});
runner.on("prices_sheet_check", async (_payload, _db) => {
  try {
    if (config.PRICES_SOURCE === "sheet") {
      const mismatches = await checkSheetConsistency();
      if (mismatches.length > 0) {
        await notifyOperator(copy.operatorSheetMismatchAlert(mismatches.join("; ")));
      }
    }
  } finally {
    scheduleDaily("prices_sheet_check", 6);
  }
});

scheduleDaily("dispatch_scan", 7);
scheduleDaily("debt_sync", 3);
scheduleDaily("debt_send", config.DEBT_REMINDER_SEND_HOUR);
scheduleDaily("prices_sheet_check", 6);

// ---------- start ----------

runner.start();

const app = buildServer(db);
app
  .listen({ port: config.PORT, host: "127.0.0.1" })
  .then(() => console.log(`cimes backend listening on :${config.PORT}`))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
