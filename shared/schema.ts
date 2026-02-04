import { z } from "zod";

// Export auth models for Replit Auth integration
export * from "./models/auth";

export type ProjectStatus = 'uploading' | 'transcribing' | 'analyzing' | 'cutting' | 'formatting' | 'completed' | 'failed';

export const projectSchema = z.object({
  id: z.string(),
  name: z.string(),
  createdAt: z.string(),
  status: z.enum(['uploading', 'transcribing', 'analyzing', 'cutting', 'formatting', 'completed', 'failed']),
  progress: z.number().min(0).max(100),
  currentStep: z.string().optional(),
  estimatedTimeRemaining: z.number().optional(),
  error: z.string().optional(),
  thumbnail: z.string().optional(),
  originalVideo: z.object({
    filename: z.string(),
    duration: z.number(),
    size: z.number(),
    format: z.string(),
    path: z.string(),
  }).optional(),
  transcript: z.string().optional(),
});

export const insertProjectSchema = z.object({
  name: z.string().min(1).default('Untitled Project'),
});

export const reelSchema = z.object({
  id: z.string(),
  projectId: z.string(),
  url: z.string(),
  thumbnail: z.string().optional(),
  duration: z.number(),
  caption: z.string(),
  start: z.number(),
  end: z.number(),
  reason: z.string().optional(),
});

export const insertReelSchema = reelSchema.omit({ id: true });

export const uploadOptionsSchema = z.object({
  clipCount: z.number().min(1).max(5).default(3),
  minDuration: z.number().min(10).max(60).default(20),
  maxDuration: z.number().min(20).max(90).default(40),
});

export type Project = z.infer<typeof projectSchema>;
export type InsertProject = z.infer<typeof insertProjectSchema>;
export type Reel = z.infer<typeof reelSchema>;
export type InsertReel = z.infer<typeof insertReelSchema>;
export type UploadOptions = z.infer<typeof uploadOptionsSchema>;

export interface ProcessingStatus {
  projectId: string;
  status: ProjectStatus;
  progress: number;
  currentStep: string;
  estimatedTimeRemaining?: number;
  error?: string;
}
