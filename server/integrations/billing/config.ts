import type { UploadOptions } from "@shared/schema";
import {
  buildPackagePricing,
  formatPackagePrice,
  calculateDiscountedPriceCents,
  clampDiscountPercent,
} from "@shared/billingPricing";

export type BillingPlanId = "demo_free" | "demo_starter" | "demo_creator" | "demo_studio";

export type DemoCreditPackage = {
  id: BillingPlanId;
  name: string;
  credits: number;
  /** List price before discount (stored in DB) */
  listPriceCents: number;
  discountPercent: number;
  /** Final price charged after discount */
  priceCents: number;
  priceLabel: string;
  originalPriceLabel: string;
  description: string;
  popular?: boolean;
};

export { formatPackagePrice, calculateDiscountedPriceCents, clampDiscountPercent };

export function enrichCreditPackage(pkg: {
  id: BillingPlanId;
  name: string;
  credits: number;
  priceCents: number;
  description: string;
  popular?: boolean;
  discountPercent?: number;
}): DemoCreditPackage {
  const pricing = buildPackagePricing(pkg.priceCents, pkg.discountPercent ?? 0);

  return {
    id: pkg.id,
    name: pkg.name,
    credits: pkg.credits,
    description: pkg.description,
    popular: pkg.popular,
    listPriceCents: pricing.listPriceCents,
    discountPercent: pricing.discountPercent,
    priceCents: pricing.priceCents,
    priceLabel: pricing.priceLabel,
    originalPriceLabel: pricing.originalPriceLabel,
  };
}

const BASE_PACKAGES = [
  {
    id: "demo_starter" as const,
    name: "Starter Pack",
    credits: 500,
    priceCents: 999,
    description: "Good for ~3–5 short video runs",
    discountPercent: 0,
  },
  {
    id: "demo_creator" as const,
    name: "Creator Pack",
    credits: 1500,
    priceCents: 2499,
    description: "Best for regular testing",
    popular: true,
    discountPercent: 0,
  },
  {
    id: "demo_studio" as const,
    name: "Studio Pack",
    credits: 5000,
    priceCents: 4999,
    description: "Heavy usage & presentations",
    discountPercent: 0,
  },
];

export const DEMO_CREDIT_PACKAGES: DemoCreditPackage[] = BASE_PACKAGES.map(enrichCreditPackage);

export const DEFAULT_SIGNUP_CREDITS = 500;

/** Estimated credits charged per video processing job */
export function calculateProcessingCost(
  options: UploadOptions,
  durationSeconds = 60,
): number {
  const minutes = Math.max(1, Math.ceil(durationSeconds / 60));
  return 50 + options.clipCount * 25 + minutes * 10;
}

export function isDemoBillingEnabled(): boolean {
  return process.env.BILLING_MODE !== "live";
}

export { BASE_PACKAGES };
