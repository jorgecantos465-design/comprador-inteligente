import * as XLSX from "xlsx";
import { parsePrice, parseUnit } from "../domain/normalize";
import type { PriceRow, Unit } from "../domain/types";

type Cell = string | number | boolean | Date | null | undefined;

interface ColumnCandidate {
  index: number;
  density: number;
  header: string;
}

interface Presentation {
  unit: Unit;
  packageSize: number;
}

const descriptionHeaders = ["descripcion", "producto", "articulo", "nombre", "detalle"];
const categoryHeaders = ["rubro", "categoria"];
const ignoredPriceHeaders = ["var", "variacion", "%"];
const preferredPriceHeaders = ["precio vigente", "precio actual", "precio", "importe", "valor"];

export interface ParsedExcelTable {
  rows: PriceRow[];
  warnings: string[];
}

export function parseExcelSheet(sheet: XLSX.WorkSheet): ParsedExcelTable {
  const matrix = XLSX.utils.sheet_to_json<Cell[]>(sheet, { header: 1, defval: "", raw: true, blankrows: true });
  const headerIndex = findHeaderRow(matrix);
  if (headerIndex === -1) {
    return { rows: [], warnings: ["No se encontró una tabla de productos reconocible en la hoja."] };
  }

  const headers = matrix[headerIndex].map(normalizeHeader);
  const descriptionIndex = findPreferredColumn(headers, descriptionHeaders);
  if (descriptionIndex === -1) {
    return { rows: [], warnings: ["No se encontró una columna de descripción o producto."] };
  }

  const priceIndex = findPriceColumn(matrix, sheet, headerIndex, descriptionIndex, headers);
  if (priceIndex === -1) {
    return { rows: [], warnings: ["No se encontró una columna de precios positivos reconocible."] };
  }

  const categoryIndex = findPreferredColumn(headers, categoryHeaders);
  let currentCategory = "";
  const rows = matrix.slice(headerIndex + 1).flatMap((row, offset) => {
    const category = categoryIndex >= 0 ? String(row[categoryIndex] ?? "").trim() : "";
    if (category) currentCategory = category;
    const product = String(row[descriptionIndex] ?? "").trim();
    const price = parsePrice(row[priceIndex]);
    if (!product || price <= 0 || isAdministrativeText(product)) return [];
    const presentation = extractPresentation(product);
    return [{
      id: crypto.randomUUID(),
      product,
      price,
      unit: presentation.unit,
      packageSize: presentation.packageSize,
      category: currentCategory || undefined,
      sourceRow: headerIndex + offset + 2,
      warnings: [],
    } satisfies PriceRow];
  });

  return {
    rows,
    warnings: [`Tabla detectada en la fila ${headerIndex + 1}. Precio importado desde la columna ${columnName(priceIndex)}.`],
  };
}

function findHeaderRow(rows: Cell[][]): number {
  let bestIndex = -1;
  let bestScore = 0;
  rows.forEach((row, index) => {
    const headers = row.map(normalizeHeader);
    const hasDescription = findPreferredColumn(headers, descriptionHeaders) >= 0;
    const score = (hasDescription ? 10 : 0)
      + (findPreferredColumn(headers, ["codigo"]) >= 0 ? 2 : 0)
      + (findPreferredColumn(headers, categoryHeaders) >= 0 ? 1 : 0)
      + (findPreferredColumn(headers, preferredPriceHeaders) >= 0 ? 2 : 0);
    if (score > bestScore) {
      bestScore = score;
      bestIndex = index;
    }
  });
  return bestScore >= 10 ? bestIndex : -1;
}

function findPriceColumn(rows: Cell[][], sheet: XLSX.WorkSheet, headerIndex: number, descriptionIndex: number, headers: string[]): number {
  const dataRows = rows.slice(headerIndex + 1).filter((row) => String(row[descriptionIndex] ?? "").trim());
  const width = Math.max(...rows.map((row) => row.length));
  const candidates: ColumnCandidate[] = [];
  for (let index = 0; index < width; index += 1) {
    const header = headers[index] ?? "";
    if (index === descriptionIndex || ignoredPriceHeaders.some((ignored) => header.includes(ignored))) continue;
    const numericValues = dataRows.map((row) => row[index]).filter((value): value is number => typeof value === "number" && value > 0);
    if (!numericValues.length) continue;
    const density = numericValues.length / Math.max(dataRows.length, 1);
    const percentFormatted = columnHasPercentFormat(sheet, headerIndex + 1, index, dataRows.length);
    if (density >= 0.6 && !percentFormatted) candidates.push({ index, density, header });
  }

  return candidates
    .sort((left, right) => scorePriceColumn(right, descriptionIndex) - scorePriceColumn(left, descriptionIndex) || left.index - right.index)[0]?.index ?? -1;
}

function scorePriceColumn(candidate: ColumnCandidate, descriptionIndex: number): number {
  const preferred = preferredPriceHeaders.some((header) => candidate.header.includes(header)) ? 10 : 0;
  const afterDescription = candidate.index > descriptionIndex ? 4 : 0;
  return preferred + afterDescription + candidate.density;
}

function columnHasPercentFormat(sheet: XLSX.WorkSheet, firstDataIndex: number, columnIndex: number, length: number): boolean {
  const end = Math.min(firstDataIndex + length, firstDataIndex + 20);
  for (let rowIndex = firstDataIndex; rowIndex < end; rowIndex += 1) {
    const cell = sheet[`${columnName(columnIndex)}${rowIndex + 1}`];
    if (typeof cell?.z === "string" && cell.z.includes("%")) return true;
  }
  return false;
}

function findPreferredColumn(headers: string[], candidates: string[]): number {
  return headers.findIndex((header) => candidates.some((candidate) => header === candidate || header.includes(candidate)));
}

function normalizeHeader(value: Cell): string {
  return String(value ?? "")
    .toLocaleLowerCase("es")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^\p{Letter}\p{Number}%]+/gu, " ")
    .trim();
}

function isAdministrativeText(value: string): boolean {
  const normalized = normalizeHeader(value);
  return normalized === "rubro"
    || normalized.includes("las listas estan sujetas")
    || normalized.includes("los precios no incluyen")
    || normalized.includes("whatsapp")
    || normalized.includes("e mail");
}

export function extractPresentation(description: string): Presentation {
  const match = description.match(/(?:(\d+)\s*x\s*)?(\d+(?:[.,]\d+)?)\s*(kg|kilos?|g|gr|gs|gramos?|l|lt|litros?|ml)\b/iu);
  if (!match) return { unit: "unit", packageSize: 1 };
  const multiplier = Number(match[1] ?? 1);
  const size = Number(match[2].replace(",", "."));
  return { unit: parseUnit(match[3] === "gs" ? "g" : match[3]), packageSize: multiplier * size };
}

function columnName(index: number): string {
  let name = "";
  for (let value = index + 1; value > 0; value = Math.floor((value - 1) / 26)) {
    name = String.fromCharCode(65 + ((value - 1) % 26)) + name;
  }
  return name;
}
