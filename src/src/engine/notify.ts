// Operator notifications: WhatsApp text to OPERATOR_PHONE via the support line.
import { config } from "../config.js";
import { sendText } from "../kapso/send.js";

export async function notifyOperator(message: string): Promise<void> {
  if (!config.OPERATOR_PHONE) return;
  try {
    await sendText(config.WHATSAPP_NUMBER_SUPPORT, config.OPERATOR_PHONE, message);
  } catch (err) {
    // Notification failure must never break the main flow.
    console.error("operator notification failed:", err);
  }
}
