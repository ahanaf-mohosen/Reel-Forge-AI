import { useState } from "react";
import { CheckCircle2, CreditCard, Loader2, Lock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { PackagePriceDisplay } from "@/components/package-price-display";

export type CheckoutPackage = {
  id: string;
  name: string;
  credits: number;
  listPriceCents?: number;
  priceLabel: string;
  priceCents: number;
  originalPriceLabel?: string;
  discountPercent?: number;
};

type DemoCheckoutDialogProps = {
  pkg: CheckoutPackage | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onPay: (payload: {
    packageId: string;
    cardholderName: string;
    cardNumber: string;
    expiry: string;
    cvc: string;
  }) => void;
  isPaying: boolean;
  lastReceipt?: {
    paymentReference: string;
    amountCents: number;
    creditsGranted: number;
  } | null;
};

function formatCardNumber(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 16);
  return digits.replace(/(\d{4})(?=\d)/g, "$1 ").trim();
}

function formatExpiry(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 4);
  if (digits.length <= 2) return digits;
  return `${digits.slice(0, 2)}/${digits.slice(2)}`;
}

export function DemoCheckoutDialog({
  pkg,
  open,
  onOpenChange,
  onPay,
  isPaying,
  lastReceipt,
}: DemoCheckoutDialogProps) {
  const [cardholderName, setCardholderName] = useState("");
  const [cardNumber, setCardNumber] = useState("");
  const [expiry, setExpiry] = useState("");
  const [cvc, setCvc] = useState("");

  const handleOpenChange = (next: boolean) => {
    if (!next && !isPaying) {
      setCardholderName("");
      setCardNumber("");
      setExpiry("");
      setCvc("");
    }
    onOpenChange(next);
  };

  const fillTestCard = () => {
    setCardholderName("Test Customer");
    setCardNumber("4242 4242 4242 4242");
    setExpiry("12/30");
    setCvc("123");
  };

  if (lastReceipt && !pkg) {
    return (
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader className="text-center sm:text-center">
            <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/10">
              <CheckCircle2 className="h-6 w-6 text-emerald-600" />
            </div>
            <DialogTitle>Payment successful</DialogTitle>
            <DialogDescription>
              Payment completed. Credits are in your wallet and the admin dashboard was updated.
            </DialogDescription>
          </DialogHeader>
          <div className="rounded-lg border bg-muted/40 p-4 space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Reference</span>
              <span className="font-mono font-medium">{lastReceipt.paymentReference}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Amount</span>
              <span className="font-medium">
                {new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(
                  lastReceipt.amountCents / 100,
                )}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Credits added</span>
              <span className="font-medium text-emerald-600">+{lastReceipt.creditsGranted}</span>
            </div>
          </div>
          <DialogFooter>
            <Button className="w-full" onClick={() => handleOpenChange(false)}>
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  if (!pkg) return null;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5" />
            Complete payment
          </DialogTitle>
          <DialogDescription>
            Secure checkout. Your payment appears in the admin dashboard.
          </DialogDescription>
        </DialogHeader>

        <div className="rounded-lg border p-4 space-y-2">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="font-medium">{pkg.name}</p>
              <p className="text-sm text-muted-foreground">{pkg.credits} credits</p>
            </div>
            <div className="text-right">
              <PackagePriceDisplay
                listPriceCents={pkg.listPriceCents}
                priceCents={pkg.priceCents}
                priceLabel={pkg.priceLabel}
                originalPriceLabel={pkg.originalPriceLabel}
                discountPercent={pkg.discountPercent ?? 0}
                size="sm"
                className="justify-end"
              />
            </div>
          </div>
          <Badge variant="secondary" className="font-normal">
            Secure payment
          </Badge>
        </div>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="cardholder">Name on card</Label>
            <Input
              id="cardholder"
              placeholder="Jane Doe"
              value={cardholderName}
              onChange={(e) => setCardholderName(e.target.value)}
              disabled={isPaying}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="cardnumber">Card number</Label>
            <Input
              id="cardnumber"
              placeholder="4242 4242 4242 4242"
              inputMode="numeric"
              value={cardNumber}
              onChange={(e) => setCardNumber(formatCardNumber(e.target.value))}
              disabled={isPaying}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="expiry">Expiry</Label>
              <Input
                id="expiry"
                placeholder="MM/YY"
                value={expiry}
                onChange={(e) => setExpiry(formatExpiry(e.target.value))}
                disabled={isPaying}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cvc">CVC</Label>
              <Input
                id="cvc"
                placeholder="123"
                inputMode="numeric"
                maxLength={4}
                value={cvc}
                onChange={(e) => setCvc(e.target.value.replace(/\D/g, "").slice(0, 4))}
                disabled={isPaying}
              />
            </div>
          </div>
          <Button type="button" variant="outline" size="sm" onClick={fillTestCard} disabled={isPaying}>
            Use test card 4242…
          </Button>
        </div>

        <Separator />

        <DialogFooter className="flex-col gap-2 sm:flex-col">
          <Button
            className="w-full"
            disabled={isPaying}
            onClick={() =>
              onPay({
                packageId: pkg.id,
                cardholderName,
                cardNumber,
                expiry,
                cvc,
              })
            }
          >
            {isPaying ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Processing payment…
              </>
            ) : (
              <>
                <Lock className="mr-2 h-4 w-4" />
                Pay {pkg.priceLabel}
              </>
            )}
          </Button>
          <p className="text-center text-xs text-muted-foreground">
            Secured checkout · Admin revenue updates instantly
          </p>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
