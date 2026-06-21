import OpenAI from "openai";
import type { UploadOptions } from "@shared/schema";
import { estimateTokensFromText } from "@shared/operatingCost";
import { tokenUsageStorage } from "../integrations/admin/tokenUsageStorage";

/**
 * AI Gateway
 * -----------
 * Default (no reel style prompt): local/demo processing — no OpenAI API calls.
 * With reel style prompt + API key: OpenAI picks moments and writes captions.
 *
 * Toggle: AI_GATEWAY_MODE=demo | production
 * Keys:   AI_INTEGRATIONS_OPENAI_API_KEY, AI_INTEGRATIONS_OPENAI_BASE_URL
 */

export type TranscriptSegment = {
  start: number;
  end: number;
  text: string;
};

export type HighlightClip = {
  start: number;
  end: number;
  reason: string;
  suggestedCaption: string;
};

export type HighlightResult = {
  projectTitle: string;
  clips: HighlightClip[];
};

let openaiClient: OpenAI | null = null;

function getOpenAI(): OpenAI | null {
  if (!process.env.AI_INTEGRATIONS_OPENAI_API_KEY) return null;
  if (!openaiClient) {
    openaiClient = new OpenAI({
      apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
      baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
    });
  }
  return openaiClient;
}

export function hasOpenAiKey(): boolean {
  return Boolean(process.env.AI_INTEGRATIONS_OPENAI_API_KEY);
}

export function isDemoAiMode(): boolean {
  if (process.env.AI_GATEWAY_MODE === "production") return false;
  if (process.env.AI_GATEWAY_MODE === "demo") return true;
  if (process.env.USE_DEMO_AI === "true") return true;
  return !hasOpenAiKey();
}

export function getAiGatewayMode(): "demo" | "production" {
  return isDemoAiMode() ? "demo" : "production";
}

/** OpenAI is only used when the user provides a reel style prompt. */
export function hasReelStylePrompt(options: UploadOptions): boolean {
  return Boolean(options.reelPrompt?.trim());
}

export function shouldUseOpenAiForReels(options: UploadOptions): boolean {
  if (isDemoAiMode()) return false;
  if (!hasOpenAiKey()) return false;
  return hasReelStylePrompt(options);
}

function isOpenAiQuotaError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const err = error as { status?: number; code?: string; error?: { code?: string } };
  return (
    err.status === 429 ||
    err.code === "insufficient_quota" ||
    err.error?.code === "insufficient_quota"
  );
}

async function recordAiTokens(
  tokens: number,
  source: string,
  projectId?: string,
  metadata?: Record<string, unknown>,
): Promise<void> {
  try {
    await tokenUsageStorage.recordUsage({
      tokens,
      source,
      projectId,
      metadata,
    });
  } catch (error) {
    console.error("[aiGateway] Failed to record token usage:", error);
  }
}

function clipTranscriptSlice(
  segments: TranscriptSegment[],
  start: number,
  end: number,
): string {
  return segments
    .filter((s) => s.end >= start && s.start <= end)
    .map((s) => s.text)
    .join(" ")
    .trim();
}

function buildDemoCaption(
  clip: Pick<HighlightClip, "start" | "end" | "reason">,
  segments: TranscriptSegment[],
  index: number,
): string {
  const slice = clipTranscriptSlice(segments, clip.start, clip.end);
  if (slice) {
    const trimmed = slice.replace(/\s+/g, " ").trim();
    return trimmed.length > 120 ? `${trimmed.slice(0, 117)}...` : trimmed;
  }
  return clip.reason || `Highlight ${index + 1}`;
}

/** Demo highlight picker — evenly spaced segments with transcript-based captions */
export function detectHighlightsDemo(
  transcript: string,
  segments: TranscriptSegment[],
  options: UploadOptions,
  videoDuration: number,
): HighlightResult {
  const clipDuration = (options.minDuration + options.maxDuration) / 2;
  const clips: HighlightClip[] = [];
  const interval = videoDuration / (options.clipCount + 1);

  const titleFromTranscript = transcript
    .split(/\s+/)
    .slice(0, 6)
    .join(" ")
    .replace(/[^\w\s'-]/g, "")
    .trim();

  const projectTitle =
    (titleFromTranscript ? titleFromTranscript.slice(0, 40) : "") || "Video Highlights";

  for (let i = 0; i < options.clipCount; i++) {
    const start = Math.max(0, (i + 1) * interval - clipDuration / 2);
    const end = Math.min(videoDuration, start + clipDuration);

    const overlapping = segments.find((s) => s.start >= start && s.start <= end);
    const reason = overlapping?.text?.slice(0, 80).trim()
      || `Engaging moment ${i + 1} from the video`;

    clips.push({
      start,
      end,
      reason,
      suggestedCaption: buildDemoCaption({ start, end, reason }, segments, i),
    });
  }

  return { projectTitle, clips };
}

/** Demo transcript when local Whisper is unavailable */
export function buildDemoTranscript(videoDuration: number): {
  text: string;
  segments: TranscriptSegment[];
} {
  const segmentCount = Math.max(3, Math.min(8, Math.ceil(videoDuration / 30)));
  const segmentLength = videoDuration / segmentCount;
  const segments: TranscriptSegment[] = [];

  for (let i = 0; i < segmentCount; i++) {
    const start = i * segmentLength;
    const end = Math.min(videoDuration, start + segmentLength);
    segments.push({
      start,
      end,
      text: `Demo transcript segment ${i + 1} — enable production AI for real speech-to-text.`,
    });
  }

  return {
    text: segments.map((s) => s.text).join(" "),
    segments,
  };
}

export async function detectHighlightsProduction(
  transcript: string,
  segments: TranscriptSegment[],
  options: UploadOptions,
  videoDuration: number,
  projectId?: string,
): Promise<HighlightResult> {
  const openai = getOpenAI();
  if (!openai) {
    return detectHighlightsDemo(transcript, segments, options, videoDuration);
  }

  const styleHint = `\nUSER REEL STYLE REQUEST:\n${options.reelPrompt!.trim()}\nPrioritize moments that match this style.\n`;

  const prompt = `You are an expert viral video editor specializing in short-form content for TikTok, Instagram Reels, and YouTube Shorts.

Analyze the following video transcript and identify the ${options.clipCount} BEST moments for creating engaging short-form reels.
${styleHint}
CRITERIA:
- Each clip must be ${options.minDuration}-${options.maxDuration} seconds long
- The video is ${Math.floor(videoDuration)} seconds total
- Look for high-impact hooks, clear payoffs, and standalone moments
- Avoid overlapping clips
- suggestedCaption should be a short social post caption for that moment (max 150 chars)

TRANSCRIPT:
${transcript.slice(0, 12000)}

TIMESTAMP SEGMENTS:
${JSON.stringify(segments.slice(0, 80))}

Return ONLY valid JSON: { "projectTitle": "...", "clips": [{ "start", "end", "reason", "suggestedCaption" }] }`;

  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [{ role: "user", content: prompt }],
    response_format: { type: "json_object" },
    max_tokens: 2048,
  });

  const usageTokens = response.usage?.total_tokens ?? estimateTokensFromText(prompt);
  await recordAiTokens(usageTokens, "highlight_detection", projectId, {
    model: "gpt-4o-mini",
  });

  const content =
    response.choices[0]?.message?.content ||
    '{"clips":[],"projectTitle":"Video Highlights"}';
  const result = JSON.parse(content);

  const clips = (result.clips || []).map((clip: HighlightClip) => ({
    ...clip,
    start: Math.max(0, clip.start),
    end: Math.min(videoDuration, clip.end),
    suggestedCaption: clip.suggestedCaption?.trim() || clip.reason || "Watch this moment",
  }));

  return {
    projectTitle: result.projectTitle || "Video Highlights",
    clips,
  };
}

/** Generate OpenAI captions from reel suggestions (only when style prompt provided). */
export async function generateReelCaptions(
  clips: HighlightClip[],
  segments: TranscriptSegment[],
  reelPrompt?: string,
  projectId?: string,
): Promise<HighlightClip[]> {
  const openai = getOpenAI();
  if (!openai || clips.length === 0 || !reelPrompt?.trim()) {
    return clips.map((clip, i) => ({
      ...clip,
      suggestedCaption:
        clip.suggestedCaption?.trim() ||
        buildDemoCaption(clip, segments, i),
    }));
  }

  const clipContext = clips.map((clip, i) => ({
    index: i,
    start: clip.start,
    end: clip.end,
    reason: clip.reason,
    transcript: clipTranscriptSlice(segments, clip.start, clip.end).slice(0, 400),
    draftCaption: clip.suggestedCaption,
  }));

  const styleHint = `The user wants reels like: "${reelPrompt.trim()}". Match that tone and style.`;

  const prompt = `You write viral short-form video captions.

${styleHint}

For each clip below, write ONE caption (max 150 characters) based on the reel suggestion (reason) and transcript. Use emojis sparingly. No hashtags unless they fit naturally.

CLIPS:
${JSON.stringify(clipContext, null, 2)}

Return ONLY valid JSON: { "captions": ["caption for clip 0", "..."] } — same order as clips.`;

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" },
      max_tokens: 1024,
    });

    const usageTokens = response.usage?.total_tokens ?? estimateTokensFromText(prompt);
    await recordAiTokens(usageTokens, "caption_generation", projectId, {
      model: "gpt-4o-mini",
    });

    const content = response.choices[0]?.message?.content || "{}";
    const result = JSON.parse(content);
    const captions: string[] = Array.isArray(result.captions) ? result.captions : [];

    return clips.map((clip, i) => ({
      ...clip,
      suggestedCaption:
        captions[i]?.trim()?.slice(0, 500) ||
        clip.suggestedCaption?.trim() ||
        buildDemoCaption(clip, segments, i),
    }));
  } catch (error) {
    console.error("[aiGateway] Caption generation failed:", error);
    if (isOpenAiQuotaError(error)) {
      console.warn("[aiGateway] OpenAI quota exceeded — using local captions");
    }
    return clips.map((clip, i) => ({
      ...clip,
      suggestedCaption:
        clip.suggestedCaption?.trim() ||
        buildDemoCaption(clip, segments, i),
    }));
  }
}

/** Route highlight detection — OpenAI only when reel style prompt is set. */
export async function detectHighlights(
  transcript: string,
  segments: TranscriptSegment[],
  options: UploadOptions,
  videoDuration: number,
  projectId?: string,
): Promise<HighlightResult> {
  if (!shouldUseOpenAiForReels(options)) {
    const result = detectHighlightsDemo(transcript, segments, options, videoDuration);
    const estimatedTokens = estimateTokensFromText(
      transcript + JSON.stringify(segments.slice(0, 80)) + (options.reelPrompt || ""),
    );
    await recordAiTokens(estimatedTokens, "highlight_detection_demo", projectId, {
      mode: "demo",
    });
    return result;
  }

  try {
    return await detectHighlightsProduction(
      transcript,
      segments,
      options,
      videoDuration,
      projectId,
    );
  } catch (error) {
    console.error("[aiGateway] OpenAI highlight detection failed:", error);
    if (isOpenAiQuotaError(error)) {
      console.warn("[aiGateway] OpenAI quota exceeded — falling back to default local highlights");
    }
    return detectHighlightsDemo(transcript, segments, options, videoDuration);
  }
}

/* -------------------------------------------------------------------------- */
/*  PRODUCTION WHISPER (optional — used from videoProcessor when enabled)      */
/* -------------------------------------------------------------------------- */

/*
import fs from "fs";

export async function transcribeAudioProduction(
  mp3Path: string,
): Promise<{ text: string; segments: TranscriptSegment[] }> {
  const openai = getOpenAI();
  if (!openai) throw new Error("OpenAI API key not configured");

  const transcription = await openai.audio.transcriptions.create({
    file: fs.createReadStream(mp3Path),
    model: "whisper-1",
    response_format: "verbose_json",
    timestamp_granularities: ["segment"],
  });

  const segments =
    (transcription as any).segments?.map((s: any) => ({
      start: s.start,
      end: s.end,
      text: s.text?.trim() || "",
    })) || [];

  return {
    text: transcription.text || "",
    segments,
  };
}
*/
