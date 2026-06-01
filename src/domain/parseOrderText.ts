import { parseUnit } from "./normalize";
import type { PurchaseItem, Unit } from "./types";

const unitPattern = "(?:kg|kilos?|kilogramos?|g|gr|gramos?|l|lt|litros?|ml|mililitros?|unidades?|u|paquetes?|packs?|cajas?)";

export function parseOrderText(text: string): PurchaseItem[] {
  let buyer = "Sin asignar";

  return text.split(/\r?\n/u).flatMap((rawLine) => {
    const line = rawLine.trim().replace(/^[-*•]\s*/u, "");
    if (!line) return [];
    if (line.endsWith(":")) {
      buyer = line.slice(0, -1).trim() || "Sin asignar";
      return [];
    }

    const parsed = parseProductLine(line);
    return [{
      id: crypto.randomUUID(),
      buyer,
      product: parsed.product,
      quantity: parsed.quantity,
      unit: parsed.unit,
    }];
  });
}

function parseProductLine(line: string): Omit<PurchaseItem, "id" | "buyer"> {
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

  return { product: line, quantity: 1, unit: "unit" };
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
