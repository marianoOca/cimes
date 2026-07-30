// One-off: generate optimized WebP hero variants for the CIMES site.
// styles.css serves the WebP via image-set(); hero-desktop.jpg is the no-webp
// fallback for both breakpoints.
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
  // Mobile hero: downscaled from the 1580x600 desktop master (the standalone
  // hero-mobile.png master is only 480w — too low-res, it looked pixelated once
  // served). 1280w keeps it crisp on phones behind the gradient at ~38 KB.
  { in: "hero-desktop.jpg", out: "hero-mobile.webp", width: 1280, quality: 78 },
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
