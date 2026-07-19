// Follow-up engine (01 §7): re-engages silent WhatsApp leads inside Meta's
// free 24h window. Timer state lives in the jobs table (restart-safe).
import { businessHours, config, followupOffsetsMs } from "../config.js";
import { copy } from "../copy.es-AR.js";
import type { DB } from "../db/db.js";
import { emitEvent } from "../db/events.js";
import {
  addLabel,
  getLeadById,
  hasTerminalLabel,
  updateLead,
  type Lead,
} from "../db/leads.js";
import { sendText } from "../kapso/send.js";
import { cancelJobs, enqueue } from "../jobs/queue.js";
import { isWithinBusinessHours, nextLocalHour } from "../time.js";
import { mirrorLeadSync, mirrorMessage } from "../crm/mirror.js";

const WINDOW_MS = 24 * 3_600_000;

/**
 * (Re)schedule the follow-up timers from the lead's last message (T).
 * Called on every inbound: pending timers are cancelled first.
 */
export function scheduleFollowups(db: DB, lead: Lead, phoneNumberId: string): void {
  cancelJobs(db, "followup", lead.lead_id);
  if (lead.stage === "cliente_cerrado" || hasTerminalLabel(lead) || !lead.ai_enabled) return;
  // Global cap: a cycle is counted when its first follow-up actually fires.
  if (lead.followup_cycles >= config.MAX_FOLLOWUP_CYCLES) return;

  const t = Date.now();
  followupOffsetsMs().forEach((offset, i) => {
    enqueue(db, "followup", new Date(t + offset), {
      lead_id: lead.lead_id,
      phone_number_id: phoneNumberId,
      seq: i + 1,
      anchor: t, // the lead's last-message time this sequence hangs off
    });
  });
}

/** WhatsApp-only; web signups never get follow-ups (01 §4.2). */
export async function handleFollowupJob(
  payload: Record<string, unknown>,
  db: DB,
): Promise<void> {
  const lead = getLeadById(db, String(payload.lead_id));
  if (!lead) return;
  const anchor = Number(payload.anchor);
  const seq = Number(payload.seq);
  const phoneNumberId = String(payload.phone_number_id);

  // A reply after the anchor cancels the sequence (belt-and-braces: timers are
  // also cancelled on inbound; this covers redelivery/races).
  const lastMs = lead.last_message_at ? Date.parse(lead.last_message_at) : 0;
  if (lastMs > anchor) return;
  // No follow-ups on terminal labels, human-owned, or closed conversations.
  if (lead.stage === "cliente_cerrado" || hasTerminalLabel(lead) || !lead.ai_enabled) return;

  // All follow-ups ride the free 24h window — never send after it closes.
  if (Date.now() - anchor >= WINDOW_MS) return;

  // Follow-up 2 defers to next morning outside business hours — but only if
  // the deferred send still fits inside the 24h window.
  if (seq === 2 && !isWithinBusinessHours(businessHours())) {
    const nextMorning = nextLocalHour(businessHours().start);
    if (nextMorning.getTime() - anchor < WINDOW_MS) {
      enqueue(db, "followup", nextMorning, payload);
    }
    return;
  }

  const stage = lead.stage as keyof typeof copy.followup;
  const text = copy.followup[stage] ?? copy.followup.inicio;
  await sendText(phoneNumberId, lead.phone, text);
  mirrorMessage(db, lead, "out", text);

  const followupCount = lead.followup_count + 1;
  updateLead(db, lead.lead_id, {
    followup_count: followupCount,
    // First send of a sequence = a new cycle consumed (MAX_FOLLOWUP_CYCLES cap).
    followup_cycles: seq === 1 ? lead.followup_cycles + 1 : lead.followup_cycles,
  });
  emitEvent(db, {
    lead_id: lead.lead_id,
    source: lead.source,
    city: lead.city,
    event_type: "followup_sent",
    stage: lead.stage,
    followup_count: followupCount,
    metadata: { seq, text },
  });

  // Sequence exhausted without reply → sin_respuesta, bot stops (01 §7).
  if (seq >= followupOffsetsMs().length) {
    if (addLabel(db, lead.lead_id, "sin_respuesta")) {
      emitEvent(db, {
        lead_id: lead.lead_id,
        source: lead.source,
        city: lead.city,
        event_type: "label_applied",
        stage: lead.stage,
        followup_count: followupCount,
        metadata: { label: "sin_respuesta" },
      });
    }
  }
  mirrorLeadSync(db, getLeadById(db, lead.lead_id)!);
}

/** On lead reply: cancel timers, reset the counter, emit followup_reply. */
export function onLeadReply(db: DB, lead: Lead): void {
  const cancelled = cancelJobs(db, "followup", lead.lead_id);
  if (lead.followup_count > 0) {
    emitEvent(db, {
      lead_id: lead.lead_id,
      source: lead.source,
      city: lead.city,
      event_type: "followup_reply",
      stage: lead.stage,
      followup_count: lead.followup_count,
      metadata: { cancelled },
    });
  }
  if (lead.followup_count !== 0) {
    updateLead(db, lead.lead_id, { followup_count: 0 });
  }
}
