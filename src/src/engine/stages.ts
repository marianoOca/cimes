// Stage machine (00-master §5.4): plain enum + transition function — 5 linear
// stages, no state-machine library (01 building blocks).
import type { Stage } from "../db/leads.js";
import { STAGES } from "../db/leads.js";
import type { Lead } from "../db/leads.js";

export function nextStage(current: Stage): Stage {
  const idx = STAGES.indexOf(current);
  return STAGES[Math.min(idx + 1, STAGES.length - 1)]!;
}

export function stageIndex(stage: Stage): number {
  return STAGES.indexOf(stage);
}

/**
 * The furthest stage the lead's known data supports — the hybrid-input rule
 * (02 §4): data already provided is never re-asked, the engine skips ahead.
 */
export function stageFromKnownData(lead: Lead): Stage {
  if (lead.labels.includes("cliente_cerrado")) return "cliente_cerrado";
  if (!lead.city) return "inicio";
  if (!lead.product) return "producto";
  if (!lead.address) return "datos_entrega";
  if (!lead.delivery_day) return "dia_entrega";
  return "confirmacion";
}

/** Dynamic stage label `{stage}:{followup_count}` (00-master §5.3). */
export function dynamicLabel(lead: Lead): string {
  return `${lead.stage}:${lead.followup_count}`;
}
