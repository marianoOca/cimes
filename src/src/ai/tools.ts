// The 5 canonical AI tools (00-master §5.5) — thin wrappers over core-api
// providers/endpoints. Exactly these names; no variants.
import type Anthropic from "@anthropic-ai/sdk";
import type { DB } from "../db/db.js";
import { emitEvent } from "../db/events.js";
import { addLabel, getLeadById, updateLead } from "../db/leads.js";
import { runCoverageForLead } from "../engine/coverage.js";
import { triggerHandoff } from "../engine/handoff.js";
import { confirmOrder } from "../pipeline/orders.js";
import { createPriceProvider } from "../providers/prices.js";
import type { PriceProvider } from "../providers/types.js";

export interface ToolContext {
  phoneNumberId: string;
}

let priceProvider: PriceProvider | null = null;
export function getPriceProvider(): PriceProvider {
  if (!priceProvider) priceProvider = createPriceProvider();
  return priceProvider;
}
/** Test seam. */
export function setPriceProvider(p: PriceProvider): void {
  priceProvider = p;
}

export const TOOL_DEFINITIONS: Anthropic.Tool[] = [
  {
    name: "get_prices",
    description:
      "Returns the catalog with prices for one city. The only source of prices.",
    input_schema: {
      type: "object",
      properties: { city: { type: "string", description: "City name" } },
      required: ["city"],
    },
  },
  {
    name: "check_coverage",
    description:
      "Checks whether a street address is covered and returns resolved delivery data.",
    input_schema: {
      type: "object",
      properties: {
        address: { type: "string", description: "Street + number, e.g. 'Rivadavia 770'" },
      },
      required: ["address"],
    },
  },
  {
    name: "get_delivery_options",
    description:
      "Returns available delivery-day options (route + weekday + time window) for an address.",
    input_schema: {
      type: "object",
      properties: { address: { type: "string" } },
      required: ["address"],
    },
  },
  {
    name: "confirm_order",
    description:
      "Confirms the order and fires the order pipeline. Call only after the user explicitly confirmed the summary.",
    input_schema: {
      type: "object",
      properties: {
        name: { type: "string" },
        product: { type: "string" },
        delivery_day: { type: "string", description: "Chosen weekday, lowercase Spanish" },
        delivery_window: { type: "string" },
      },
      required: ["product", "delivery_day"],
    },
  },
  {
    name: "handoff",
    description:
      "Hands the conversation to a human operator. Use for out-of-KB questions, complaints, or explicit requests.",
    input_schema: {
      type: "object",
      properties: { reason: { type: "string" } },
      required: ["reason"],
    },
  },
];

export async function runTool(
  db: DB,
  leadId: string,
  name: string,
  input: Record<string, unknown>,
  ctx: ToolContext,
): Promise<string> {
  const lead = getLeadById(db, leadId);
  if (!lead) return "error: lead not found";

  try {
    switch (name) {
      case "get_prices": {
        const city = String(input.city ?? lead.city);
        if (city && city !== lead.city) updateLead(db, leadId, { city });
        const catalog = lead.price_list
          ? await getPriceProvider().getPricesForList(lead.price_list)
          : await getPriceProvider().getCatalog(city);
        // Asking prices marks the lead interesado (00-master §5.3).
        if (addLabel(db, leadId, "interesado")) {
          emitEvent(db, {
            lead_id: leadId,
            source: lead.source,
            city,
            event_type: "label_applied",
            stage: lead.stage,
            metadata: { label: "interesado", reason: "asked_prices" },
          });
        }
        return JSON.stringify(catalog);
      }
      case "check_coverage":
      case "get_delivery_options": {
        const address = String(input.address ?? lead.address);
        if (!address) return "error: no address known yet — ask the user for it";
        const result = await runCoverageForLead(db, { ...lead, address }, address);
        updateLead(db, leadId, { coverage_json: JSON.stringify(result) });
        return JSON.stringify({
          covered: result.covered,
          delivery_options: result.delivery_options.map((o) => ({
            route: o.route,
            weekday: o.weekday,
            time_window: o.time_window,
          })),
        });
      }
      case "confirm_order": {
        const patch: Record<string, string> = {};
        if (input.name) patch.name = String(input.name);
        if (input.product) patch.product = String(input.product);
        if (input.delivery_day) patch.delivery_day = String(input.delivery_day);
        if (input.delivery_window) patch.delivery_window = String(input.delivery_window);
        updateLead(db, leadId, patch);
        const result = await confirmOrder(db, leadId);
        return JSON.stringify({
          order_id: result.order.id,
          sync_status: result.sync_status,
          delivery_day: result.order.delivery_day,
          delivery_window: result.order.delivery_window,
        });
      }
      case "handoff": {
        await triggerHandoff(db, lead, String(input.reason ?? "ai_request"), ctx.phoneNumberId);
        return "handoff done — the user was told where to write; do not keep selling";
      }
      default:
        return `error: unknown tool ${name}`;
    }
  } catch (err) {
    return `error: ${err instanceof Error ? err.message : String(err)}`;
  }
}
