import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../src/kapso/send.js", () => ({
  sendText: vi.fn(async () => "wamid.out"),
  sendButtons: vi.fn(async () => "wamid.out"),
  sendList: vi.fn(async () => "wamid.out"),
  sendFlow: vi.fn(async () => "wamid.out"),
  sendLocation: vi.fn(async () => "wamid.out"),
  sendTemplate: vi.fn(async () => "wamid.out"),
}));

vi.mock("../src/waterservice/client.js", () => ({
  busquedaRapidaPorTelefono: vi.fn(async () => []),
  crearNuevoClientePorChatBot: vi.fn(async () => 1042),
  createContacto: vi.fn(async () => undefined),
}));

import { openDb } from "../src/db/db.js";
import { getLeadByPhone } from "../src/db/leads.js";
import { handleInbound } from "../src/engine/conversation.js";
import { setGeocodingProvider } from "../src/engine/coverage.js";
import { setPriceProvider } from "../src/ai/tools.js";
import { sendButtons, sendList, sendLocation, sendText } from "../src/kapso/send.js";
import type { NormalizedInbound } from "../src/kapso/webhook.js";

const catalog = {
  price_list: "5",
  products: [
    { id: "1", name: "Bidon x 20 lts", price: 800 },
    { id: "2", name: "Bidon x 12 lts", price: 500 },
    { id: "3", name: "Soda sifón", price: 300 },
    { id: "4", name: "Dispenser frío-calor", price: 30000 },
  ],
};

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

setPriceProvider({
  getCatalog: async () => catalog,
  getPricesForList: async () => catalog,
});
setGeocodingProvider({ resolve: async () => coverage });

let msgSeq = 0;
function inbound(partial: Partial<NormalizedInbound>): NormalizedInbound {
  return {
    messageId: `wamid.${++msgSeq}`,
    from: "5491100000042",
    phoneNumberId: "PN1",
    kind: "text",
    content: "",
    ...partial,
  };
}

describe("conversation engine — Flow A happy path (deterministic, no AI)", () => {
  beforeEach(() => vi.clearAllMocks());

  it("free-text fast path: city + product in the first message skips both pickers", async () => {
    const db = openDb(":memory:");
    await handleInbound(
      db,
      inbound({ content: "hola, soy de Luján, quiero un bidón de 20 litros" }),
    );
    const lead = getLeadByPhone(db, "5491100000042")!;
    expect(lead.city).toBe("luján");
    expect(lead.product).toBe("Bidon x 20 lts");
    expect(lead.price).toBe(800);
    expect(lead.stage).toBe("datos_entrega");
    // Quote sent in the same exchange (producto+price merged).
    const texts = vi.mocked(sendText).mock.calls.map((c) => String(c[2]));
    expect(texts.some((t) => t.includes("800"))).toBe(true);
    // No city list, no product list — steps skipped.
    expect(sendList).not.toHaveBeenCalled();
  });

  it("full guided path: list picks + flow form + day + confirm → order closed", async () => {
    const db = openDb(":memory:");
    const from = "5491100000042";

    // 1. Greeting → city list.
    await handleInbound(db, inbound({ content: "hola" }));
    expect(sendList).toHaveBeenCalledTimes(1); // city list

    // 2. City picked → product list.
    await handleInbound(db, inbound({ kind: "list", content: "city:luján", title: "Luján" }));
    let lead = getLeadByPhone(db, from)!;
    expect(lead.stage).toBe("producto");

    // 3. Product picked → quote + delivery-data prompt.
    await handleInbound(db, inbound({ kind: "list", content: "product:1" }));
    lead = getLeadByPhone(db, from)!;
    expect(lead.stage).toBe("datos_entrega");
    expect(lead.price).toBe(800);

    // 4. Flow form response → coverage runs → map-pin confirmation.
    await handleInbound(
      db,
      inbound({
        kind: "flow",
        flowResponse: {
          nombre: "Ana",
          apellido: "Prueba",
          calle: "Rivadavia",
          altura: "770",
          entre_calles: "Mitre y Lavalle",
        },
      }),
    );
    lead = getLeadByPhone(db, from)!;
    expect(lead.stage).toBe("confirmar_ubicacion");
    expect(lead.address).toBe("Rivadavia 770");
    expect(lead.price_list).toBe("5");
    expect(sendLocation).toHaveBeenCalled(); // map pin sent

    // 4b. Pin confirmed → day options.
    await handleInbound(db, inbound({ kind: "button", content: "loc:yes" }));
    lead = getLeadByPhone(db, from)!;
    expect(lead.stage).toBe("dia_entrega");
    // 1 option → buttons (≤3 → buttons rule).
    expect(sendButtons).toHaveBeenCalled();

    // 5. Day picked → confirmation summary.
    await handleInbound(db, inbound({ kind: "button", content: "day:0" }));
    lead = getLeadByPhone(db, from)!;
    expect(lead.stage).toBe("confirmacion");
    expect(lead.delivery_day).toBe("sábado");

    // 6. Confirm → pipeline → cliente_cerrado.
    await handleInbound(db, inbound({ kind: "button", content: "confirm:yes" }));
    lead = getLeadByPhone(db, from)!;
    expect(lead.stage).toBe("cliente_cerrado");
    expect(lead.labels).toContain("cliente_cerrado");
    expect(lead.waterservice_client_id).toBe("1042");

    // Events captured along the way.
    const events = db
      .prepare("SELECT event_type FROM events WHERE lead_id = ? ORDER BY id")
      .all(lead.lead_id) as { event_type: string }[];
    const types = events.map((e) => e.event_type);
    for (const required of [
      "lead_created",
      "message_in",
      "stage_entered",
      "coverage_checked",
      "order_confirmed",
      "label_applied",
    ]) {
      expect(types).toContain(required);
    }
  });

  it("free-typed address at datos_entrega goes through the map pin (no AI)", async () => {
    const db = openDb(":memory:");
    const from = "5491100000042";
    // Fast-path to datos_entrega.
    await handleInbound(db, inbound({ content: "hola, soy de Luján, quiero un bidón de 20 litros" }));
    expect(getLeadByPhone(db, from)!.stage).toBe("datos_entrega");
    vi.clearAllMocks();

    // Typed address (not the Flow form) → geocode + pin, not the AI.
    await handleInbound(db, inbound({ content: "Rivadavia 770" }));
    const lead = getLeadByPhone(db, from)!;
    expect(lead.stage).toBe("confirmar_ubicacion");
    expect(lead.address).toBe("Rivadavia 770");
    expect(lead.location_attempts).toBe(1);
    expect(sendLocation).toHaveBeenCalled();
  });

  it("map pin rejected twice → free re-entry, then human handoff (web parity)", async () => {
    const db = openDb(":memory:");
    const from = "5491100000042";

    // Fast-path to datos_entrega, then submit the delivery-data form.
    await handleInbound(db, inbound({ content: "hola, soy de Luján, quiero un bidón de 20 litros" }));
    await handleInbound(
      db,
      inbound({
        kind: "flow",
        flowResponse: { nombre: "Ana", calle: "Rivadavia", altura: "770" },
      }),
    );
    let lead = getLeadByPhone(db, from)!;
    expect(lead.stage).toBe("confirmar_ubicacion");
    expect(lead.location_attempts).toBe(1);

    // First "No" → asked to re-type the full address (still attempt 1).
    await handleInbound(db, inbound({ kind: "button", content: "loc:no" }));
    lead = getLeadByPhone(db, from)!;
    expect(lead.stage).toBe("confirmar_ubicacion");
    const reenter = vi.mocked(sendText).mock.calls.map((c) => String(c[2]));
    expect(reenter.some((t) => t.includes("Buenos Aires"))).toBe(true);

    // Re-typed address → second pin (attempt 2).
    await handleInbound(db, inbound({ content: "Luján, San Martín 1234" }));
    lead = getLeadByPhone(db, from)!;
    expect(lead.location_attempts).toBe(2);
    expect(lead.address).toBe("Luján, San Martín 1234");

    // Second "No" → stop and hand to a human.
    vi.clearAllMocks();
    await handleInbound(db, inbound({ kind: "button", content: "loc:no" }));
    lead = getLeadByPhone(db, from)!;
    expect(lead.ai_enabled).toBe(false);
    expect(lead.labels).toContain("revision_cobertura");
    const handoff = vi.mocked(sendText).mock.calls.map((c) => String(c[2]));
    expect(handoff.some((t) => t.includes("verifico la cobertura"))).toBe(true);
  });

  it("uncovered city → otra_ciudad label + polite ending, no follow-ups", async () => {
    const db = openDb(":memory:");
    await handleInbound(db, inbound({ content: "hola, soy de Córdoba, quiero agua" }));
    // "córdoba" doesn't match a covered city — engine greets + shows the list;
    // picking "Otra" closes it.
    await handleInbound(db, inbound({ kind: "list", content: "city:otra", title: "Otra" }));
    const lead = getLeadByPhone(db, "5491100000042")!;
    expect(lead.labels).toContain("otra_ciudad");
    const followups = db
      .prepare("SELECT COUNT(*) n FROM jobs WHERE type='followup' AND status='pending'")
      .get() as { n: number };
    expect(followups.n).toBe(0);
  });

  it("dedupes redelivered webhooks by message id", async () => {
    const db = openDb(":memory:");
    const msg = inbound({ content: "hola" });
    await handleInbound(db, msg);
    await handleInbound(db, msg); // redelivery
    const count = db
      .prepare("SELECT COUNT(*) n FROM events WHERE event_type='message_in'")
      .get() as { n: number };
    expect(count.n).toBe(1);
  });

  it("media inbound gets the mediaFallback copy", async () => {
    const db = openDb(":memory:");
    await handleInbound(db, inbound({ kind: "media" }));
    const texts = vi.mocked(sendText).mock.calls.map((c) => String(c[2]));
    expect(texts.some((t) => t.includes("texto"))).toBe(true);
  });

  it("inbound on an archived conversation unarchives it (03 §2 reopen)", async () => {
    const db = openDb(":memory:");
    await handleInbound(db, inbound({ content: "hola" }));
    const lead = getLeadByPhone(db, "5491100000042")!;
    db.prepare("UPDATE leads SET archived = 1 WHERE lead_id = ?").run(lead.lead_id);
    await handleInbound(db, inbound({ kind: "list", content: "city:luján", title: "Luján" }));
    expect(getLeadByPhone(db, "5491100000042")!.archived).toBe(false);
  });

  it("human-owned conversations (ai_enabled=false) get no auto-reply", async () => {
    const db = openDb(":memory:");
    await handleInbound(db, inbound({ content: "hola" }));
    const lead = getLeadByPhone(db, "5491100000042")!;
    db.prepare("UPDATE leads SET ai_enabled = 0 WHERE lead_id = ?").run(lead.lead_id);
    vi.clearAllMocks();
    await handleInbound(db, inbound({ content: "sigo esperando" }));
    expect(sendText).not.toHaveBeenCalled();
    expect(sendList).not.toHaveBeenCalled();
  });
});
