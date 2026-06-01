import assert from "node:assert/strict";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import test from "node:test";
import { build } from "esbuild";

async function loadCalculator() {
  const directory = await mkdtemp(join(tmpdir(), "comprador-inteligente-calculate-"));
  const output = join(directory, "calculate.mjs");
  await build({
    entryPoints: ["src/domain/calculate.ts"],
    outfile: output,
    bundle: true,
    format: "esm",
    platform: "node",
  });
  return import(pathToFileURL(output).href);
}

test("matches an order item after removing presentation details", async () => {
  const { calculateStrategy } = await loadCalculator();
  const supplier = { id: "supplier-a", name: "Proveedor A", distance: "", notes: "" };
  const lists = [{
    id: "list-a",
    supplierId: supplier.id,
    fileName: "lista-real.xls",
    sourceType: "xlsx",
    warnings: [],
    rows: [{
      id: "row-a",
      product: "AVENA ARROLLADA INSTANTANEA x 1 kg.",
      price: 2428.573,
      unit: "kg",
      packageSize: 1,
      sourceRow: 25,
      warnings: [],
    }],
  }];
  const items = [{
    id: "item-a",
    buyer: "Flor",
    product: "Avena Instantánea 1 kg",
    quantity: 1,
    unit: "kg",
  }];

  const strategy = calculateStrategy([supplier], lists, items, []);

  assert.equal(strategy.comparisons[0].item.buyer, "Flor");
  assert.equal(strategy.comparisons[0].best?.supplierId, supplier.id);
  assert.equal(strategy.comparisons[0].best?.fileName, "lista-real.xls");
  assert.equal(strategy.comparisons[0].best?.normalizedUnitPrice, 2428.573);
  assert.equal(strategy.optimalTotal, 2428.573);
});
