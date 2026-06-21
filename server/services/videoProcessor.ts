import fs from "fs";
import path from "path";
import os from "os";
import { randomUUID } from "crypto";
import { spawn } from "child_process";
import { storage } from "../storage";
import { authStorage } from "../integrations/auth";
import type { UploadOptions, PanelStyle, PanelTextAlign } from "@shared/schema";
import { adminAuditStorage, calculateEstimatedProfitMetrics } from "../integrations/admin/storage";
import { billingStorage } from "../integrations/billing/storage";
import {
  buildDemoTranscript,
  detectHighlights,
  getAiGatewayMode,
  shouldUseOpenAiForReels,
  type TranscriptSegment,
} from "./aiGateway";

const outputDir = path.join(process.cwd(), 'outputs');

async function updateProgress(projectId: string, status: string, progress: number, step: string, eta?: number) {
  await storage.updateProject(projectId, {
    status: status as any,
    progress,
    currentStep: step,
    estimatedTimeRemaining: eta,
  });
}

async function extractAudio(videoPath: string, outputPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const ffmpeg = spawn('ffmpeg', [
      '-i', videoPath,
      '-vn',
      '-acodec', 'libmp3lame',
      '-ar', '16000',
      '-ac', '1',
      '-b:a', '64k',
      '-y',
      outputPath.replace('.wav', '.mp3')
    ]);

    let stderr = '';
    ffmpeg.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    ffmpeg.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`FFmpeg audio extraction failed: ${stderr}`));
      }
    });

    ffmpeg.on('error', reject);
  });
}

async function getVideoDuration(videoPath: string): Promise<number> {
  return new Promise((resolve, reject) => {
    const ffprobe = spawn('ffprobe', [
      '-v', 'error',
      '-show_entries', 'format=duration',
      '-of', 'default=noprint_wrappers=1:nokey=1',
      videoPath
    ]);

    let output = '';
    ffprobe.stdout.on('data', (data) => {
      output += data.toString();
    });

    ffprobe.on('close', (code) => {
      if (code === 0) {
        resolve(parseFloat(output.trim()) || 0);
      } else {
        resolve(60);
      }
    });

    ffprobe.on('error', () => {
      resolve(60);
    });
  });
}

async function transcribeAudio(
  audioPath: string,
  videoDuration: number,
): Promise<{ text: string; segments: TranscriptSegment[] }> {
  const mp3Path = audioPath.replace('.wav', '.mp3');

  // Local Whisper (free) — preferred in demo mode
  try {
    return await new Promise((resolve, reject) => {
      const python = spawn('python', [
        '-c',
        `
import whisper
import json

model = whisper.load_model("base")
result = model.transcribe("${mp3Path.replace(/\\/g, '/')}", language="en")

segments = []
for segment in result.get('segments', []):
    segments.append({
        'start': segment['start'],
        'end': segment['end'],
        'text': segment['text'].strip()
    })

print(json.dumps({'text': result['text'], 'segments': segments}))
`
      ]);

      let stdout = '';
      let stderr = '';

      python.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      python.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      python.on('close', (code) => {
        if (code === 0) {
          try {
            const result = JSON.parse(stdout);
            resolve({
              text: result.text || '',
              segments: result.segments || [],
            });
          } catch {
            reject(new Error('Failed to parse Whisper output'));
          }
        } else {
          console.error('Whisper error:', stderr);
          reject(new Error('Local Whisper failed'));
        }
      });

      python.on('error', (error) => {
        reject(new Error(`Failed to start Whisper: ${error.message}`));
      });
    });
  } catch (error) {
    console.warn('[videoProcessor] Local Whisper unavailable, using demo transcript:', error);
    return buildDemoTranscript(videoDuration);
  }

  /*
  // PRODUCTION: OpenAI Whisper API (uncomment when AI_GATEWAY_MODE=production)
  // import { transcribeAudioProduction } from "./aiGateway";
  // return transcribeAudioProduction(mp3Path);
  */
}

type ReelOverlayConfig = {
  topPanelText?: string;
  bottomPanelText?: string;
  topPanelStyle?: PanelStyle;
  bottomPanelStyle?: PanelStyle;
  topPanelFontSize?: number;
  bottomPanelFontSize?: number;
  topPanelTextColor?: string;
  bottomPanelTextColor?: string;
  topPanelTextAlign?: PanelTextAlign;
  bottomPanelTextAlign?: PanelTextAlign;
  watermarkEnabled?: boolean;
  watermarkText?: string;
  watermarkOpacity?: number;
  logoPath?: string;
};

function escapeFfmpegDrawText(text: string): string {
  return text
    .replace(/\\/g, "\\\\")
    .replace(/'/g, "'\\''")
    .replace(/:/g, "\\:")
    .replace(/%/g, "\\%");
}

function toFfmpegPath(filePath: string): string {
  return filePath.replace(/\\/g, "/").replace(/:/g, "\\:");
}

function normalizePanelText(text: string): string {
  return text.trim().replace(/\r\n/g, "\n").replace(/\r/g, "\n");
}

function buildDrawtextSource(text: string, tempFiles: string[]): string {
  const normalized = normalizePanelText(text);
  if (normalized.includes("\n")) {
    const tempFile = path.join(os.tmpdir(), `rf-dt-${randomUUID()}.txt`);
    fs.writeFileSync(tempFile, normalized, "utf8");
    tempFiles.push(tempFile);
    return `textfile='${toFfmpegPath(tempFile)}'`;
  }
  return `text='${escapeFfmpegDrawText(normalized)}'`;
}

function cleanupTempTextFiles(tempFiles: string[]): void {
  for (const file of tempFiles) {
    try {
      fs.unlinkSync(file);
    } catch {
      // ignore cleanup errors
    }
  }
}

function hexToFfmpegColor(hex: string, alpha?: number): string {
  const normalized = hex.replace("#", "").toUpperCase();
  if (!/^[0-9A-F]{6}$/.test(normalized)) {
    return alpha !== undefined ? `white@${alpha}` : "white";
  }
  return alpha !== undefined ? `0x${normalized}@${alpha}` : `0x${normalized}`;
}

function getFfmpegDrawtextFontPrefix(): string {
  const winDir = process.env.WINDIR || "C:\\Windows";
  const candidates = [
    path.join(winDir, "Fonts", "arial.ttf"),
    path.join(winDir, "Fonts", "segoeui.ttf"),
    "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
    "/System/Library/Fonts/Supplemental/Arial.ttf",
  ];

  for (const fontPath of candidates) {
    if (fs.existsSync(fontPath)) {
      const ffmpegPath = fontPath.replace(/\\/g, "/").replace(/:/g, "\\:");
      return `fontfile='${ffmpegPath}':`;
    }
  }

  return "";
}

const DRAWTEXT_FONT_PREFIX = getFfmpegDrawtextFontPrefix();

/** 9:16 canvas with centered 16:9 main frame — letterbox bands above/below. */
const OUTPUT_WIDTH = 1080;
const OUTPUT_HEIGHT = 1920;
const MAIN_FRAME_HEIGHT = Math.round((OUTPUT_WIDTH * 9) / 16);
const PANEL_HEIGHT = Math.floor((OUTPUT_HEIGHT - MAIN_FRAME_HEIGHT) / 2);
const PANEL_CENTER_Y = Math.round(PANEL_HEIGHT / 2);
const PANEL_BOX_Y_BOTTOM = OUTPUT_HEIGHT - PANEL_HEIGHT;
const PANEL_TEXT_Y_BOTTOM = PANEL_BOX_Y_BOTTOM + PANEL_CENTER_Y;
const PANEL_FONT_SIZE = Math.round(Math.min(OUTPUT_WIDTH / 8, PANEL_HEIGHT * 0.16));
const TRANSPARENT_PANEL_FONT_SIZE = Math.round(Math.min(OUTPUT_WIDTH / 6, PANEL_HEIGHT * 0.22));
const WATERMARK_FONT_SIZE = Math.round(Math.min(OUTPUT_WIDTH / 10, MAIN_FRAME_HEIGHT / 3.5));
/** Radians for bottom-left → top-right diagonal of the 16:9 main frame. */
const WATERMARK_DIAGONAL_ANGLE = Math.atan2(MAIN_FRAME_HEIGHT, OUTPUT_WIDTH).toFixed(4);
const PANEL_TEXT_MARGIN = 48;
const LOGO_MAX_WIDTH = 72;
const LOGO_MARGIN = 20;

function panelStyleOrDefault(style?: PanelStyle): PanelStyle {
  return style ?? "black";
}

function needsPanelOverlay(text?: string): boolean {
  return Boolean(text?.trim());
}

function resolvePanelFontSize(style: PanelStyle, custom?: number): number {
  if (custom) return custom;
  return style === "transparent" ? TRANSPARENT_PANEL_FONT_SIZE : PANEL_FONT_SIZE;
}

function resolvePanelTextColor(style: PanelStyle, customColor?: string): string {
  if (customColor) return hexToFfmpegColor(customColor);
  if (style === "transparent") return hexToFfmpegColor("#FFFFFF", 0.95);
  if (style === "white") return "black";
  return "white";
}

function resolvePanelX(align: PanelTextAlign = "center"): string {
  if (align === "left") return String(PANEL_TEXT_MARGIN);
  if (align === "right") return `w-text_w-${PANEL_TEXT_MARGIN}`;
  return "(w-text_w)/2";
}

function resolveWatermarkOpacity(opacity?: number): { fill: string; border: string } {
  const alpha = Math.min(0.9, Math.max(0.1, (opacity ?? 45) / 100));
  const borderAlpha = Math.min(0.85, Math.max(0.15, alpha * 0.95));
  return {
    fill: `white@${alpha.toFixed(2)}`,
    border: `black@${borderAlpha.toFixed(2)}`,
  };
}

/** 9:16 output: sharp video centered, blurred fill behind (16:9 → 9:16 style). */
function buildVerticalBlurFillFilter(
  watermark?: Pick<ReelOverlayConfig, "watermarkEnabled" | "watermarkText" | "watermarkOpacity">,
): string {
  const parts = [
    "split[main][bg]",
    "[bg]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,boxblur=24:12[blurred]",
  ];

  if (watermark?.watermarkEnabled && watermark.watermarkText) {
    const escaped = escapeFfmpegDrawText(watermark.watermarkText);
    const font = DRAWTEXT_FONT_PREFIX;
    const { fill, border } = resolveWatermarkOpacity(watermark.watermarkOpacity);
    parts.push(
      "[main]scale=1080:1920:force_original_aspect_ratio=decrease,format=yuva420p[fg]",
      "[fg]split[fgv][fgt]",
      `[fgt]geq=r='0':g='0':b='0':a='0',drawtext=${font}text='${escaped}':fontsize=${WATERMARK_FONT_SIZE}:fontcolor=${fill}:borderw=2:bordercolor=${border}:x=(w-text_w)/2:y=(h-text_h)/2[txt]`,
      `[txt]rotate=angle=${WATERMARK_DIAGONAL_ANGLE}:fillcolor=black@0:ow=iw:oh=ih[txtr]`,
      "[fgv][txtr]overlay=0:0:format=auto[fgwm]",
      "[blurred][fgwm]overlay=(W-w)/2:(H-h)/2[base]",
    );
  } else {
    parts.push(
      "[main]scale=1080:1920:force_original_aspect_ratio=decrease[fg]",
      "[blurred][fg]overlay=(W-w)/2:(H-h)/2[base]",
    );
  }

  return parts.join(";");
}

const VERTICAL_BLUR_FILL_FILTER = buildVerticalBlurFillFilter();

function buildPanelFilter(
  currentLabel: string,
  outLabel: string,
  text: string | undefined,
  style: PanelStyle | undefined,
  position: "top" | "bottom",
  tempFiles: string[],
  fontSize?: number,
  textColor?: string,
  textAlign?: PanelTextAlign,
): string {
  const panelStyle = panelStyleOrDefault(style);
  const hasText = Boolean(text?.trim());
  const font = DRAWTEXT_FONT_PREFIX;
  const boxY = position === "top" ? 0 : PANEL_BOX_Y_BOTTOM;
  const textY =
    position === "top"
      ? `${PANEL_CENTER_Y}-(text_h/2)`
      : `${PANEL_TEXT_Y_BOTTOM}-(text_h/2)`;
  const filters: string[] = [];
  let label = currentLabel;

  if (panelStyle === "black") {
    const boxLabel = `${outLabel}_box`;
    filters.push(
      `[${label}]drawbox=x=0:y=${boxY}:w=${OUTPUT_WIDTH}:h=${PANEL_HEIGHT}:color=black:t=fill[${boxLabel}]`,
    );
    label = boxLabel;
  } else if (panelStyle === "white") {
    const boxLabel = `${outLabel}_box`;
    filters.push(
      `[${label}]drawbox=x=0:y=${boxY}:w=${OUTPUT_WIDTH}:h=${PANEL_HEIGHT}:color=white:t=fill[${boxLabel}]`,
    );
    label = boxLabel;
  }

  if (hasText) {
    const textSource = buildDrawtextSource(text!, tempFiles);
    const resolvedFontSize = resolvePanelFontSize(panelStyle, fontSize);
    const resolvedColor = resolvePanelTextColor(panelStyle, textColor);
    const x = resolvePanelX(textAlign ?? "center");
    const lineSpacing = Math.max(8, Math.round(resolvedFontSize * 0.22));
    let textOpts =
      `drawtext=${font}${textSource}:fontsize=${resolvedFontSize}:x=${x}:y=${textY}` +
      `:fontcolor=${resolvedColor}:line_spacing=${lineSpacing}`;

    if (panelStyle === "transparent" && !textColor) {
      textOpts += ":borderw=4:bordercolor=black@0.75";
    }

    filters.push(`[${label}]${textOpts}[${outLabel}]`);
  } else {
    const passLabel = label === currentLabel ? outLabel : label;
    if (label === currentLabel) {
      return `[${currentLabel}]copy[${outLabel}]`;
    }
    if (passLabel !== outLabel) {
      filters.push(`[${label}]copy[${outLabel}]`);
    }
  }

  return filters.join(";");
}

function hasOverlayEffects(config?: ReelOverlayConfig): boolean {
  if (!config) return false;
  return Boolean(
    needsPanelOverlay(config.topPanelText) ||
      needsPanelOverlay(config.bottomPanelText) ||
      config.watermarkEnabled ||
      config.logoPath,
  );
}

function buildOverlayFilter(config: ReelOverlayConfig): {
  filterComplex: string;
  outputLabel: string;
  logoInput: boolean;
  tempTextFiles: string[];
} {
  const filters: string[] = [buildVerticalBlurFillFilter(config)];
  const tempTextFiles: string[] = [];
  let currentLabel = "base";
  let step = 0;
  const nextLabel = () => `v${++step}`;

  if (needsPanelOverlay(config.topPanelText)) {
    const out = nextLabel();
    filters.push(
      buildPanelFilter(
        currentLabel,
        out,
        config.topPanelText,
        config.topPanelStyle,
        "top",
        tempTextFiles,
        config.topPanelFontSize,
        config.topPanelTextColor,
        config.topPanelTextAlign,
      ),
    );
    currentLabel = out;
  }

  if (needsPanelOverlay(config.bottomPanelText)) {
    const out = nextLabel();
    filters.push(
      buildPanelFilter(
        currentLabel,
        out,
        config.bottomPanelText,
        config.bottomPanelStyle,
        "bottom",
        tempTextFiles,
        config.bottomPanelFontSize,
        config.bottomPanelTextColor,
        config.bottomPanelTextAlign,
      ),
    );
    currentLabel = out;
  }

  const logoInput = Boolean(config.logoPath);
  if (logoInput) {
    const out = nextLabel();
    filters.push(`[1:v]scale=${LOGO_MAX_WIDTH}:-1[brandlogo]`);
    filters.push(
      `[${currentLabel}][brandlogo]overlay=W-w-${LOGO_MARGIN}:${LOGO_MARGIN}[${out}]`,
    );
    currentLabel = out;
  }

  const outputLabel = currentLabel === "base" ? "base" : currentLabel;
  return {
    filterComplex: filters.join(";"),
    outputLabel,
    logoInput,
    tempTextFiles,
  };
}

async function resolveReelOverlayConfig(
  options: UploadOptions,
  billingUserId?: string,
): Promise<ReelOverlayConfig | undefined> {
  const config: ReelOverlayConfig = {
    topPanelText: options.topPanelText,
    bottomPanelText: options.bottomPanelText,
    topPanelStyle: options.topPanelStyle,
    bottomPanelStyle: options.bottomPanelStyle,
    topPanelFontSize: options.topPanelFontSize,
    bottomPanelFontSize: options.bottomPanelFontSize,
    topPanelTextColor: options.topPanelTextColor,
    bottomPanelTextColor: options.bottomPanelTextColor,
    topPanelTextAlign: options.topPanelTextAlign,
    bottomPanelTextAlign: options.bottomPanelTextAlign,
    watermarkEnabled: options.watermarkEnabled,
    watermarkOpacity: options.watermarkOpacity,
  };

  const user = billingUserId ? await authStorage.getUser(billingUserId) : undefined;

  if (options.watermarkEnabled) {
    const name = [user?.firstName, user?.lastName].filter(Boolean).join(" ").trim();
    config.watermarkText =
      options.watermarkText ||
      name ||
      user?.email?.split("@")[0] ||
      "ReelForge AI";
  }

  if (options.logoEnabled && user?.brandLogoUrl) {
    const logoPath = path.join(process.cwd(), user.brandLogoUrl.replace(/^\//, ""));
    if (fs.existsSync(logoPath)) {
      config.logoPath = logoPath;
    }
  }

  return hasOverlayEffects(config) ? config : undefined;
}

async function cutAndFormatClip(
  videoPath: string,
  outputPath: string,
  start: number,
  end: number,
  overlay?: ReelOverlayConfig,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const duration = end - start;
    const useOverlay = hasOverlayEffects(overlay);
    const built = useOverlay ? buildOverlayFilter(overlay!) : null;

    const args = ["-ss", start.toString(), "-i", videoPath];
    if (built?.logoInput && overlay?.logoPath) {
      args.push("-i", overlay.logoPath);
    }

    args.push("-t", duration.toString());

    if (built) {
      args.push("-filter_complex", built.filterComplex, "-map", `[${built.outputLabel}]`);
    } else {
      args.push(
        "-filter_complex",
        VERTICAL_BLUR_FILL_FILTER.replace("[base]", "[outv]"),
        "-map",
        "[outv]",
      );
    }

    args.push(
      "-map",
      "0:a?",
      "-c:v",
      "libx264",
      "-profile:v",
      "main",
      "-pix_fmt",
      "yuv420p",
      "-preset",
      "medium",
      "-crf",
      "23",
      "-c:a",
      "aac",
      "-b:a",
      "128k",
      "-movflags",
      "+faststart",
      "-y",
      outputPath,
    );

    const ffmpeg = spawn("ffmpeg", args);

    let stderr = '';
    ffmpeg.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    ffmpeg.on('close', (code) => {
      if (built?.tempTextFiles.length) {
        cleanupTempTextFiles(built.tempTextFiles);
      }
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`FFmpeg clip creation failed: ${stderr}`));
      }
    });

    ffmpeg.on('error', (error) => {
      if (built?.tempTextFiles.length) {
        cleanupTempTextFiles(built.tempTextFiles);
      }
      reject(error);
    });
  });
}

export async function processVideo(
  projectId: string,
  videoPath: string,
  options: UploadOptions,
  billingUserId?: string,
): Promise<void> {
  const projectOutputDir = path.join(outputDir, projectId);
  let creditsCharged = 0;

  if (!fs.existsSync(projectOutputDir)) {
    fs.mkdirSync(projectOutputDir, { recursive: true });
  }

  try {
    await updateProgress(projectId, 'uploading', 10, 'Preparing video...', 300);

    const duration = await getVideoDuration(videoPath);

    if (billingUserId) {
      const charge = await billingStorage.chargeForProcessing(
        billingUserId,
        options,
        duration,
        projectId,
      );
      creditsCharged = charge.cost;
    }

    const aiMode = getAiGatewayMode();
    const useOpenAi = shouldUseOpenAiForReels(options);
    await storage.updateProject(projectId, {
      originalVideo: {
        filename: path.basename(videoPath),
        duration,
        size: fs.statSync(videoPath).size,
        format: path.extname(videoPath).slice(1),
        path: videoPath,
      },
      currentStep: useOpenAi
        ? 'Preparing video (style prompt → OpenAI)...'
        : 'Preparing video (default local AI — no API charges)...',
    });

    await updateProgress(projectId, 'transcribing', 20, 'Extracting audio...', 240);
    
    const audioPath = path.join(projectOutputDir, 'audio.wav');
    await extractAudio(videoPath, audioPath);

    await updateProgress(
      projectId,
      'transcribing',
      40,
      aiMode === 'demo' ? 'Transcribing (local)...' : 'Transcribing with AI...',
      180,
    );

    const { text: transcript, segments } = await transcribeAudio(audioPath, duration);
    
    await storage.updateProject(projectId, { transcript });

    await updateProgress(
      projectId,
      'analyzing',
      55,
      useOpenAi
        ? 'AI analyzing highlights (your style prompt)...'
        : 'Selecting highlights (default — no OpenAI)...',
      120,
    );
    
    const { projectTitle, clips: highlights } = await detectHighlights(transcript, segments, options, duration);
    
    // Update project with AI-generated title
    await storage.updateProject(projectId, { name: projectTitle });

    const overlayConfig = await resolveReelOverlayConfig(options, billingUserId);

    await updateProgress(projectId, 'cutting', 70, 'Cutting clips...', 90);
    
    const totalClips = highlights.length;
    let clipsCreated = 0;
    let lastClipError: string | undefined;
    for (let i = 0; i < highlights.length; i++) {
      const clip = highlights[i];
      const clipOutputPath = path.join(projectOutputDir, `clip_${i}.mp4`);
      
      await updateProgress(
        projectId, 
        'cutting', 
        70 + (15 * (i / totalClips)), 
        `Cutting clip ${i + 1} of ${totalClips}...`,
        60
      );
      
      try {
        await cutAndFormatClip(videoPath, clipOutputPath, clip.start, clip.end, overlayConfig);
        if (fs.existsSync(clipOutputPath)) {
          clipsCreated += 1;
        }
      } catch (error) {
        lastClipError = error instanceof Error ? error.message : String(error);
        console.error(`Failed to cut clip ${i}:`, error);
      }
    }

    if (clipsCreated === 0) {
      throw new Error(
        lastClipError?.includes("drawtext") || lastClipError?.includes("font")
          ? "Failed to export reels because a text overlay could not be rendered. Try again after restarting the server, or disable panel text/watermark."
          : "Failed to export reels while rendering video clips. Please try again.",
      );
    }

    await updateProgress(projectId, 'formatting', 85, 'Formatting 9:16 with blurred background...', 30);
    
    for (let i = 0; i < highlights.length; i++) {
      const clip = highlights[i];
      const clipPath = path.join(projectOutputDir, `clip_${i}.mp4`);
      const reelPath = path.join(projectOutputDir, `reel_${i}.mp4`);
      
      if (fs.existsSync(clipPath)) {
        fs.renameSync(clipPath, reelPath);
        
        await storage.createReel({
          projectId,
          url: `/outputs/${projectId}/reel_${i}.mp4`,
          thumbnail: undefined,
          duration: clip.end - clip.start,
          caption: clip.suggestedCaption,
          start: clip.start,
          end: clip.end,
          reason: clip.reason,
        });
      }
    }

    try {
      const mp3Path = audioPath.replace('.wav', '.mp3');
      if (fs.existsSync(mp3Path)) fs.unlinkSync(mp3Path);
      if (fs.existsSync(audioPath)) fs.unlinkSync(audioPath);
    } catch (e) {
    }

    try {
      const profit = calculateEstimatedProfitMetrics({
        videoDurationSeconds: Math.round(duration),
        clipsCount: highlights.length,
      });

      await adminAuditStorage.logProfitEvent({
        projectId,
        projectName: projectTitle,
        revenueCents: profit.revenueCents,
        costCents: profit.costCents,
        clipsCount: highlights.length,
        videoDurationSeconds: Math.round(duration),
        source: 'video_processing',
      });
    } catch (profitError) {
      console.error('Failed to record profit event:', profitError);
    }

    await updateProgress(projectId, 'completed', 100, 'Processing complete!', 0);

  } catch (error) {
    console.error('Video processing error:', error);

    if (billingUserId && creditsCharged > 0) {
      try {
        await billingStorage.refundProcessing(
          billingUserId,
          creditsCharged,
          projectId,
          'Processing failed',
        );
      } catch (refundError) {
        console.error('Failed to refund credits:', refundError);
      }
    }

    await storage.updateProject(projectId, {
      status: 'failed',
      error: error instanceof Error ? error.message : 'Processing failed',
    });
    throw error;
  }
}
