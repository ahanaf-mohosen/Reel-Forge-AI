import fs from "fs";
import path from "path";
import { spawn } from "child_process";

const YT_DLP_CANDIDATES: Array<{ command: string; prefix: string[] }> = [
  { command: "python", prefix: ["-m", "yt_dlp"] },
  { command: "python3", prefix: ["-m", "yt_dlp"] },
  { command: "yt-dlp", prefix: [] },
];

export function isYouTubeUrl(url: string): boolean {
  try {
    const parsed = new URL(url.trim());
    const host = parsed.hostname.replace(/^www\./, "").toLowerCase();
    if (host === "youtu.be") {
      return parsed.pathname.length > 1;
    }
    if (host === "youtube.com" || host === "m.youtube.com") {
      if (parsed.pathname.startsWith("/shorts/")) {
        return parsed.pathname.length > "/shorts/".length;
      }
      if (parsed.pathname.startsWith("/live/")) {
        return parsed.pathname.length > "/live/".length;
      }
      if (parsed.pathname === "/watch") {
        return Boolean(parsed.searchParams.get("v"));
      }
    }
    return false;
  } catch {
    return false;
  }
}

function runProcess(command: string, args: string[]): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const proc = spawn(command, args, { windowsHide: true });
    let stdout = "";
    let stderr = "";
    let settled = false;

    const timeout = setTimeout(() => {
      if (settled) return;
      settled = true;
      proc.kill("SIGTERM");
      reject(new Error("YouTube download timed out. Try a shorter video or upload the file directly."));
    }, 15 * 60 * 1000);

    proc.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });
    proc.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });

    proc.on("error", (error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      reject(error);
    });
    proc.on("close", (code) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      if (code === 0) {
        resolve({ stdout, stderr });
        return;
      }
      const detail = (stderr || stdout).trim();
      const lastLine = detail.split("\n").filter(Boolean).pop() ?? detail;
      reject(new Error(lastLine || `${command} exited with code ${code}`));
    });
  });
}

async function runYtDlp(args: string[]): Promise<{ stdout: string; stderr: string }> {
  let lastError: Error | undefined;

  for (const candidate of YT_DLP_CANDIDATES) {
    try {
      return await runProcess(candidate.command, [...candidate.prefix, ...args]);
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
    }
  }

  throw lastError ?? new Error(
    "YouTube download is unavailable. Install yt-dlp: pip install yt-dlp",
  );
}

function sanitizeFilename(name: string): string {
  return name
    .replace(/[<>:"/\\|?*\x00-\x1f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 120) || "youtube-video";
}

export async function getYouTubeVideoTitle(url: string): Promise<string> {
  const { stdout } = await runYtDlp([
    "--print",
    "title",
    "--no-playlist",
    "--no-warnings",
    "--no-download",
    url,
  ]);
  return sanitizeFilename(stdout.trim().split("\n")[0] || "YouTube Video");
}

export async function downloadYouTubeVideo(
  url: string,
  outputDir: string,
): Promise<{ path: string; filename: string; title: string }> {
  const stamp = Date.now();
  const outputPath = path.join(outputDir, `yt-${stamp}.mp4`);
  const title = await getYouTubeVideoTitle(url);

  await runYtDlp([
    url,
    "-f",
    "bestvideo[ext=mp4]+bestaudio[ext=m4a]/bestvideo+bestaudio/best[ext=mp4]/best",
    "--merge-output-format",
    "mp4",
    "--no-playlist",
    "--restrict-filenames",
    "--no-progress",
    "-o",
    outputPath,
  ]);

  if (!fs.existsSync(outputPath)) {
    const fallback = fs
      .readdirSync(outputDir)
      .find((name) => name.startsWith(`yt-${stamp}.`));
    if (!fallback) {
      throw new Error("YouTube download finished but no video file was created.");
    }
    const resolved = path.join(outputDir, fallback);
    return {
      path: resolved,
      filename: `${title}${path.extname(fallback) || ".mp4"}`,
      title,
    };
  }

  return {
    path: outputPath,
    filename: `${title}.mp4`,
    title,
  };
}
