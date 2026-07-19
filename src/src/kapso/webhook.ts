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

const inboundMessage = z.object({
  id: z.string(),
  from: z.string(),
  type: z.string().optional().default("text"),
  text: z.object({ body: z.string() }).nullish(),
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
  event_type: z.string().optional(),
  message: inboundMessage.optional(),
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
}

const MEDIA_TYPES = new Set(["image", "video", "audio", "document", "location", "sticker"]);

/** Returns null for events that carry no inbound customer message. */
export function normalizeInbound(payload: unknown): NormalizedInbound | null {
  const parsed = webhookEvent.safeParse(payload);
  if (!parsed.success || !parsed.data.message) return null;
  const msg = parsed.data.message;
  const base = {
    messageId: msg.id,
    from: msg.from,
    phoneNumberId: parsed.data.phone_number_id ?? "",
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
