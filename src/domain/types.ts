export type Unit = "kg" | "g" | "l" | "ml" | "unit" | "pack";

export interface Supplier {
  id: string;
  name: string;
  distance: string;
  notes: string;
}

export interface PriceRow {
  id: string;
  product: string;
  price: number;
  unit: Unit;
  packageSize: number;
  category?: string;
  sourceRow: number;
  warnings: string[];
}

export interface PriceList {
  id: string;
  supplierId: string;
  fileName: string;
  sourceType: "xlsx" | "csv" | "pdf" | "manual";
  rows: PriceRow[];
  warnings: string[];
}

export interface PurchaseItem {
  id: string;
  buyer: string;
  product: string;
  quantity: number;
  unit: Unit;
}

export interface Alias {
  id: string;
  from: string;
  to: string;
}

export interface Offer {
  id: string;
  supplierId: string;
  listId: string;
  fileName: string;
  sourceRow: number;
  product: string;
  normalizedProduct: string;
  price: number;
  normalizedUnitPrice: number;
  baseUnit: "kg" | "l" | "unit";
}

export interface ComparedOffer extends Offer {
  subtotal: number;
}

export interface Comparison {
  item: PurchaseItem;
  offers: ComparedOffer[];
  best?: ComparedOffer;
  second?: ComparedOffer;
  spreadPercent?: number;
  unresolved: boolean;
}

export interface Strategy {
  comparisons: Comparison[];
  optimalTotal: number;
  totalsByBuyer: Record<string, number>;
  totalsBySupplier: Record<string, number>;
  bestSingleSupplier?: {
    supplierId: string;
    total: number;
  };
}
