export function formatPackagePrice(cents: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(cents / 100);
}

export function clampDiscountPercent(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(100, Math.max(0, Math.round(value)));
}

export function calculateDiscountedPriceCents(
  listPriceCents: number,
  discountPercent: number,
): number {
  const clamped = clampDiscountPercent(discountPercent);
  return Math.round((listPriceCents * (100 - clamped)) / 100);
}

export type PricedPackage = {
  listPriceCents: number;
  discountPercent: number;
  priceCents: number;
  priceLabel: string;
  originalPriceLabel: string;
};

export function buildPackagePricing(
  listPriceCents: number,
  discountPercent: number,
): PricedPackage {
  const discount = clampDiscountPercent(discountPercent);
  const finalPriceCents = calculateDiscountedPriceCents(listPriceCents, discount);

  return {
    listPriceCents,
    discountPercent: discount,
    priceCents: finalPriceCents,
    priceLabel: formatPackagePrice(finalPriceCents),
    originalPriceLabel: formatPackagePrice(listPriceCents),
  };
}
