// Outbound send API (02 §2): Kapso's Meta Cloud API-compatible proxy.
// POST {KAPSO_BASE_URL}/{phone_number_id}/messages, header X-API-Key.
// WHATSAPP_NUMBER_SALES / WHATSAPP_NUMBER_SUPPORT hold the Kapso
// phone_number_ids of the two lines. Meta hard limits (02 §3) are enforced
// here: ≤3 quick-reply buttons, ≤10 list rows.
import { config } from "../config.js";

export interface Button {
  id: string;
  title: string; // ≤20 chars per Meta
}

export interface ListRow {
  id: string;
  title: string;
  description?: string;
}

async function post(phoneNumberId: string, payload: Record<string, unknown>): Promise<string> {
  const res = await fetch(`${config.KAPSO_BASE_URL}/${phoneNumberId}/messages`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-API-Key": config.KAPSO_API_KEY },
    body: JSON.stringify({ messaging_product: "whatsapp", ...payload }),
  });
  if (!res.ok) {
    throw new Error(`Kapso send failed (${res.status}): ${await res.text()}`);
  }
  const body = (await res.json()) as { messages?: { id: string }[] };
  return body.messages?.[0]?.id ?? "";
}

export function sendText(phoneNumberId: string, to: string, body: string): Promise<string> {
  return post(phoneNumberId, { to, type: "text", text: { body } });
}

export function sendButtons(
  phoneNumberId: string,
  to: string,
  body: string,
  buttons: Button[],
): Promise<string> {
  if (buttons.length > 3) throw new Error("Meta limit: max 3 quick-reply buttons");
  return post(phoneNumberId, {
    to,
    type: "interactive",
    interactive: {
      type: "button",
      body: { text: body },
      action: {
        buttons: buttons.map((b) => ({ type: "reply", reply: { id: b.id, title: b.title } })),
      },
    },
  });
}

export function sendList(
  phoneNumberId: string,
  to: string,
  body: string,
  buttonLabel: string,
  rows: ListRow[],
): Promise<string> {
  if (rows.length > 10) throw new Error("Meta limit: max 10 list rows");
  return post(phoneNumberId, {
    to,
    type: "interactive",
    interactive: {
      type: "list",
      body: { text: body },
      action: {
        button: buttonLabel,
        sections: [{ title: buttonLabel, rows }],
      },
    },
  });
}

/** The delivery-data form: a WhatsApp Flow pre-published in Kapso (02 §4). */
export function sendFlow(
  phoneNumberId: string,
  to: string,
  body: string,
  cta: string,
  flowToken: string,
): Promise<string> {
  return post(phoneNumberId, {
    to,
    type: "interactive",
    interactive: {
      type: "flow",
      body: { text: body },
      action: {
        name: "flow",
        parameters: {
          flow_message_version: "3",
          flow_id: config.KAPSO_DELIVERY_FLOW_ID,
          flow_cta: cta,
          mode: "published",
          flow_token: flowToken,
        },
      },
    },
  });
}

/** Pre-approved utility templates (IG greeting, debt reminder, web confirmation). */
export function sendTemplate(
  phoneNumberId: string,
  to: string,
  templateName: string,
  bodyParams: string[],
): Promise<string> {
  return post(phoneNumberId, {
    to,
    type: "template",
    template: {
      name: templateName,
      language: { code: "es_AR" },
      components: [
        {
          type: "body",
          parameters: bodyParams.map((text) => ({ type: "text", text })),
        },
      ],
    },
  });
}
