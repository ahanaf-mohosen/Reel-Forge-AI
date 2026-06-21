import crypto from "crypto";
import { sql, eq, and, gt } from "drizzle-orm";
import { users, type User, type UpsertUser } from "@shared/models/auth";
import { db } from "../../db";

export interface IAuthStorage {
  ensureSchema(): Promise<void>;
  getUser(id: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  getUserByGoogleId(googleId: string): Promise<User | undefined>;
  getUserByVerificationToken(token: string): Promise<User | undefined>;
  getUserByPasswordResetToken(token: string): Promise<User | undefined>;
  getAllUsers(): Promise<User[]>;
  upsertUser(user: UpsertUser): Promise<User>;
  updateUser(id: string, updates: Partial<User>): Promise<User | undefined>;
  createVerificationToken(): { token: string; expires: Date };
  createPasswordResetToken(): { token: string; expires: Date };
}

class AuthStorage implements IAuthStorage {
  async ensureSchema(): Promise<void> {
    await db.execute(sql`
      ALTER TABLE users ADD COLUMN IF NOT EXISTS google_id varchar
    `);
    await db.execute(sql`
      ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified boolean NOT NULL DEFAULT false
    `);
    await db.execute(sql`
      ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verification_token varchar
    `);
    await db.execute(sql`
      ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verification_expires timestamp
    `);
    await db.execute(sql`
      ALTER TABLE users ADD COLUMN IF NOT EXISTS brand_logo_url varchar
    `);
    await db.execute(sql`
      ALTER TABLE users ADD COLUMN IF NOT EXISTS password_reset_token varchar
    `);
    await db.execute(sql`
      ALTER TABLE users ADD COLUMN IF NOT EXISTS password_reset_expires timestamp
    `);
    await db.execute(sql`
      UPDATE users SET email_verified = true WHERE email_verified = false
    `);
  }

  createVerificationToken(): { token: string; expires: Date } {
    const token = crypto.randomBytes(32).toString("hex");
    const expires = new Date(Date.now() + 24 * 60 * 60 * 1000);
    return { token, expires };
  }

  createPasswordResetToken(): { token: string; expires: Date } {
    const token = crypto.randomBytes(32).toString("hex");
    const expires = new Date(Date.now() + 60 * 60 * 1000);
    return { token, expires };
  }

  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user;
  }

  async getUserByGoogleId(googleId: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.googleId, googleId));
    return user;
  }

  async getUserByVerificationToken(token: string): Promise<User | undefined> {
    const [user] = await db
      .select()
      .from(users)
      .where(
        and(
          eq(users.emailVerificationToken, token),
          gt(users.emailVerificationExpires, new Date()),
        ),
      );
    return user;
  }

  async getUserByPasswordResetToken(token: string): Promise<User | undefined> {
    const [user] = await db
      .select()
      .from(users)
      .where(
        and(
          eq(users.passwordResetToken, token),
          gt(users.passwordResetExpires, new Date()),
        ),
      );
    return user;
  }

  async getAllUsers(): Promise<User[]> {
    const { asc } = await import("drizzle-orm");
    return db.select().from(users).orderBy(asc(users.createdAt));
  }

  async upsertUser(userData: UpsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(userData)
      .onConflictDoUpdate({
        target: users.id,
        set: {
          ...userData,
          updatedAt: new Date(),
        },
      })
      .returning();
    return user;
  }

  async updateUser(id: string, updates: Partial<User>): Promise<User | undefined> {
    const [user] = await db
      .update(users)
      .set({
        ...updates,
        updatedAt: new Date(),
      })
      .where(eq(users.id, id))
      .returning();
    return user;
  }
}

export const authStorage = new AuthStorage();
