// All local-day logic runs in America/Argentina/Buenos_Aires (guardrail 00 §6).
// Storage timestamps are UTC ISO strings.
import { TIMEZONE } from "./config.js";

const partsFmt = new Intl.DateTimeFormat("en-CA", {
  timeZone: TIMEZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

interface LocalParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
}

export function localParts(date: Date = new Date()): LocalParts {
  const parts = Object.fromEntries(
    partsFmt.formatToParts(date).map((p) => [p.type, p.value]),
  );
  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    hour: Number(parts.hour) % 24,
    minute: Number(parts.minute),
  };
}

/** WaterService request-date format: dd/MM/yyyy in AR local time (guardrail). */
export function toWsDate(date: Date): string {
  const p = localParts(date);
  return `${String(p.day).padStart(2, "0")}/${String(p.month).padStart(2, "0")}/${p.year}`;
}

/** Parse a WaterService .NET response timestamp: /Date(1753112501144)/ → Date. */
export function parseWsDate(value: string): Date {
  const m = value.match(/\/Date\((-?\d+)/);
  if (!m) throw new Error(`Unparseable WaterService date: ${value}`);
  return new Date(Number(m[1]));
}

/** Local calendar date string YYYY-MM-DD in AR time. */
export function localDateString(date: Date = new Date()): string {
  const p = localParts(date);
  return `${p.year}-${String(p.month).padStart(2, "0")}-${String(p.day).padStart(2, "0")}`;
}

/** The AR-local date N days from now, as YYYY-MM-DD. */
export function localDatePlusDays(days: number, from: Date = new Date()): string {
  return localDateString(new Date(from.getTime() + days * 86_400_000));
}

/**
 * Next UTC instant at which AR local time reaches `hour:00` (today if still ahead,
 * else tomorrow). Iterative but bounded; avoids a tz library.
 */
export function nextLocalHour(hour: number, from: Date = new Date()): Date {
  const candidate = new Date(from.getTime());
  candidate.setUTCMinutes(0, 0, 0);
  for (let i = 0; i < 48; i++) {
    const p = localParts(candidate);
    if (p.hour === hour && candidate.getTime() > from.getTime()) return candidate;
    candidate.setUTCHours(candidate.getUTCHours() + 1);
  }
  throw new Error("nextLocalHour: no slot found in 48h");
}

export function isWithinBusinessHours(
  hours: { start: number; end: number },
  date: Date = new Date(),
): boolean {
  const h = localParts(date).hour;
  return h >= hours.start && h < hours.end;
}

/** Spanish weekday name (lowercase, e.g. "sábado") for an AR-local date. */
export function localWeekdayEs(date: Date): string {
  return new Intl.DateTimeFormat("es-AR", { timeZone: TIMEZONE, weekday: "long" })
    .format(date)
    .toLowerCase();
}
