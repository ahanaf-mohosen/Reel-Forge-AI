import { desc, eq, sql } from "drizzle-orm";
import fs from "fs";
import path from "path";
import { db } from "../../db";
import { announcements, type AnnouncementRow } from "@shared/models/announcements";

export type Announcement = {
  id: string;
  title: string;
  body: string;
  imageUrl: string | null;
  linkUrl: string | null;
  frameRatio: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
};

function toAnnouncement(row: AnnouncementRow): Announcement {
  return {
    id: row.id,
    title: row.title,
    body: row.body,
    imageUrl: row.imageUrl ?? null,
    linkUrl: row.linkUrl ?? null,
    frameRatio: row.frameRatio ?? "1:1",
    active: row.active,
    createdAt: new Date(row.createdAt).toISOString(),
    updatedAt: new Date(row.updatedAt).toISOString(),
  };
}

export function deleteAnnouncementImageFile(imageUrl: string | null | undefined): void {
  if (!imageUrl?.startsWith("/uploads/announcements/")) return;
  const filePath = path.join(process.cwd(), imageUrl.replace(/^\//, ""));
  try {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  } catch (error) {
    console.warn("Failed to delete announcement image:", error);
  }
}

class AnnouncementStorage {
  async ensureSchema(): Promise<void> {
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS announcements (
        id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
        title varchar NOT NULL,
        body text NOT NULL DEFAULT '',
        image_url varchar,
        active boolean NOT NULL DEFAULT true,
        created_at timestamp NOT NULL DEFAULT NOW(),
        updated_at timestamp NOT NULL DEFAULT NOW()
      )
    `);

    await db.execute(sql`
      ALTER TABLE announcements ADD COLUMN IF NOT EXISTS image_url varchar
    `);

    await db.execute(sql`
      ALTER TABLE announcements ADD COLUMN IF NOT EXISTS link_url varchar
    `);

    await db.execute(sql`
      ALTER TABLE announcements ADD COLUMN IF NOT EXISTS frame_ratio varchar NOT NULL DEFAULT '1:1'
    `);

    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS idx_announcements_active_created
      ON announcements (active, created_at DESC)
    `);
  }

  async listAll(): Promise<Announcement[]> {
    const rows = await db
      .select()
      .from(announcements)
      .orderBy(desc(announcements.createdAt));
    return rows.map(toAnnouncement);
  }

  async listActive(): Promise<Announcement[]> {
    const rows = await db
      .select()
      .from(announcements)
      .where(eq(announcements.active, true))
      .orderBy(desc(announcements.createdAt));
    return rows.map(toAnnouncement);
  }

  async getById(id: string): Promise<Announcement | null> {
    const [row] = await db.select().from(announcements).where(eq(announcements.id, id)).limit(1);
    return row ? toAnnouncement(row) : null;
  }

  async create(input: {
    title: string;
    body: string;
    imageUrl?: string | null;
    linkUrl?: string | null;
    frameRatio?: string;
    active?: boolean;
  }): Promise<Announcement> {
    const [row] = await db
      .insert(announcements)
      .values({
        title: input.title.trim(),
        body: input.body.trim(),
        imageUrl: input.imageUrl ?? null,
        linkUrl: input.linkUrl?.trim() || null,
        frameRatio: input.frameRatio || "1:1",
        active: input.active ?? true,
      })
      .returning();
    return toAnnouncement(row);
  }

  async update(
    id: string,
    input: {
      title?: string;
      body?: string;
      imageUrl?: string | null;
      linkUrl?: string | null;
      frameRatio?: string;
      active?: boolean;
    },
  ): Promise<Announcement | null> {
    const existing = await this.getById(id);
    if (!existing) return null;

    const updates: Partial<typeof announcements.$inferInsert> = {
      updatedAt: new Date(),
    };
    if (input.title !== undefined) updates.title = input.title.trim();
    if (input.body !== undefined) updates.body = input.body.trim();
    if (input.imageUrl !== undefined) {
      if (existing.imageUrl && existing.imageUrl !== input.imageUrl) {
        deleteAnnouncementImageFile(existing.imageUrl);
      }
      updates.imageUrl = input.imageUrl;
    }
    if (input.linkUrl !== undefined) {
      updates.linkUrl = input.linkUrl?.trim() || null;
    }
    if (input.frameRatio !== undefined) {
      updates.frameRatio = input.frameRatio;
    }
    if (input.active !== undefined) updates.active = input.active;

    const [row] = await db
      .update(announcements)
      .set(updates)
      .where(eq(announcements.id, id))
      .returning();

    return row ? toAnnouncement(row) : null;
  }

  async deletePermanently(id: string): Promise<boolean> {
    const existing = await this.getById(id);
    if (!existing) return false;

    const result = await db
      .delete(announcements)
      .where(eq(announcements.id, id))
      .returning({ id: announcements.id });

    if (result.length > 0) {
      deleteAnnouncementImageFile(existing.imageUrl);
      return true;
    }
    return false;
  }
}

export const announcementStorage = new AnnouncementStorage();
