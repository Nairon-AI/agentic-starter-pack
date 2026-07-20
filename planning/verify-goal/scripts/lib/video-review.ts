import { spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { constants, copyFileSync, existsSync, mkdirSync, mkdtempSync, readdirSync, rmSync } from "node:fs";
import { basename, join, resolve } from "node:path";
import { tmpdir } from "node:os";
import {
  assertPortableRelativePath,
  resolveDirectory,
  resolveRegularFile,
  sha256Path,
} from "./safe-paths.ts";

export type FrameReason = "scene_change" | "action_boundary" | "dense_moving" | "static_sparse";

export interface SceneScore {
  time_seconds: number;
  score: number;
}

export interface FrameCandidate {
  time_seconds: number;
  reasons: FrameReason[];
}

export interface ReviewFrame {
  path: string;
  sha256: string;
  time_seconds: number;
  source_times_seconds: number[];
  reasons: FrameReason[];
}

export interface VideoReview {
  artifact_path: string;
  artifact_sha256: string;
  duration_seconds: number;
  action_boundaries_seconds: number[];
  frames: ReviewFrame[];
}

const REASON_ORDER: readonly FrameReason[] = ["scene_change", "action_boundary", "dense_moving", "static_sparse"];

function run(command: string, args: string[]): string {
  const result = spawnSync(command, args, { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    const detail = `${result.stderr || result.stdout}`.trim();
    throw new Error(`${command} failed${detail ? `: ${detail}` : ""}`);
  }
  return `${result.stdout}${result.stderr}`;
}

export function parseSceneScoreOutput(output: string): SceneScore[] {
  const scores: SceneScore[] = [];
  let currentTime: number | null = null;
  for (const line of output.split(/\r?\n/)) {
    const frame = line.match(/\bpts_time:([0-9]+(?:\.[0-9]+)?)/);
    if (frame) currentTime = Number(frame[1]);
    const metadata = line.match(/lavfi\.scene_score=([0-9]+(?:\.[0-9]+)?)/);
    if (metadata && currentTime !== null) {
      const score = Number(metadata[1]);
      if (Number.isFinite(score) && Number.isFinite(currentTime)) scores.push({ time_seconds: currentTime, score });
    }
  }
  return scores;
}

function quantizeTime(value: number, duration: number): number {
  return Math.round(Math.max(0, Math.min(duration, value)) * 1000) / 1000;
}

function orderedReasons(reasons: Iterable<FrameReason>): FrameReason[] {
  const values = new Set(reasons);
  return REASON_ORDER.filter((reason) => values.has(reason));
}

export function selectFrameCandidates(
  sceneScores: readonly SceneScore[],
  durationSeconds: number,
  actionBoundariesSeconds: readonly number[],
): FrameCandidate[] {
  if (!Number.isFinite(durationSeconds) || durationSeconds <= 0) throw new Error("video duration must be positive");
  const candidates = new Map<number, Set<FrameReason>>();
  const add = (time: number, reason: FrameReason): void => {
    if (!Number.isFinite(time)) throw new Error(`invalid frame time: ${time}`);
    const value = quantizeTime(time, durationSeconds);
    const reasons = candidates.get(value) ?? new Set<FrameReason>();
    reasons.add(reason);
    candidates.set(value, reasons);
  };

  const validScores = sceneScores
    .filter((item) => Number.isFinite(item.time_seconds) && Number.isFinite(item.score) && item.time_seconds >= 0 && item.time_seconds <= durationSeconds)
    .sort((left, right) => left.time_seconds - right.time_seconds || right.score - left.score);

  for (const item of validScores.filter((entry) => entry.score >= 0.3).sort((left, right) => right.score - left.score).slice(0, 12)) {
    add(item.time_seconds, "scene_change");
  }

  const movingBuckets = new Map<number, SceneScore[]>();
  for (const item of validScores) {
    const bucket = Math.floor(item.time_seconds / 2);
    const entries = movingBuckets.get(bucket) ?? [];
    entries.push(item);
    movingBuckets.set(bucket, entries);
  }
  const dense = [...movingBuckets.entries()].map(([bucket, entries]) => {
    const average = entries.reduce((total, item) => total + item.score, 0) / entries.length;
    const peak = [...entries].sort((left, right) => right.score - left.score || left.time_seconds - right.time_seconds)[0];
    return { bucket, average, peak };
  }).filter((item): item is { bucket: number; average: number; peak: SceneScore } => item.average >= 0.015 && item.peak !== undefined)
    .sort((left, right) => right.average - left.average || left.bucket - right.bucket)
    .slice(0, 12);
  for (const item of dense) add(item.peak.time_seconds, "dense_moving");

  const sparseWindow = Math.max(10, durationSeconds / 8);
  const sparseCount = Math.max(1, Math.ceil(durationSeconds / sparseWindow));
  for (let index = 0; index < sparseCount; index += 1) {
    const start = index * sparseWindow;
    const end = Math.min(durationSeconds, start + sparseWindow);
    const entries = validScores.filter((item) => item.time_seconds >= start && item.time_seconds < end);
    const average = entries.length === 0 ? 0 : entries.reduce((total, item) => total + item.score, 0) / entries.length;
    if (average <= 0.005 || entries.length === 0) add((start + end) / 2, "static_sparse");
  }
  add(0, "static_sparse");
  add(Math.max(0, durationSeconds - Math.min(1, durationSeconds / 2)), "static_sparse");

  for (const boundary of [...actionBoundariesSeconds].sort((left, right) => left - right)) {
    if (!Number.isFinite(boundary) || boundary < 0 || boundary > durationSeconds) {
      throw new Error(`action boundary outside video: ${boundary}`);
    }
    add(boundary - 0.25, "action_boundary");
    add(boundary, "action_boundary");
    add(boundary + 0.25, "action_boundary");
  }

  return [...candidates.entries()]
    .sort(([left], [right]) => left - right)
    .map(([time_seconds, reasons]) => ({ time_seconds, reasons: orderedReasons(reasons) }));
}

function videoDuration(path: string): number {
  const output = run("ffprobe", [
    "-v", "error",
    "-show_entries", "format=duration",
    "-of", "default=noprint_wrappers=1:nokey=1",
    path,
  ]).trim();
  const duration = Number(output);
  if (!Number.isFinite(duration) || duration <= 0) throw new Error(`invalid video duration: ${output}`);
  return Math.round(duration * 1000) / 1000;
}

function sceneScores(path: string): SceneScore[] {
  const output = run("ffmpeg", [
    "-hide_banner",
    "-loglevel", "info",
    "-i", path,
    "-an",
    "-vf", "select='gte(scene,0)',metadata=print",
    "-f", "null",
    "-",
  ]);
  return parseSceneScoreOutput(output);
}

function prepareOutputDirectory(root: string, relativeDirectory: string): string {
  assertPortableRelativePath(relativeDirectory);
  const absolute = resolve(root, relativeDirectory);
  mkdirSync(absolute, { recursive: true });
  const resolved = resolveDirectory(root, relativeDirectory);
  if (readdirSync(resolved).length > 0) throw new Error(`frame output directory must be empty: ${relativeDirectory}`);
  return resolved;
}

export function extractReviewFrames(
  root: string,
  artifactPath: string,
  actionBoundariesSeconds: readonly number[],
  frameOutputDirectory: string,
): VideoReview {
  const videoPath = resolveRegularFile(root, artifactPath);
  const duration = videoDuration(videoPath);
  const candidates = selectFrameCandidates(sceneScores(videoPath), duration, actionBoundariesSeconds);
  const outputDirectory = prepareOutputDirectory(root, frameOutputDirectory);
  const temporary = mkdtempSync(join(tmpdir(), `verify-goal-privacy-${randomUUID()}-`));
  const framesByHash = new Map<string, ReviewFrame>();
  try {
    candidates.forEach((candidate, index) => {
      const milliseconds = Math.round(candidate.time_seconds * 1000);
      const fileName = `frame-${String(index + 1).padStart(4, "0")}-${String(milliseconds).padStart(9, "0")}ms.png`;
      const temporaryPath = join(temporary, fileName);
      let extractedAt: number | null = null;
      for (const retreat of [0, 0.05, 0.1, 0.25, 0.5, 1]) {
        const attempt = quantizeTime(candidate.time_seconds - retreat, duration);
        run("ffmpeg", [
          "-hide_banner",
          "-loglevel", "error",
          "-y",
          "-i", videoPath,
          "-ss", attempt.toFixed(3),
          "-frames:v", "1",
          "-compression_level", "9",
          temporaryPath,
        ]);
        if (existsSync(temporaryPath)) {
          extractedAt = attempt;
          break;
        }
      }
      if (extractedAt === null) throw new Error(`could not extract review frame near ${candidate.time_seconds}s`);
      const hash = sha256Path(temporaryPath);
      const existing = framesByHash.get(hash);
      if (existing) {
        existing.reasons = orderedReasons([...existing.reasons, ...candidate.reasons]);
        existing.source_times_seconds = [...new Set([...existing.source_times_seconds, candidate.time_seconds])].sort((left, right) => left - right);
        return;
      }
      const destination = join(outputDirectory, fileName);
      copyFileSync(temporaryPath, destination, constants.COPYFILE_EXCL);
      framesByHash.set(hash, {
        path: `${frameOutputDirectory}/${basename(destination)}`,
        sha256: hash,
        time_seconds: extractedAt,
        source_times_seconds: [candidate.time_seconds],
        reasons: candidate.reasons,
      });
    });
  } finally {
    rmSync(temporary, { recursive: true, force: true });
  }
  return {
    artifact_path: artifactPath,
    artifact_sha256: sha256Path(videoPath),
    duration_seconds: duration,
    action_boundaries_seconds: [...actionBoundariesSeconds].sort((left, right) => left - right),
    frames: [...framesByHash.values()].sort((left, right) => left.path.localeCompare(right.path, "en")),
  };
}
