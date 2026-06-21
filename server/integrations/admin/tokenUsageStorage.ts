import { sql } from "drizzle-orm";
import { db } from "../../db";
import { buildDailyBuckets, toAdminDateKey } from "@shared/adminDateRange";
import {
  calculateTokenBlockOperatingCostCents,
  OPERATING_COST_PER_BLOCK_CENTS,
  TOKENS_PER_OPERATING_COST_BLOCK,
} from "@shared/operatingCost";

export type TokenUsageRecord = {
  id: string;
  tokens: number;
  source: string;
  projectId: string | null;
  createdAt: string;
};

export type TokenUsageStats = {
  totalTokens: number;
  operatingCostCents: number;
  blockCount: number;
  tokensPerBlock: number;
  costPerBlockCents: number;
  daily: { date: string; tokens: number; operatingCostCents: number }[];
};

class TokenUsageStorage {
  async ensureSchema(): Promise<void> {
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS platform_token_usage (
        id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
        tokens integer NOT NULL,
        source varchar NOT NULL,
        project_id varchar,
        metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
        created_at timestamp NOT NULL DEFAULT NOW()
      )
    `);

    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS idx_platform_token_usage_created_at
      ON platform_token_usage (created_at DESC)
    `);
  }

  async recordUsage(entry: {
    tokens: number;
    source: string;
    projectId?: string | null;
    metadata?: Record<string, unknown>;
  }): Promise<void> {
    const tokens = Math.max(0, Math.round(entry.tokens));
    if (tokens === 0) return;

    await db.execute(sql`
      INSERT INTO platform_token_usage (tokens, source, project_id, metadata)
      VALUES (
        ${tokens},
        ${entry.source},
        ${entry.projectId ?? null},
        ${JSON.stringify(entry.metadata ?? {})}::jsonb
      )
    `);
  }

  async getStats(range: { start: Date; end: Date }): Promise<TokenUsageStats> {
    const start = new Date(range.start);
    const end = new Date(range.end);

    const rows = await db.execute<{ tokens: number; created_at: Date }>(sql`
      SELECT tokens, created_at
      FROM platform_token_usage
      WHERE created_at >= ${start}
        AND created_at <= ${end}
      ORDER BY created_at ASC
    `);

    const byDate = new Map<string, number>();
    for (const key of buildDailyBuckets(start, end)) {
      byDate.set(key, 0);
    }

    let totalTokens = 0;
    for (const row of rows.rows) {
      totalTokens += row.tokens;
      const key = toAdminDateKey(row.created_at);
      if (byDate.has(key)) {
        byDate.set(key, (byDate.get(key) || 0) + row.tokens);
      }
    }

    const daily = Array.from(byDate.entries()).map(([date, tokens]) => ({
      date,
      tokens,
      operatingCostCents: calculateTokenBlockOperatingCostCents(tokens),
    }));

    const operatingCostCents = calculateTokenBlockOperatingCostCents(totalTokens);
    const blockCount =
      totalTokens > 0
        ? Math.ceil(totalTokens / TOKENS_PER_OPERATING_COST_BLOCK)
        : 0;

    return {
      totalTokens,
      operatingCostCents,
      blockCount,
      tokensPerBlock: TOKENS_PER_OPERATING_COST_BLOCK,
      costPerBlockCents: OPERATING_COST_PER_BLOCK_CENTS,
      daily,
    };
  }

  async getLifetimeTotalTokens(): Promise<number> {
    const rows = await db.execute<{ total: number }>(sql`
      SELECT COALESCE(SUM(tokens), 0)::int AS total
      FROM platform_token_usage
    `);
    return rows.rows[0]?.total ?? 0;
  }
}

export const tokenUsageStorage = new TokenUsageStorage();
