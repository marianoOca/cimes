// Central env parsing. Names/defaults are canonical in docs/00-master.md §8.
import { z } from "zod";

const jsonRecord = (fallback: Record<string, string>) =>
  z
    .string()
    .transform((s) => JSON.parse(s) as Record<string, string>)
    .catch(fallback);

const envSchema = z.object({
  // chatbot
  KAPSO_API_KEY: z.string().default(""),
  KAPSO_WEBHOOK_SECRET: z.string().default(""),
  KAPSO_BASE_URL: z.string().default("https://api.kapso.ai/meta/whatsapp/v24.0"),
  KAPSO_DELIVERY_FLOW_ID: z.string().default(""),
  WHATSAPP_NUMBER_SALES: z.string().default(""),
  WHATSAPP_NUMBER_SUPPORT: z.string().default(""),
  ANTHROPIC_API_KEY: z.string().default(""),
  MODEL_DEFAULT: z.string().default("claude-sonnet-5"),
  MODEL_ESCALATION: z.string().default("claude-sonnet-5"),
  SUPPORT_NUMBER: z.string().default("+54 9 11 XXXX-XXXX (PLACEHOLDER)"),

  // chatbot — Meta leadgen webhook (Flow D; 02 §7). Not in the master env
  // table — required by the Graph API webhook mechanics; noted in PROGRESS.md.
  META_VERIFY_TOKEN: z.string().default(""),
  META_APP_SECRET: z.string().default(""),
  META_PAGE_ACCESS_TOKEN: z.string().default(""),
  IG_GREETING_TEMPLATE: z.string().default("ig_lead_greeting"),

  // core-api — WaterService
  WATERSERVICE_BASE_URL: z.string().default(""),
  WATERSERVICE_USER: z.string().default(""),
  WATERSERVICE_PASSWORD: z.string().default(""),
  WS_INCIDENT_TYPE_ID: z.coerce.number().default(1),
  WS_INCIDENT_SUBTYPE_ID: z.coerce.number().default(28),
  WS_SEVERITY_ID: z.coerce.number().default(2),
  WS_CENTRO_DISTRIBUCION_MAP: jsonRecord({}),
  // tipoLista_id for the #10 price matrix — per-env, vendor confirms (01 §12e).
  WS_TIPO_LISTA_ID: z.coerce.number().default(2),

  // core-api — sheets / geocoding / coverage
  GOOGLE_SERVICE_ACCOUNT_JSON: z.string().default(""),
  ORDERS_SHEET_ID: z.string().default(""),
  GOOGLE_MAPS_API_KEY: z.string().default(""),
  GEOCODING_PROVIDER: z.enum(["waterservice", "googlemaps"]).default("waterservice"),
  COVERAGE_RADIUS_M: z.coerce.number().default(10000),

  // core-api — follow-ups / debt
  BUSINESS_HOURS: z.string().regex(/^\d{2}-\d{2}$/).default("09-21"),
  FOLLOWUP_SCHEDULE: z.string().default("1h,8h,23h"),
  MAX_FOLLOWUP_CYCLES: z.coerce.number().default(2),
  WEB_CONFIRMATION_TEMPLATE: z
    .string()
    .default("false")
    .transform((v) => v === "true"),
  DEBT_THRESHOLD: z.coerce.number().default(0),
  DEBT_REMINDER_COOLDOWN_DAYS: z.coerce.number().default(14),
  DEBT_REMINDER_SEND_HOUR: z.coerce.number().default(9),

  // core-api — prices
  CITY_PRICE_LIST_MAP: jsonRecord({}),
  // PRICES_SOURCE is a genuinely open item (00-master §10a): no default forced.
  PRICES_SOURCE: z.enum(["waterservice", "sheet"]).optional(),
  PRICES_SHEET_ID: z.string().default(""),

  OPERATOR_PHONE: z.string().default(""),

  // crm (consumed by the mirror, 01 §10.3)
  CHATWOOT_BASE_URL: z.string().default(""),
  CHATWOOT_API_ACCESS_TOKEN: z.string().default(""),
  CHATWOOT_ACCOUNT_ID: z.string().default(""),
  CHATWOOT_INBOX_ID: z.string().default(""),
  CHATWOOT_WEBHOOK_SECRET: z.string().default(""),

  // service
  PORT: z.coerce.number().default(3000),
  DB_PATH: z.string().default("./cimes.db"),
  AI_MAX_TOKENS: z.coerce.number().default(1024),
  AI_MAX_UNPRODUCTIVE_TURNS: z.coerce.number().default(6),
});

export type Config = z.infer<typeof envSchema>;

export const config: Config = envSchema.parse(process.env);

export const TIMEZONE = "America/Argentina/Buenos_Aires";

/** FOLLOWUP_SCHEDULE "1h,8h,23h" → offsets in ms from the lead's last message. */
export function followupOffsetsMs(cfg: Config = config): number[] {
  return cfg.FOLLOWUP_SCHEDULE.split(",").map((part) => {
    const m = part.trim().match(/^(\d+(?:\.\d+)?)(h|m)$/);
    if (!m) throw new Error(`Bad FOLLOWUP_SCHEDULE entry: ${part}`);
    const n = Number(m[1]);
    return m[2] === "h" ? n * 3_600_000 : n * 60_000;
  });
}

/** BUSINESS_HOURS "09-21" → { start, end } local hours. */
export function businessHours(cfg: Config = config): { start: number; end: number } {
  const [start, end] = cfg.BUSINESS_HOURS.split("-").map(Number) as [number, number];
  return { start, end };
}
