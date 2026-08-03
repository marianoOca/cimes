// Coverage check business logic (01 §4.1 step 5) — shared by the chatbot
// tools and POST /api/coverage.
import { config } from "../config.js";
import { copy } from "../copy.es-AR.js";
import type { DB } from "../db/db.js";
import { emitEvent } from "../db/events.js";
import { addLabel, updateLead, type Lead } from "../db/leads.js";
import { createGeocodingProvider } from "../providers/geocoding.js";
import type { CoverageResult } from "../providers/types.js";
import { notifyOperator } from "./notify.js";

// Shortcut cities: the quick-pick buttons/links shown first. NOT a coverage
// gate — any BA city is served if WaterService finds serving neighbors. Free
// text outside this list snaps to the full BA_CITIES set (engine/cities.ts).
export const COVERED_CITIES = [
  "mercedes",
  "luján",
  "san andrés de giles",
  "san antonio de areco",
  "chivilcoy",
  "campana",
  "zárate",
  "Escobar",
];

const geocoding = { provider: createGeocodingProvider() };

/** Test seam: swap the provider without touching config. */
export function setGeocodingProvider(p: typeof geocoding.provider): void {
  geocoding.provider = p;
}

/**
 * Run coverage for a lead's address, persist the resolved data, apply the
 * no-coverage label if needed, and emit coverage_checked.
 */
export async function runCoverageForLead(
  db: DB,
  lead: Lead,
  address: string,
): Promise<CoverageResult> {
  const fullAddress = `Argentina, ${lead.city}, ${address}`;
  const result = await geocoding.provider.resolve(fullAddress, config.COVERAGE_RADIUS_M);

  emitEvent(db, {
    lead_id: lead.lead_id,
    source: lead.source,
    city: lead.city,
    event_type: "coverage_checked",
    stage: lead.stage,
    followup_count: lead.followup_count,
    metadata: { covered: result.covered, address, price_list: result.price_list },
  });

  if (!result.covered) {
    // In-city, no neighbors in radius → mal_lead + operator review (01 §4.1).
    // The taxonomy is fixed — no sin_cobertura label.
    if (addLabel(db, lead.lead_id, "mal_lead")) {
      emitEvent(db, {
        lead_id: lead.lead_id,
        source: lead.source,
        city: lead.city,
        event_type: "label_applied",
        stage: lead.stage,
        metadata: { label: "mal_lead", reason: "no_neighbors_in_radius" },
      });
    }
    await notifyOperator(copy.operatorNewZoneAlert(lead.phone, fullAddress));
    return result;
  }

  updateLead(db, lead.lead_id, {
    address,
    price_list: result.price_list ?? "",
  });
  return result;
}
