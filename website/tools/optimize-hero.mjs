// One-off: generate optimized WebP hero variants for the CIMES site.
// The originals (hero-mobile.png, hero-desktop.jpg) stay as fallbacks; index.html
// serves the WebP via <picture>/image-set with the original as fallback.
//
// `sharp` is NOT a runtime dependency of the site or backend. Install it only to
// run this script, then commit the generated .webp files:
//   cd website && npm i sharp && node tools/optimize-hero.mjs
// or with sharp installed elsewhere:
//   NODE_PATH=/path/to/node_modules node website/tools/optimize-hero.mjs
import sharp from "sharp";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const assets = join(dirname(fileURLToPath(import.meta.url)), "..", "assets");

const jobs = [
  // Mobile hero: photographic content shipped as a 513 KB PNG at 480w. WebP at
  // the same width is an order of magnitude smaller and becomes a clean LCP.
  { in: "hero-mobile.png", out: "hero-mobile.webp", width: 480, quality: 80 },
  // Desktop hero background (1580x600).
  { in: "hero-desktop.jpg", out: "hero-desktop.webp", width: 1580, quality: 78 },
];

for (const j of jobs) {
  const info = await sharp(join(assets, j.in))
    .resize({ width: j.width, withoutEnlargement: true })
    .webp({ quality: j.quality })
    .toFile(join(assets, j.out));
  console.log(`${j.out}: ${info.width}x${info.height}, ${Math.round(info.size / 1024)} KB`);
}
