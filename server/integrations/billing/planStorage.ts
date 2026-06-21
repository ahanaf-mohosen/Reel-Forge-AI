import { asc, sql } from "drizzle-orm";
import { db } from "../../db";
import {
  BASE_PACKAGES,
  enrichCreditPackage,
  type DemoCreditPackage,
} from "./config";
import { billingCreditPackages } from "@shared/models/billing";
import { clampDiscountPercent } from "@shared/billingPricing";

function rowToPackage(row: typeof billingCreditPackages.$inferSelect): DemoCreditPackage {
  return enrichCreditPackage({
    id: row.id as DemoCreditPackage["id"],
    name: row.name,
    credits: row.credits,
    priceCents: row.priceCents,
    description: row.description,
    popular: row.popular ?? false,
    discountPercent: row.discountPercent ?? 0,
  });
}

export type SavePackageInput = {
  id: DemoCreditPackage["id"];
  name: string;
  credits: number;
  priceCents: number;
  description: string;
  popular?: boolean;
  discountPercent?: number;
};

class PlanStorage {
  async ensureSchema(): Promise<void> {
    await db.execute(sql`
      ALTER TABLE billing_credit_packages
      ADD COLUMN IF NOT EXISTS discount_percent integer NOT NULL DEFAULT 0
    `);

    try {
      const existing = await db
        .select({ id: billingCreditPackages.id })
        .from(billingCreditPackages)
        .limit(1);
      if (existing.length === 0) {
        await this.savePackages(BASE_PACKAGES);
      }
    } catch (error) {
      console.error("Plan storage seed skipped:", error);
    }
  }

  async getPackages(): Promise<DemoCreditPackage[]> {
    try {
      const rows = await db
        .select()
        .from(billingCreditPackages)
        .orderBy(asc(billingCreditPackages.sortOrder));

      if (rows.length === 0) {
        return BASE_PACKAGES.map(enrichCreditPackage);
      }

      return rows.map(rowToPackage);
    } catch (error) {
      console.error("Plan storage read failed, using defaults:", error);
      return BASE_PACKAGES.map(enrichCreditPackage);
    }
  }

  async savePackages(packages: SavePackageInput[]): Promise<DemoCreditPackage[]> {
    const normalized = packages.map((pkg, index) => ({
      id: pkg.id,
      name: pkg.name.trim(),
      credits: pkg.credits,
      priceCents: Math.max(0, Math.round(pkg.priceCents)),
      description: pkg.description.trim(),
      popular: Boolean(pkg.popular),
      discountPercent: clampDiscountPercent(pkg.discountPercent ?? 0),
      sortOrder: index,
    }));

    for (const pkg of normalized) {
      await db
        .insert(billingCreditPackages)
        .values({
          id: pkg.id,
          name: pkg.name,
          credits: pkg.credits,
          priceCents: pkg.priceCents,
          description: pkg.description,
          popular: pkg.popular,
          discountPercent: pkg.discountPercent,
          sortOrder: pkg.sortOrder,
        })
        .onConflictDoUpdate({
          target: billingCreditPackages.id,
          set: {
            name: pkg.name,
            credits: pkg.credits,
            priceCents: pkg.priceCents,
            description: pkg.description,
            popular: pkg.popular,
            discountPercent: pkg.discountPercent,
            sortOrder: pkg.sortOrder,
            updatedAt: new Date(),
          },
        });
    }

    return normalized.map((pkg) =>
      enrichCreditPackage({
        id: pkg.id,
        name: pkg.name,
        credits: pkg.credits,
        priceCents: pkg.priceCents,
        description: pkg.description,
        popular: pkg.popular,
        discountPercent: pkg.discountPercent,
      }),
    );
  }

  async getPackageById(id: string): Promise<DemoCreditPackage | undefined> {
    const packages = await this.getPackages();
    return packages.find((p) => p.id === id);
  }
}

export const planStorage = new PlanStorage();
