import { Badge } from "@/components/ui/badge";
import { buildPackagePricing, formatPackagePrice } from "@shared/billingPricing";
import { cn } from "@/lib/utils";

type PackagePriceDisplayProps = {
  listPriceCents?: number;
  priceCents: number;
  priceLabel: string;
  originalPriceLabel?: string;
  discountPercent?: number;
  size?: "sm" | "md" | "lg";
  className?: string;
};

const sizeClasses = {
  sm: { original: "text-sm", price: "text-base" },
  md: { original: "text-base", price: "text-xl" },
  lg: { original: "text-lg", price: "text-2xl" },
};

export function PackagePriceDisplay({
  listPriceCents,
  priceCents,
  priceLabel,
  originalPriceLabel,
  discountPercent = 0,
  size = "md",
  className,
}: PackagePriceDisplayProps) {
  const listCents =
    listPriceCents ??
    (discountPercent > 0 && priceCents > 0
      ? Math.round((priceCents * 100) / Math.max(1, 100 - discountPercent))
      : priceCents);

  const pricing = buildPackagePricing(listCents, discountPercent);
  const hasDiscount = pricing.discountPercent > 0;
  const classes = sizeClasses[size];

  if (!hasDiscount) {
    return (
      <p className={cn("font-bold text-primary tabular-nums", classes.price, className)}>
        {priceLabel}
      </p>
    );
  }

  return (
    <div className={cn("space-y-1", className)}>
      <div className="flex flex-wrap items-baseline gap-2">
        <span
          className={cn(
            "font-medium text-muted-foreground line-through tabular-nums",
            classes.original,
          )}
        >
          {originalPriceLabel || pricing.originalPriceLabel}
        </span>
        <span className={cn("font-bold text-primary tabular-nums", classes.price)}>
          {priceLabel}
        </span>
        <Badge variant="secondary" className="text-[10px]">
          {pricing.discountPercent}% off
        </Badge>
      </div>
    </div>
  );
}

export function formatDiscountedPreview(listPriceDollars: string, discountPercent: string): string {
  const listCents = Math.round((Number.parseFloat(listPriceDollars) || 0) * 100);
  const pricing = buildPackagePricing(listCents, Number(discountPercent) || 0);
  return formatPackagePrice(pricing.priceCents);
}
