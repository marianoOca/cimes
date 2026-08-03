// Local STUB backend for CIMES website QA. Serves canned JSON for the endpoints
// the wizard calls, so the /alta flow can be exercised in a browser WITHOUT the
// real backend (no WaterService creds, no real order writes). Run via tsx (see
// `npm run dev:stub` / dev.sh) so it can import the REAL city list + matcher —
// city snapping behaves exactly like production; only the external services
// (prices/coverage/orders) are faked here. `./dev.sh --real` hits those for real.
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { BA_CITIES, matchCity } from "../src/src/engine/cities.js";

const PORT = Number(process.env.PORT || 3001);

const catalog = {
  price_list: "5",
  products: [
    { id: "1", name: "Bidón retornable 20L", price: 2600, unit: "u" },
    { id: "2", name: "Bidón retornable 12L", price: 1900, unit: "u" },
    { id: "3", name: "Bidón 12L Menos Sodio", price: 2100, unit: "u" },
    { id: "4", name: "Soda en sifón", price: 1200, unit: "u" },
    { id: "5", name: "Agua saborizada", price: 1500, unit: "u" },
  ],
};

const coverage = {
  covered: true,
  coordinates: { lat: -34.65, lng: -59.43 },
  price_list: "5",
  delivery_options: [
    { route: "19", weekday: "sábado", time_window: "entre 10 y 13" },
    { route: "07", weekday: "miércoles", time_window: "entre 14 y 18" },
  ],
};

const json = (res: ServerResponse, code: number, body: unknown): void => {
  res.writeHead(code, { "content-type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(body));
};

const server = createServer(async (req: IncomingMessage, res: ServerResponse) => {
  const url = new URL(req.url ?? "/", `http://localhost:${PORT}`);
  const path = url.pathname;
  let body = "";
  for await (const c of req) body += c;
  const data: Record<string, any> = body ? JSON.parse(body) : {};

  if (req.method === "GET" && path === "/api/prices") {
    return json(res, 200, { city: url.searchParams.get("city"), ...catalog });
  }
  if (req.method === "POST" && path === "/api/coverage") {
    return json(res, 200, coverage);
  }
  // Real list + matcher (shared with production) — typos/abbreviations snap here
  // exactly as they would live.
  if (req.method === "GET" && path === "/api/cities") {
    return json(res, 200, { cities: BA_CITIES });
  }
  if (req.method === "POST" && path === "/api/resolve-city") {
    return json(res, 200, matchCity(String(data.text ?? "")));
  }
  if (req.method === "POST" && path === "/api/orders") {
    // STUB: acknowledge without any real WaterService/Sheet write. Mirror the
    // real server: resolve items against the catalog, sum the total, summarize.
    const priceOf = (name: string) =>
      (catalog.products.find((p) => p.name === name) || ({} as { price?: number })).price || 0;
    const items: { product: string; qty: number }[] =
      data.items ?? (data.product ? [{ product: data.product, qty: 1 }] : []);
    const total = items.reduce((s, it) => s + priceOf(it.product) * it.qty, 0);
    const summary = items.map((it) => `${it.qty}x ${it.product}`).join(", ");
    console.log(`ORDER (stub, not written): ${summary} = $${total}`, JSON.stringify(data));
    return json(res, 200, {
      order_id: "stub-" + (data.phone || "x"),
      waterservice_client_id: "stub-client",
      ticket_status: "scheduled",
      sync_status: "synced",
      label: "cliente_cerrado",
    });
  }
  if (path === "/health") return json(res, 200, { ok: true });
  json(res, 404, { error: "not_found", path });
});

server.listen(PORT, () => console.log(`CIMES stub backend on http://localhost:${PORT}`));
