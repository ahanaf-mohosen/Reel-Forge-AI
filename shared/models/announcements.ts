import { sql } from "drizzle-orm";
import { boolean, index, pgTable, text, timestamp, varchar } from "drizzle-orm/pg-core";

export const announcements = pgTable(
  "announcements",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    title: varchar("title").notNull(),
    body: text("body").notNull().default(""),
    imageUrl: varchar("image_url"),
    linkUrl: varchar("link_url"),
    frameRatio: varchar("frame_ratio").notNull().default("1:1"),
    active: boolean("active").notNull().default(true),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [index("idx_announcements_active_created").on(table.active, table.createdAt)],
);

export type AnnouncementRow = typeof announcements.$inferSelect;
