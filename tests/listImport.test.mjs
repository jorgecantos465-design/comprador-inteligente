import assert from "node:assert/strict";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import test from "node:test";
import { build } from "esbuild";
import XLSX from "xlsx";

async function loadModule(entryPoint, name, format = "esm") {
  const directory = await mkdtemp(join(tmpdir(), "comprador-inteligente-import-"));
  const output = join(directory, `${name}.${format === "cjs" ? "cjs" : "mjs"}`);
  await build({
    entryPoints: [entryPoint],
    outfile: output,
    bundle: true,
    format,
    platform: "node",
  });
  return import(pathToFileURL(output).href);
}

test("detects a commercial XLS table below administrative rows", async () => {
  const { parseExcelSheet } = await loadModule("src/parsers/parseExcelTable.ts", "parseExcelTable", "cjs");
  const matrix = [
    [],
    [],
    ["", "", "", "", "", "Fecha de Emisión:04/05/2026"],
    [],
    [],
    ["Las listas estan sujetas a variación sin previo aviso - LOS PRECIOS NO INCLUYEN IVA"],
    [],
    ["San Juan de Dios 921 - Dorrego - Mendoza - WhatsApp 261 - 4544377"],
    [],
    ["RUBRO", "", "", "CODIGO", "DESCRIPCION", "", 46146, 46140, "VAR"],
    ["6 DIETETICAS", "", "", 2772, "SAL DEL HIMALAYA FINA x 1 kg.", "", 2428.573, 2428.573, 0],
    ["", "", "", 4051, "ACEITE DE COCO NEUTRO 4 x 900 ml.", "", 21159.886, 21159.886, 0],
    ["", "", "", 878, "SAL MARINA FINA x 500 gs.", "", 2101.77, 2001.945, 0.049864],
  ];
  const sheet = XLSX.utils.aoa_to_sheet(matrix);
  sheet["!ref"] = "A1:I13";
  for (const address of ["I11", "I12", "I13"]) sheet[address].z = "0%";

  const result = parseExcelSheet(sheet);

  assert.equal(result.rows.length, 3);
  assert.match(result.warnings[0], /fila 10/u);
  assert.match(result.warnings[0], /columna G/u);
  assert.deepEqual(
    result.rows.map(({ product, price, unit, packageSize, category, sourceRow }) => ({ product, price, unit, packageSize, category, sourceRow })),
    [
      { product: "SAL DEL HIMALAYA FINA x 1 kg.", price: 2428.573, unit: "kg", packageSize: 1, category: "6 DIETETICAS", sourceRow: 11 },
      { product: "ACEITE DE COCO NEUTRO 4 x 900 ml.", price: 21159.886, unit: "ml", packageSize: 3600, category: "6 DIETETICAS", sourceRow: 12 },
      { product: "SAL MARINA FINA x 500 gs.", price: 2101.77, unit: "g", packageSize: 500, category: "6 DIETETICAS", sourceRow: 13 },
    ],
  );
  assert.equal(result.rows.some((row) => row.product.includes("Las listas estan sujetas")), false);
});

test("parses Argentine PDF prices without changing numeric Excel values", async () => {
  const { parseArgentinePrice } = await loadModule("src/domain/normalize.ts", "normalize");
  assert.equal(parseArgentinePrice("23.600"), 23600);
  assert.equal(parseArgentinePrice("21.240"), 21240);
  assert.equal(parseArgentinePrice("17.464"), 17464);
  assert.equal(parseArgentinePrice("20.414"), 20414);
  assert.equal(parseArgentinePrice("23,60"), 23.6);
  assert.equal(parseArgentinePrice("23.600,50"), 23600.5);
  assert.equal(parseArgentinePrice(2428.573), 2428.573);
});
