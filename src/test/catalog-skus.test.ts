// The catalog allowlist (src/catalog/skus.ts): the 9 SKUs CIMES sells are the same
// in every zone, no matter what a WaterService price list contains.
import { describe, expect, it } from "vitest";
import {
  applyCatalog,
  matchSku,
  matchSkuByText,
  missingSkus,
  SKUS,
} from "../src/catalog/skus.js";

/** A realistic list: code-prefixed CIMES names plus junk the real lists carry. */
function rawList() {
  return [
    { id: "1", name: "10001  -  BOTELLON 12L", price: 6000 },
    { id: "2", name: "10002  -  BOTELLON 20L", price: 8500 },
    { id: "3", name: "10003  -  BOTELLON 12L NA", price: 6400 },
    { id: "4", name: "10004  -  BOTELLON 20L NA", price: 8900 },
    { id: "5", name: "10005  -  SIFON 1 1/2L", price: 1600 },
    { id: "6", name: "10006  -  AGUA SABORIZADA 1.5 L", price: 1800 },
    { id: "7", name: "10007  -  GASEOSAS 2 L", price: 2400 },
    { id: "8", name: "10008  -  AGUA 2L", price: 1200 },
    { id: "9", name: "10009  -  CIMES PLUS ISOTONICA 750 ml", price: 2100 },
    { id: "1014", name: "Sanitizacion de Dispenser", price: 9000 },
    { id: "1015", name: "Abono mensual frio-calor 4 botellones", price: 38000 },
    { id: "1016", name: "Envase retornable", price: 5000 },
  ];
}

describe("catalog SKU registry", () => {
  it("every display name fits a WhatsApp list row (24 chars)", () => {
    for (const sku of SKUS) expect(sku.display.length).toBeLessThanOrEqual(24);
  });

  it("has 9 SKUs with unique keys and display names", () => {
    expect(SKUS).toHaveLength(9);
    expect(new Set(SKUS.map((s) => s.key)).size).toBe(9);
    expect(new Set(SKUS.map((s) => s.display)).size).toBe(9);
  });
});

describe("matchSku — WaterService article -> SKU", () => {
  it("tolerates the internal-code prefix and extra spacing", () => {
    expect(matchSku("2", "10002  -  BOTELLON 20L")?.key).toBe("botellon-20l");
  });

  it("keeps the NA (bajo sodio) variants apart from the plain ones", () => {
    expect(matchSku("2", "BOTELLON 20L")?.key).toBe("botellon-20l");
    expect(matchSku("4", "BOTELLON 20L NA")?.key).toBe("botellon-20l-na");
    expect(matchSku("1", "BOTELLON 12L")?.key).toBe("botellon-12l");
    expect(matchSku("3", "BOTELLON 12L NA")?.key).toBe("botellon-12l-na");
  });

  it("does not let AGUA 2L swallow AGUA SABORIZADA", () => {
    expect(matchSku("6", "AGUA SABORIZADA 1.5 L")?.key).toBe("saborizada");
    expect(matchSku("8", "AGUA 2L")?.key).toBe("agua-2l");
  });

  it("returns null for articles we don't sell", () => {
    expect(matchSku("1014", "Sanitizacion de Dispenser")).toBeNull();
    expect(matchSku("1015", "Abono mensual frio-calor 4 botellones")).toBeNull();
    expect(matchSku("1016", "Envase retornable")).toBeNull();
  });

  // Every SKU ships with wsId: null (regex path) until `npm run dump:prices` pins the
  // real ids. Once pinned, the id must win outright — even against a renamed article.
  it("a pinned wsId wins over the name", () => {
    const sku = SKUS[0]!;
    sku.wsId = 777;
    try {
      expect(matchSku("777", "nombre completamente distinto")?.key).toBe(sku.key);
      // With an id pinned, the name no longer qualifies an article.
      expect(matchSku("2", "BOTELLON 20L")).toBeNull();
    } finally {
      sku.wsId = null;
    }
  });
});

describe("matchSkuByText — user free text -> SKU", () => {
  const cases: [string, string][] = [
    ["quiero un bidón de 20 litros", "botellon-20l"],
    ["un botellón de 12", "botellon-12l"],
    ["botellon de 20 bajo sodio", "botellon-20l-na"],
    ["bidon 12 menos sodio", "botellon-12l-na"],
    ["me mandás una soda?", "sifon"],
    ["agua saborizada de pomelo", "saborizada"],
    ["una gaseosa", "gaseosa"],
    ["agua en botella 2l", "agua-2l"],
    ["tienen powerade?", "isotonica"],
  ];
  for (const [text, key] of cases) {
    it(`"${text}" -> ${key}`, () => {
      expect(matchSkuByText(text)?.key).toBe(key);
    });
  }

  it("returns null for things we don't sell", () => {
    expect(matchSkuByText("quiero un dispenser frío calor")).toBeNull();
    expect(matchSkuByText("hola buenas tardes")).toBeNull();
  });
});

describe("applyCatalog", () => {
  it("keeps only the 9 SKUs, in sales order, with canonical names", () => {
    const products = applyCatalog(rawList());
    expect(products.map((p) => p.name)).toEqual([
      "Botellón 20L",
      "Botellón 12L",
      "Botellón 20L Bajo Sodio",
      "Botellón 12L Bajo Sodio",
      "Soda en Sifón 1,5L",
      "Agua Saborizada 1,5L",
      "Gaseosa 2L",
      "Agua 2L",
      "Isotónica CIMES 750mL",
    ]);
  });

  it("keeps the WaterService id and price of each kept article", () => {
    const products = applyCatalog(rawList());
    expect(products[0]).toEqual({ id: "2", name: "Botellón 20L", price: 8500 });
  });

  it("drops non-catalog articles", () => {
    const ids = applyCatalog(rawList()).map((p) => p.id);
    expect(ids).not.toContain("1014");
    expect(ids).not.toContain("1015");
    expect(ids).not.toContain("1016");
  });

  it("never maps two SKUs onto the same article", () => {
    const products = applyCatalog(rawList());
    expect(new Set(products.map((p) => p.id)).size).toBe(products.length);
  });

  it("returns an empty list when the price list carries no catalog SKU", () => {
    expect(applyCatalog([{ id: "1014", name: "Sanitizacion de Dispenser", price: 1 }])).toEqual(
      [],
    );
  });

  it("silently omits a SKU the list didn't price", () => {
    const partial = rawList().filter((p) => p.id !== "9" && p.id !== "7");
    const products = applyCatalog(partial);
    expect(products).toHaveLength(7);
    expect(missingSkus(products).map((s) => s.key)).toEqual(["gaseosa", "isotonica"]);
  });

  it("reports no gaps for a complete list", () => {
    expect(missingSkus(applyCatalog(rawList()))).toEqual([]);
  });
});
