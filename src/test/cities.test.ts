// City fuzzy matcher: the "Otra ciudad" free-text entry snaps whatever the user
// types to the closest BA city (typo-tolerant), and genuinely non-city input is
// kept as-is rather than force-matched to a wrong city.
import { describe, expect, it } from "vitest";
import { BA_CITIES, matchCity } from "../src/engine/cities.js";

describe("cities: matchCity", () => {
  it("matches exactly, ignoring case and diacritics", () => {
    expect(matchCity("la plata")).toMatchObject({ city: "La Plata", matched: true });
    expect(matchCity("LOBOS")).toMatchObject({ city: "Lobos", matched: true });
    expect(matchCity("lujan")).toMatchObject({ city: "Luján", matched: true });
  });

  it("snaps a misspelling to the closest city", () => {
    expect(matchCity("lujann").city).toBe("Luján");
    expect(matchCity("quilmez").city).toBe("Quilmes");
    expect(matchCity("necoch").city).toBe("Necochea");
  });

  it("recovers the canonical form from a de-slugged name", () => {
    expect(matchCity("belen de escobar").city).toBe("Belén de Escobar");
    expect(matchCity("veronica")).toMatchObject({ city: "Verónica", matched: true });
    expect(matchCity("25 de mayo").city).toBe("25 de Mayo");
  });

  it("expands common AR abbreviations (Gral./Cnel./Cap.)", () => {
    expect(matchCity("Gral. Pinto")).toEqual({ city: "General Pinto", matched: true, score: 1, suggestions: ["General Pinto"] });
    expect(matchCity("gral las heras").city).toBe("General Las Heras");
    expect(matchCity("Cnel. Suárez").city).toBe("Coronel Suárez");
    expect(matchCity("cap sarmiento").city).toBe("Capitán Sarmiento");
  });

  // Regression cases reported during QA (a typo, and an abbreviation with a period).
  // Keep these snapping so the "Otra Ciudad" entry never dead-ends on them again.
  it("snaps QA-reported cases: 'nechochea' → Necochea, 'gral. pinto' → General Pinto", () => {
    expect(matchCity("nechochea")).toMatchObject({ city: "Necochea", matched: true });
    expect(matchCity("gral. pinto")).toMatchObject({ city: "General Pinto", matched: true });
  });

  it("keeps unrecognizable input instead of forcing a bad snap", () => {
    const r = matchCity("xkcdqwzptlmn");
    expect(r.matched).toBe(false);
    expect(r.city).toBe("xkcdqwzptlmn");
  });

  // `suggestions` are always real BA cities (the 1–3 closest), even below the
  // match floor — they feed the website's "did you mean?" second thought.
  it("offers the 1–3 closest real cities as `suggestions`, even below the match floor", () => {
    // Matched input: a single suggestion, the canonical city itself.
    expect(matchCity("lujann").suggestions).toEqual(["Luján"]);
    expect(matchCity("necoch").suggestions).toEqual(["Necochea"]);
    // Unrecognized input: kept as-is, but paired with the closest real cities (1–3).
    const monteChico = matchCity("monte chico");
    expect(monteChico.matched).toBe(false);
    expect(monteChico.city).toBe("monte chico");
    expect(monteChico.suggestions.length).toBeGreaterThanOrEqual(1);
    expect(monteChico.suggestions.length).toBeLessThanOrEqual(3);
    monteChico.suggestions.forEach((s) => expect(BA_CITIES).toContain(s));
    // A near-tie surfaces more than one option (the reported "montecito" case:
    // both Monte Hermoso and Monte Grande, not just the single closest).
    const montecito = matchCity("montecito");
    expect(montecito.suggestions.length).toBeGreaterThan(1);
    expect(montecito.suggestions).toContain("Monte Hermoso");
    expect(montecito.suggestions).toContain("Monte Grande");
    // Empty input is the only case with no suggestions.
    expect(matchCity("   ").suggestions).toEqual([]);
  });

  it("does not match empty / whitespace input", () => {
    expect(matchCity("   ")).toMatchObject({ matched: false });
  });

  it("resolves every canonical city to itself", () => {
    for (const c of BA_CITIES) {
      expect(matchCity(c)).toEqual({ city: c, matched: true, score: 1, suggestions: [c] });
    }
  });
});
