// Inbound Kapso webhook handling (02 §2): HMAC-SHA256 signature verification
// (X-Webhook-Signature, timing-safe) and normalization of Meta-shaped inbound
// messages. Dedupe by message ID happens in the engine layer via SQLite.
import { createHmac, timingSafeEqual } from "node:crypto";
import { z } from "zod";

export function verifyKapsoSignature(
  rawBody: string,
  signature: string | undefined,
  secret: string,
): boolean {
  if (!signature) return false;
  const expected = createHmac("sha256", secret).update(rawBody).digest("hex");
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

// Kapso payload_version v2 (integrate-whatsapp/references/webhooks-event-types.md):
// the message object carries NO `from` — the sender phone is
// `conversation.phone_number`, and direction is `message.kapso.direction`.
// `from` is accepted too, only as a fallback for the older/raw-Meta shape.
const inboundMessage = z.object({
  id: z.string(),
  from: z.string().nullish(),
  type: z.string().optional().default("text"),
  text: z.object({ body: z.string() }).nullish(),
  kapso: z.object({ direction: z.string().nullish() }).nullish(),
  interactive: z
    .object({
      type: z.string(),
      button_reply: z.object({ id: z.string(), title: z.string() }).nullish(),
      list_reply: z.object({ id: z.string(), title: z.string() }).nullish(),
      nfm_reply: z.object({ response_json: z.string() }).nullish(),
    })
    .nullish(),
});

const webhookEvent = z.object({
  message: inboundMessage.optional(),
  // Top-level in v2; sender + contact name live here, not on the message.
  conversation: z
    .object({
      phone_number: z.string().nullish(),
      kapso: z.object({ contact_name: z.string().nullish() }).nullish(),
    })
    .nullish(),
  phone_number_id: z.string().optional(),
});

export type InboundKind = "text" | "button" | "list" | "flow" | "media" | "other";

export interface NormalizedInbound {
  messageId: string;
  from: string; // sender phone
  phoneNumberId: string; // which of our lines received it
  kind: InboundKind;
  /** Text body, or the selected button/list id, or "" for media. */
  content: string;
  /** Human title of the tapped button/list row, if any. */
  title?: string;
  /** Parsed WhatsApp Flow (delivery-data form) response, if any. */
  flowResponse?: Record<string, unknown>;
  /** WhatsApp profile name, for pre-filling the lead name (02 §5 datos_entrega). */
  contactName?: string;
}

const MEDIA_TYPES = new Set(["image", "video", "audio", "document", "location", "sticker"]);

/**
 * Returns null for events that carry no inbound customer message. The same
 * top-level shape is used for sent/delivered/failed echoes — gate on
 * `message.kapso.direction` so we never treat our own outbound as inbound.
 */
export function normalizeInbound(payload: unknown): NormalizedInbound | null {
  const parsed = webhookEvent.safeParse(payload);
  if (!parsed.success || !parsed.data.message) return null;
  const msg = parsed.data.message;
  if (msg.kapso?.direction && msg.kapso.direction !== "inbound") return null;
  const from = parsed.data.conversation?.phone_number ?? msg.from ?? "";
  if (!from) return null;
  const base = {
    messageId: msg.id,
    from,
    phoneNumberId: parsed.data.phone_number_id ?? "",
    contactName: parsed.data.conversation?.kapso?.contact_name ?? undefined,
  };

  if (msg.interactive?.button_reply) {
    return {
      ...base,
      kind: "button",
      content: msg.interactive.button_reply.id,
      title: msg.interactive.button_reply.title,
    };
  }
  if (msg.interactive?.list_reply) {
    return {
      ...base,
      kind: "list",
      content: msg.interactive.list_reply.id,
      title: msg.interactive.list_reply.title,
    };
  }
  // NOTE: the nfm_reply.response_json path is raw-Meta and plausible, but the
  // v2 webhook refs do not document flow completions — verify against a real
  // flow-completion capture (send-test-flow.js) before relying on it.
  if (msg.interactive?.nfm_reply) {
    let flowResponse: Record<string, unknown> = {};
    try {
      flowResponse = JSON.parse(msg.interactive.nfm_reply.response_json) as Record<
        string,
        unknown
      >;
    } catch {
      // Malformed flow payload — treat as empty; the engine re-prompts.
    }
    return { ...base, kind: "flow", content: "", flowResponse };
  }
  if (msg.text?.body) {
    return { ...base, kind: "text", content: msg.text.body };
  }
  if (MEDIA_TYPES.has(msg.type)) {
    return { ...base, kind: "media", content: "" };
  }
  return { ...base, kind: "other", content: "" };
}
