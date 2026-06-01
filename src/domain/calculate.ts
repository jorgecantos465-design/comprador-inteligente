import { canonicalName, toBase } from "./normalize";
import type {
  Alias,
  Comparison,
  Offer,
  PriceList,
  PurchaseItem,
  Strategy,
  Supplier,
} from "./types";

export function buildOffers(lists: PriceList[], aliases: Alias[]): Offer[] {
  return lists.flatMap((list) =>
    list.rows.flatMap((row) => {
      const pack = toBase(row.packageSize || 1, row.unit);
      if (!row.product.trim() || row.price <= 0 || pack.quantity <= 0) return [];
      return [{
        id: row.id,
        supplierId: list.supplierId,
        listId: list.id,
        fileName: list.fileName,
        sourceRow: row.sourceRow,
        product: row.product,
        normalizedProduct: canonicalName(row.product, aliases),
        price: row.price,
        normalizedUnitPrice: row.price / pack.quantity,
        baseUnit: pack.unit,
      }];
    }),
  );
}

export function calculateStrategy(
  suppliers: Supplier[],
  lists: PriceList[],
  items: PurchaseItem[],
  aliases: Alias[],
): Strategy {
  const offers = buildOffers(lists, aliases);
  const comparisons = items.map((item): Comparison => {
    const requested = toBase(item.quantity, item.unit);
    const name = canonicalName(item.product, aliases);
    const matches = offers
      .filter((offer) => offer.normalizedProduct === name && offer.baseUnit === requested.unit)
      .map((offer) => ({ ...offer, subtotal: offer.normalizedUnitPrice * requested.quantity }))
      .sort((a, b) => a.subtotal - b.subtotal);
    const best = matches[0];
    const second = matches.find((offer) => offer.supplierId !== best?.supplierId);
    return {
      item,
      offers: matches,
      best,
      second,
      spreadPercent:
        best && second ? ((second.normalizedUnitPrice - best.normalizedUnitPrice) / best.normalizedUnitPrice) * 100 : undefined,
      unresolved: !best,
    };
  });

  const resolved = comparisons.filter((comparison) => comparison.best);
  const optimalTotal = resolved.reduce((total, comparison) => total + (comparison.best?.subtotal ?? 0), 0);
  const totalsByBuyer = sumBy(resolved, (comparison) => comparison.item.buyer, (comparison) => comparison.best?.subtotal ?? 0);
  const totalsBySupplier = sumBy(resolved, (comparison) => comparison.best?.supplierId ?? "", (comparison) => comparison.best?.subtotal ?? 0);

  const singleSupplierOptions = items.length ? suppliers.flatMap((supplier) => {
    const supplierOffers = comparisons.map((comparison) =>
      comparison.offers.find((offer) => offer.supplierId === supplier.id),
    );
    if (supplierOffers.some((offer) => !offer) || supplierOffers.length !== items.length) return [];
    return [{
      supplierId: supplier.id,
      total: supplierOffers.reduce((total, offer) => total + (offer?.subtotal ?? 0), 0),
    }];
  }).sort((a, b) => a.total - b.total) : [];

  return { comparisons, optimalTotal, totalsByBuyer, totalsBySupplier, bestSingleSupplier: singleSupplierOptions[0] };
}

function sumBy<T>(
  items: T[],
  getKey: (item: T) => string,
  getValue: (item: T) => number,
): Record<string, number> {
  return items.reduce<Record<string, number>>((totals, item) => {
    const key = getKey(item);
    totals[key] = (totals[key] ?? 0) + getValue(item);
    return totals;
  }, {});
}
