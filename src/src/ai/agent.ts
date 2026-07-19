// AI layer (02 §11): official Anthropic TS SDK, plain tool-use loop, prompt
// caching on the stable prefix (role/tone/catalog/KB/tools). The dynamic tail
// (ONE city's resolved prices + lead state) is a separate system block — THE
// MODEL NEVER SEES TWO CITIES' PRICES IN ONE CONTEXT. Prices/coverage/days
// come only from tools, never from model memory.
import Anthropic from "@anthropic-ai/sdk";
import { config } from "../config.js";
import type { DB } from "../db/db.js";
import type { Lead } from "../db/leads.js";
import { getLeadById } from "../db/leads.js";
import type { PricedCatalog } from "../providers/types.js";
import { TOOL_DEFINITIONS, runTool, type ToolContext } from "./tools.js";
import { SYSTEM_PROMPT } from "./prompt.js";

const client = new Anthropic({ apiKey: config.ANTHROPIC_API_KEY });

export interface AiTurnResult {
  /** Messages to send to the user, in order. Empty = stay silent (valid). */
  replies: string[];
  handoffTriggered: boolean;
}

function dynamicContext(lead: Lead, catalog: PricedCatalog | null): string {
  const parts = [
    `Current lead state: name=${lead.name || "?"} city=${lead.city || "?"} product=${
      lead.product || "?"
    } address=${lead.address || "?"} stage=${lead.stage}`,
  ];
  if (catalog) {
    // Only the resolved city's list — never two lists at once (02 §11).
    parts.push(
      `Resolved price list ${catalog.price_list} for ${lead.city}:\n` +
        catalog.products.map((p) => `- ${p.name}: $${p.price}`).join("\n"),
    );
  }
  return parts.join("\n\n");
}

/** Rebuild chat history from the event log (message_in/out carry text). */
export function historyFromEvents(db: DB, leadId: string, limit = 24): Anthropic.MessageParam[] {
  const rows = db
    .prepare(
      `SELECT event_type, metadata FROM events
       WHERE lead_id = ? AND event_type IN ('message_in','message_out')
       ORDER BY id DESC LIMIT ?`,
    )
    .all(leadId, limit) as { event_type: string; metadata: string }[];
  return rows
    .reverse()
    .map((r) => {
      const text = String((JSON.parse(r.metadata) as { text?: string }).text ?? "");
      if (!text) return null;
      return {
        role: r.event_type === "message_in" ? ("user" as const) : ("assistant" as const),
        content: text,
      };
    })
    .filter((m): m is NonNullable<typeof m> => m !== null);
}

/** Merge consecutive same-role turns (the API requires alternation). */
function normalizeHistory(history: Anthropic.MessageParam[]): Anthropic.MessageParam[] {
  const out: Anthropic.MessageParam[] = [];
  for (const m of history) {
    const prev = out[out.length - 1];
    if (prev && prev.role === m.role) {
      prev.content = `${prev.content as string}\n${m.content as string}`;
    } else {
      out.push({ ...m });
    }
  }
  if (out[0]?.role === "assistant") out.shift();
  return out;
}

export async function runAiTurn(
  db: DB,
  leadId: string,
  userMessage: string,
  ctx: ToolContext,
  catalog: PricedCatalog | null,
): Promise<AiTurnResult> {
  const lead = getLeadById(db, leadId);
  if (!lead) throw new Error(`runAiTurn: lead ${leadId} not found`);

  const history = normalizeHistory(historyFromEvents(db, leadId));
  const messages: Anthropic.MessageParam[] = [
    ...history,
    { role: "user", content: userMessage },
  ];

  const replies: string[] = [];
  let handoffTriggered = false;

  for (let turn = 0; turn < 6; turn++) {
    const response = await client.messages.create({
      model: config.MODEL_DEFAULT,
      max_tokens: config.AI_MAX_TOKENS,
      system: [
        // Stable prefix — cached (role/tone/catalog/KB/tool guidance).
        { type: "text", text: SYSTEM_PROMPT, cache_control: { type: "ephemeral" } },
        // Per-conversation tail — varies per lead/city.
        { type: "text", text: dynamicContext(getLeadById(db, leadId) ?? lead, catalog) },
      ],
      tools: TOOL_DEFINITIONS,
      messages,
    });

    for (const block of response.content) {
      if (block.type === "text" && block.text.trim()) replies.push(block.text.trim());
    }

    if (response.stop_reason !== "tool_use") break;

    const toolResults: Anthropic.ToolResultBlockParam[] = [];
    for (const block of response.content) {
      if (block.type !== "tool_use") continue;
      if (block.name === "handoff") handoffTriggered = true;
      const result = await runTool(
        db,
        leadId,
        block.name,
        block.input as Record<string, unknown>,
        ctx,
      );
      toolResults.push({
        type: "tool_result",
        tool_use_id: block.id,
        content: result,
      });
    }
    messages.push({ role: "assistant", content: response.content });
    messages.push({ role: "user", content: toolResults });
  }

  return { replies, handoffTriggered };
}
