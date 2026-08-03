// Buenos Aires province cities + a fuzzy matcher, shared by the website
// (GET /api/cities, POST /api/resolve-city) and the WhatsApp engine. Single
// source of truth: the "Otra ciudad" free-text entry snaps whatever the user
// types to the closest real city here, then the normal order flow runs and
// WaterService decides coverage. The 8 shortcut cities (COVERED_CITIES) are a
// convenience subset of this list, not a coverage gate.

/** Canonical BA-province city names (display casing, es-AR). */
export const BA_CITIES: string[] = [
  "Carhué", "Adolfo Gonzales Chaves", "Alberti", "Adrogué", "Arrecifes",
  "Avellaneda", "Ayacucho", "Azul", "Bahía Blanca", "San José de Balcarce",
  "Santiago del Baradero", "Benito Juárez", "Berazategui", "Berisso",
  "San Carlos de Bolívar", "Bragado", "Coronel Brandsen", "Campana", "Cañuelas",
  "Capitán Sarmiento", "Carlos Casares", "Carlos Tejedor", "Carmen de Areco",
  "Castelli", "Chacabuco", "Chascomús", "Chivilcoy", "Colón", "Punta Alta",
  "Coronel Dorrego", "Coronel Pringles", "Coronel Suárez", "Daireaux", "Dolores",
  "Ensenada", "Belén de Escobar", "Monte Grande", "Capilla del Señor",
  "José María Ezeiza", "Florentino Ameghino", "Florencio Varela", "Miramar",
  "General Alvear", "General Arenales", "General Belgrano", "General Guido",
  "General Juan Madariaga", "General La Madrid", "General Las Heras",
  "General Lavalle", "Ranchos", "General Pinto", "Mar del Plata",
  "General Rodríguez", "San Martín", "Los Toldos", "General Villegas", "Guaminí",
  "Hurlingham", "Henderson", "Ituzaingó", "José C. Paz", "Junín", "Mar del Tuyú",
  "San Justo", "La Plata", "Lanús", "Laprida", "Las Flores", "Vedia", "Lezama",
  "Lincoln", "Lobería", "Lobos", "Lomas de Zamora", "Luján", "Magdalena",
  "Maipú", "Los Polvorines", "Coronel Vidal", "Marcos Paz", "Mercedes", "Merlo",
  "San Miguel del Monte", "Monte Hermoso", "Moreno", "Morón", "Navarro",
  "Necochea", "Nueve de Julio", "Olavarría", "Carmen de Patagones", "Pehuajó",
  "Pellegrini", "Pergamino", "Pila", "Pilar", "Pinamar", "Guernica", "Puan",
  "Verónica", "Quilmes", "Ramallo", "Rauch", "América", "Rojas", "Roque Pérez",
  "Pigüé", "Saladillo", "Salliqueló", "Salto", "San Andrés de Giles",
  "San Antonio de Areco", "San Cayetano", "San Fernando", "San Isidro",
  "San Miguel", "San Nicolás de los Arroyos", "San Pedro", "San Vicente",
  "Suipacha", "Tandil", "Tapalqué", "Tigre", "General Conesa", "Tornquist",
  "Trenque Lauquen", "Tres Arroyos", "Caseros", "Tres Lomas", "25 de Mayo",
  "Olivos", "Villa Gesell", "Médanos", "Zárate",
];

// Common AR city-name abbreviations, expanded token-wise so "Gral. Pinto",
// "Cnel. Suárez", "Cap. Sarmiento" snap exactly instead of relying on edit
// distance. Keys must be the diacritic-stripped forms. Only prefixes that
// actually appear in BA_CITIES are worth listing (General/Coronel/Capitán).
const ABBREV: Record<string, string> = {
  gral: "general",
  grl: "general",
  cnel: "coronel",
  cnl: "coronel",
  crnel: "coronel",
  cap: "capitan",
};

/** Lowercase, strip diacritics + punctuation, expand abbreviations, collapse spaces. */
function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[.,]/g, " ")
    .trim()
    .replace(/\s+/g, " ")
    .split(" ")
    .map((t) => ABBREV[t] ?? t)
    .join(" ");
}

const NORMALIZED = BA_CITIES.map((city) => ({ city, norm: normalize(city) }));

/** Classic Levenshtein edit distance (cities are short — cheap). */
function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  let prev = Array.from({ length: n + 1 }, (_, j) => j);
  const curr = new Array<number>(n + 1);
  for (let i = 1; i <= m; i++) {
    curr[0] = i;
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(prev[j]! + 1, curr[j - 1]! + 1, prev[j - 1]! + cost);
    }
    prev = curr.slice();
  }
  return prev[n]!;
}

export interface CityMatch {
  /** Canonical city if matched, otherwise the trimmed input (never rejected). */
  city: string;
  matched: boolean;
  /** 0..1 similarity of the winning candidate. */
  score: number;
  /**
   * The 1–3 closest real BA cities, best-first — the winner plus any near-equals
   * within SUGGESTION_BAND of it. Empty only for empty input. The website's "Otra
   * ciudad" flow surfaces these as "did you mean?" options when the typed city
   * isn't recognized.
   */
  suggestions: string[];
}

// Below this similarity we keep the user's text as-is rather than force a bad
// snap — coverage will still decide. Above it we accept the closest city, which
// is what lets a misspelling ("lujann" → "Luján") sail through.
const MATCH_FLOOR = 0.6;

// "Did you mean?" offers up to MAX_SUGGESTIONS cities: the closest, plus any
// runner-up within SUGGESTION_BAND of it. The band keeps it to genuine
// near-equals — "montecito" surfaces both Monte Hermoso and Monte Grande, while
// a clear single winner stays a single option.
const MAX_SUGGESTIONS = 3;
const SUGGESTION_BAND = 0.12;

/** Snap free-text to the closest BA city. Accepts typos; never rejects input. */
export function matchCity(input: string): CityMatch {
  const raw = input.trim();
  const q = normalize(raw);
  if (!q) return { city: raw, matched: false, score: 0, suggestions: [] };

  const scored = NORMALIZED.map((e) => {
    let score = 1 - levenshtein(q, e.norm) / Math.max(q.length, e.norm.length);
    // A clean containment (typed city with minor extra words, or a prefix) is a
    // strong signal edit-distance alone can undervalue on longer names.
    if (e.norm.includes(q) || q.includes(e.norm)) score = Math.max(score, 0.85);
    return { city: e.city, norm: e.norm, score };
  });

  // An exact normalized hit wins outright (score 1, itself as the sole suggestion).
  const exact = scored.find((s) => s.norm === q);
  if (exact) return { city: exact.city, matched: true, score: 1, suggestions: [exact.city] };

  scored.sort((a, b) => b.score - a.score);
  const best = scored[0]!;
  const suggestions = scored
    .filter((s) => s.score >= best.score - SUGGESTION_BAND)
    .slice(0, MAX_SUGGESTIONS)
    .map((s) => s.city);

  return best.score >= MATCH_FLOOR
    ? { city: best.city, matched: true, score: best.score, suggestions }
    : { city: raw, matched: false, score: best.score, suggestions };
}
