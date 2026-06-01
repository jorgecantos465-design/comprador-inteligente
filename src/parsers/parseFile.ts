import Papa from "papaparse";
import * as XLSX from "xlsx";
import { parseArgentinePrice, parsePrice, parseUnit } from "../domain/normalize";
import type { PriceRow } from "../domain/types";
import { parseExcelSheet } from "./parseExcelTable";

export interface ParsedPriceList {
  sourceType: "xlsx" | "csv" | "pdf";
  rows: PriceRow[];
  warnings: string[];
}

type LooseRow = Record<string, unknown>;

const productHeaders = ["producto", "product", "descripcion", "descripción", "articulo", "artículo", "nombre", "detalle"];
const priceHeaders = ["precio", "price", "importe", "valor", "precio venta", "precio unitario"];
const unitHeaders = ["unidad", "unit", "medida", "presentacion", "presentación"];
const packageHeaders = ["cantidad", "contenido", "tamano", "tamaño", "peso", "pack"];

export async function parsePriceFile(file: File): Promise<ParsedPriceList> {
  const extension = file.name.split(".").pop()?.toLocaleLowerCase("es");
  if (extension === "csv") return parseCsv(file);
  if (extension === "xlsx" || extension === "xls") return parseExcel(file);
  if (extension === "pdf") return parsePdf(file);
  throw new Error(`Formato no soportado: ${file.name}`);
}

async function parseCsv(file: File): Promise<ParsedPriceList> {
  const text = await file.text();
  const result = Papa.parse<LooseRow>(text, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (header) => header.trim(),
  });
  return {
    sourceType: "csv",
    rows: mapLooseRows(result.data),
    warnings: result.errors.map((error) => `CSV: ${error.message}`),
  };
}

async function parseExcel(file: File): Promise<ParsedPriceList> {
  const workbook = XLSX.read(await file.arrayBuffer(), { type: "array" });
  const warnings = workbook.SheetNames.length > 1
    ? [`Se importó la primera hoja: ${workbook.SheetNames[0]}.`]
    : [];
  const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
  const parsed = parseExcelSheet(firstSheet);
  return { sourceType: "xlsx", rows: parsed.rows, warnings: [...warnings, ...parsed.warnings] };
}

async function parsePdf(file: File): Promise<ParsedPriceList> {
  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = new URL(
    "pdfjs-dist/build/pdf.worker.min.mjs",
    import.meta.url,
  ).toString();
  const document = await pdfjs.getDocument({ data: await file.arrayBuffer() }).promise;
  const lines: string[] = [];
  for (let index = 1; index <= document.numPages; index += 1) {
    const page = await document.getPage(index);
    const content = await page.getTextContent();
    const items = content.items
      .filter((item): item is typeof item & { str: string; transform: number[] } => "str" in item)
      .map((item) => ({ text: item.str, x: item.transform[4], y: Math.round(item.transform[5]) }))
      .sort((a, b) => b.y - a.y || a.x - b.x);
    const grouped = new Map<number, string[]>();
    for (const item of items) grouped.set(item.y, [...(grouped.get(item.y) ?? []), item.text]);
    lines.push(...[...grouped.values()].map((parts) => parts.join(" ").trim()).filter(Boolean));
  }

  const rows = lines.flatMap((line, index) => {
    const match = line.match(/^(.*?)[\s|;:$]+(\d[\d.,]*)\s*(kg|kilos?|g|gr|l|lt|ml|unidades?|u|pack)?\s*$/iu);
    if (!match) return [];
    return [{
      id: crypto.randomUUID(),
      product: match[1].trim(),
      price: parseArgentinePrice(match[2]),
      unit: parseUnit(match[3]),
      packageSize: 1,
      sourceRow: index + 1,
      warnings: [],
    } satisfies PriceRow];
  });

  return {
    sourceType: "pdf",
    rows,
    warnings: ["Revisar datos extraídos del PDF. La extracción básica puede requerir correcciones manuales."],
  };
}

function mapLooseRows(rows: LooseRow[]): PriceRow[] {
  return rows.map((row, index) => {
    const keys = Object.keys(row);
    const productKey = findHeader(keys, productHeaders) ?? keys[0];
    const priceKey = findHeader(keys, priceHeaders) ?? keys[1];
    const unitKey = findHeader(keys, unitHeaders);
    const packageKey = findHeader(keys, packageHeaders);
    const product = String(row[productKey] ?? "").trim();
    const price = parsePrice(row[priceKey]);
    const warnings: string[] = [];
    if (!product) warnings.push("Falta producto.");
    if (!price) warnings.push("Precio inválido.");
    return {
      id: crypto.randomUUID(),
      product,
      price,
      unit: parseUnit(unitKey ? row[unitKey] : ""),
      packageSize: parsePrice(packageKey ? row[packageKey] : 1) || 1,
      sourceRow: index + 2,
      warnings,
    };
  });
}

function findHeader(keys: string[], candidates: string[]): string | undefined {
  return keys.find((key) => candidates.includes(key.toLocaleLowerCase("es").trim()));
}
