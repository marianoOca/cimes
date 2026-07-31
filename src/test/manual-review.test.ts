// Manual-review handoff (04-website §5 / 01 §4.5): a covered-city lead we can't offer a
// delivery time is saved + handed to a human (AI off, `revision_cobertura`, CRM + operator
// ping). Website path via recordManualReviewLead; WhatsApp path via the inbound sentinel.
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
}));

import { openDb } from "../src/db/db.js";
import { getLeadByPhone } from "../src/db/leads.js";
import { recordManualReviewLead } from "../src/api/manual-review.js";
import { MANUAL_REVIEW_TAG } from "../src/engine/manual-review.js";
import { handleInbound } from "../src/engine/conversation.js";
import { setGeocodingProvider } from "../src/engine/coverage.js";
import { setPriceProvider } from "../src/ai/tools.js";
import { sendText } from "../src/kapso/send.js";
import type { NormalizedInbound } from "../src/kapso/webhook.js";

// Providers are never reached on the paths under test, but stub them so nothing touches
// the real WaterService default provider.
setPriceProvider({
  getCatalog: async () => ({ price_list: "5", products: [] }),
  getPricesForList: async () => ({ price_list: "5", products: [] }),
});
setGeocodingProvider({
  resolve: async () => ({
    covered: false,
    coordinates: null,
    price_list: null,
    delivery_options: [],
    nearest_client_id: null,
  }),
});

const input = {
  name: "Ana Prueba",
  phone: "2324555222",
  city: "luján",
  address: "Rivadavia 770",
  cross_streets: "Mitre y Lavalle",
  items: [
    { product: "Bidon x 20 lts", qty: 2 },
    { product: "Soda sifón", qty: 1 },
  ],
};

describe("manual review — website capture (covered city, no delivery time)", () => {
  beforeEach(() => vi.clearAllMocks());

  it("saves the lead, turns AI off, labels revision_cobertura, queues a sheet row", async () => {
    const db = openDb(":memory:");
    await recordManualReviewLead(db, input);

    const lead = getLeadByPhone(db, "2324555222");
    expect(lead).not.toBeNull();
    expect(lead!.source).toBe("web");
    expect(lead!.city).toBe("luján");
    expect(lead!.address).toBe("Rivadavia 770");
    expect(lead!.product).toBe("2x Bidon x 20 lts, 1x Soda sifón"); // items summarized
    expect(lead!.ai_enabled).toBe(false); // human owns it now
    expect(lead!.labels).toContain("revision_cobertura");

    const sheet = db
      .prepare("SELECT COUNT(*) n FROM jobs WHERE type='sheet_append_order'")
      .get() as { n: number };
    expect(sheet.n).toBe(1);
  });

  it("is idempotent per phone — repeat submit doesn't duplicate lead/label/sheet", async () => {
    const db = openDb(":memory:");
    await recordManualReviewLead(db, input);
    await recordManualReviewLead(db, input);

    const created = db
      .prepare("SELECT id FROM events WHERE event_type='lead_created'")
      .all();
    expect(created).toHaveLength(1);
    const sheet = db.prepare("SELECT id FROM jobs WHERE type='sheet_append_order'").all();
    expect(sheet).toHaveLength(1); // dedupe_key sheet_manual_review:<lead_id>
    const lead = getLeadByPhone(db, "2324555222")!;
    expect(lead.labels.filter((l) => l === "revision_cobertura")).toHaveLength(1);
  });
});

describe("manual review — WhatsApp sentinel fallback", () => {
  beforeEach(() => vi.clearAllMocks());

  it("an inbound carrying [REV-COB] flips an AI-on lead to manual review, AI stays silent", async () => {
    const db = openDb(":memory:");
    await handleInbound(db, {
      messageId: "wamid.rev1",
      from: "5491133344455",
      phoneNumberId: "PN1",
      kind: "text",
      content: `Hola, quiero coordinar mi entrega ${MANUAL_REVIEW_TAG}`,
    } as NormalizedInbound);

    const lead = getLeadByPhone(db, "5491133344455")!;
    expect(lead.ai_enabled).toBe(false);
    expect(lead.labels).toContain("revision_cobertura");
    // Only the human-handoff acknowledgement went out — no AI sales flow kicked in.
    expect(vi.mocked(sendText).mock.calls).toHaveLength(1);
  });
});
