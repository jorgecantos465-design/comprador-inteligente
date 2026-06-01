import assert from "node:assert/strict";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import test from "node:test";
import { build } from "esbuild";

async function loadSessionModule() {
  const directory = await mkdtemp(join(tmpdir(), "comprador-inteligente-session-"));
  const output = join(directory, "localSession.mjs");
  await build({
    entryPoints: ["src/domain/localSession.ts"],
    outfile: output,
    bundle: true,
    format: "esm",
    platform: "node",
  });
  return import(pathToFileURL(output).href);
}

function createStorage() {
  const data = new Map();
  return {
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => data.set(key, value),
    removeItem: (key) => data.delete(key),
  };
}

test("saves, restores and clears processed session data", async () => {
  const { clearLocalSession, loadLocalSession, saveLocalSession } = await loadSessionModule();
  const storage = createStorage();
  const session = {
    suppliers: [{ id: "supplier-1", name: "Proveedor", distance: "", notes: "" }],
    lists: [{ id: "list-1", supplierId: "supplier-1", fileName: "lista.csv", sourceType: "csv", rows: [], warnings: [] }],
    aliases: [],
    items: [{ id: "item-1", buyer: "Jorge", product: "Almendras", quantity: 1, unit: "kg" }],
  };

  assert.equal(saveLocalSession(storage, session), undefined);
  assert.deepEqual(loadLocalSession(storage), { session });
  assert.equal(clearLocalSession(storage), undefined);
  assert.deepEqual(loadLocalSession(storage), {});
});

test("reports storage failures without throwing", async () => {
  const { clearLocalSession, loadLocalSession, saveLocalSession } = await loadSessionModule();
  const storage = {
    getItem: () => { throw new Error("blocked"); },
    setItem: () => { throw new Error("blocked"); },
    removeItem: () => { throw new Error("blocked"); },
  };
  const session = { suppliers: [], lists: [], aliases: [], items: [] };

  assert.match(loadLocalSession(storage).error, /No se pudo acceder/u);
  assert.match(saveLocalSession(storage, session), /No se pudo guardar/u);
  assert.match(clearLocalSession(storage), /No se pudo borrar/u);
});
