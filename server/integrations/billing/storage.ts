import { sql } from "drizzle-orm";
import { db } from "../../db";
import { buildDailyBuckets, toAdminDateKey } from "@shared/adminDateRange";
import {
  calculateTokenBlockOperatingCostCents,
  OPERATING_COST_PER_BLOCK_CENTS,
  TOKENS_PER_OPERATING_COST_BLOCK,
} from "@shared/operatingCost";
import { planStorage } from "./planStorage";
import {
  DEFAULT_SIGNUP_CREDITS,
  type BillingPlanId,
  type DemoCreditPackage,
  calculateProcessingCost,
  isDemoBillingEnabled,
} from "./config";
import type { UploadOptions } from "@shared/schema";

export type BillingPayment = {
  id: string;
  userId: string;
  userEmail?: string | null;
  packageId: BillingPlanId;
  packageName: string;
  amountCents: number;
  creditsGranted: number;
  status: "completed" | "failed" | "pending";
  cardLast4: string;
  cardholderName: string;
  paymentReference: string;
  createdAt: string;
};

export type BillingTransaction = {
  id: string;
  userId: string;
  type: "signup_bonus" | "demo_purchase" | "processing_charge" | "refund" | "admin_adjustment";
  creditsDelta: number;
  balanceAfter: number;
  description: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
};

export type BillingSummary = {
  mode: "demo" | "live";
  creditsBalance: number;
  planId: BillingPlanId;
  estimatedCostPerReel: number;
  packages: DemoCreditPackage[];
  transactions: BillingTransaction[];
};

const memoryWallets = new Map<string, { balance: number; planId: BillingPlanId }>();
const memoryTransactions = new Map<string, BillingTransaction[]>();
const memoryPayments: BillingPayment[] = [];

export type AdminBillingStats = {
  totalRevenueCents: number;
  paymentCount: number;
  recentPayments: BillingPayment[];
  daily: { date: string; revenueCents: number }[];
};

export type PlanPurchaseStat = {
  packageId: BillingPlanId;
  packageName: string;
  purchaseCount: number;
  customerCount: number;
  revenueCents: number;
  creditsGranted: number;
  operatingCostCents: number;
};

export type PlanAdoptionOperatingStats = {
  totalCreditsGranted: number;
  operatingCostCents: number;
  blockCount: number;
  tokensPerBlock: number;
  costPerBlockCents: number;
  daily: { date: string; creditsGranted: number; operatingCostCents: number }[];
};

export type CurrentPlanStat = {
  planId: BillingPlanId;
  userCount: number;
};

export type AdminWalletRow = {
  userId: string;
  userEmail: string | null;
  userName: string;
  creditsBalance: number;
  planId: BillingPlanId;
  updatedAt: string;
};

export type AdminBillingOverview = {
  totalCredits: number;
  walletCount: number;
  wallets: AdminWalletRow[];
};

class BillingStorage {
  async ensureSchema(): Promise<void> {
    await db.execute(sql.raw(`
      CREATE TABLE IF NOT EXISTS user_billing_wallets (
        user_id varchar PRIMARY KEY,
        credits_balance integer NOT NULL DEFAULT ${DEFAULT_SIGNUP_CREDITS},
        plan_id varchar NOT NULL DEFAULT 'demo_free',
        updated_at timestamp NOT NULL DEFAULT NOW()
      )
    `));

    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS billing_transactions (
        id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id varchar NOT NULL,
        type varchar NOT NULL,
        credits_delta integer NOT NULL,
        balance_after integer NOT NULL,
        description text NOT NULL,
        metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
        created_at timestamp NOT NULL DEFAULT NOW()
      )
    `);

    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS billing_payments (
        id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id varchar NOT NULL,
        user_email varchar,
        package_id varchar NOT NULL,
        package_name varchar NOT NULL,
        amount_cents integer NOT NULL,
        credits_granted integer NOT NULL,
        status varchar NOT NULL DEFAULT 'completed',
        card_last4 varchar NOT NULL,
        cardholder_name varchar NOT NULL,
        payment_reference varchar NOT NULL UNIQUE,
        created_at timestamp NOT NULL DEFAULT NOW()
      )
    `);

    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS idx_billing_transactions_user_created
      ON billing_transactions (user_id, created_at DESC)
    `);

    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS idx_billing_payments_created
      ON billing_payments (created_at DESC)
    `);

    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS billing_credit_packages (
        id varchar PRIMARY KEY,
        name varchar NOT NULL,
        credits integer NOT NULL,
        price_cents integer NOT NULL,
        description text NOT NULL,
        popular boolean NOT NULL DEFAULT false,
        discount_percent integer NOT NULL DEFAULT 0,
        sort_order integer NOT NULL DEFAULT 0,
        updated_at timestamp NOT NULL DEFAULT NOW()
      )
    `);

    await db.execute(sql`
      ALTER TABLE billing_credit_packages
      ADD COLUMN IF NOT EXISTS discount_percent integer NOT NULL DEFAULT 0
    `);
  }

  private useMemoryFallback = false;

  async getOrCreateWallet(userId: string): Promise<{ balance: number; planId: BillingPlanId }> {
    if (this.useMemoryFallback) {
      const existing = memoryWallets.get(userId);
      if (existing) return existing;
      const wallet = { balance: DEFAULT_SIGNUP_CREDITS, planId: "demo_free" as BillingPlanId };
      memoryWallets.set(userId, wallet);
      memoryTransactions.set(userId, [
        {
          id: `mem-${Date.now()}`,
          userId,
          type: "signup_bonus",
          creditsDelta: DEFAULT_SIGNUP_CREDITS,
          balanceAfter: DEFAULT_SIGNUP_CREDITS,
          description: "Welcome bonus credits",
          createdAt: new Date().toISOString(),
        },
      ]);
      return wallet;
    }

    try {
      const rows = await db.execute<{ credits_balance: number; plan_id: string }>(sql`
        SELECT credits_balance, plan_id FROM user_billing_wallets WHERE user_id = ${userId}
      `);

      const row = rows.rows[0];
      if (row) {
        return {
          balance: row.credits_balance,
          planId: (row.plan_id as BillingPlanId) || "demo_free",
        };
      }

      await db.execute(sql`
        INSERT INTO user_billing_wallets (user_id, credits_balance, plan_id)
        VALUES (${userId}, ${DEFAULT_SIGNUP_CREDITS}, 'demo_free')
      `);

      await this.recordTransaction(userId, {
        type: "signup_bonus",
        creditsDelta: DEFAULT_SIGNUP_CREDITS,
        balanceAfter: DEFAULT_SIGNUP_CREDITS,
        description: "Welcome bonus credits",
      });

      return { balance: DEFAULT_SIGNUP_CREDITS, planId: "demo_free" };
    } catch (error) {
      console.error("Billing DB unavailable, using in-memory demo wallet:", error);
      this.useMemoryFallback = true;
      return this.getOrCreateWallet(userId);
    }
  }

  async recordTransaction(
    userId: string,
    entry: {
      type: BillingTransaction["type"];
      creditsDelta: number;
      balanceAfter: number;
      description: string;
      metadata?: Record<string, unknown>;
    },
  ): Promise<void> {
    if (this.useMemoryFallback) {
      const list = memoryTransactions.get(userId) || [];
      list.unshift({
        id: `mem-${Date.now()}-${list.length}`,
        userId,
        type: entry.type,
        creditsDelta: entry.creditsDelta,
        balanceAfter: entry.balanceAfter,
        description: entry.description,
        metadata: entry.metadata,
        createdAt: new Date().toISOString(),
      });
      memoryTransactions.set(userId, list.slice(0, 50));
      return;
    }

    await db.execute(sql`
      INSERT INTO billing_transactions (user_id, type, credits_delta, balance_after, description, metadata)
      VALUES (
        ${userId},
        ${entry.type},
        ${entry.creditsDelta},
        ${entry.balanceAfter},
        ${entry.description},
        ${JSON.stringify(entry.metadata || {})}::jsonb
      )
    `);
  }

  async getRecentTransactions(userId: string, limit = 15): Promise<BillingTransaction[]> {
    if (this.useMemoryFallback) {
      return (memoryTransactions.get(userId) || []).slice(0, limit);
    }

    try {
      const rows = await db.execute<{
        id: string;
        user_id: string;
        type: string;
        credits_delta: number;
        balance_after: number;
        description: string;
        metadata: Record<string, unknown>;
        created_at: Date;
      }>(sql`
        SELECT id, user_id, type, credits_delta, balance_after, description, metadata, created_at
        FROM billing_transactions
        WHERE user_id = ${userId}
        ORDER BY created_at DESC
        LIMIT ${limit}
      `);

      return rows.rows.map((row) => ({
        id: row.id,
        userId: row.user_id,
        type: row.type as BillingTransaction["type"],
        creditsDelta: row.credits_delta,
        balanceAfter: row.balance_after,
        description: row.description,
        metadata: row.metadata,
        createdAt: new Date(row.created_at).toISOString(),
      }));
    } catch {
      return memoryTransactions.get(userId)?.slice(0, limit) || [];
    }
  }

  async getSummary(userId: string): Promise<BillingSummary> {
    const wallet = await this.getOrCreateWallet(userId);
    const transactions = await this.getRecentTransactions(userId);
    const packages = await planStorage.getPackages();

    return {
      mode: isDemoBillingEnabled() ? "demo" : "live",
      creditsBalance: wallet.balance,
      planId: wallet.planId,
      estimatedCostPerReel: calculateProcessingCost({
        clipCount: 3,
        minDuration: 20,
        maxDuration: 40,
      }),
      packages,
      transactions,
    };
  }

  async purchaseDemoPackage(
    userId: string,
    packageId: BillingPlanId,
    paymentDetails: { cardholderName: string; cardLast4: string },
    userEmail?: string | null,
  ): Promise<{ summary: BillingSummary; payment: BillingPayment }> {
    const pkg = await planStorage.getPackageById(packageId);
    if (!pkg) {
      throw new Error("Invalid credit package");
    }

    const wallet = await this.getOrCreateWallet(userId);
    const newBalance = wallet.balance + pkg.credits;
    const paymentReference = `DEMO-${Date.now().toString(36).toUpperCase()}`;

    const payment: BillingPayment = {
      id: `pay-${Date.now()}`,
      userId,
      userEmail: userEmail ?? null,
      packageId,
      packageName: pkg.name,
      amountCents: pkg.priceCents,
      creditsGranted: pkg.credits,
      status: "completed",
      cardLast4: paymentDetails.cardLast4,
      cardholderName: paymentDetails.cardholderName,
      paymentReference,
      createdAt: new Date().toISOString(),
    };

    if (this.useMemoryFallback) {
      memoryWallets.set(userId, { balance: newBalance, planId: packageId });
      memoryPayments.unshift(payment);
    } else {
      await db.execute(sql`
        UPDATE user_billing_wallets
        SET credits_balance = ${newBalance}, plan_id = ${packageId}, updated_at = NOW()
        WHERE user_id = ${userId}
      `);

      const inserted = await db.execute<{ id: string }>(sql`
        INSERT INTO billing_payments (
          user_id, user_email, package_id, package_name,
          amount_cents, credits_granted, status,
          card_last4, cardholder_name, payment_reference
        )
        VALUES (
          ${userId},
          ${userEmail ?? null},
          ${packageId},
          ${pkg.name},
          ${pkg.priceCents},
          ${pkg.credits},
          'completed',
          ${paymentDetails.cardLast4},
          ${paymentDetails.cardholderName},
          ${paymentReference}
        )
        RETURNING id
      `);

      payment.id = inserted.rows[0]?.id || payment.id;
      memoryWallets.set(userId, { balance: newBalance, planId: packageId });
      memoryPayments.unshift(payment);
    }

    await this.recordTransaction(userId, {
      type: "demo_purchase",
      creditsDelta: pkg.credits,
      balanceAfter: newBalance,
      description: `Payment ${paymentReference} · ${pkg.name}`,
      metadata: {
        packageId,
        paymentReference,
        amountCents: pkg.priceCents,
        cardLast4: paymentDetails.cardLast4,
      },
    });

    return {
      summary: await this.getSummary(userId),
      payment,
    };
  }

  async getRecentPayments(limit = 25): Promise<BillingPayment[]> {
    if (this.useMemoryFallback) {
      return memoryPayments.slice(0, limit);
    }

    try {
      const rows = await db.execute<{
        id: string;
        user_id: string;
        user_email: string | null;
        package_id: string;
        package_name: string;
        amount_cents: number;
        credits_granted: number;
        status: string;
        card_last4: string;
        cardholder_name: string;
        payment_reference: string;
        created_at: Date;
      }>(sql`
        SELECT id, user_id, user_email, package_id, package_name,
               amount_cents, credits_granted, status,
               card_last4, cardholder_name, payment_reference, created_at
        FROM billing_payments
        ORDER BY created_at DESC
        LIMIT ${limit}
      `);

      return rows.rows.map((row) => ({
        id: row.id,
        userId: row.user_id,
        userEmail: row.user_email,
        packageId: row.package_id as BillingPlanId,
        packageName: row.package_name,
        amountCents: row.amount_cents,
        creditsGranted: row.credits_granted,
        status: row.status as BillingPayment["status"],
        cardLast4: row.card_last4,
        cardholderName: row.cardholder_name,
        paymentReference: row.payment_reference,
        createdAt: new Date(row.created_at).toISOString(),
      }));
    } catch {
      return memoryPayments.slice(0, limit);
    }
  }

  async getAdminBillingStats(range: { start: Date; end: Date }): Promise<AdminBillingStats> {
    const start = new Date(range.start);
    const end = new Date(range.end);

    if (this.useMemoryFallback) {
      const recentInRange = memoryPayments.filter(
        (p) =>
          p.status === "completed" &&
          new Date(p.createdAt) >= start &&
          new Date(p.createdAt) <= end,
      );

      const byDate = new Map<string, number>();
      for (const key of buildDailyBuckets(start, end)) {
        byDate.set(key, 0);
      }

      for (const payment of recentInRange) {
        const key = toAdminDateKey(payment.createdAt);
        if (byDate.has(key)) {
          byDate.set(key, (byDate.get(key) || 0) + payment.amountCents);
        }
      }

      return {
        totalRevenueCents: recentInRange.reduce((sum, p) => sum + p.amountCents, 0),
        paymentCount: recentInRange.length,
        recentPayments: recentInRange.slice(0, 25),
        daily: Array.from(byDate.entries()).map(([date, revenueCents]) => ({
          date,
          revenueCents,
        })),
      };
    }

    try {
      const rows = await db.execute<{
        id: string;
        user_id: string;
        user_email: string | null;
        package_id: string;
        package_name: string;
        amount_cents: number;
        credits_granted: number;
        status: string;
        card_last4: string;
        cardholder_name: string;
        payment_reference: string;
        created_at: Date;
      }>(sql`
        SELECT id, user_id, user_email, package_id, package_name,
               amount_cents, credits_granted, status,
               card_last4, cardholder_name, payment_reference, created_at
        FROM billing_payments
        WHERE status = 'completed'
          AND created_at >= ${start}
          AND created_at <= ${end}
        ORDER BY created_at DESC
      `);

      const paymentsInRange = rows.rows.map((row) => ({
        id: row.id,
        userId: row.user_id,
        userEmail: row.user_email,
        packageId: row.package_id as BillingPlanId,
        packageName: row.package_name,
        amountCents: row.amount_cents,
        creditsGranted: row.credits_granted,
        status: row.status as BillingPayment["status"],
        cardLast4: row.card_last4,
        cardholderName: row.cardholder_name,
        paymentReference: row.payment_reference,
        createdAt: new Date(row.created_at).toISOString(),
      }));

      const byDate = new Map<string, number>();
      for (const key of buildDailyBuckets(start, end)) {
        byDate.set(key, 0);
      }

      for (const payment of paymentsInRange) {
        const key = toAdminDateKey(payment.createdAt);
        if (byDate.has(key)) {
          byDate.set(key, (byDate.get(key) || 0) + payment.amountCents);
        }
      }

      const recentPayments = paymentsInRange.slice(0, 25);

      return {
        totalRevenueCents: paymentsInRange.reduce((sum, p) => sum + p.amountCents, 0),
        paymentCount: paymentsInRange.length,
        recentPayments,
        daily: Array.from(byDate.entries()).map(([date, revenueCents]) => ({
          date,
          revenueCents,
        })),
      };
    } catch (error) {
      if (!this.useMemoryFallback) {
        console.error("Failed to load billing stats from database:", error);
        throw error;
      }

      const recentInRange = memoryPayments.filter(
        (p) =>
          p.status === "completed" &&
          new Date(p.createdAt) >= start &&
          new Date(p.createdAt) <= end,
      );

      const byDate = new Map<string, number>();
      for (const key of buildDailyBuckets(start, end)) {
        byDate.set(key, 0);
      }

      for (const payment of recentInRange) {
        const key = toAdminDateKey(payment.createdAt);
        if (byDate.has(key)) {
          byDate.set(key, (byDate.get(key) || 0) + payment.amountCents);
        }
      }

      return {
        totalRevenueCents: recentInRange.reduce((sum, p) => sum + p.amountCents, 0),
        paymentCount: recentInRange.length,
        recentPayments: recentInRange.slice(0, 25),
        daily: Array.from(byDate.entries()).map(([date, revenueCents]) => ({
          date,
          revenueCents,
        })),
      };
    }
  }

  async getPlanPurchaseBreakdown(range: { start: Date; end: Date }): Promise<PlanPurchaseStat[]> {
    const start = new Date(range.start);
    const end = new Date(range.end);

    if (this.useMemoryFallback) {
      const grouped = new Map<string, PlanPurchaseStat>();
      for (const payment of memoryPayments) {
        if (payment.status !== "completed") continue;
        const created = new Date(payment.createdAt);
        if (created < start || created > end) continue;

        const existing = grouped.get(payment.packageId) ?? {
          packageId: payment.packageId,
          packageName: payment.packageName,
          purchaseCount: 0,
          customerCount: 0,
          revenueCents: 0,
          creditsGranted: 0,
          _users: new Set<string>(),
        };
        existing.purchaseCount += 1;
        existing.revenueCents += payment.amountCents;
        existing.creditsGranted += payment.creditsGranted;
        (existing as PlanPurchaseStat & { _users: Set<string> })._users.add(payment.userId);
        grouped.set(payment.packageId, existing);
      }

      return Array.from(grouped.values())
        .map((row) => ({
          packageId: row.packageId,
          packageName: row.packageName,
          purchaseCount: row.purchaseCount,
          customerCount: (row as PlanPurchaseStat & { _users: Set<string> })._users.size,
          revenueCents: row.revenueCents,
          creditsGranted: row.creditsGranted,
          operatingCostCents: 0,
        }))
        .sort((a, b) => b.purchaseCount - a.purchaseCount);
    }

    try {
      const rows = await db.execute<{
        package_id: string;
        package_name: string;
        purchase_count: number;
        customer_count: number;
        revenue_cents: number;
        credits_granted: number;
      }>(sql`
        SELECT package_id,
               package_name,
               COUNT(*)::int AS purchase_count,
               COUNT(DISTINCT user_id)::int AS customer_count,
               COALESCE(SUM(amount_cents), 0)::int AS revenue_cents,
               COALESCE(SUM(credits_granted), 0)::int AS credits_granted
        FROM billing_payments
        WHERE status = 'completed'
          AND created_at >= ${start}
          AND created_at <= ${end}
        GROUP BY package_id, package_name
        ORDER BY purchase_count DESC
      `);

      return rows.rows.map((row) => ({
        packageId: row.package_id as BillingPlanId,
        packageName: row.package_name,
        purchaseCount: row.purchase_count,
        customerCount: row.customer_count,
        revenueCents: row.revenue_cents,
        creditsGranted: row.credits_granted,
        operatingCostCents: 0,
      }));
    } catch (error) {
      if (!this.useMemoryFallback) {
        console.error("Failed to load plan purchase breakdown:", error);
        throw error;
      }
      return [];
    }
  }

  async getPlanAdoptionOperatingStats(range: {
    start: Date;
    end: Date;
  }): Promise<PlanAdoptionOperatingStats> {
    const start = new Date(range.start);
    const end = new Date(range.end);

    const paymentsInRange: { creditsGranted: number; createdAt: string }[] = [];

    if (this.useMemoryFallback) {
      for (const payment of memoryPayments) {
        if (payment.status !== "completed") continue;
        const created = new Date(payment.createdAt);
        if (created < start || created > end) continue;
        paymentsInRange.push({
          creditsGranted: payment.creditsGranted,
          createdAt: payment.createdAt,
        });
      }
    } else {
      try {
        const rows = await db.execute<{
          credits_granted: number;
          created_at: Date;
        }>(sql`
          SELECT credits_granted, created_at
          FROM billing_payments
          WHERE status = 'completed'
            AND created_at >= ${start}
            AND created_at <= ${end}
          ORDER BY created_at ASC
        `);

        for (const row of rows.rows) {
          paymentsInRange.push({
            creditsGranted: row.credits_granted,
            createdAt: new Date(row.created_at).toISOString(),
          });
        }
      } catch (error) {
        if (!this.useMemoryFallback) {
          console.error("Failed to load plan adoption operating stats:", error);
          throw error;
        }
      }
    }

    const byDate = new Map<string, number>();
    for (const key of buildDailyBuckets(start, end)) {
      byDate.set(key, 0);
    }

    let totalCreditsGranted = 0;
    for (const payment of paymentsInRange) {
      totalCreditsGranted += payment.creditsGranted;
      const key = toAdminDateKey(payment.createdAt);
      if (byDate.has(key)) {
        byDate.set(key, (byDate.get(key) || 0) + payment.creditsGranted);
      }
    }

    const daily = Array.from(byDate.entries()).map(([date, creditsGranted]) => ({
      date,
      creditsGranted,
      operatingCostCents: calculateTokenBlockOperatingCostCents(creditsGranted),
    }));

    const operatingCostCents = calculateTokenBlockOperatingCostCents(totalCreditsGranted);
    const blockCount =
      totalCreditsGranted > 0
        ? Math.ceil(totalCreditsGranted / TOKENS_PER_OPERATING_COST_BLOCK)
        : 0;

    return {
      totalCreditsGranted,
      operatingCostCents,
      blockCount,
      tokensPerBlock: TOKENS_PER_OPERATING_COST_BLOCK,
      costPerBlockCents: OPERATING_COST_PER_BLOCK_CENTS,
      daily,
    };
  }

  async getCurrentPlanCounts(): Promise<CurrentPlanStat[]> {
    if (this.useMemoryFallback) {
      const counts = new Map<BillingPlanId, number>();
      for (const wallet of Array.from(memoryWallets.values())) {
        counts.set(wallet.planId, (counts.get(wallet.planId) || 0) + 1);
      }
      return Array.from(counts.entries()).map(([planId, userCount]) => ({ planId, userCount }));
    }

    try {
      const rows = await db.execute<{ plan_id: string; user_count: number }>(sql`
        SELECT plan_id, COUNT(*)::int AS user_count
        FROM user_billing_wallets
        GROUP BY plan_id
        ORDER BY user_count DESC
      `);

      return rows.rows.map((row) => ({
        planId: row.plan_id as BillingPlanId,
        userCount: row.user_count,
      }));
    } catch (error) {
      if (!this.useMemoryFallback) {
        console.error("Failed to load current plan counts:", error);
        throw error;
      }
      return [];
    }
  }

  async getAdminBillingOverview(): Promise<AdminBillingOverview> {
    if (this.useMemoryFallback) {
      const wallets: AdminWalletRow[] = Array.from(memoryWallets.entries()).map(([userId, wallet]) => ({
        userId,
        userEmail: null,
        userName: userId.slice(0, 8),
        creditsBalance: wallet.balance,
        planId: wallet.planId,
        updatedAt: new Date().toISOString(),
      }));

      return {
        totalCredits: wallets.reduce((sum, row) => sum + row.creditsBalance, 0),
        walletCount: wallets.length,
        wallets: wallets.sort((a, b) => b.creditsBalance - a.creditsBalance),
      };
    }

    try {
      const rows = await db.execute<{
        user_id: string;
        user_email: string | null;
        first_name: string | null;
        last_name: string | null;
        credits_balance: number;
        plan_id: string;
        updated_at: Date;
      }>(sql`
        SELECT w.user_id,
               u.email AS user_email,
               u.first_name,
               u.last_name,
               w.credits_balance,
               w.plan_id,
               w.updated_at
        FROM user_billing_wallets w
        LEFT JOIN users u ON u.id = w.user_id
        ORDER BY w.credits_balance DESC, w.updated_at DESC
      `);

      const wallets = rows.rows.map((row) => ({
        userId: row.user_id,
        userEmail: row.user_email,
        userName:
          `${row.first_name || ""} ${row.last_name || ""}`.trim() ||
          row.user_email ||
          "Unknown user",
        creditsBalance: row.credits_balance,
        planId: row.plan_id as BillingPlanId,
        updatedAt: new Date(row.updated_at).toISOString(),
      }));

      return {
        totalCredits: wallets.reduce((sum, row) => sum + row.creditsBalance, 0),
        walletCount: wallets.length,
        wallets,
      };
    } catch {
      return { totalCredits: 0, walletCount: 0, wallets: [] };
    }
  }

  async chargeForProcessing(
    userId: string,
    options: UploadOptions,
    durationSeconds: number,
    projectId: string,
  ): Promise<{ cost: number; balanceAfter: number }> {
    const cost = calculateProcessingCost(options, durationSeconds);
    const wallet = await this.getOrCreateWallet(userId);

    if (wallet.balance < cost) {
      throw new Error(
        `Insufficient credits. This job needs ${cost} credits but you have ${wallet.balance}. Add credits in Settings → Billing.`,
      );
    }

    const newBalance = wallet.balance - cost;

    if (this.useMemoryFallback) {
      memoryWallets.set(userId, { balance: newBalance, planId: wallet.planId });
    } else {
      await db.execute(sql`
        UPDATE user_billing_wallets
        SET credits_balance = ${newBalance}, updated_at = NOW()
        WHERE user_id = ${userId}
      `);
    }

    await this.recordTransaction(userId, {
      type: "processing_charge",
      creditsDelta: -cost,
      balanceAfter: newBalance,
      description: `Video processing (${options.clipCount} clips)`,
      metadata: { projectId, durationSeconds, cost },
    });

    return { cost, balanceAfter: newBalance };
  }

  async refundProcessing(
    userId: string,
    cost: number,
    projectId: string,
    reason: string,
  ): Promise<void> {
    const wallet = await this.getOrCreateWallet(userId);
    const newBalance = wallet.balance + cost;

    if (this.useMemoryFallback) {
      memoryWallets.set(userId, { balance: newBalance, planId: wallet.planId });
    } else {
      await db.execute(sql`
        UPDATE user_billing_wallets
        SET credits_balance = ${newBalance}, updated_at = NOW()
        WHERE user_id = ${userId}
      `);
    }

    await this.recordTransaction(userId, {
      type: "refund",
      creditsDelta: cost,
      balanceAfter: newBalance,
      description: `Refund: ${reason}`,
      metadata: { projectId },
    });
  }
}

export const billingStorage = new BillingStorage();
