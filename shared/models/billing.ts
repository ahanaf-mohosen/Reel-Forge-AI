import { sql } from "drizzle-orm";
import { index, integer, jsonb, pgTable, text, timestamp, varchar, unique, boolean } from "drizzle-orm/pg-core";
import { users } from "./auth";

export const userBillingWallets = pgTable("user_billing_wallets", {
  userId: varchar("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  creditsBalance: integer("credits_balance").notNull().default(500),
  planId: varchar("plan_id").notNull().default("demo_free"),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const billingTransactions = pgTable(
  "billing_transactions",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    userId: varchar("user_id").notNull(),
    type: varchar("type").notNull(),
    creditsDelta: integer("credits_delta").notNull(),
    balanceAfter: integer("balance_after").notNull(),
    description: text("description").notNull(),
    metadata: jsonb("metadata").notNull().default(sql`'{}'::jsonb`),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("idx_billing_transactions_user_created").on(table.userId, table.createdAt),
  ],
);

export const billingPayments = pgTable(
  "billing_payments",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    userId: varchar("user_id").notNull(),
    userEmail: varchar("user_email"),
    packageId: varchar("package_id").notNull(),
    packageName: varchar("package_name").notNull(),
    amountCents: integer("amount_cents").notNull(),
    creditsGranted: integer("credits_granted").notNull(),
    status: varchar("status").notNull().default("completed"),
    cardLast4: varchar("card_last4").notNull(),
    cardholderName: varchar("cardholder_name").notNull(),
    paymentReference: varchar("payment_reference").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    unique("billing_payments_payment_reference_unique").on(table.paymentReference),
    index("idx_billing_payments_created").on(table.createdAt),
  ],
);

export const billingCreditPackages = pgTable("billing_credit_packages", {
  id: varchar("id").primaryKey(),
  name: varchar("name").notNull(),
  credits: integer("credits").notNull(),
  priceCents: integer("price_cents").notNull(),
  description: text("description").notNull(),
  popular: boolean("popular").notNull().default(false),
  discountPercent: integer("discount_percent").notNull().default(0),
  sortOrder: integer("sort_order").notNull().default(0),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type UserBillingWallet = typeof userBillingWallets.$inferSelect;
export type BillingTransactionRow = typeof billingTransactions.$inferSelect;
export type BillingPaymentRow = typeof billingPayments.$inferSelect;
export type BillingCreditPackageRow = typeof billingCreditPackages.$inferSelect;
