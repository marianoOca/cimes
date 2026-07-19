// Order confirmation pipeline (01 §4.5) — the single closer behind every
// source (Flow A confirm, Flow B web, tool confirm_order). Idempotent per
// lead; #3 (driver ticket) is NOT called here — the dispatch scheduler fires
// it the day before delivery, reading the order's CURRENT state (guardrail).
import { config } from "../config.js";
import { copy } from "../copy.es-AR.js";
import type { DB } from "../db/db.js";
import { emitEvent } from "../db/events.js";
import { addLabel, getLeadById, updateLead, type Lead } from "../db/leads.js";
import {
  createOrder,
  getPendingOrderForLead,
  type Order,
} from "../db/orders.js";
import { setOrderNeighborClient } from "../db/orders-update.js";
import { enqueue } from "../jobs/queue.js";
import * as ws from "../waterservice/client.js";
import { localDatePlusDays, localWeekdayEs } from "../time.js";
import type { CoverageResult } from "../providers/types.js";
import { mirrorLeadSync } from "../crm/mirror.js";
import { notifyOperator } from "../engine/notify.js";

export interface ConfirmResult {
  order: Order;
  waterservice_client_id: string;
  sync_status: "synced" | "pending" | "failed";
}

/** Next AR-local date (YYYY-MM-DD) whose weekday matches, searching 1..7 days ahead. */
export function nextDateForWeekday(weekday: string): string {
  const target = weekday
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
  for (let i = 1; i <= 7; i++) {
    const date = new Date(Date.now() + i * 86_400_000);
    const name = localWeekdayEs(date).normalize("NFD").replace(/[̀-ͯ]/g, "");
    if (name === target) return localDatePlusDays(i);
  }
  // Unknown weekday string — deliver in a week; operator can edit until dispatch.
  return localDatePlusDays(7);
}

function coverageOf(lead: Lead): CoverageResult | null {
  if (!lead.coverage_json) return null;
  try {
    return JSON.parse(lead.coverage_json) as CoverageResult;
  } catch {
    return null;
  }
}

/**
 * Run the pipeline for a lead whose order fields are already on the record.
 * Safe to re-run (retry queue): existing ids are reused, never re-created.
 */
export async function confirmOrder(db: DB, leadId: string): Promise<ConfirmResult> {
  let lead = getLeadById(db, leadId);
  if (!lead) throw new Error(`confirmOrder: lead ${leadId} not found`);

  // Idempotency: one pending order per lead.
  let order = getPendingOrderForLead(db, leadId);
  if (!order) {
    const price = lead.price ?? 0;
    order = createOrder(db, {
      lead_id: leadId,
      product: lead.product,
      price,
      amount_to_collect: price,
      route: lead.route,
      delivery_day: lead.delivery_day,
      delivery_window: lead.delivery_window,
      delivery_date: nextDateForWeekday(lead.delivery_day),
    });
    const coverage = coverageOf(lead);
    if (coverage?.nearest_client_id) {
      setOrderNeighborClient(db, order.id, coverage.nearest_client_id);
    }
  }

  let syncStatus: "synced" | "failed" = "synced";
  try {
    // 1. Dedupe: existing WaterService client by phone (#2) before alta.
    if (!lead.waterservice_client_id) {
      const existing = await ws.busquedaRapidaPorTelefono(lead.phone);
      const found = existing[0];
      if (found) {
        lead = updateLead(db, leadId, {
          waterservice_client_id: String(found.cliente_id),
        });
      }
    }

    // 2. Alta (#6) with reparto/list/coords from the coverage result.
    if (!lead.waterservice_client_id) {
      const coverage = coverageOf(lead);
      const repartoId =
        coverage?.delivery_options.find((o) => o.weekday === lead!.delivery_day)
          ?.reparto_id ?? coverage?.delivery_options[0]?.reparto_id;
      if (!coverage?.coordinates || !repartoId || !lead.price_list) {
        throw new Error("missing coverage data for alta (run coverage first)");
      }
      const clienteId = await ws.crearNuevoClientePorChatBot({
        nombre: lead.name || lead.phone,
        telefono: lead.phone,
        listaDePreciosId: Number(lead.price_list),
        repartoId,
        domicilio: {
          provincia: "Buenos Aires",
          ciudad: lead.city,
          calle: lead.address,
          puerta: "",
          observaciones: lead.cross_streets
            ? `Entre calles: ${lead.cross_streets}. ${lead.notes}`
            : lead.notes,
          latitud: String(coverage.coordinates.lat),
          longitud: String(coverage.coordinates.lng),
        },
      });
      lead = updateLead(db, leadId, { waterservice_client_id: String(clienteId) });

      // 3. Attach the WhatsApp number (#7).
      await ws.createContacto({
        clienteId,
        nombrePersona: lead.name || lead.phone,
        celular: lead.phone,
      });
    }
  } catch (err) {
    // Never silently drop a confirmed order: queue a replay + notify operator.
    syncStatus = "failed";
    const detail = err instanceof Error ? err.message : String(err);
    enqueue(
      db,
      "order_sync_retry",
      new Date(Date.now() + 60_000),
      { lead_id: leadId },
      `order_sync:${leadId}`,
    );
    await notifyOperator(copy.operatorFailureAlert(lead.phone, detail));
  }

  // 4. Ticket (#3) is scheduled, not fired: daily dispatch scan picks it up.

  // 5. Sheet row (queued; retried independently of WaterService).
  enqueue(
    db,
    "sheet_append_order",
    new Date(),
    { lead_id: leadId, order_id: order.id, label: "cliente_cerrado" },
    `sheet_order:${order.id}`,
  );

  // 6. Label + stage.
  if (addLabel(db, leadId, "cliente_cerrado")) {
    emitEvent(db, {
      lead_id: leadId,
      source: lead.source,
      city: lead.city,
      event_type: "label_applied",
      stage: lead.stage,
      metadata: { label: "cliente_cerrado" },
    });
  }
  lead = updateLead(db, leadId, {
    stage: "cliente_cerrado",
    sync_status: syncStatus,
  });

  // 8. Event. (7 — the confirmation message — is sent by the caller, which
  // knows the channel: WhatsApp reply vs optional web template.)
  emitEvent(db, {
    lead_id: leadId,
    source: lead.source,
    city: lead.city,
    event_type: "order_confirmed",
    stage: "cliente_cerrado",
    metadata: { order_id: order.id, sync_status: syncStatus },
  });
  mirrorLeadSync(db, lead);

  return {
    order,
    waterservice_client_id: lead.waterservice_client_id ?? "",
    sync_status: syncStatus,
  };
}

/** Optional web-order confirmation template (01 §4.2 step 6), pipeline-decided. */
export function maybeSendWebConfirmation(db: DB, lead: Lead, order: Order): void {
  if (!config.WEB_CONFIRMATION_TEMPLATE) return;
  enqueue(db, "send_web_confirmation", new Date(), {
    lead_id: lead.lead_id,
    day: order.delivery_day,
    window: order.delivery_window,
  });
}
