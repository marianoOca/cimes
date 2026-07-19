// Debt-reminder engine (01 §8): visit-eve balance reminders, NOT dunning.
// Payment happens at the door. Reminders only when the visit is tomorrow.
// Note: candidates are WaterService clients the bot knows a phone for
// (leads with waterservice_client_id); vendor webhooks PDF still pending.
import { config } from "../config.js";
import type { DB } from "../db/db.js";
import { kvGet, kvSet } from "../db/db.js";
import { emitEvent } from "../db/events.js";
import * as ws from "../waterservice/client.js";
import { sendTemplate } from "../kapso/send.js";
import { localDatePlusDays, toWsDate } from "../time.js";

const SYNC_WATERMARK_KEY = "debt_sync_desde";
export const DEBT_REMINDER_TEMPLATE = "debt_reminder"; // pre-approved utility template

/** 1. Nightly incremental sync of balance deltas via #28 (paginated, idempotent). */
export async function handleDebtSync(
  _payload: Record<string, unknown>,
  db: DB,
): Promise<void> {
  const desde =
    kvGet(db, SYNC_WATERMARK_KEY) ?? toWsDate(new Date(Date.now() - 30 * 86_400_000));
  const balances = new Map<number, number>();
  let pagina = 1;
  for (;;) {
    const page = await ws.obtenerFacturasConSaldoModificado(desde, pagina);
    for (const f of page.Facturas) {
      balances.set(f.cliente_id, (balances.get(f.cliente_id) ?? 0) + f.saldoPendiente);
    }
    if (!page.HasMore) break;
    pagina++;
  }
  const upsert = db.prepare(
    `INSERT INTO debt_balances (waterservice_client_id, balance, updated_at)
     VALUES (?, ?, ?)
     ON CONFLICT(waterservice_client_id) DO UPDATE SET balance = excluded.balance, updated_at = excluded.updated_at`,
  );
  const now = new Date().toISOString();
  for (const [clientId, balance] of balances) {
    upsert.run(String(clientId), balance, now);
  }
  kvSet(db, SYNC_WATERMARK_KEY, toWsDate(new Date()));
}

interface Candidate {
  waterservice_client_id: string;
  balance: number;
  phone: string;
  lead_id: string;
  source: string;
  city: string;
}

/** 2–4. Morning selection + #21 re-check + template send. */
export async function handleDebtSend(
  _payload: Record<string, unknown>,
  db: DB,
): Promise<void> {
  const tomorrow = localDatePlusDays(1); // AR-local "tomorrow" (guardrail)
  const cooldownCutoff = new Date(
    Date.now() - config.DEBT_REMINDER_COOLDOWN_DAYS * 86_400_000,
  ).toISOString();

  const candidates = db
    .prepare(
      `SELECT d.waterservice_client_id, d.balance, l.phone, l.lead_id, l.source, l.city
       FROM debt_balances d
       JOIN leads l ON l.waterservice_client_id = d.waterservice_client_id
       WHERE d.balance > ?
         AND l.phone NOT IN (SELECT phone FROM debt_suppressions)
         AND d.waterservice_client_id NOT IN (
           SELECT waterservice_client_id FROM debt_reminders WHERE last_sent_at > ?
         )`,
    )
    .all(config.DEBT_THRESHOLD, cooldownCutoff) as Candidate[];

  for (const c of candidates) {
    const clientId = Number(c.waterservice_client_id);

    // Visit must be tomorrow (from #8's fechaProximaVisita1).
    let detail;
    try {
      detail = await ws.obtenerDatosCliente(clientId);
    } catch {
      continue;
    }
    if (detail.fechaProximaVisita1 !== tomorrow) continue;

    // Re-check the balance right before sending (#21) — never remind someone
    // who just paid.
    let saldos;
    try {
      saldos = await ws.obtenerSaldosDeCliente(clientId);
    } catch {
      continue;
    }
    if (saldos.saldoCuentaFacturacion <= config.DEBT_THRESHOLD) continue;

    await sendTemplate(config.WHATSAPP_NUMBER_SUPPORT, c.phone, DEBT_REMINDER_TEMPLATE, [
      `$${saldos.saldoCuentaFacturacion}`,
    ]);
    db.prepare(
      `INSERT INTO debt_reminders (waterservice_client_id, last_sent_at) VALUES (?, ?)
       ON CONFLICT(waterservice_client_id) DO UPDATE SET last_sent_at = excluded.last_sent_at`,
    ).run(c.waterservice_client_id, new Date().toISOString());
    emitEvent(db, {
      lead_id: c.lead_id,
      source: c.source,
      city: c.city,
      event_type: "debt_reminder_sent",
      metadata: { balance: saldos.saldoCuentaFacturacion },
    });
  }
}

/** 6. Opt-out → suppression list (01 §8). */
export function suppressDebtReminders(db: DB, phone: string, leadId: string, source: string): void {
  db.prepare("INSERT OR IGNORE INTO debt_suppressions (phone) VALUES (?)").run(phone);
  emitEvent(db, { lead_id: leadId, source, event_type: "opt_out" });
}

/** 5. Opportunistic mention: balance note when a debtor writes ($0, open window). */
export async function debtBalanceOf(db: DB, waterserviceClientId: string): Promise<number> {
  const row = db
    .prepare("SELECT balance FROM debt_balances WHERE waterservice_client_id = ?")
    .get(waterserviceClientId) as { balance: number } | undefined;
  return row?.balance ?? 0;
}

/** 7. "Ya pagué" verification via #14 (last 30 days). */
export async function hasRecentPayment(waterserviceClientId: string): Promise<boolean> {
  const recibos = await ws.obtenerRecibosDeCobros(
    Number(waterserviceClientId),
    toWsDate(new Date(Date.now() - 30 * 86_400_000)),
    toWsDate(new Date()),
  );
  return recibos.length > 0;
}
