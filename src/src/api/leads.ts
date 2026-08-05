// Flow B (website), early lead capture (04-website §5): the data step is the first
// screen of the wizard, and submitting it saves who the visitor is and where they
// live — before a dispenser, a cart or a coverage check exist. Everyone who drops
// out after this point stays reachable; before this change nothing was persisted
// until the coverage call, four screens later.
//
// Deliberately inert: a `leads` row and its `lead_created` event, nothing else. No
// Sheet row, no Chatwoot mirror, no WaterService call, and no follow-up timers
// (`scheduleFollowups` only ever runs off an inbound WhatsApp message).
import type { DB } from "../db/db.js";
import { emitEvent } from "../db/events.js";
import { getOrCreateLead, updateLead } from "../db/leads.js";

export interface WebLeadInput {
  name: string;
  phone: string;
  city: string;
  address: string;
  cross_streets?: string;
  attribution?: Record<string, string | undefined>;
}

/** Persist a half-finished web signup. Keyed by phone, so it's safe to call twice. */
export function recordWebLead(db: DB, input: WebLeadInput) {
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
      metadata: { attribution: input.attribution ?? {}, web_signup: true },
    });
  }
  // Stage is set explicitly, as the Instagram lead path does: `stageFromKnownData`
  // assumes product-before-address and would call this "producto", but a web lead
  // with an address and no cart isn't a shape that linear machine models.
  return updateLead(db, created.lead_id, {
    name: input.name || created.name,
    city: input.city,
    address: input.address,
    cross_streets: input.cross_streets ?? created.cross_streets,
    stage: "datos_entrega",
  });
}
