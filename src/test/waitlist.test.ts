// Out-of-coverage waitlist capture (04-website §5): recordWaitlistLead persists
// an `otra_ciudad` lead and queues its sheet row, reusing the shared lead/sheet
// machinery. Unit-level (in-memory db), same style as jobs/pipeline tests.
import { describe, expect, it } from "vitest";
import { openDb } from "../src/db/db.js";
import { getLeadByPhone } from "../src/db/leads.js";
import { recordWaitlistLead } from "../src/api/waitlist.js";

describe("waitlist: uncovered-area lead capture", () => {
  it("records an otra_ciudad lead with zone + comment and queues a sheet row", () => {
    const db = openDb(":memory:");
    recordWaitlistLead(db, {
      name: "Ana Prueba",
      phone: "2324555000",
      city: "Navarro",
      comment: "Vivo a 3 cuadras de la plaza",
      attribution: { utm_source: "ig" },
    });

    const lead = getLeadByPhone(db, "2324555000");
    expect(lead).not.toBeNull();
    expect(lead!.name).toBe("Ana Prueba");
    expect(lead!.city).toBe("Navarro"); // free-text zone stored in city
    expect(lead!.notes).toBe("Vivo a 3 cuadras de la plaza"); // comentario stored in notes
    expect(lead!.source).toBe("web");
    expect(lead!.labels).toContain("otra_ciudad");

    const jobs = db
      .prepare("SELECT payload FROM jobs WHERE type = 'sheet_append_order'")
      .all() as { payload: string }[];
    expect(jobs).toHaveLength(1);
    const payload = JSON.parse(jobs[0]!.payload);
    expect(payload).toMatchObject({ order_id: null, label: "otra_ciudad" });
    expect(payload.lead_id).toBe(lead!.lead_id);
  });

  it("emits lead_created once and dedupes the sheet row for a repeat submit", () => {
    const db = openDb(":memory:");
    recordWaitlistLead(db, { name: "Ana", phone: "2324555111", city: "Navarro" });
    recordWaitlistLead(db, { name: "Ana", phone: "2324555111", city: "Navarro" });

    const created = db
      .prepare("SELECT id FROM events WHERE event_type = 'lead_created'")
      .all();
    expect(created).toHaveLength(1);
    const sheetJobs = db
      .prepare("SELECT id FROM jobs WHERE type = 'sheet_append_order'")
      .all();
    expect(sheetJobs).toHaveLength(1); // dedupe_key sheet_waitlist:<lead_id>
  });
});
