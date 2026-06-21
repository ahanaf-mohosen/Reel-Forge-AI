import type { Express, Request, Response } from "express";
import { billingStorage } from "./storage";
import type { BillingPlanId } from "./config";
import { authStorage } from "../auth/storage";
import { adminAuditStorage } from "../admin/storage";
import { sendPlanPurchaseEmail } from "../../services/emailService";

function getBillingUserId(req: Request): string | null {
  if (!req.session) return null;
  const userId = (req.session as { userId?: string }).userId;
  if (userId) return userId;
  if (req.session.id) return `guest:${req.session.id}`;
  return null;
}

function sanitizeCardNumber(value: string): string {
  return value.replace(/\D/g, "");
}

export function registerBillingRoutes(app: Express): void {
  app.get("/api/billing/summary", async (req: Request, res: Response) => {
    try {
      const userId = getBillingUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "Sign in to view billing" });
      }

      const summary = await billingStorage.getSummary(userId);
      res.json(summary);
    } catch (error) {
      console.error("Billing summary error:", error);
      res.status(500).json({ message: "Failed to load billing summary" });
    }
  });

  app.post("/api/billing/demo-purchase", async (req: Request, res: Response) => {
    try {
      const userId = getBillingUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "Sign in to complete payment" });
      }

      const { packageId, cardholderName, cardNumber, expiry, cvc } = req.body as {
        packageId?: BillingPlanId;
        cardholderName?: string;
        cardNumber?: string;
        expiry?: string;
        cvc?: string;
      };

      if (!packageId) {
        return res.status(400).json({ message: "packageId is required" });
      }

      if (!cardholderName?.trim()) {
        return res.status(400).json({ message: "Cardholder name is required" });
      }

      const digits = sanitizeCardNumber(cardNumber || "");
      if (digits.length < 13) {
        return res.status(400).json({ message: "Enter a valid card number" });
      }

      if (!/^\d{2}\/\d{2}$/.test(expiry || "")) {
        return res.status(400).json({ message: "Expiry must be MM/YY" });
      }

      if (!/^\d{3,4}$/.test(cvc || "")) {
        return res.status(400).json({ message: "Enter a valid CVC" });
      }

      const user = await authStorage.getUser(userId);
      const userEmail = user?.email ?? null;

      // Simulate payment gateway latency
      await new Promise((resolve) => setTimeout(resolve, 1200));

      const { summary, payment } = await billingStorage.purchaseDemoPackage(
        userId,
        packageId,
        {
          cardholderName: cardholderName.trim(),
          cardLast4: digits.slice(-4),
        },
        userEmail,
      );

      await adminAuditStorage.logEvent({
        actorId: userId,
        actorEmail: userEmail,
        action: "billing_demo_payment",
        resourceType: "billing_payment",
        resourceId: payment.id,
        details: {
          paymentReference: payment.paymentReference,
          packageId: payment.packageId,
          packageName: payment.packageName,
          amountCents: payment.amountCents,
          creditsGranted: payment.creditsGranted,
          cardLast4: payment.cardLast4,
          mode: "demo",
        },
      });

      if (userEmail) {
        sendPlanPurchaseEmail({
          to: userEmail,
          firstName: user?.firstName,
          packageName: payment.packageName,
          credits: payment.creditsGranted,
          amountCents: payment.amountCents,
          paymentReference: payment.paymentReference,
          creditsBalance: summary.creditsBalance,
        }).catch((emailError) => {
          console.error("Plan purchase email error:", emailError);
        });
      }

      res.json({ success: true, summary, payment });
    } catch (error) {
      console.error("Demo purchase error:", error);
      res.status(400).json({
        message: error instanceof Error ? error.message : "Payment failed",
      });
    }
  });
}

export { getBillingUserId };

/*
// PRODUCTION PAYMENT GATEWAY (Stripe) — uncomment when ready for live billing
//
// import Stripe from "stripe";
// const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
//
// app.post("/api/billing/checkout-session", async (req, res) => {
//   const session = await stripe.checkout.sessions.create({ ... });
//   res.json({ url: session.url });
// });
//
// app.post("/api/billing/webhook", express.raw({ type: "application/json" }), async (req, res) => {
//   const event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET!);
//   // handle checkout.session.completed → billingStorage.purchaseDemoPackage(...)
// });
*/
