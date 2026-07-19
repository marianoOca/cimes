// Flow D — Instagram Instant Form lead ingestion (01 §4.3, 02 §7): fetch the
// lead from the Graph API, normalize into the standard lead record, queue the
// sheet row, send ONE utility-template greeting acknowledging the submitted
// data (never re-asked). The reply opens the 24h window → Flow A continues.
import { createHmac, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { config } from "../config.js";
import type { DB } from "../db/db.js";
import { emitEvent } from "../db/events.js";
import { getOrCreateLead, updateLead } from "../db/leads.js";
import { enqueue } from "../jobs/queue.js";
import { sendTemplate } from "../kapso/send.js";
import { mirrorLeadSync } from "../crm/mirror.js";

export function verifyMetaSignature(
  rawBody: string,
  header: string | undefined,
  appSecret: string,
): boolean {
  if (!header?.startsWith("sha256=")) return false;
  const expected = createHmac("sha256", appSecret).update(rawBody).digest("hex");
  const provided = header.slice("sha256=".length);
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

const leadgenEvent = z.object({
  entry: z
    .array(
      z.object({
        changes: z
          .array(
            z.object({
              field: z.string(),
              value: z.object({ leadgen_id: z.string() }).passthrough(),
            }),
          )
          .default([]),
      }),
    )
    .default([]),
});

interface LeadFields {
  name: string;
  phone: string;
  city: string;
  address: string;
  product: string;
}

async function fetchLead(leadgenId: string): Promise<LeadFields> {
  const res = await fetch(
    `https://graph.facebook.com/v21.0/${leadgenId}?access_token=${config.META_PAGE_ACCESS_TOKEN}`,
  );
  if (!res.ok) throw new Error(`Graph API leadgen fetch failed (${res.status})`);
  const body = (await res.json()) as {
    field_data: { name: string; values: string[] }[];
  };
  const get = (key: string) =>
    body.field_data.find((f) => f.name.toLowerCase().includes(key))?.values[0] ?? "";
  return {
    name: get("full_name") || get("name"),
    phone: get("phone").replace(/[^\d+]/g, ""),
    city: get("city") || get("ciudad"),
    address: get("address") || get("direcci"),
    product: get("product") || get("producto"),
  };
}

export async function handleInstagramLead(db: DB, payload: unknown): Promise<void> {
  const parsed = leadgenEvent.safeParse(payload);
  if (!parsed.success) return;
  for (const entry of parsed.data.entry) {
    for (const change of entry.changes) {
      if (change.field !== "leadgen") continue;
      const fields = await fetchLead(change.value.leadgen_id);
      if (!fields.phone) continue;

      const { lead: created, created: isNew } = getOrCreateLead(db, {
        phone: fields.phone,
        source: "instagram",
        name: fields.name,
      });
      if (isNew) {
        emitEvent(db, {
          lead_id: created.lead_id,
          source: "instagram",
          city: fields.city,
          event_type: "lead_created",
          metadata: { leadgen_id: change.value.leadgen_id },
        });
      }
      const lead = updateLead(db, created.lead_id, {
        name: fields.name || created.name,
        city: fields.city || created.city,
        address: fields.address || created.address,
        product: fields.product || created.product,
        // Address already submitted → continue at coverage/day when they reply.
        stage: fields.address ? "datos_entrega" : created.stage,
      });

      enqueue(
        db,
        "sheet_append_order",
        new Date(),
        { lead_id: lead.lead_id, order_id: null, label: "lead_instagram" },
        `sheet_ig:${lead.lead_id}`,
      );

      // Mandatory utility-template greeting (pre-approved), acknowledging data.
      await sendTemplate(config.WHATSAPP_NUMBER_SALES, lead.phone, config.IG_GREETING_TEMPLATE, [
        fields.name || "!",
        fields.city || "tu ciudad",
        fields.product || "agua a domicilio",
      ]);
      emitEvent(db, {
        lead_id: lead.lead_id,
        source: "instagram",
        city: lead.city,
        event_type: "message_out",
        stage: lead.stage,
        metadata: { template: config.IG_GREETING_TEMPLATE },
      });
      mirrorLeadSync(db, lead);
    }
  }
}
