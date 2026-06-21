import { z } from "zod";
import { ANNOUNCEMENT_FRAME_RATIOS } from "./announcementFrame";

// Export auth models for Replit Auth integration
export * from "./models/auth";
export * from "./models/billing";
export * from "./models/announcements";
export * from "./announcementFrame";

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

export const updateProjectSchema = z.object({
  name: z.string().min(1).max(200),
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

export const panelStyleSchema = z.enum(["transparent", "black", "white"]);
export const panelTextAlignSchema = z.enum(["left", "center", "right"]);

const panelHexColorSchema = z
  .string()
  .optional()
  .transform((value) => {
    const trimmed = value?.trim();
    if (!trimmed) return undefined;
    return /^#[0-9A-Fa-f]{6}$/.test(trimmed) ? trimmed : undefined;
  });

export const uploadOptionsSchema = z.object({
  clipCount: z.number().min(1).max(5).default(3),
  minDuration: z.number().min(10).max(60).default(20),
  maxDuration: z.number().min(20).max(90).default(40),
  /** Optional — leave blank for default highlight & caption behavior. */
  reelPrompt: z
    .string()
    .max(1000)
    .optional()
    .transform((v) => (v?.trim() ? v.trim() : undefined)),
  /** Optional top banner text on generated reels (supports multiple lines). */
  topPanelText: z
    .string()
    .max(500)
    .optional()
    .transform((v) => (v?.trim() ? v.trim() : undefined)),
  /** Optional bottom banner text on generated reels (supports multiple lines). */
  bottomPanelText: z
    .string()
    .max(500)
    .optional()
    .transform((v) => (v?.trim() ? v.trim() : undefined)),
  topPanelStyle: panelStyleSchema.optional(),
  bottomPanelStyle: panelStyleSchema.optional(),
  topPanelFontSize: z.coerce.number().int().min(16).max(200).optional(),
  bottomPanelFontSize: z.coerce.number().int().min(16).max(200).optional(),
  topPanelTextColor: panelHexColorSchema,
  bottomPanelTextColor: panelHexColorSchema,
  topPanelTextAlign: panelTextAlignSchema.optional(),
  bottomPanelTextAlign: panelTextAlignSchema.optional(),
  /** Optional semi-transparent text watermark. */
  watermarkEnabled: z.boolean().optional(),
  /** Custom watermark text when watermark is enabled. */
  watermarkText: z
    .string()
    .max(100)
    .optional()
    .transform((v) => (v?.trim() ? v.trim() : undefined)),
  /** Watermark fill opacity (10–90). */
  watermarkOpacity: z.coerce.number().int().min(10).max(90).optional(),
  /** Optional brand logo overlay (logo must be uploaded in Settings). */
  logoEnabled: z.boolean().optional(),
});

export const updateReelCaptionSchema = z.object({
  caption: z.string().min(1).max(500),
});

export const updateAccountSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  email: z.string().email().max(255).optional(),
  currentPassword: z.string().min(1).optional(),
  newPassword: z.string().min(8).max(128).optional(),
});

export const adminCreditPackageSchema = z.object({
  id: z.enum(["demo_starter", "demo_creator", "demo_studio"]),
  name: z.string().min(1).max(100),
  credits: z.number().int().min(1).max(1_000_000),
  priceCents: z.number().int().min(0),
  discountPercent: z.number().int().min(0).max(100).optional().default(0),
  description: z.string().max(500),
  popular: z.boolean().optional(),
});

export const updateAdminPlansSchema = z.object({
  packages: z.array(adminCreditPackageSchema).min(1).max(10),
});

export const announcementFrameRatioSchema = z.enum(ANNOUNCEMENT_FRAME_RATIOS);

export const createAnnouncementSchema = z.object({
  title: z.string().min(1).max(200),
  body: z.string().max(2000).optional().default(""),
  imageUrl: z.string().max(500).nullable().optional(),
  linkUrl: z.string().max(500).nullable().optional(),
  frameRatio: announcementFrameRatioSchema.optional().default("1:1"),
  active: z.boolean().optional().default(true),
});

export const updateAnnouncementSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  body: z.string().max(2000).optional(),
  imageUrl: z.string().max(500).nullable().optional(),
  linkUrl: z.string().max(500).nullable().optional(),
  frameRatio: announcementFrameRatioSchema.optional(),
  active: z.boolean().optional(),
});

export type Project = z.infer<typeof projectSchema>;
export type InsertProject = z.infer<typeof insertProjectSchema>;
export type Reel = z.infer<typeof reelSchema>;
export type InsertReel = z.infer<typeof insertReelSchema>;
export type UploadOptions = z.infer<typeof uploadOptionsSchema>;
export type PanelStyle = z.infer<typeof panelStyleSchema>;
export type PanelTextAlign = z.infer<typeof panelTextAlignSchema>;

export interface ProcessingStatus {
  projectId: string;
  status: ProjectStatus;
  progress: number;
  currentStep: string;
  estimatedTimeRemaining?: number;
  error?: string;
}
