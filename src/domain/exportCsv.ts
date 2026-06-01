import type { Strategy, Supplier } from "./types";

export function downloadStrategyCsv(strategy: Strategy, suppliers: Supplier[]): void {
  const supplierName = (id?: string) => suppliers.find((supplier) => supplier.id === id)?.name ?? "";
  const rows = [
    ["Comprador", "Producto", "Cantidad", "Unidad", "Proveedor recomendado", "Archivo origen", "Fila origen", "Precio unitario normalizado", "Subtotal", "Segundo proveedor", "Diferencia %"],
    ...strategy.comparisons.map((comparison) => [
      comparison.item.buyer,
      comparison.item.product,
      comparison.item.quantity,
      comparison.item.unit,
      supplierName(comparison.best?.supplierId),
      comparison.best?.fileName ?? "",
      comparison.best?.sourceRow ?? "",
      comparison.best?.normalizedUnitPrice.toFixed(2) ?? "",
      comparison.best?.subtotal.toFixed(2) ?? "",
      supplierName(comparison.second?.supplierId),
      comparison.spreadPercent?.toFixed(2) ?? "",
    ]),
  ];
  const csv = rows.map((row) => row.map(escapeCell).join(",")).join("\n");
  const blob = new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = "estrategia-de-compra.csv";
  link.click();
  URL.revokeObjectURL(link.href);
}

function escapeCell(value: string | number): string {
  return `"${String(value).replaceAll('"', '""')}"`;
}
