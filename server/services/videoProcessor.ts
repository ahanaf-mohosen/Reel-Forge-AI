import OpenAI from "openai";
import fs from "fs";
import path from "path";
import { spawn } from "child_process";
import { storage } from "../storage";
import type { UploadOptions } from "@shared/schema";

const openai = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
});

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

async function transcribeAudio(audioPath: string): Promise<{ text: string; segments: any[] }> {
  try {
    const mp3Path = audioPath.replace('.wav', '.mp3');
    
    // Use local Whisper instead of OpenAI API
    return new Promise((resolve, reject) => {
      const python = spawn('python', [
        '-c',
        `
import whisper
import json
import sys

model = whisper.load_model("base")
result = model.transcribe("${mp3Path.replace(/\\/g, '/')}", language="en")

# Format segments
segments = []
for segment in result.get('segments', []):
    segments.append({
        'start': segment['start'],
        'end': segment['end'],
        'text': segment['text'].strip()
    })

output = {
    'text': result['text'],
    'segments': segments
}
print(json.dumps(output))
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
          } catch (parseError) {
            reject(new Error('Failed to parse Whisper output'));
          }
        } else {
          console.error('Whisper error:', stderr);
          reject(new Error('Failed to transcribe audio with local Whisper'));
        }
      });

      python.on('error', (error) => {
        reject(new Error(`Failed to start Whisper: ${error.message}`));
      });
    });
  } catch (error) {
    console.error('Transcription error:', error);
    throw new Error('Failed to transcribe audio');
  }
}

interface HighlightClip {
  start: number;
  end: number;
  reason: string;
  suggestedCaption: string;
}

interface HighlightResult {
  projectTitle: string;
  clips: HighlightClip[];
}

async function detectHighlights(
  transcript: string,
  segments: any[],
  options: UploadOptions,
  videoDuration: number
): Promise<HighlightResult> {
  try {
    const prompt = `You are an expert viral video editor specializing in short-form content for TikTok, Instagram Reels, and YouTube Shorts.

Analyze the following video transcript and identify the ${options.clipCount} BEST moments for creating engaging short-form reels.

CRITERIA:
- Each clip must be ${options.minDuration}-${options.maxDuration} seconds long
- The video is ${Math.floor(videoDuration)} seconds total
- Look for moments with:
  * High emotional impact
  * Clear hooks or payoffs
  * Self-contained stories or ideas
  * Visual or verbal punchlines
  * Surprising or valuable information
- Avoid clips that start mid-sentence or lack context
- Prioritize content that works standalone
- Ensure clips don't overlap

IMPORTANT:
- ALL titles must be in ENGLISH, even if the transcript is in another language
- Create catchy, viral-worthy English titles that capture the essence
- If transcript is non-English, translate the key message for the title
- Make titles short, punchy, and engaging (max 50 chars)

TRANSCRIPT:
${transcript}

TIMESTAMP SEGMENTS:
${JSON.stringify(segments.slice(0, 50))}

Return ONLY valid JSON in this exact format:
{
  "projectTitle": "Short catchy English title for the whole video (max 40 chars)",
  "clips": [
    {
      "start": 12.5,
      "end": 45.3,
      "reason": "Strong hook about unexpected benefit",
      "suggestedCaption": "Catchy English Title Here"
    }
  ]
}`;

    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      response_format: { type: 'json_object' },
      max_tokens: 1024,
    });

    const content = response.choices[0]?.message?.content || '{"clips":[],"projectTitle":"Video Highlights"}';
    const result = JSON.parse(content);
    
    let clips = result.clips || [];
    const projectTitle = result.projectTitle || 'Video Highlights';
    
    if (clips.length === 0) {
      const clipDuration = (options.minDuration + options.maxDuration) / 2;
      const interval = videoDuration / (options.clipCount + 1);
      
      for (let i = 0; i < options.clipCount; i++) {
        const start = Math.max(0, (i + 1) * interval - clipDuration / 2);
        clips.push({
          start,
          end: Math.min(videoDuration, start + clipDuration),
          reason: 'Auto-selected segment',
          suggestedCaption: `Highlight ${i + 1}`,
        });
      }
    }

    clips = clips.map((clip: HighlightClip) => ({
      ...clip,
      start: Math.max(0, clip.start),
      end: Math.min(videoDuration, clip.end),
    }));

    return { projectTitle, clips };
  } catch (error) {
    console.error('Highlight detection error:', error);
    
    const clipDuration = (options.minDuration + options.maxDuration) / 2;
    const clips: HighlightClip[] = [];
    const interval = videoDuration / (options.clipCount + 1);
    
    for (let i = 0; i < options.clipCount; i++) {
      const start = Math.max(0, (i + 1) * interval - clipDuration / 2);
      clips.push({
        start,
        end: Math.min(videoDuration, start + clipDuration),
        reason: 'Auto-selected segment',
        suggestedCaption: `Highlight ${i + 1}`,
      });
    }
    
    return { projectTitle: 'Video Highlights', clips };
  }
}

async function cutAndFormatClip(
  videoPath: string,
  outputPath: string,
  start: number,
  end: number
): Promise<void> {
  return new Promise((resolve, reject) => {
    const duration = end - start;
    
    const ffmpeg = spawn('ffmpeg', [
      '-ss', start.toString(),
      '-i', videoPath,
      '-t', duration.toString(),
      '-vf', 'scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920',
      '-c:v', 'libx264',
      '-preset', 'ultrafast',
      '-crf', '28',
      '-c:a', 'aac',
      '-b:a', '96k',
      '-movflags', '+faststart',
      '-y',
      outputPath
    ]);

    let stderr = '';
    ffmpeg.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    ffmpeg.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`FFmpeg clip creation failed: ${stderr}`));
      }
    });

    ffmpeg.on('error', reject);
  });
}

export async function processVideo(
  projectId: string,
  videoPath: string,
  options: UploadOptions
): Promise<void> {
  const projectOutputDir = path.join(outputDir, projectId);
  
  if (!fs.existsSync(projectOutputDir)) {
    fs.mkdirSync(projectOutputDir, { recursive: true });
  }

  try {
    await updateProgress(projectId, 'uploading', 10, 'Preparing video...', 300);
    
    const duration = await getVideoDuration(videoPath);
    await storage.updateProject(projectId, {
      originalVideo: {
        filename: path.basename(videoPath),
        duration,
        size: fs.statSync(videoPath).size,
        format: path.extname(videoPath).slice(1),
        path: videoPath,
      },
    });

    await updateProgress(projectId, 'transcribing', 20, 'Extracting audio...', 240);
    
    const audioPath = path.join(projectOutputDir, 'audio.wav');
    await extractAudio(videoPath, audioPath);

    await updateProgress(projectId, 'transcribing', 40, 'Transcribing with AI...', 180);
    
    const { text: transcript, segments } = await transcribeAudio(audioPath);
    
    await storage.updateProject(projectId, { transcript });

    await updateProgress(projectId, 'analyzing', 55, 'AI analyzing for highlights...', 120);
    
    const { projectTitle, clips: highlights } = await detectHighlights(transcript, segments, options, duration);
    
    // Update project with AI-generated title
    await storage.updateProject(projectId, { name: projectTitle });

    await updateProgress(projectId, 'cutting', 70, 'Cutting clips...', 90);
    
    const totalClips = highlights.length;
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
        await cutAndFormatClip(videoPath, clipOutputPath, clip.start, clip.end);
      } catch (error) {
        console.error(`Failed to cut clip ${i}:`, error);
      }
    }

    await updateProgress(projectId, 'formatting', 85, 'Formatting for vertical...', 30);
    
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

    await updateProgress(projectId, 'completed', 100, 'Processing complete!', 0);

  } catch (error) {
    console.error('Video processing error:', error);
    await storage.updateProject(projectId, {
      status: 'failed',
      error: error instanceof Error ? error.message : 'Processing failed',
    });
    throw error;
  }
}
