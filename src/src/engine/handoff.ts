// Handoff logic (01 §5). Both things always happen: tell the user to write to
// SUPPORT_NUMBER AND notify the operator — not either/or (02 §9).
import { config } from "../config.js";
import { copy } from "../copy.es-AR.js";
import type { DB } from "../db/db.js";
import { emitEvent } from "../db/events.js";
import { addLabel, getLeadById, updateLead, type Lead } from "../db/leads.js";
import { sendText } from "../kapso/send.js";
import { mirrorConversationOpen } from "../crm/mirror.js";
import { notifyOperator } from "./notify.js";

export async function triggerHandoff(
  db: DB,
  lead: Lead,
  reason: string,
  phoneNumberId: string,
): Promise<void> {
  // 1. The single canonical AI gate (00-master §5.2).
  updateLead(db, lead.lead_id, { ai_enabled: false });

  // 2. Label.
  if (addLabel(db, lead.lead_id, "derivado")) {
    emitEvent(db, {
      lead_id: lead.lead_id,
      source: lead.source,
      city: lead.city,
      event_type: "label_applied",
      stage: lead.stage,
      metadata: { label: "derivado" },
    });
  }

  // 3. Operator notification with the Chatwoot deep link; flip Chatwoot to open.
  const fresh = getLeadById(db, lead.lead_id) ?? lead;
  await notifyOperator(
    copy.operatorHandoffAlert(lead.phone, reason, fresh.conversation_link || "(sin link)"),
  );
  mirrorConversationOpen(db, fresh);

  // 4. Tell the user to write to the support number (placeholder until the
  // client provides the real one — 00-master §8).
  await sendText(phoneNumberId, lead.phone, copy.handoffToSupport(config.SUPPORT_NUMBER));

  // 5. Event.
  emitEvent(db, {
    lead_id: lead.lead_id,
    source: lead.source,
    city: lead.city,
    event_type: "handoff",
    stage: lead.stage,
    metadata: { reason },
  });
}
