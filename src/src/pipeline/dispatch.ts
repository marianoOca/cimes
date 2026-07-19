// Dispatch scheduler (01 §4.5/§4.6): a daily scan that fires #3 (driver
// ticket, "Visita por alta") the day BEFORE delivery, reading each order's
// CURRENT state at dispatch time — operator edits up to then are picked up.
import { config } from "../config.js";
import type { DB } from "../db/db.js";
import { getLeadById, updateLead } from "../db/leads.js";
import { markDispatched } from "../db/orders.js";
import { ordersPendingForDate } from "../db/orders-update.js";
import { enqueue } from "../jobs/queue.js";
import * as ws from "../waterservice/client.js";
import { localDatePlusDays, toWsDate } from "../time.js";
import { notifyOperator } from "../engine/notify.js";
import { copy } from "../copy.es-AR.js";

/** Job handler: scan orders due tomorrow and dispatch each as its own job. */
export async function handleDispatchScan(
  _payload: Record<string, unknown>,
  db: DB,
): Promise<void> {
  const tomorrow = localDatePlusDays(1);
  for (const order of ordersPendingForDate(db, tomorrow)) {
    enqueue(
      db,
      "dispatch_order",
      new Date(),
      { order_id: order.id },
      `dispatch:${order.id}`,
    );
  }
}

export async function handleDispatchOrder(
  payload: Record<string, unknown>,
  db: DB,
): Promise<void> {
  const orderId = String(payload.order_id);
  // Read CURRENT state — never cached from confirmation time (guardrail).
  const order = ordersPendingForDate(db, localDatePlusDays(1)).find(
    (o) => o.id === orderId,
  );
  if (!order) return; // edited to another date, dispatched, or cancelled
  const lead = getLeadById(db, order.lead_id);
  if (!lead?.waterservice_client_id) {
    await notifyOperator(
      copy.operatorFailureAlert(
        lead?.phone ?? order.lead_id,
        `pedido ${orderId} sin cliente WaterService al despachar`,
      ),
    );
    return;
  }

  // Usual driver from the nearest neighbor, read at dispatch time (01 §1.1 #3).
  let driverId: number | null = null;
  if (order.neighbor_client_id) {
    try {
      const neighbor = await ws.obtenerDatosCliente(order.neighbor_client_id);
      driverId = neighbor.usuarioRepartidorHabitual ?? null;
    } catch {
      driverId = null; // fall through to group/unassigned
    }
  }

  const centroId = Number(
    config.WS_CENTRO_DISTRIBUCION_MAP[lead.city.toLowerCase()] ?? 0,
  );
  const deliveryDate = new Date(`${order.delivery_date}T12:00:00-03:00`);
  const ticketId = await ws.crearTicket({
    centroDistribucionId: centroId,
    clienteId: Number(lead.waterservice_client_id),
    titulo: `Visita por alta — ${lead.name || lead.phone}`,
    descripcionHtml: `<p>Producto: ${order.product}</p><p>Horario: ${order.delivery_window}</p><p>Monto a cobrar: $${order.amount_to_collect}</p>`,
    fechaCierreEstimado: toWsDate(deliveryDate),
    tipoIncidenteId: config.WS_INCIDENT_TYPE_ID,
    subTipoIncidenteId: config.WS_INCIDENT_SUBTYPE_ID,
    severidadId: config.WS_SEVERITY_ID,
    usuarioResponsableId: driverId,
    grupoResponsableIds: null, // mutually exclusive with usuarioResponsable_id
  });

  markDispatched(db, orderId, String(ticketId));
  updateLead(db, lead.lead_id, { ticket_id: String(ticketId), sync_status: "synced" });
  if (order.sheet_row) {
    enqueue(db, "sheet_update_ticket", new Date(), {
      row: order.sheet_row,
      ticket_id: String(ticketId),
    });
  }
}
