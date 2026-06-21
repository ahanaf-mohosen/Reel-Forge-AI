import { sql } from "drizzle-orm";
import { index, integer, jsonb, pgTable, timestamp, varchar, unique, text, boolean } from "drizzle-orm/pg-core";

// Session storage table.
// (IMPORTANT) This table is mandatory for Replit Auth, don't drop it.
export const sessions = pgTable(
  "sessions",
  {
    sid: varchar("sid").primaryKey(),
    sess: jsonb("sess").notNull(),
    expire: timestamp("expire").notNull(),
  },
  (table) => [index("IDX_session_expire").on(table.expire)]
);

// User storage table.
// (IMPORTANT) This table is mandatory for Replit Auth, don't drop it.
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: varchar("email").unique(),
  password: varchar("password"),
  firstName: varchar("first_name"),
  lastName: varchar("last_name"),
  profileImageUrl: varchar("profile_image_url"),
  brandLogoUrl: varchar("brand_logo_url"),
  authProvider: varchar("auth_provider").default("google"),
  googleId: varchar("google_id"),
  emailVerified: boolean("email_verified").notNull().default(false),
  emailVerificationToken: varchar("email_verification_token"),
  emailVerificationExpires: timestamp("email_verification_expires"),
  passwordResetToken: varchar("password_reset_token"),
  passwordResetExpires: timestamp("password_reset_expires"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export type UpsertUser = typeof users.$inferInsert;
export type User = typeof users.$inferSelect;

// Social media connections table for OAuth integrations
export const socialMediaAccounts = pgTable("social_media_accounts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  platform: varchar("platform").notNull(), // 'instagram', 'facebook', 'youtube'
  platformUserId: varchar("platform_user_id").notNull(),
  platformUsername: varchar("platform_username"),
  accessToken: varchar("access_token").notNull(),
  refreshToken: varchar("refresh_token"),
  tokenExpiresAt: timestamp("token_expires_at"),
  scope: varchar("scope"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  unique("user_platform_unique").on(table.userId, table.platform),
]);

export type SocialMediaAccount = typeof socialMediaAccounts.$inferSelect;
export type InsertSocialMediaAccount = typeof socialMediaAccounts.$inferInsert;

// Persistent profit ledger for admin analytics.
export const adminProfitEvents = pgTable(
  "admin_profit_events",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    projectId: varchar("project_id").notNull().unique(),
    projectName: text("project_name").notNull(),
    source: varchar("source").notNull().default("video_processing"),
    revenueCents: integer("revenue_cents").notNull(),
    costCents: integer("cost_cents").notNull(),
    profitCents: integer("profit_cents").notNull(),
    clipsCount: integer("clips_count").notNull().default(0),
    videoDurationSeconds: integer("video_duration_seconds").notNull().default(0),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [index("idx_admin_profit_events_created_at").on(table.createdAt)]
);

export type AdminProfitEvent = typeof adminProfitEvents.$inferSelect;
export type InsertAdminProfitEvent = typeof adminProfitEvents.$inferInsert;

// Persistent admin audit trail.
export const adminAuditLogs = pgTable(
  "admin_audit_logs",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    actorId: varchar("actor_id").references(() => users.id, { onDelete: "set null" }),
    actorEmail: varchar("actor_email"),
    action: varchar("action").notNull(),
    resourceType: varchar("resource_type").notNull(),
    resourceId: varchar("resource_id"),
    details: jsonb("details").notNull().default(sql`'{}'::jsonb`),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [index("idx_admin_audit_logs_created_at").on(table.createdAt)]
);

export type AdminAuditLog = typeof adminAuditLogs.$inferSelect;
export type InsertAdminAuditLog = typeof adminAuditLogs.$inferInsert;
