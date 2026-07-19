// WaterService transport. Guardrails (01 §13): HTTP status is always 200 —
// failure is `error != 0` in the body; auth token cached and sent as
// CURRENTTOKENVALUE; re-login on expiry or auth error. Server-side only.
import { z } from "zod";
import { config } from "../config.js";

export class WaterServiceError extends Error {
  constructor(
    public endpoint: string,
    public code: number | string,
    message: string,
  ) {
    super(`WaterService ${endpoint} error ${code}: ${message}`);
  }
}

const tokenResponse = z.object({
  tokenValido: z.string(),
  vencimiento: z.string(),
  error: z.coerce.number(),
  message: z.string().optional().default(""),
});

interface TokenCache {
  token: string;
  expiresAt: number; // epoch ms, with safety margin
}

let cache: TokenCache | null = null;

async function login(): Promise<string> {
  const res = await fetch(`${config.WATERSERVICE_BASE_URL}/api/Session/GetToken`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      username: config.WATERSERVICE_USER,
      password: config.WATERSERVICE_PASSWORD,
    }),
  });
  const body = tokenResponse.parse(await res.json());
  if (body.error !== 0) {
    throw new WaterServiceError("GetToken", body.error, body.message);
  }
  // vencimiento is "yyyy-MM-dd HH:mm:ss" server-local; keep a conservative TTL
  // of 30 min instead of trusting clock alignment.
  cache = { token: body.tokenValido, expiresAt: Date.now() + 30 * 60_000 };
  return body.tokenValido;
}

async function getToken(): Promise<string> {
  if (cache && cache.expiresAt > Date.now()) return cache.token;
  return login();
}

export function invalidateToken(): void {
  cache = null;
}

interface WsCallOptions {
  method: "GET" | "POST";
  path: string;
  /** GET query params or POST JSON body. */
  data?: Record<string, unknown>;
}

/**
 * One WaterService call with token handling and the body-`error` check.
 * Retries once on an auth failure (expired token) after re-login.
 */
export async function wsCall(opts: WsCallOptions, retried = false): Promise<unknown> {
  const token = await getToken();
  let url = `${config.WATERSERVICE_BASE_URL}${opts.path}`;
  const init: RequestInit = {
    method: opts.method,
    headers: { "Content-Type": "application/json", CURRENTTOKENVALUE: token },
  };
  if (opts.method === "GET" && opts.data) {
    const qs = new URLSearchParams();
    for (const [k, v] of Object.entries(opts.data)) {
      if (v !== undefined && v !== null) qs.set(k, String(v));
    }
    url += `?${qs.toString()}`;
  } else if (opts.data) {
    init.body = JSON.stringify(opts.data);
  }

  const res = await fetch(url, init);
  if (res.status === 401 && !retried) {
    invalidateToken();
    return wsCall(opts, true);
  }
  const body = (await res.json()) as Record<string, unknown>;

  const errorCode = Number(body.error ?? 0);
  if (errorCode !== 0) {
    const message = String(body.message ?? "");
    // Token-expiry surfaces as a body error too; retry once with a fresh login.
    if (!retried && /token|sesi[oó]n|autoriz/i.test(message)) {
      invalidateToken();
      return wsCall(opts, true);
    }
    throw new WaterServiceError(opts.path, errorCode, message);
  }
  return body;
}
