// Shared text normalization: lowercase, strip accents, trim. Used for matching
// user free text and WaterService article names against the SKU registry.
export function normalizeText(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim();
}
