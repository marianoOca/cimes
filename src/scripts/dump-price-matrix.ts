// Read-only dump of the WaterService #10 price matrix. Used to pin the real
// `articulo_id` of each catalog SKU (src/catalog/skus.ts) and to discover which
// lista_id corresponds to LISTA PRECIOS GENERAL / PRECIO LOBOS / PRECIO CAMPANA
// ESPECIAL. Pure read — safe to re-run.
//
//   cd src && npm run dump:prices
import { config } from "../src/config.js";
import { obtenerMatrizListaDePrecios } from "../src/waterservice/client.js";
import { matchSku } from "../src/catalog/skus.js";

const matrix = await obtenerMatrizListaDePrecios(config.WS_TIPO_LISTA_ID);

console.log(`\n=== Listas (tipoLista_id=${config.WS_TIPO_LISTA_ID}) ===`);
for (const l of matrix.listas) {
  console.log(`  ${String(l.lista_id).padStart(5)}  ${l.nombre}`);
}

console.log(`\n=== Articulos (${matrix.articulos.length}) ===`);
console.log(
  `${"id".padStart(6)}  ${"SKU match".padEnd(24)}  ${"nombreArticulo".padEnd(44)}  rubro / listas`,
);
for (const a of matrix.articulos) {
  const sku = matchSku(String(a.articulo_id), a.nombreArticulo);
  const lists = a.precios.map((p) => `${p.lista_id}:$${p.precio}`).join(" ");
  console.log(
    `${String(a.articulo_id).padStart(6)}  ${(sku?.key ?? "—").padEnd(24)}  ` +
      `${a.nombreArticulo.padEnd(44)}  ${a.rubro ?? "—"} | ${lists}`,
  );
}

console.log("\n=== SKU resolution per lista ===");
for (const l of matrix.listas) {
  const hits = new Map<string, string>();
  for (const a of matrix.articulos) {
    if (!a.precios.some((p) => p.lista_id === l.lista_id)) continue;
    const sku = matchSku(String(a.articulo_id), a.nombreArticulo);
    if (sku) hits.set(sku.key, a.nombreArticulo);
  }
  console.log(`  lista ${l.lista_id} (${l.nombre}): ${hits.size}/9 SKUs`);
  for (const [key, name] of hits) console.log(`      ${key.padEnd(24)} <- ${name}`);
}
