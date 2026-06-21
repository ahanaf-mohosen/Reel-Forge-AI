import { sql, eq, and } from "drizzle-orm";
import { db } from "../../db";
import { socialMediaAccounts, type SocialMediaAccount, type InsertSocialMediaAccount } from "@shared/models/auth";

export interface ISocialMediaStorage {
  getAccount(userId: string, platform: string): Promise<SocialMediaAccount | undefined>;
  getAllAccounts(userId: string): Promise<SocialMediaAccount[]>;
  upsertAccount(account: InsertSocialMediaAccount): Promise<SocialMediaAccount>;
  deleteAccount(userId: string, platform: string): Promise<void>;
  updateAccessToken(userId: string, platform: string, accessToken: string, expiresAt?: Date): Promise<void>;
}

class SocialMediaStorage implements ISocialMediaStorage {
  async getAccount(userId: string, platform: string): Promise<SocialMediaAccount | undefined> {
    const [account] = await db
      .select()
      .from(socialMediaAccounts)
      .where(
        and(
          eq(socialMediaAccounts.userId, userId),
          eq(socialMediaAccounts.platform, platform)
        )
      );
    return account;
  }

  async getAllAccounts(userId: string): Promise<SocialMediaAccount[]> {
    return await db
      .select()
      .from(socialMediaAccounts)
      .where(eq(socialMediaAccounts.userId, userId));
  }

  async upsertAccount(account: InsertSocialMediaAccount): Promise<SocialMediaAccount> {
    const [result] = await db
      .insert(socialMediaAccounts)
      .values(account)
      .onConflictDoUpdate({
        target: [socialMediaAccounts.userId, socialMediaAccounts.platform],
        set: {
          platformUserId: account.platformUserId,
          platformUsername: account.platformUsername,
          accessToken: account.accessToken,
          refreshToken: account.refreshToken,
          tokenExpiresAt: account.tokenExpiresAt,
          scope: account.scope,
          updatedAt: new Date(),
        },
      })
      .returning();
    return result;
  }

  async deleteAccount(userId: string, platform: string): Promise<void> {
    await db
      .delete(socialMediaAccounts)
      .where(
        and(
          eq(socialMediaAccounts.userId, userId),
          eq(socialMediaAccounts.platform, platform)
        )
      );
  }

  async updateAccessToken(userId: string, platform: string, accessToken: string, expiresAt?: Date): Promise<void> {
    await db
      .update(socialMediaAccounts)
      .set({
        accessToken,
        tokenExpiresAt: expiresAt,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(socialMediaAccounts.userId, userId),
          eq(socialMediaAccounts.platform, platform)
        )
      );
  }

  async listAllForAdmin(): Promise<AdminSocialAccountRow[]> {
    const rows = await db.execute<{
      id: string;
      user_id: string;
      user_email: string | null;
      first_name: string | null;
      last_name: string | null;
      platform: string;
      platform_user_id: string;
      platform_username: string | null;
      token_expires_at: Date | null;
      created_at: Date;
      updated_at: Date;
    }>(sql`
      SELECT sma.id,
             sma.user_id,
             u.email AS user_email,
             u.first_name,
             u.last_name,
             sma.platform,
             sma.platform_user_id,
             sma.platform_username,
             sma.token_expires_at,
             sma.created_at,
             sma.updated_at
      FROM social_media_accounts sma
      LEFT JOIN users u ON u.id = sma.user_id
      ORDER BY sma.updated_at DESC
    `);

    return rows.rows.map((row) => ({
      id: row.id,
      userId: row.user_id,
      userEmail: row.user_email,
      userName: `${row.first_name || ""} ${row.last_name || ""}`.trim() || row.user_email || "Unknown user",
      platform: row.platform,
      platformUserId: row.platform_user_id,
      platformUsername: row.platform_username,
      tokenExpiresAt: row.token_expires_at ? new Date(row.token_expires_at).toISOString() : null,
      createdAt: new Date(row.created_at).toISOString(),
      updatedAt: new Date(row.updated_at).toISOString(),
    }));
  }
}

export type AdminSocialAccountRow = {
  id: string;
  userId: string;
  userEmail: string | null;
  userName: string;
  platform: string;
  platformUserId: string;
  platformUsername: string | null;
  tokenExpiresAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export const socialMediaStorage = new SocialMediaStorage();
