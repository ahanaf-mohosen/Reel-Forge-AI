import { useState } from "react";
import { Coins, Loader2, Sparkles, Zap } from "lucide-react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { DemoCheckoutDialog, type CheckoutPackage } from "@/components/demo-checkout-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { cn } from "@/lib/utils";
import { PackagePriceDisplay } from "@/components/package-price-display";

type BillingSummary = {
  mode: "demo" | "live";
  creditsBalance: number;
  planId: string;
  estimatedCostPerReel: number;
  packages: CheckoutPackage[];
  transactions: {
    id: string;
    type: string;
    creditsDelta: number;
    balanceAfter: number;
    description: string;
    createdAt: string;
  }[];
};

export function BillingPanel() {
  const { toast } = useToast();
  const [checkoutPkg, setCheckoutPkg] = useState<CheckoutPackage | null>(null);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [lastReceipt, setLastReceipt] = useState<{
    paymentReference: string;
    amountCents: number;
    creditsGranted: number;
  } | null>(null);

  const { data: billing, isLoading } = useQuery<BillingSummary>({
    queryKey: ["/api/billing/summary"],
  });

  const purchaseMutation = useMutation({
    mutationFn: async (payload: {
      packageId: string;
      cardholderName: string;
      cardNumber: string;
      expiry: string;
      cvc: string;
    }) => {
      const res = await apiRequest("POST", "/api/billing/demo-purchase", payload);
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/billing/summary"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/summary"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/payments"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/audit-logs"] });

      setCheckoutPkg(null);
      setLastReceipt({
        paymentReference: data.payment.paymentReference,
        amountCents: data.payment.amountCents,
        creditsGranted: data.payment.creditsGranted,
      });

      toast({
        title: "Payment successful",
        description: `${data.payment.creditsGranted} credits added · Ref ${data.payment.paymentReference}`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Payment failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const openCheckout = (pkg: CheckoutPackage) => {
    setLastReceipt(null);
    setCheckoutPkg(pkg);
    setCheckoutOpen(true);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16 text-muted-foreground">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        Loading billing...
      </div>
    );
  }

  if (!billing) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-muted-foreground">
          Sign in to manage billing and credits.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Coins className="h-5 w-5 text-primary" />
                Credit Wallet
              </CardTitle>
              <CardDescription className="mt-1">
                Purchase credit packs to add credits to your wallet.
              </CardDescription>
            </div>
            <Badge variant="outline" className="gap-1.5">
              <Sparkles className="h-3.5 w-3.5" />
              Billing active
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm text-muted-foreground">Available credits</p>
            <p className="text-4xl font-semibold tabular-nums">{billing.creditsBalance}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              ~{billing.estimatedCostPerReel} credits per typical reel run
            </p>
          </div>
          <div className="rounded-lg border bg-muted/40 px-4 py-3 text-sm">
            <p className="font-medium flex items-center gap-2">
              <Zap className="h-4 w-4 text-primary" />
              Payments sync to Admin live
            </p>
            <p className="mt-1 text-muted-foreground text-xs">
              Each checkout updates revenue and payment history in the admin dashboard.
            </p>
          </div>
        </CardContent>
      </Card>

      <div>
        <h3 className="text-sm font-medium mb-3">Credit packs</h3>
        <div className="grid gap-4 md:grid-cols-3">
          {billing.packages.map((pkg) => (
            <Card
              key={pkg.id}
              className={cn(
                "relative",
                pkg.popular && "border-primary shadow-sm ring-1 ring-primary/20",
              )}
            >
              {pkg.popular && (
                <Badge className="absolute -top-2.5 left-4">Popular</Badge>
              )}
              <CardHeader className="pb-2">
                <CardTitle className="text-base">{pkg.name}</CardTitle>
                <CardDescription>{pkg.description}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <p className="text-2xl font-semibold tabular-nums">{pkg.credits}</p>
                  <p className="text-xs text-muted-foreground">credits</p>
                  <div className="mt-2">
                    <PackagePriceDisplay
                      listPriceCents={pkg.listPriceCents}
                      priceCents={pkg.priceCents}
                      priceLabel={pkg.priceLabel}
                      originalPriceLabel={pkg.originalPriceLabel}
                      discountPercent={pkg.discountPercent ?? 0}
                      size="md"
                    />
                  </div>
                </div>
                <Button
                  className="w-full"
                  variant={pkg.popular ? "default" : "outline"}
                  onClick={() => openCheckout(pkg)}
                >
                  Buy now
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Wallet activity</CardTitle>
          <CardDescription>Purchases and processing charges</CardDescription>
        </CardHeader>
        <CardContent>
          {billing.transactions.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">
              No transactions yet.
            </p>
          ) : (
            <ul className="divide-y">
              {billing.transactions.map((tx) => (
                <li
                  key={tx.id}
                  className="flex items-center justify-between gap-4 py-3 text-sm first:pt-0 last:pb-0"
                >
                  <div className="min-w-0">
                    <p className="font-medium truncate">{tx.description}</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(tx.createdAt).toLocaleString()}
                    </p>
                  </div>
                  <span
                    className={cn(
                      "shrink-0 font-medium tabular-nums",
                      tx.creditsDelta >= 0 ? "text-emerald-600" : "text-destructive",
                    )}
                  >
                    {tx.creditsDelta >= 0 ? "+" : ""}
                    {tx.creditsDelta}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Separator />

      <p className="text-xs text-muted-foreground">
        Payments are processed through the platform billing gateway. Contact support if you need
        help with billing or invoices.
      </p>

      <DemoCheckoutDialog
        pkg={checkoutPkg}
        open={checkoutOpen}
        onOpenChange={(open) => {
          setCheckoutOpen(open);
          if (!open) {
            setLastReceipt(null);
            setCheckoutPkg(null);
          }
        }}
        isPaying={purchaseMutation.isPending}
        lastReceipt={lastReceipt}
        onPay={(payload) => purchaseMutation.mutate(payload)}
      />
    </div>
  );
}
