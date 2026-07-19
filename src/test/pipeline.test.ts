import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../src/kapso/send.js", () => ({
  sendText: vi.fn(async () => "wamid.out"),
  sendButtons: vi.fn(async () => "wamid.out"),
  sendList: vi.fn(async () => "wamid.out"),
  sendFlow: vi.fn(async () => "wamid.out"),
  sendTemplate: vi.fn(async () => "wamid.out"),
}));

vi.mock("../src/waterservice/client.js", () => ({
  busquedaRapidaPorTelefono: vi.fn(async () => []),
  crearNuevoClientePorChatBot: vi.fn(async () => 1042),
  createContacto: vi.fn(async () => undefined),
  obtenerDatosCliente: vi.fn(async () => ({
    cliente_id: 802,
    usuarioRepartidorHabitual: 13886,
  })),
  crearTicket: vi.fn(async () => 10190),
}));

import { openDb } from "../src/db/db.js";
import { createLead, getLeadById, updateLead } from "../src/db/leads.js";
import { confirmOrder } from "../src/pipeline/orders.js";
import { handleDispatchOrder } from "../src/pipeline/dispatch.js";
import { getOrder, updatePendingOrder } from "../src/db/orders.js";
import { localDatePlusDays } from "../src/time.js";
import * as ws from "../src/waterservice/client.js";

const coverage = {
  covered: true,
  coordinates: { lat: -34.6, lng: -59.4 },
  price_list: "5",
  delivery_options: [
    {
      reparto_id: 19,
      route: "19",
      weekday: "sábado",
      hour_min: "10",
      hour_max: "13",
      time_window: "entre 10 y 13",
    },
  ],
  nearest_client_id: 802,
};

function readyLead(db: ReturnType<typeof openDb>) {
  const lead = createLead(db, { phone: "5491100000009", source: "whatsapp" });
  return updateLead(db, lead.lead_id, {
    name: "Ana Prueba",
    city: "luján",
    address: "Rivadavia 770",
    cross_streets: "Mitre y Lavalle",
    product: "Bidon x 20 lts",
    price: 800,
    price_list: "5",
    route: "19",
    delivery_day: "sábado",
    delivery_window: "entre 10 y 13",
    stage: "confirmacion",
    coverage_json: JSON.stringify(coverage),
  });
}

describe("order confirmation pipeline (01 §4.5)", () => {
  beforeEach(() => vi.clearAllMocks());

  it("creates client + contact, labels cliente_cerrado, schedules ticket for dispatch", async () => {
    const db = openDb(":memory:");
    const lead = readyLead(db);
    const result = await confirmOrder(db, lead.lead_id);

    expect(ws.busquedaRapidaPorTelefono).toHaveBeenCalledWith(lead.phone);
    expect(ws.crearNuevoClientePorChatBot).toHaveBeenCalledOnce();
    expect(ws.createContacto).toHaveBeenCalledOnce();
    expect(ws.crearTicket).not.toHaveBeenCalled(); // #3 fires at dispatch, not here

    expect(result.sync_status).toBe("synced");
    expect(result.waterservice_client_id).toBe("1042");
    const fresh = getLeadById(db, lead.lead_id)!;
    expect(fresh.stage).toBe("cliente_cerrado");
    expect(fresh.labels).toContain("cliente_cerrado");
    expect(getOrder(db, result.order.id)!.status).toBe("pending_dispatch");
    // Sheet append queued.
    const sheetJobs = db
      .prepare("SELECT COUNT(*) n FROM jobs WHERE type='sheet_append_order'")
      .get() as { n: number };
    expect(sheetJobs.n).toBe(1);
  });

  it("is idempotent per lead — replay creates no duplicate client/order", async () => {
    const db = openDb(":memory:");
    const lead = readyLead(db);
    const first = await confirmOrder(db, lead.lead_id);
    const second = await confirmOrder(db, lead.lead_id);
    expect(second.order.id).toBe(first.order.id);
    expect(ws.crearNuevoClientePorChatBot).toHaveBeenCalledOnce();
    const orders = db.prepare("SELECT COUNT(*) n FROM orders").get() as { n: number };
    expect(orders.n).toBe(1);
  });

  it("reuses an existing WaterService client found by phone (#2 dedupe)", async () => {
    const db = openDb(":memory:");
    vi.mocked(ws.busquedaRapidaPorTelefono).mockResolvedValueOnce([
      { cliente_id: 53 } as never,
    ]);
    const lead = readyLead(db);
    const result = await confirmOrder(db, lead.lead_id);
    expect(result.waterservice_client_id).toBe("53");
    expect(ws.crearNuevoClientePorChatBot).not.toHaveBeenCalled();
  });

  it("on WaterService failure: queues retry, sets sync_status=failed, keeps the order", async () => {
    const db = openDb(":memory:");
    vi.mocked(ws.crearNuevoClientePorChatBot).mockRejectedValueOnce(new Error("outage"));
    const lead = readyLead(db);
    const result = await confirmOrder(db, lead.lead_id);
    expect(result.sync_status).toBe("failed");
    const retry = db
      .prepare("SELECT COUNT(*) n FROM jobs WHERE type='order_sync_retry'")
      .get() as { n: number };
    expect(retry.n).toBe(1);
    // Replay succeeds without duplicating anything.
    const replay = await confirmOrder(db, lead.lead_id);
    expect(replay.sync_status).toBe("synced");
    expect(replay.order.id).toBe(result.order.id);
  });
});

describe("dispatch scheduler (01 §4.5/§4.6)", () => {
  beforeEach(() => vi.clearAllMocks());

  it("dispatches with the order's CURRENT state and stores ticket_id", async () => {
    const db = openDb(":memory:");
    const lead = readyLead(db);
    const { order } = await confirmOrder(db, lead.lead_id);
    // Operator edit before dispatch: move delivery to tomorrow.
    updatePendingOrder(db, order.id, { delivery_date: localDatePlusDays(1) });

    await handleDispatchOrder({ order_id: order.id }, db);
    const dispatched = getOrder(db, order.id)!;
    expect(dispatched.status).toBe("dispatched");
    expect(dispatched.ticket_id).toBe("10190");
    expect(getLeadById(db, lead.lead_id)!.ticket_id).toBe("10190");
    // Driver resolved from the nearest neighbor at dispatch time.
    expect(ws.obtenerDatosCliente).toHaveBeenCalledWith(802);
    expect(ws.crearTicket).toHaveBeenCalledWith(
      expect.objectContaining({ usuarioResponsableId: 13886, grupoResponsableIds: null }),
    );
  });

  it("skips orders not due tomorrow (edited away)", async () => {
    const db = openDb(":memory:");
    const lead = readyLead(db);
    const { order } = await confirmOrder(db, lead.lead_id);
    updatePendingOrder(db, order.id, { delivery_date: localDatePlusDays(5) });
    await handleDispatchOrder({ order_id: order.id }, db);
    expect(ws.crearTicket).not.toHaveBeenCalled();
    expect(getOrder(db, order.id)!.status).toBe("pending_dispatch");
  });
});
