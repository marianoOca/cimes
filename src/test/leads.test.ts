// Early lead capture (04-website §5): the wizard's first step (delivery data) saves
// who the visitor is and where they live, before a cart or a coverage result exists.
// The point of the endpoint is that it is *inert* — a row and an event, nothing that
// reaches WaterService, Sheets, Chatwoot, or the follow-up timers — so most of what
// these tests assert is what it does NOT do.
import { describe, expect, it } from "vitest";

import { openDb } from "../src/db/db.js";
import { getLeadByPhone } from "../src/db/leads.js";
import { recordWebLead } from "../src/api/leads.js";

const input = {
  name: "Ana Prueba",
  phone: "2324555222",
  city: "Luján",
  address: "Rivadavia 770, 3 B",
  cross_streets: "Mitre y Lavalle",
  attribution: { utm_source: "ig", utm_campaign: "verano" },
};

describe("web lead capture (wizard step 1)", () => {
  it("saves contact + address at datos_entrega, with nothing queued", () => {
    const db = openDb(":memory:");
    recordWebLead(db, input);

    const lead = getLeadByPhone(db, "2324555222")!;
    expect(lead.source).toBe("web");
    expect(lead.name).toBe("Ana Prueba");
    expect(lead.city).toBe("Luján");
    expect(lead.address).toBe("Rivadavia 770, 3 B"); // piso folded in by the client
    expect(lead.cross_streets).toBe("Mitre y Lavalle");
    // Set explicitly: stageFromKnownData assumes product-before-address and would
    // call an address-but-no-cart lead "producto".
    expect(lead.stage).toBe("datos_entrega");
    // No order yet, so nothing about one is recorded and the AI stays on.
    expect(lead.product).toBe("");
    expect(lead.dispenser).toBe("ninguno"); // the dispenser step comes later

    expect(lead.ai_enabled).toBe(true);
    expect(lead.labels).toEqual([]);

    // The inert part: no sheet row, no CRM mirror, no follow-up timers.
    const jobs = db.prepare("SELECT type FROM jobs").all();
    expect(jobs).toEqual([]);
  });

  it("records the ad attribution on the lead_created event", () => {
    const db = openDb(":memory:");
    recordWebLead(db, input);
    const row = db
      .prepare("SELECT metadata FROM events WHERE event_type='lead_created'")
      .get() as { metadata: string };
    expect(JSON.parse(row.metadata).attribution).toMatchObject({
      utm_source: "ig",
      utm_campaign: "verano",
    });
  });

  it("is keyed by phone: re-submitting the step updates one lead, doesn't duplicate", () => {
    const db = openDb(":memory:");
    recordWebLead(db, input);
    // Back, corrected the address, Continuar again.
    recordWebLead(db, { ...input, address: "Rivadavia 880" });

    const leads = db.prepare("SELECT lead_id FROM leads").all();
    expect(leads).toHaveLength(1);
    const created = db.prepare("SELECT id FROM events WHERE event_type='lead_created'").all();
    expect(created).toHaveLength(1); // only the first submit is a creation
    expect(getLeadByPhone(db, "2324555222")!.address).toBe("Rivadavia 880");
  });

  it("keeps the known name when a later submit sends an empty one", () => {
    const db = openDb(":memory:");
    recordWebLead(db, input);
    recordWebLead(db, { ...input, name: "" });
    expect(getLeadByPhone(db, "2324555222")!.name).toBe("Ana Prueba");
  });
});
