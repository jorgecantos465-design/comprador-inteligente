import assert from "node:assert/strict";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import test from "node:test";
import { build } from "esbuild";

async function loadParser() {
  const directory = await mkdtemp(join(tmpdir(), "comprador-inteligente-"));
  const output = join(directory, "parseOrderText.mjs");
  await build({
    entryPoints: ["src/domain/parseOrderText.ts"],
    outfile: output,
    bundle: true,
    format: "esm",
    platform: "node",
  });
  return import(pathToFileURL(output).href);
}

test("imports product blocks without treating headings as products", async () => {
  const { parseOrderText } = await loadParser();
  const items = parseOrderText(`Producto Cantidad
Precio
Jorge:
Sésamo Integral 1 kg
Pasas Negras Premium 1 kg
Lino Marrón Limpio de Primera 1 kg
Girasol Pelado Limpio G1 Premium 1 kg
Maní sin sal Premium 2 kg
Almendras Enteras con Partidas 1 kg
Avena Instantánea 1 kg

Mamá:
Nueces 1 kg
Almendras 500 g

Cliente:
Maní sin sal Premium 1 kg
Pasas Negras Premium 500 g`);

  assert.equal(items.length, 11);
  assert.deepEqual(
    Object.fromEntries(Object.entries(Object.groupBy(items, (item) => item.buyer)).map(([buyer, buyerItems]) => [buyer, buyerItems.length])),
    { Jorge: 7, Mamá: 2, Cliente: 2 },
  );
  assert.equal(items.some((item) => ["Producto Cantidad", "Precio", "Jorge"].includes(item.product)), false);
});

test("supports compact units, fractions and unassigned products", async () => {
  const { parseOrderText } = await loadParser();
  const items = parseOrderText(`Producto
1kg almendras
nueces 500gr
pasas 0.5 kg
lino 1/2 kg
2 unidades leche de almendras
3 manzanas`);

  assert.deepEqual(items.map(({ buyer, product, quantity, unit }) => ({ buyer, product, quantity, unit })), [
    { buyer: "Sin asignar", product: "almendras", quantity: 1, unit: "kg" },
    { buyer: "Sin asignar", product: "nueces", quantity: 500, unit: "g" },
    { buyer: "Sin asignar", product: "pasas", quantity: 0.5, unit: "kg" },
    { buyer: "Sin asignar", product: "lino", quantity: 0.5, unit: "kg" },
    { buyer: "Sin asignar", product: "leche de almendras", quantity: 2, unit: "unit" },
    { buyer: "Sin asignar", product: "manzanas", quantity: 3, unit: "unit" },
  ]);
});

test("keeps buyers from plain block headings and supports tab-separated rows", async () => {
  const { parseOrderText } = await loadParser();
  const items = parseOrderText(`Jorge
Producto	Cantidad
Sésamo Integral	1kg
Pasas Negras Premium	1kg
Lino Marrón Limpio de Primera	1kg
Girasol Pelado Limpio G1 (Premium)	1kg
Maní sin sal Premium	1kg
Almendras Partidas	1 kg
Avena Instantánea	1 kg
nueces 1kg

Maria
Almendras partidas  1kg
mani  sin sal  1 kg
mix clasico 1kg

Flor
AVENA ARROLLADA INSTANTANEA 1 kg
SAL DEL HIMALAYA FINA 1 kg
QUINOA (QUINUA) NACIONAL 1 kg`);

  assert.deepEqual(
    Object.fromEntries(Object.entries(Object.groupBy(items, (item) => item.buyer)).map(([buyer, buyerItems]) => [buyer, buyerItems.length])),
    { Jorge: 8, Maria: 3, Flor: 3 },
  );
  assert.equal(items.some((item) => item.buyer === "Sin asignar"), false);
  assert.equal(items.some((item) => ["Producto", "Cantidad", "Producto Cantidad"].includes(item.product)), false);
});
