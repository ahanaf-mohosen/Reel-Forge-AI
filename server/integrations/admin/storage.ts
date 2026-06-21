import { desc, sql } from "drizzle-orm";
import { db } from "../../db";
import { buildDailyBuckets } from "@shared/adminDateRange";
import {
  adminAuditLogs,
  adminProfitEvents,
  type AdminAuditLog,
  type AdminProfitEvent,
  type InsertAdminAuditLog,
  type InsertAdminProfitEvent,
} from "@shared/models/auth";

export interface IAdminAuditStorage {
  ensureSchema(): Promise<void>;
  logEvent(entry: {
    actorId?: string | null;
    actorEmail?: string | null;
    action: string;
    resourceType: string;
    resourceId?: string | null;
    details?: Record<string, unknown>;
  }): Promise<AdminAuditLog>;
  getRecentEvents(limit?: number): Promise<AdminAuditLog[]>;
}

export type ProfitTrendPoint = {
  date: string;
  revenueCents: number;
  costCents: number;
  profitCents: number;
};

export type ProfitSummary = {
  totalRevenueCents: number;
  totalCostCents: number;
  totalProfitCents: number;
  profitMargin: number;
  trendChangePercent: number;
  daily: ProfitTrendPoint[];
};

export function calculateEstimatedProfitMetrics(input: {
  videoDurationSeconds: number;
  clipsCount: number;
}): { revenueCents: number; costCents: number; profitCents: number } {
  const durationMinutes = Math.max(1, input.videoDurationSeconds / 60);
  const revenueCents = Math.round(4999 + input.clipsCount * 1799 + durationMinutes * 45);
  const costCents = Math.round(1299 + input.clipsCount * 350 + durationMinutes * 28);

  return {
    revenueCents,
    costCents,
    profitCents: revenueCents - costCents,
  };
}

class AdminAuditStorage implements IAdminAuditStorage {
  async ensureSchema(): Promise<void> {
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS admin_audit_logs (
        id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
        actor_id varchar REFERENCES users(id) ON DELETE SET NULL,
        actor_email varchar,
        action varchar NOT NULL,
        resource_type varchar NOT NULL,
        resource_id varchar,
        details jsonb NOT NULL DEFAULT '{}'::jsonb,
        created_at timestamp NOT NULL DEFAULT NOW()
      )
    `);

    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS idx_admin_audit_logs_created_at
      ON admin_audit_logs (created_at DESC)
    `);

    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS admin_profit_events (
        id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
        project_id varchar NOT NULL UNIQUE,
        project_name text NOT NULL,
        source varchar NOT NULL DEFAULT 'video_processing',
        revenue_cents integer NOT NULL,
        cost_cents integer NOT NULL,
        profit_cents integer NOT NULL,
        clips_count integer NOT NULL DEFAULT 0,
        video_duration_seconds integer NOT NULL DEFAULT 0,
        created_at timestamp NOT NULL DEFAULT NOW()
      )
    `);

    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS idx_admin_profit_events_created_at
      ON admin_profit_events (created_at DESC)
    `);
  }

  async logEvent(entry: {
    actorId?: string | null;
    actorEmail?: string | null;
    action: string;
    resourceType: string;
    resourceId?: string | null;
    details?: Record<string, unknown>;
  }): Promise<AdminAuditLog> {
    const values: InsertAdminAuditLog = {
      actorId: entry.actorId ?? null,
      actorEmail: entry.actorEmail ?? null,
      action: entry.action,
      resourceType: entry.resourceType,
      resourceId: entry.resourceId ?? null,
      details: entry.details ?? {},
    };

    const [auditLog] = await db.insert(adminAuditLogs).values(values).returning();
    return auditLog;
  }

  async getRecentEvents(limit = 25): Promise<AdminAuditLog[]> {
    return db
      .select()
      .from(adminAuditLogs)
      .orderBy(desc(adminAuditLogs.createdAt))
      .limit(limit);
  }

  async logProfitEvent(entry: {
    projectId: string;
    projectName: string;
    revenueCents: number;
    costCents: number;
    clipsCount: number;
    videoDurationSeconds: number;
    source?: string;
  }): Promise<AdminProfitEvent> {
    const values: InsertAdminProfitEvent = {
      projectId: entry.projectId,
      projectName: entry.projectName,
      source: entry.source || "video_processing",
      revenueCents: entry.revenueCents,
      costCents: entry.costCents,
      profitCents: entry.revenueCents - entry.costCents,
      clipsCount: entry.clipsCount,
      videoDurationSeconds: entry.videoDurationSeconds,
    };

    const [event] = await db
      .insert(adminProfitEvents)
      .values(values)
      .onConflictDoUpdate({
        target: adminProfitEvents.projectId,
        set: {
          projectName: values.projectName,
          source: values.source,
          revenueCents: values.revenueCents,
          costCents: values.costCents,
          profitCents: values.profitCents,
          clipsCount: values.clipsCount,
          videoDurationSeconds: values.videoDurationSeconds,
        },
      })
      .returning();

    return event;
  }

  async getProfitSummary(range: { start: Date; end: Date }): Promise<ProfitSummary> {
    const rows = await db
      .select()
      .from(adminProfitEvents)
      .orderBy(desc(adminProfitEvents.createdAt));

    const start = new Date(range.start);
    const end = new Date(range.end);

    const relevantRows = rows.filter((row) => {
      const created = new Date(row.createdAt);
      return created >= start && created <= end;
    });

    const byDate = new Map<string, ProfitTrendPoint>();
    for (const key of buildDailyBuckets(start, end)) {
      byDate.set(key, {
        date: key,
        revenueCents: 0,
        costCents: 0,
        profitCents: 0,
      });
    }

    for (const row of relevantRows) {
      const key = new Date(row.createdAt).toISOString().slice(0, 10);
      const bucket = byDate.get(key);
      if (!bucket) continue;
      bucket.revenueCents += row.revenueCents;
      bucket.costCents += row.costCents;
      bucket.profitCents += row.profitCents;
    }

    const daily = Array.from(byDate.values());
    const totalRevenueCents = daily.reduce((sum, day) => sum + day.revenueCents, 0);
    const totalCostCents = daily.reduce((sum, day) => sum + day.costCents, 0);
    const totalProfitCents = daily.reduce((sum, day) => sum + day.profitCents, 0);
    const profitMargin = totalRevenueCents > 0 ? (totalProfitCents / totalRevenueCents) * 100 : 0;

    const days = daily.length;
    const midpoint = Math.max(1, Math.floor(days / 2));
    const recentProfit = daily.slice(midpoint).reduce((sum, day) => sum + day.profitCents, 0);
    const previousProfit = daily.slice(0, midpoint).reduce((sum, day) => sum + day.profitCents, 0);
    const trendChangePercent = previousProfit > 0
      ? ((recentProfit - previousProfit) / previousProfit) * 100
      : recentProfit > 0
        ? 100
        : 0;

    return {
      totalRevenueCents,
      totalCostCents,
      totalProfitCents,
      profitMargin,
      trendChangePercent,
      daily,
    };
  }

  async getTrackedProfitProjectIds(): Promise<Set<string>> {
    const rows = await db.select({ projectId: adminProfitEvents.projectId }).from(adminProfitEvents);
    return new Set(rows.map((row) => row.projectId));
  }
}

export const adminAuditStorage = new AdminAuditStorage();