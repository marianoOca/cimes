// Chatwoot mirror (01 §10.3). The lead record is the source of truth; mirror
// failures never block the conversation flow — every Chatwoot write goes
// through the jobs queue and is retried there. Kapso stays the only WhatsApp
// transport; Chatwoot is an API-channel inbox.
import { config } from "../config.js";
import type { DB } from "../db/db.js";
import { getLeadById, updateLead, type Lead } from "../db/leads.js";
import { dynamicLabel } from "../engine/stages.js";
import { enqueue } from "../jobs/queue.js";

function chatwootConfigured(): boolean {
  return Boolean(config.CHATWOOT_BASE_URL && config.CHATWOOT_API_ACCESS_TOKEN);
}

async function api(path: string, method: string, body?: unknown): Promise<unknown> {
  const res = await fetch(
    `${config.CHATWOOT_BASE_URL}/api/v1/accounts/${config.CHATWOOT_ACCOUNT_ID}${path}`,
    {
      method,
      headers: {
        "Content-Type": "application/json",
        api_access_token: config.CHATWOOT_API_ACCESS_TOKEN,
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    },
  );
  if (!res.ok) throw new Error(`Chatwoot ${method} ${path} failed (${res.status})`);
  return res.json();
}

/** Ensure contact + conversation exist; store the conversation id + deep link. */
async function ensureConversation(db: DB, lead: Lead): Promise<number> {
  if (lead.chatwoot_conversation_id) return lead.chatwoot_conversation_id;
  const contact = (await api("/contacts", "POST", {
    name: lead.name || lead.phone,
    phone_number: lead.phone.startsWith("+") ? lead.phone : `+${lead.phone}`,
  })) as { payload?: { contact?: { id: number } } };
  const contactId = contact.payload?.contact?.id;
  if (!contactId) throw new Error("Chatwoot contact creation returned no id");
  const conv = (await api("/conversations", "POST", {
    inbox_id: Number(config.CHATWOOT_INBOX_ID),
    contact_id: contactId,
    status: "pending", // pending ↔ ai_enabled=true (00-master §5.2)
  })) as { id: number };
  updateLead(db, lead.lead_id, {
    chatwoot_conversation_id: conv.id,
    conversation_link: `${config.CHATWOOT_BASE_URL}/app/accounts/${config.CHATWOOT_ACCOUNT_ID}/conversations/${conv.id}`,
  });
  return conv.id;
}

// ---------- job handlers (registered in index.ts) ----------

export async function handleMirrorMessageJob(
  payload: Record<string, unknown>,
  db: DB,
): Promise<void> {
  if (!chatwootConfigured()) return;
  const lead = getLeadById(db, String(payload.lead_id));
  if (!lead) return;
  const convId = await ensureConversation(db, lead);
  await api(`/conversations/${convId}/messages`, "POST", {
    content: String(payload.content),
    message_type: payload.direction === "in" ? "incoming" : "outgoing",
    private: false,
  });
}

export async function handleMirrorSyncJob(
  payload: Record<string, unknown>,
  db: DB,
): Promise<void> {
  if (!chatwootConfigured()) return;
  const lead = getLeadById(db, String(payload.lead_id));
  if (!lead) return;
  const convId = await ensureConversation(db, lead);
  await api(`/conversations/${convId}/custom_attributes`, "POST", {
    custom_attributes: {
      stage: lead.stage,
      followup_count: lead.followup_count,
      dynamic_label: dynamicLabel(lead),
      city: lead.city,
      product: lead.product,
      price: lead.price,
      delivery_day: lead.delivery_day,
      delivery_window: lead.delivery_window,
      sync_status: lead.sync_status,
      waterservice_client_id: lead.waterservice_client_id,
      ticket_id: lead.ticket_id,
    },
  });
  await api(`/conversations/${convId}/labels`, "POST", { labels: lead.labels });
}

export async function handleMirrorStatusJob(
  payload: Record<string, unknown>,
  db: DB,
): Promise<void> {
  if (!chatwootConfigured()) return;
  const lead = getLeadById(db, String(payload.lead_id));
  if (!lead?.chatwoot_conversation_id) return;
  await api(
    `/conversations/${lead.chatwoot_conversation_id}/toggle_status`,
    "POST",
    { status: String(payload.status) },
  );
}

// ---------- enqueue helpers (what the engine calls) ----------

export function mirrorMessage(
  db: DB,
  lead: Lead,
  direction: "in" | "out",
  content: string,
): void {
  if (!chatwootConfigured()) return;
  enqueue(db, "chatwoot_mirror_message", new Date(), {
    lead_id: lead.lead_id,
    direction,
    content,
  });
}

export function mirrorLeadSync(db: DB, lead: Lead): void {
  if (!chatwootConfigured()) return;
  enqueue(
    db,
    "chatwoot_mirror_sync",
    new Date(),
    { lead_id: lead.lead_id },
    `mirror_sync:${lead.lead_id}`,
  );
}

/** Handoff flips the Chatwoot conversation to open (01 §5). */
export function mirrorConversationOpen(db: DB, lead: Lead): void {
  if (!chatwootConfigured()) return;
  enqueue(db, "chatwoot_mirror_status", new Date(), {
    lead_id: lead.lead_id,
    status: "open",
  });
}
