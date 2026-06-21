import { randomUUID } from "crypto";
import { sql } from "drizzle-orm";
import { db } from "../../db";
import type {
  Project,
  InsertProject,
  Reel,
  InsertReel,
} from "@shared/schema";

export interface IStorage {
  ensureSchema(): Promise<void>;
  getProject(id: string): Promise<Project | undefined>;
  getProjectUserId(id: string): Promise<string | null>;
  getAllProjects(): Promise<Project[]>;
  getProjectsByUserId(userId: string): Promise<Project[]>;
  createProject(
    project: InsertProject & { originalVideo?: Project["originalVideo"]; userId?: string },
  ): Promise<Project>;
  updateProject(id: string, updates: Partial<Project>): Promise<Project | undefined>;
  deleteProject(id: string): Promise<boolean>;

  getReelsByProject(projectId: string): Promise<Reel[]>;
  getReel(projectId: string, reelId: string): Promise<Reel | undefined>;
  createReel(reel: InsertReel): Promise<Reel>;
  updateReel(
    projectId: string,
    reelId: string,
    updates: Partial<Pick<Reel, "caption">>,
  ): Promise<Reel | undefined>;
  deleteReelsByProject(projectId: string): Promise<void>;
}

type ProjectRow = {
  id: string;
  name: string;
  created_at: Date | string;
  status: Project["status"];
  progress: number;
  current_step: string | null;
  estimated_time_remaining: number | null;
  error: string | null;
  thumbnail: string | null;
  original_video: Project["originalVideo"] | null;
  transcript: string | null;
};

type ReelRow = {
  id: string;
  project_id: string;
  url: string;
  thumbnail: string | null;
  duration: number;
  caption: string;
  start: number;
  end: number;
  reason: string | null;
};

function rowToProject(row: ProjectRow): Project {
  const originalVideo = row.original_video
    ? typeof row.original_video === "string"
      ? JSON.parse(row.original_video)
      : row.original_video
    : undefined;

  return {
    id: row.id,
    name: row.name,
    createdAt: new Date(row.created_at).toISOString(),
    status: row.status,
    progress: row.progress,
    currentStep: row.current_step ?? undefined,
    estimatedTimeRemaining: row.estimated_time_remaining ?? undefined,
    error: row.error ?? undefined,
    thumbnail: row.thumbnail ?? undefined,
    originalVideo,
    transcript: row.transcript ?? undefined,
  };
}

function rowToReel(row: ReelRow): Reel {
  return {
    id: row.id,
    projectId: row.project_id,
    url: row.url,
    thumbnail: row.thumbnail ?? undefined,
    duration: row.duration,
    caption: row.caption,
    start: row.start,
    end: row.end,
    reason: row.reason ?? undefined,
  };
}

class DbProjectStorage implements IStorage {
  async ensureSchema(): Promise<void> {
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS video_projects (
        id varchar PRIMARY KEY,
        user_id varchar,
        name text NOT NULL,
        status varchar NOT NULL DEFAULT 'uploading',
        progress integer NOT NULL DEFAULT 0,
        current_step text,
        estimated_time_remaining integer,
        error text,
        thumbnail text,
        original_video jsonb,
        transcript text,
        created_at timestamp NOT NULL DEFAULT NOW(),
        updated_at timestamp NOT NULL DEFAULT NOW()
      )
    `);

    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS video_reels (
        id varchar PRIMARY KEY,
        project_id varchar NOT NULL REFERENCES video_projects(id) ON DELETE CASCADE,
        url text NOT NULL,
        thumbnail text,
        duration double precision NOT NULL,
        caption text NOT NULL,
        start double precision NOT NULL,
        "end" double precision NOT NULL,
        reason text,
        created_at timestamp NOT NULL DEFAULT NOW()
      )
    `);

    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS idx_video_projects_created_at ON video_projects(created_at DESC)
    `);

    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS idx_video_reels_project_id ON video_reels(project_id)
    `);

    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS idx_video_projects_user_id ON video_projects(user_id)
    `);
  }

  async getProjectUserId(id: string): Promise<string | null> {
    const result = await db.execute(sql`
      SELECT user_id FROM video_projects WHERE id = ${id} LIMIT 1
    `);
    const row = result.rows[0] as { user_id: string | null } | undefined;
    return row?.user_id ?? null;
  }

  async getProjectsByUserId(userId: string): Promise<Project[]> {
    const result = await db.execute(sql`
      SELECT * FROM video_projects
      WHERE user_id = ${userId}
      ORDER BY created_at DESC
    `);
    return (result.rows as ProjectRow[]).map(rowToProject);
  }

  async getProject(id: string): Promise<Project | undefined> {
    const result = await db.execute(sql`
      SELECT * FROM video_projects WHERE id = ${id} LIMIT 1
    `);
    const row = result.rows[0] as ProjectRow | undefined;
    return row ? rowToProject(row) : undefined;
  }

  async getAllProjects(): Promise<Project[]> {
    const result = await db.execute(sql`
      SELECT * FROM video_projects ORDER BY created_at DESC
    `);
    return (result.rows as ProjectRow[]).map(rowToProject);
  }

  async createProject(
    input: InsertProject & { originalVideo?: Project["originalVideo"]; userId?: string },
  ): Promise<Project> {
    const id = randomUUID();
    const name = input.name || "Untitled Project";

    await db.execute(sql`
      INSERT INTO video_projects (
        id, user_id, name, status, progress, current_step, original_video
      ) VALUES (
        ${id},
        ${input.userId ?? null},
        ${name},
        'uploading',
        0,
        'Preparing upload...',
        ${input.originalVideo ? JSON.stringify(input.originalVideo) : null}::jsonb
      )
    `);

    const project = await this.getProject(id);
    if (!project) {
      throw new Error("Failed to create project");
    }
    return project;
  }

  async updateProject(id: string, updates: Partial<Project>): Promise<Project | undefined> {
    const existing = await this.getProject(id);
    if (!existing) return undefined;

    const merged = { ...existing, ...updates };

    await db.execute(sql`
      UPDATE video_projects SET
        name = ${merged.name},
        status = ${merged.status},
        progress = ${merged.progress},
        current_step = ${merged.currentStep ?? null},
        estimated_time_remaining = ${merged.estimatedTimeRemaining ?? null},
        error = ${merged.error ?? null},
        thumbnail = ${merged.thumbnail ?? null},
        original_video = ${merged.originalVideo ? JSON.stringify(merged.originalVideo) : null}::jsonb,
        transcript = ${merged.transcript ?? null},
        updated_at = NOW()
      WHERE id = ${id}
    `);

    return this.getProject(id);
  }

  async deleteProject(id: string): Promise<boolean> {
    const result = await db.execute(sql`
      DELETE FROM video_projects WHERE id = ${id}
    `);
    return (result.rowCount ?? 0) > 0;
  }

  async getReelsByProject(projectId: string): Promise<Reel[]> {
    const result = await db.execute(sql`
      SELECT * FROM video_reels WHERE project_id = ${projectId} ORDER BY created_at ASC
    `);
    return (result.rows as ReelRow[]).map(rowToReel);
  }

  async getReel(projectId: string, reelId: string): Promise<Reel | undefined> {
    const result = await db.execute(sql`
      SELECT * FROM video_reels WHERE id = ${reelId} AND project_id = ${projectId} LIMIT 1
    `);
    const row = result.rows[0] as ReelRow | undefined;
    return row ? rowToReel(row) : undefined;
  }

  async createReel(input: InsertReel): Promise<Reel> {
    const id = randomUUID();

    await db.execute(sql`
      INSERT INTO video_reels (
        id, project_id, url, thumbnail, duration, caption, start, "end", reason
      ) VALUES (
        ${id},
        ${input.projectId},
        ${input.url},
        ${input.thumbnail ?? null},
        ${input.duration},
        ${input.caption},
        ${input.start},
        ${input.end},
        ${input.reason ?? null}
      )
    `);

    const reel = await this.getReel(input.projectId, id);
    if (!reel) {
      throw new Error("Failed to create reel");
    }
    return reel;
  }

  async updateReel(
    projectId: string,
    reelId: string,
    updates: Partial<Pick<Reel, "caption">>,
  ): Promise<Reel | undefined> {
    const existing = await this.getReel(projectId, reelId);
    if (!existing) return undefined;

    await db.execute(sql`
      UPDATE video_reels SET caption = ${updates.caption ?? existing.caption}
      WHERE id = ${reelId} AND project_id = ${projectId}
    `);

    return this.getReel(projectId, reelId);
  }

  async deleteReelsByProject(projectId: string): Promise<void> {
    await db.execute(sql`
      DELETE FROM video_reels WHERE project_id = ${projectId}
    `);
  }
}

export const projectStorage = new DbProjectStorage();
