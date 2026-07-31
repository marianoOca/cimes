// Concurrency guards at the WaterService boundary (PROGRESS: "concurrency review"):
//  - http.ts single-flights login, so a token stampede at cold-start/expiry can't fire N
//    parallel GetToken calls that overwrite each other (and 401 the losers if WaterService
//    invalidates the prior token per login).
//  - /api/coverage answers 503 ("couldn't check"), NOT a 200 not-covered, when the upstream
//    check fails — so the website escalates retry → WhatsApp instead of lying about coverage.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// buildServer pulls the whole engine graph in; stub the outbound edges so importing it
// never touches the network. The geocoding provider is forced to throw for the 503 test.
vi.mock("../src/kapso/send.js", () => ({
  sendText: vi.fn(async () => "wamid.out"),
  sendButtons: vi.fn(async () => "wamid.out"),
  sendList: vi.fn(async () => "wamid.out"),
  sendFlow: vi.fn(async () => "wamid.out"),
  sendTemplate: vi.fn(async () => "wamid.out"),
}));

vi.mock("../src/providers/geocoding.js", () => ({
  createGeocodingProvider: () => ({
    resolve: vi.fn(async () => {
      throw new Error("waterservice timeout");
    }),
  }),
}));

import { wsCall, invalidateToken } from "../src/waterservice/http.js";
import { buildServer } from "../src/api/server.js";
import { openDb } from "../src/db/db.js";

function jsonRes(body: unknown, ok = true) {
  return { ok, status: ok ? 200 : 503, json: async () => body };
}

describe("waterservice http: single-flight login", () => {
  beforeEach(() => invalidateToken());
  afterEach(() => vi.unstubAllGlobals());

  it("concurrent calls at cold start trigger exactly one GetToken", async () => {
    let logins = 0;
    const fetchMock = vi.fn(async (url: string) => {
      if (String(url).includes("GetToken")) {
        logins++;
        await new Promise((r) => setTimeout(r, 10)); // hold the login so all callers overlap
        return jsonRes({ tokenValido: "T", vencimiento: "2099-01-01 00:00:00", error: 0 });
      }
      return jsonRes({ error: 0, rows: [] });
    });
    vi.stubGlobal("fetch", fetchMock);

    await Promise.all([
      wsCall({ method: "GET", path: "/api/x" }),
      wsCall({ method: "GET", path: "/api/y" }),
      wsCall({ method: "GET", path: "/api/z" }),
    ]);

    expect(logins).toBe(1); // without single-flight this would be 3
  });
});

describe("/api/coverage: upstream failure is 503, not a false 'not covered'", () => {
  it("answers 503 with coverage_unavailable when the check throws", async () => {
    const app = buildServer(openDb(":memory:"));
    const res = await app.inject({
      method: "POST",
      url: "/api/coverage",
      payload: { city: "Luján", address: "Rivadavia 770" },
    });
    expect(res.statusCode).toBe(503);
    expect(res.json()).toMatchObject({ error: "coverage_unavailable" });
    await app.close();
  });
});
