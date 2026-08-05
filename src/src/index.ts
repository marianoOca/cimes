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
import { checkCatalogCompleteness, refreshPriceCache } from "./providers/prices.js";
import { configuredAbonoIds } from "./providers/abonos.js";
import { oldestFetchedAt, readAbono } from "./db/prices-cache.js";
import { getPriceProvider } from "./ai/tools.js";
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

/** Two missed daily refreshes: the cron is broken, not just unlucky. */
const STALE_PRICES_MS = 48 * 3_600_000;

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
// The only thing in the service that calls WaterService for prices. Everything
// else reads ws_price_cache, so this failing degrades to "prices are stale",
// never to "the wizard can't quote".
runner.on("prices_refresh", async (_payload, db) => {
  try {
    try {
      await refreshPriceCache(db, configuredAbonoIds());
    } catch (err) {
      // Last-good rows stay in place — never cleared on a failed refresh.
      await notifyOperator(copy.operatorPriceRefreshFailedAlert(String(err)));
    }
    // A silently failing refresh would otherwise only surface as drifted prices.
    const oldest = oldestFetchedAt(db);
    if (oldest && Date.now() - Date.parse(oldest) > STALE_PRICES_MS) {
      await notifyOperator(copy.operatorPricesStaleAlert(oldest));
    }
    // Ungated: a SKU missing from a price list is silently hidden from that zone.
    const gaps = await checkCatalogCompleteness(getPriceProvider());
    if (gaps.length > 0) {
      await notifyOperator(copy.operatorMissingSkusAlert(gaps.join("; ")));
    }
  } finally {
    scheduleDaily("prices_refresh", 6);
  }
});

scheduleDaily("dispatch_scan", 7);
scheduleDaily("debt_sync", 3);
scheduleDaily("debt_send", config.DEBT_REMINDER_SEND_HOUR);
scheduleDaily("prices_refresh", 6);
// Price lists self-heal on the first /api/prices miss, but abonos have no
// read-path fetch: an uncached abono id hides the frío/calor card entirely. So
// refresh at boot whenever one is missing — covers a cold DB and, just as often,
// a newly configured id in FRIO_CALOR_ABONO_MAP.
if (configuredAbonoIds().some((id) => !readAbono(db, id))) {
  enqueue(db, "prices_refresh", new Date(), {}, "prices_refresh:boot");
}

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
