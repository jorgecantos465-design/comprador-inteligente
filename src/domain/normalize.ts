import type { Alias, Unit } from "./types";

const singularRules: Array<[RegExp, string]> = [
  [/ces$/u, "z"],
  [/es$/u, ""],
  [/s$/u, ""],
];

export function normalizeProductName(value: string): string {
  const tokens = value
    .toLocaleLowerCase("es")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^\p{Letter}\p{Number}]+/gu, " ")
    .trim()
    .split(/\s+/u)
    .filter(Boolean)
    .map(singularize);

  return tokens.join(" ");
}

function singularize(token: string): string {
  if (token.length < 4) return token;
  for (const [pattern, replacement] of singularRules) {
    if (pattern.test(token)) return token.replace(pattern, replacement);
  }
  return token;
}

export function canonicalName(value: string, aliases: Alias[]): string {
  let current = normalizeProductName(value);
  const visited = new Set<string>();

  while (!visited.has(current)) {
    visited.add(current);
    const alias = aliases.find((item) => normalizeProductName(item.from) === current);
    if (!alias) break;
    current = normalizeProductName(alias.to);
  }

  return current;
}

export function similarity(left: string, right: string): number {
  const a = new Set(normalizeProductName(left).split(" ").filter(Boolean));
  const b = new Set(normalizeProductName(right).split(" ").filter(Boolean));
  if (!a.size || !b.size) return 0;
  const intersection = [...a].filter((token) => b.has(token)).length;
  const union = new Set([...a, ...b]).size;
  return intersection / union;
}

export function parseUnit(value: unknown): Unit {
  const text = String(value ?? "")
    .toLocaleLowerCase("es")
    .trim();
  if (["kg", "kilo", "kilos", "kilogramo", "kilogramos"].includes(text)) return "kg";
  if (["g", "gr", "gramo", "gramos"].includes(text)) return "g";
  if (["l", "lt", "litro", "litros"].includes(text)) return "l";
  if (["ml", "mililitro", "mililitros"].includes(text)) return "ml";
  if (["pack", "packs", "paquete", "paquetes", "caja", "cajas"].includes(text)) return "pack";
  return "unit";
}

export function toBase(quantity: number, unit: Unit): {
  quantity: number;
  unit: "kg" | "l" | "unit";
} {
  if (unit === "g") return { quantity: quantity / 1000, unit: "kg" };
  if (unit === "ml") return { quantity: quantity / 1000, unit: "l" };
  if (unit === "pack") return { quantity, unit: "unit" };
  return { quantity, unit: unit === "kg" || unit === "l" ? unit : "unit" };
}

export function parsePrice(value: unknown): number {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  const raw = String(value ?? "")
    .replace(/[^\d,.-]/gu, "")
    .trim();
  if (!raw) return 0;
  const comma = raw.lastIndexOf(",");
  const dot = raw.lastIndexOf(".");
  let normalized = raw;
  if (comma > dot) normalized = raw.replace(/\./gu, "").replace(",", ".");
  else if (dot > comma && comma >= 0) normalized = raw.replace(/,/gu, "");
  else if (comma >= 0) normalized = raw.replace(",", ".");
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}
