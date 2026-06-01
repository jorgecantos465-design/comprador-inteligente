import { parseUnit } from "./normalize";
import type { PurchaseItem, Unit } from "./types";

const unitPattern = "(?:kg|kilos?|kilogramos?|g|gr|gramos?|l|lt|litros?|ml|mililitros?|unidades?|u|paquetes?|packs?|cajas?)";
const ignoredLines = new Set([
  "producto",
  "cantidad",
  "producto cantidad",
  "precio",
  "total",
  "detalles",
  "fecha",
  "estado",
  "pago",
  "medio de pago",
  "envio",
  "direccion de envio",
]);

export function parseOrderText(text: string): PurchaseItem[] {
  let buyer = "Sin asignar";

  return text.split(/\r?\n/u).flatMap((rawLine) => {
    const line = rawLine.trim().replace(/^[-*•]\s*/u, "");
    if (!line) return [];
    if (isIgnoredLine(line)) return [];
    if (line.endsWith(":")) {
      buyer = line.slice(0, -1).trim() || "Sin asignar";
      return [];
    }

    const parsed = parseProductLine(line);
    if (!parsed) return [];
    return [{
      id: crypto.randomUUID(),
      buyer,
      product: parsed.product,
      quantity: parsed.quantity,
      unit: parsed.unit,
    }];
  });
}

function parseProductLine(line: string): Omit<PurchaseItem, "id" | "buyer"> | undefined {
  const prefix = line.match(new RegExp(`^(${quantityPattern()})\\s*(${unitPattern})?\\s+(.+)$`, "iu"));
  if (prefix) {
    return {
      quantity: parseQuantity(prefix[1]),
      unit: parseUnit(prefix[2]),
      product: prefix[3].trim(),
    };
  }

  const suffix = line.match(new RegExp(`^(.+?)\\s+(${quantityPattern()})\\s*(${unitPattern})?$`, "iu"));
  if (suffix) {
    return {
      product: suffix[1].trim(),
      quantity: parseQuantity(suffix[2]),
      unit: parseUnit(suffix[3]),
    };
  }

  return undefined;
}

function quantityPattern(): string {
  return "(?:\\d+\\/\\d+|\\d+(?:[.,]\\d+)?)";
}

function parseQuantity(value: string): number {
  if (value.includes("/")) {
    const [numerator, denominator] = value.split("/").map(Number);
    return denominator ? numerator / denominator : 1;
  }
  return Number(value.replace(",", ".")) || 1;
}

export function normalizeImportedUnit(value: string): Unit {
  return parseUnit(value);
}

function isIgnoredLine(value: string): boolean {
  const normalized = value
    .replace(/:$/u, "")
    .toLocaleLowerCase("es")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^\p{Letter}\p{Number}]+/gu, " ")
    .trim();
  return ignoredLines.has(normalized);
}
