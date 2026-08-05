// Canonical product catalog — the single source of truth for WHICH products
// CIMES sells, what they're called, and in what order they're offered.
//
// The client closed this list: exactly these 9 SKUs, the same in every zone, no
// matter what a WaterService price list happens to contain (docs/preguntas_licha.md
// §5). A price list is therefore a source of PRICES ONLY; everything else in it
// (dispensers, abonos, sanitización, packs) is not a product we sell.
//
// Matching a WaterService article to a SKU: pinned `wsId` first (article ids don't
// change), normalized-name regex as fallback. Names arrive code-prefixed in CIMES's
// instance ("10002  -  BOTELLON 20L"), so every regex must be prefix-tolerant.
//
// Website product images are keyed off `display` in website/js/wizard.js — keep the
// two in sync when adding a SKU.
import { normalizeText } from "../text.js";

/** "bajo sodio" marker — matches both WaterService's "NA" suffix and user phrasing. */
const LOW_SODIUM = /\bna\b|bajo.*sodio|menos.*sodio|sin.*sodio/;

export interface SkuDef {
  /** Stable slug. Never shown to users. */
  key: string;
  /** Pinned WaterService articulo_id. null => regex-only (see npm run dump:prices). */
  wsId: number | null;
  /** User-facing es-AR name. Must stay <= 24 chars (WhatsApp list row limit). */
  display: string;
  /** Tested against a normalized WaterService nombreArticulo. */
  match: RegExp;
  /** Tested against normalized user free text (WhatsApp). */
  aliases: RegExp;
  /** Must ALSO match, on both the name and the free-text path. */
  requires?: RegExp;
  /** Must NOT match, on both the name and the free-text path. */
  exclude?: RegExp;
  clientType: "bidon" | "soda";
}

/** Sales order: Botellón 20L first — the client's star/best-margin product. */
export const SKUS: SkuDef[] = [
  {
    key: "botellon-20l",
    wsId: null,
    display: "Botellón 20L",
    match: /botellon.*20|bidon.*20/,
    aliases: /botellon.*20|bidon.*20|\b20\s*l/,
    exclude: LOW_SODIUM,
    clientType: "bidon",
  },
  {
    key: "botellon-12l",
    wsId: null,
    display: "Botellón 12L",
    match: /botellon.*12|bidon.*12/,
    aliases: /botellon.*12|bidon.*12|\b12\s*l/,
    exclude: LOW_SODIUM,
    clientType: "bidon",
  },
  {
    key: "botellon-20l-na",
    wsId: null,
    display: "Botellón 20L Bajo Sodio",
    match: /botellon.*20|bidon.*20/,
    aliases: /botellon.*20|bidon.*20|\b20\s*l/,
    requires: LOW_SODIUM,
    clientType: "bidon",
  },
  {
    key: "botellon-12l-na",
    wsId: null,
    display: "Botellón 12L Bajo Sodio",
    match: /botellon.*12|bidon.*12/,
    aliases: /botellon.*12|bidon.*12|\b12\s*l/,
    requires: LOW_SODIUM,
    clientType: "bidon",
  },
  {
    key: "sifon",
    wsId: null,
    display: "Soda en Sifón 1,5L",
    match: /sifon|soda/,
    aliases: /sifon|soda/,
    clientType: "soda",
  },
  {
    key: "saborizada",
    wsId: null,
    display: "Agua Saborizada 1,5L",
    match: /saboriz/,
    aliases: /saboriz/,
    clientType: "soda",
  },
  {
    key: "gaseosa",
    wsId: null,
    display: "Gaseosa 2L",
    match: /gaseosa/,
    aliases: /gaseosa|refresco|coca/,
    clientType: "soda",
  },
  {
    key: "agua-2l",
    wsId: null,
    display: "Agua 2L",
    match: /\bagua\b.*\b2\s*l/,
    aliases: /\bagua\b.*\b2\s*l|agua.*botella|botella.*agua/,
    // "AGUA SABORIZADA 1.5 L" also contains "agua" — never let it land here.
    exclude: /saboriz|isoton|botellon|bidon|sifon|soda|gaseosa/,
    clientType: "bidon",
  },
  {
    key: "isotonica",
    wsId: null,
    display: "Isotónica CIMES 750mL",
    match: /isoton/,
    aliases: /isoton|powerade|cimes\s*plus/,
    clientType: "soda",
  },
];

function satisfies(sku: SkuDef, normalized: string, pattern: RegExp): boolean {
  if (!pattern.test(normalized)) return false;
  if (sku.requires && !sku.requires.test(normalized)) return false;
  if (sku.exclude && sku.exclude.test(normalized)) return false;
  return true;
}

/** True when this WaterService article is this SKU (pinned id wins over the name). */
function isArticle(sku: SkuDef, articuloId: string, name: string): boolean {
  if (sku.wsId !== null) return String(sku.wsId) === articuloId;
  return satisfies(sku, normalizeText(name), sku.match);
}

/** The SKU a WaterService article maps to, or null if we don't sell it. */
export function matchSku(articuloId: string, name: string): SkuDef | null {
  return SKUS.find((sku) => isArticle(sku, articuloId, name)) ?? null;
}

/** The SKU a user's free text refers to, or null. */
export function matchSkuByText(text: string): SkuDef | null {
  const t = normalizeText(text);
  return SKUS.find((sku) => satisfies(sku, t, sku.aliases)) ?? null;
}

/** The SKU behind a display name (order rows, sheet mirror). */
export function skuByDisplay(display: string): SkuDef | null {
  const d = normalizeText(display);
  return SKUS.find((sku) => normalizeText(sku.display) === d) ?? null;
}

/**
 * Reduce a raw price list to the products we actually sell, in sales order, with
 * canonical display names. Iterating SKUS (not the raw list) gives the ordering,
 * the dedupe, and the implicit drop of everything else for free.
 */
export function applyCatalog<T extends { id: string; name: string }>(raw: T[]): T[] {
  const products: T[] = [];
  const consumed = new Set<string>();
  for (const sku of SKUS) {
    const hit = raw.find((p) => !consumed.has(p.id) && isArticle(sku, p.id, p.name));
    if (!hit) continue;
    consumed.add(hit.id);
    products.push({ ...hit, name: sku.display });
  }
  return products;
}

/** SKUs the price list didn't carry — the operator alert's payload. */
export function missingSkus(products: { name: string }[]): SkuDef[] {
  const have = new Set(products.map((p) => normalizeText(p.name)));
  return SKUS.filter((sku) => !have.has(normalizeText(sku.display)));
}
