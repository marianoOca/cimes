// Local QA server for the CIMES website.
// Serves website/ statically AND proxies /api/* to the backend, so the browser
// talks to a single origin (no CORS). Overrides /config.js to point the wizard
// at this same origin. Edits NO tracked files.
//
//   node qa-server.mjs
//   env: WEBSITE_DIR (required), BACKEND=http://localhost:3000, PORT=8080,
//        WA_NUMBER=<sales wa number for the deep links>
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { join, extname, normalize } from "node:path";

const WEBSITE_DIR = process.env.WEBSITE_DIR;
const BACKEND = (process.env.BACKEND || "http://localhost:3000").replace(/\/$/, "");
const PORT = Number(process.env.PORT || 8080);
const WA_NUMBER = process.env.WA_NUMBER || "5491100000000";

if (!WEBSITE_DIR) {
  console.error("WEBSITE_DIR env is required");
  process.exit(1);
}

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".xml": "application/xml",
  ".txt": "text/plain; charset=utf-8",
};

// Same-origin config: API_BASE_URL="" -> wizard fetches "/api/..." on this host.
const CONFIG_JS =
  `window.CIMES_CONFIG = { API_BASE_URL: "", WHATSAPP_NUMBER_SALES: "${WA_NUMBER}" };\n`;

const server = createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  const path = url.pathname;

  // 1. Proxy the wizard's API calls to the real backend.
  if (path.startsWith("/api/")) {
    try {
      const chunks = [];
      for await (const c of req) chunks.push(c);
      const body = Buffer.concat(chunks);
      const upstream = await fetch(BACKEND + path + url.search, {
        method: req.method,
        headers: { "content-type": req.headers["content-type"] || "application/json" },
        body: ["GET", "HEAD"].includes(req.method) ? undefined : body,
      });
      const text = await upstream.text();
      res.writeHead(upstream.status, {
        "content-type": upstream.headers.get("content-type") || "application/json",
      });
      res.end(text);
      console.log(`${req.method} ${path} -> ${upstream.status}`);
    } catch (err) {
      res.writeHead(502, { "content-type": "application/json" });
      res.end(JSON.stringify({ error: "backend_unreachable", detail: String(err) }));
      console.error(`${req.method} ${path} -> 502 (${err})`);
    }
    return;
  }

  // Dev: never let the browser cache assets (app.js/styles.css/copy) — stale
  // caching across restarts is a constant dev footgun.
  const NO_CACHE = "no-store, no-cache, must-revalidate";

  // 2. Override config.js so the static file's placeholder URL is never used.
  if (path === "/config.js") {
    res.writeHead(200, { "content-type": MIME[".js"], "cache-control": NO_CACHE });
    res.end(CONFIG_JS);
    return;
  }

  // 3. Static files from website/. A trailing-slash path is a directory
  //    request -> serve its index.html (mirrors Apache's DirectoryIndex, so
  //    /alta/ resolves to website/alta/index.html like it will in production).
  const wanted = path === "/" || path.endsWith("/") ? path + "index.html" : path;
  const rel = normalize(wanted).replace(/^(\.\.[/\\])+/, "");
  const file = join(WEBSITE_DIR, rel);
  if (!file.startsWith(WEBSITE_DIR)) {
    res.writeHead(403);
    res.end("forbidden");
    return;
  }
  try {
    const data = await readFile(file);
    res.writeHead(200, {
      "content-type": MIME[extname(file)] || "application/octet-stream",
      "cache-control": NO_CACHE,
    });
    res.end(data);
  } catch {
    res.writeHead(404, { "content-type": "text/plain" });
    res.end("not found");
  }
});

server.listen(PORT, () => {
  console.log(`QA site:    http://localhost:${PORT}`);
  console.log(`Proxying /api/* -> ${BACKEND}`);
});
