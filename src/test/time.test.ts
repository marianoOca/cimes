import { describe, expect, it } from "vitest";
import { localParts, nextLocalHour, parseWsDate, toWsDate } from "../src/time.js";

describe("time helpers (America/Argentina/Buenos_Aires)", () => {
  it("formats WaterService request dates as dd/MM/yyyy in AR local time", () => {
    // 2026-07-19T02:00Z is 2026-07-18 23:00 in AR (UTC-3).
    expect(toWsDate(new Date("2026-07-19T02:00:00Z"))).toBe("18/07/2026");
    expect(toWsDate(new Date("2026-07-19T12:00:00Z"))).toBe("19/07/2026");
  });

  it("parses .NET /Date(ms)/ response timestamps", () => {
    expect(parseWsDate("/Date(1753112501144)/").getTime()).toBe(1753112501144);
    expect(() => parseWsDate("2026-01-01")).toThrow();
  });

  it("nextLocalHour lands on the requested AR hour, in the future", () => {
    const from = new Date("2026-07-19T12:00:00Z"); // 09:00 AR
    const next = nextLocalHour(9, from);
    expect(localParts(next).hour).toBe(9);
    expect(next.getTime()).toBeGreaterThan(from.getTime());
    // Should be tomorrow 09:00 AR, not today (already past the tick).
    expect(next.getTime() - from.getTime()).toBeGreaterThan(23 * 3_600_000);
  });
});
