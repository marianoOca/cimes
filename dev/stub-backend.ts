// Local STUB backend for CIMES website QA. Serves canned JSON for the endpoints
// the wizard calls, so the /alta flow can be exercised in a browser WITHOUT the
// real backend (no WaterService creds, no real order writes). Run via tsx (see
// `npm run dev:stub` / dev.sh) so it can import the REAL city list + matcher —
// city snapping behaves exactly like production; only the external services
// (prices/coverage/orders) are faked here. `./dev.sh --real` hits those for real.
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { BA_CITIES, matchCity } from "../src/src/engine/cities.js";
import { applyCatalog } from "../src/src/catalog/skus.js";

const PORT = Number(process.env.PORT || 3001);

// Raw WaterService-shaped rows (code-prefixed names, plus junk the real lists
// carry), run through the REAL catalog filter — so the stub shows exactly the 9
// SKUs, in sales order, with the canonical display names.
const catalog = {
  price_list: "5",
  products: applyCatalog([
    { id: "1", name: "10001  -  BOTELLON 12L", price: 6000, unit: "u" },
    { id: "2", name: "10002  -  BOTELLON 20L", price: 8500, unit: "u" },
    { id: "3", name: "10003  -  BOTELLON 12L NA", price: 6400, unit: "u" },
    { id: "4", name: "10004  -  BOTELLON 20L NA", price: 8900, unit: "u" },
    { id: "5", name: "10005  -  SIFON 1 1/2L", price: 1600, unit: "u" },
    { id: "6", name: "10006  -  AGUA SABORIZADA 1.5 L", price: 1800, unit: "u" },
    { id: "7", name: "10007  -  GASEOSAS 2 L", price: 2400, unit: "u" },
    { id: "8", name: "10008  -  AGUA 2L", price: 1200, unit: "u" },
    { id: "9", name: "10009  -  CIMES PLUS ISOTONICA 750 ml", price: 2100, unit: "u" },
    { id: "1014", name: "Sanitizacion de Dispenser", price: 9000, unit: "u" },
    { id: "1015", name: "Abono mensual frio-calor", price: 38000, unit: "u" },
  ]),
};

// Stands in for the real #11 abonos + the frío/calor price list. Shaped exactly
// like api/frio-calor.ts so the wizard's card, cart math and summary are the real
// ones — only the numbers are canned.
const frioCalor = {
  comun: {
    abono_id: 1,
    abono_name: "abono mensual de 4 botellones de 20 lts",
    abono: 34000,
    abono_first_month: 17000,
    included_bottles: 4,
    excedente: 8500,
    price_list: "5",
  },
  bajo_sodio: {
    abono_id: 7,
    abono_name: "abono mensual de 4 botellones de 20 lts -NA",
    abono: 36000,
    abono_first_month: 18000,
    included_bottles: 4,
    excedente: 8900,
    price_list: "5",
  },
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
    return json(res, 200, {
      city: url.searchParams.get("city"),
      ...catalog,
      frio_calor: frioCalor,
    });
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
    // Mirror the abono math: half the first month, and the first 4 of the
    // included 20L are free.
    const abono = data.dispenser === "frio_calor" ? frioCalor[data.water_type === "bajo_sodio" ? "bajo_sodio" : "comun"] : null;
    const includedName = abono
      ? data.water_type === "bajo_sodio"
        ? "Botellón 20L Bajo Sodio"
        : "Botellón 20L"
      : null;
    const total = items.reduce((s, it) => {
      const free = it.product === includedName ? Math.min(it.qty, 4) : 0;
      return s + priceOf(it.product) * (it.qty - free);
    }, abono ? abono.abono_first_month : 0);
    const summary = (abono ? [`1x Abono Frío/Calor: ${abono.abono_name} — 1er mes 50% OFF`] : [])
      .concat(items.map((it) => `${it.qty}x ${it.product}`))
      .join(", ");
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
