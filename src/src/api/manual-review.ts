// Flow B (website), covered-city / no-delivery-time capture (04-website §5): a visitor
// whose covered-city address has no serviceable route (no time we can offer) is saved as
// a lead and handed to a human via `enterManualReview` (AI off, `revision_cobertura`,
// Chatwoot + operator ping). Any BA city can land here now — coverage is decided
// by WaterService neighbours at the address step, not by a city list.
import type { DB } from "../db/db.js";
import { emitEvent } from "../db/events.js";
import { getOrCreateLead, updateLead } from "../db/leads.js";
import { enqueue } from "../jobs/queue.js";
import { enterManualReview } from "../engine/manual-review.js";

export interface ManualReviewInput {
  name: string;
  phone: string;
  city: string;
  address: string;
  cross_streets?: string;
  items: { product: string; qty: number }[];
  attribution?: Record<string, string | undefined>;
}

/** Persist a covered-city / no-time lead and hand it to a human for a manual decision. */
export async function recordManualReviewLead(db: DB, input: ManualReviewInput) {
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
      metadata: { attribution: input.attribution ?? {}, manual_review: true },
    });
  }
  const summary = input.items.map((i) => `${i.qty}x ${i.product}`).join(", ");
  const lead = updateLead(db, created.lead_id, {
    name: input.name || created.name,
    city: input.city,
    address: input.address,
    cross_streets: input.cross_streets ?? created.cross_streets,
    product: summary,
  });
  // Lead-only sheet row so the case surfaces in analytics too (idempotent per lead).
  enqueue(
    db,
    "sheet_append_order",
    new Date(),
    { lead_id: lead.lead_id, order_id: null, label: "revision_cobertura" },
    `sheet_manual_review:${lead.lead_id}`,
  );
  await enterManualReview(db, lead);
  return lead;
}
