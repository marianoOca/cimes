// Canonical lead record (00-master §5.1), keyed by phone (E.164).
import { randomUUID } from "node:crypto";
import type { DB } from "./db.js";

export type Source = "whatsapp" | "web" | "instagram";
export type Stage =
  | "inicio"
  | "producto"
  | "datos_entrega"
  | "confirmar_ubicacion"
  | "dia_entrega"
  | "confirmacion"
  | "cliente_cerrado";

export const STAGES: Stage[] = [
  "inicio",
  "producto",
  "datos_entrega",
  "confirmar_ubicacion",
  "dia_entrega",
  "confirmacion",
  "cliente_cerrado",
];

export type TerminalLabel =
  | "sin_respuesta"
  | "interesado"
  | "cliente_cerrado"
  | "pedido_cerrado"
  | "mal_lead"
  | "derivado"
  | "revision_cobertura";

export interface Lead {
  lead_id: string;
  phone: string;
  source: Source;
  name: string;
  city: string;
  address: string;
  cross_streets: string;
  product: string;
  price: number | null;
  price_list: string;
  route: string;
  delivery_day: string;
  delivery_window: string;
  stage: Stage;
  followup_count: number;
  followup_cycles: number;
  labels: string[];
  ai_enabled: boolean;
  waterservice_client_id: string | null;
  ticket_id: string | null;
  sync_status: "pending" | "synced" | "failed";
  conversation_link: string;
  chatwoot_conversation_id: number | null;
  notes: string;
  coverage_json: string | null;
  /** How many address→map confirmations we've offered (map-confirm flow). */
  location_attempts: number;
  archived: boolean;
  last_message_at: string | null;
  created_at: string;
}

type LeadRow = Omit<Lead, "labels" | "ai_enabled" | "archived"> & {
  labels: string;
  ai_enabled: number;
  archived: number;
};

function fromRow(row: LeadRow): Lead {
  return {
    ...row,
    labels: JSON.parse(row.labels) as string[],
    ai_enabled: row.ai_enabled === 1,
    archived: row.archived === 1,
  };
}

export function getLeadByPhone(db: DB, phone: string): Lead | null {
  const row = db.prepare("SELECT * FROM leads WHERE phone = ?").get(phone) as
    | LeadRow
    | undefined;
  return row ? fromRow(row) : null;
}

export function getLeadById(db: DB, leadId: string): Lead | null {
  const row = db.prepare("SELECT * FROM leads WHERE lead_id = ?").get(leadId) as
    | LeadRow
    | undefined;
  return row ? fromRow(row) : null;
}

export function createLead(
  db: DB,
  fields: { phone: string; source: Source; name?: string },
): Lead {
  const lead_id = randomUUID();
  db.prepare(
    "INSERT INTO leads (lead_id, phone, source, name) VALUES (?, ?, ?, ?)",
  ).run(lead_id, fields.phone, fields.source, fields.name ?? "");
  return getLeadById(db, lead_id)!;
}

/** Returning contacts are never re-asked known data (01 §6): load-or-create by phone. */
export function getOrCreateLead(
  db: DB,
  fields: { phone: string; source: Source; name?: string },
): { lead: Lead; created: boolean } {
  const existing = getLeadByPhone(db, fields.phone);
  if (existing) return { lead: existing, created: false };
  return { lead: createLead(db, fields), created: true };
}

const UPDATABLE = new Set([
  "name",
  "city",
  "address",
  "cross_streets",
  "product",
  "price",
  "price_list",
  "route",
  "delivery_day",
  "delivery_window",
  "stage",
  "followup_count",
  "followup_cycles",
  "waterservice_client_id",
  "ticket_id",
  "sync_status",
  "conversation_link",
  "chatwoot_conversation_id",
  "notes",
  "coverage_json",
  "location_attempts",
  "last_message_at",
]);

export function updateLead(db: DB, leadId: string, patch: Partial<Lead>): Lead {
  const entries = Object.entries(patch).filter(([k]) => UPDATABLE.has(k));
  const extra: [string, unknown][] = [];
  if (patch.labels !== undefined) extra.push(["labels", JSON.stringify(patch.labels)]);
  if (patch.ai_enabled !== undefined) extra.push(["ai_enabled", patch.ai_enabled ? 1 : 0]);
  if (patch.archived !== undefined) extra.push(["archived", patch.archived ? 1 : 0]);
  const all = [...entries, ...extra];
  if (all.length > 0) {
    const sets = all.map(([k]) => `${k} = ?`).join(", ");
    db.prepare(`UPDATE leads SET ${sets} WHERE lead_id = ?`).run(
      ...all.map(([, v]) => v),
      leadId,
    );
  }
  return getLeadById(db, leadId)!;
}

/** Add a label if absent. Returns true if newly added. */
export function addLabel(db: DB, leadId: string, label: string): boolean {
  const lead = getLeadById(db, leadId);
  if (!lead || lead.labels.includes(label)) return false;
  updateLead(db, leadId, { labels: [...lead.labels, label] });
  return true;
}

export function hasTerminalLabel(lead: Lead): boolean {
  const terminals: string[] = [
    "sin_respuesta",
    "cliente_cerrado",
    "pedido_cerrado",
    "mal_lead",
    "derivado",
    "revision_cobertura",
  ];
  return lead.labels.some((l) => terminals.includes(l));
}
