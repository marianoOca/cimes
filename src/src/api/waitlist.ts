// Flow B (website), "Otra ciudad" waitlist: an out-of-coverage visitor leaves
// their contact so we reach out when we add their zone. Records a lead labeled
// `otra_ciudad` and queues a row to the orders sheet (04-website §5). Reuses the
// same lead + sheet-append machinery as the Instagram lead path (instagram.ts).
import type { DB } from "../db/db.js";
import { emitEvent } from "../db/events.js";
import { addLabel, getOrCreateLead, updateLead } from "../db/leads.js";
import { enqueue } from "../jobs/queue.js";

export interface WaitlistInput {
  name: string;
  phone: string;
  city: string; // free-text city/zone the visitor typed (not one of the 7 covered)
  comment?: string;
  attribution?: Record<string, string | undefined>;
}

/** Persist an uncovered-area waitlist lead (label `otra_ciudad`) + queue its sheet row. */
export function recordWaitlistLead(db: DB, input: WaitlistInput) {
  const { lead: created, created: isNew } = getOrCreateLead(db, {
    phone: input.phone,
    source: "web",
    name: input.name,
  });
  if (isNew) {
    emitEvent(db, {
      lead_id: created.lead_id,
      source: "web",
      city: input.city,
      event_type: "lead_created",
      metadata: { attribution: input.attribution ?? {}, waitlist: true },
    });
  }
  const lead = updateLead(db, created.lead_id, {
    name: input.name || created.name,
    city: input.city,
    notes: input.comment || created.notes,
  });
  addLabel(db, lead.lead_id, "otra_ciudad");
  // Lead-only sheet row (order_id null → appendOrderRow tolerates it), same as IG leads.
  enqueue(
    db,
    "sheet_append_order",
    new Date(),
    { lead_id: lead.lead_id, order_id: null, label: "otra_ciudad" },
    `sheet_waitlist:${lead.lead_id}`,
  );
  return lead;
}
