import { randomUUID } from "crypto";
import type { 
  Project, 
  InsertProject, 
  Reel, 
  InsertReel,
  ProjectStatus,
  UploadOptions 
} from "@shared/schema";

export interface IStorage {
  getProject(id: string): Promise<Project | undefined>;
  getAllProjects(): Promise<Project[]>;
  createProject(project: InsertProject & { originalVideo?: Project['originalVideo'] }): Promise<Project>;
  updateProject(id: string, updates: Partial<Project>): Promise<Project | undefined>;
  deleteProject(id: string): Promise<boolean>;
  
  getReelsByProject(projectId: string): Promise<Reel[]>;
  getReel(projectId: string, reelId: string): Promise<Reel | undefined>;
  createReel(reel: InsertReel): Promise<Reel>;
  deleteReelsByProject(projectId: string): Promise<void>;
}

export class MemStorage implements IStorage {
  private projects: Map<string, Project>;
  private reels: Map<string, Reel>;

  constructor() {
    this.projects = new Map();
    this.reels = new Map();
  }

  async getProject(id: string): Promise<Project | undefined> {
    return this.projects.get(id);
  }

  async getAllProjects(): Promise<Project[]> {
    return Array.from(this.projects.values())
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  async createProject(input: InsertProject & { originalVideo?: Project['originalVideo'] }): Promise<Project> {
    const id = randomUUID();
    const project: Project = {
      id,
      name: input.name || 'Untitled Project',
      createdAt: new Date().toISOString(),
      status: 'uploading',
      progress: 0,
      currentStep: 'Preparing upload...',
      originalVideo: input.originalVideo,
    };
    this.projects.set(id, project);
    return project;
  }

  async updateProject(id: string, updates: Partial<Project>): Promise<Project | undefined> {
    const project = this.projects.get(id);
    if (!project) return undefined;
    
    const updated = { ...project, ...updates };
    this.projects.set(id, updated);
    return updated;
  }

  async deleteProject(id: string): Promise<boolean> {
    await this.deleteReelsByProject(id);
    return this.projects.delete(id);
  }

  async getReelsByProject(projectId: string): Promise<Reel[]> {
    return Array.from(this.reels.values())
      .filter(reel => reel.projectId === projectId);
  }

  async getReel(projectId: string, reelId: string): Promise<Reel | undefined> {
    const reel = this.reels.get(reelId);
    if (reel && reel.projectId === projectId) {
      return reel;
    }
    return undefined;
  }

  async createReel(input: InsertReel): Promise<Reel> {
    const id = randomUUID();
    const reel: Reel = {
      ...input,
      id,
    };
    this.reels.set(id, reel);
    return reel;
  }

  async deleteReelsByProject(projectId: string): Promise<void> {
    for (const [id, reel] of this.reels.entries()) {
      if (reel.projectId === projectId) {
        this.reels.delete(id);
      }
    }
  }
}

export const storage = new MemStorage();
