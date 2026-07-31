// Manual-review handoff (04-website §5 / 01 §4.5): a lead in a *covered* city for
// which we cannot offer any delivery time (no serviceable neighbor/route) is handed to
// a human — AI off, labeled `revision_cobertura`, mirrored to Chatwoot (open + private
// note), operator pinged. Shared by the website endpoint and the WhatsApp bot flow.
import { copy } from "../copy.es-AR.js";
import type { DB } from "../db/db.js";
import { emitEvent } from "../db/events.js";
import { addLabel, updateLead, type Lead } from "../db/leads.js";
import { mirrorConversationOpen, mirrorLeadSync, mirrorPrivateNote } from "../crm/mirror.js";
import { notifyOperator } from "./notify.js";

/** Sentinel embedded in the website's WhatsApp deep-link text; the inbound handler
 *  detects it as a fallback for when phone-match misses (web phone ≠ WhatsApp phone). */
export const MANUAL_REVIEW_TAG = "[REV-COB]";

/**
 * Hand a covered-city / no-delivery-time lead to a human. Idempotent: re-running only
 * re-syncs the CRM; it does not re-alert the operator or re-post the note.
 */
export async function enterManualReview(db: DB, lead: Lead): Promise<void> {
  const fresh = updateLead(db, lead.lead_id, { ai_enabled: false });
  const newlyFlagged = addLabel(db, fresh.lead_id, "revision_cobertura");

  // Mirror current state + hand the conversation to a human (both idempotent).
  mirrorLeadSync(db, fresh);
  mirrorConversationOpen(db, fresh);

  if (!newlyFlagged) return; // already in manual review — don't re-alert/re-note

  emitEvent(db, {
    lead_id: fresh.lead_id,
    source: fresh.source,
    city: fresh.city,
    event_type: "handoff",
    stage: fresh.stage,
    metadata: { reason: "no_delivery_time", label: "revision_cobertura" },
  });
  mirrorPrivateNote(
    db,
    fresh,
    copy.manualReviewNote(fresh.product || "(sin detalle)", fresh.address, fresh.cross_streets),
  );
  await notifyOperator(
    copy.operatorManualReviewAlert(
      fresh.phone,
      fresh.city,
      fresh.address,
      fresh.conversation_link || "(sin link)",
    ),
  );
}
