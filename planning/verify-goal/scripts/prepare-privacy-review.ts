#!/usr/bin/env node

import { readFileSync, renameSync, writeFileSync } from "node:fs";
import { basename, join, posix, resolve } from "node:path";
import { assertNoPortableCollisions, assertPortableRelativePath, resolveDirectory, resolveRegularFile } from "./lib/safe-paths.ts";
import { imageArtifact, scanPrivacyInputs, videoArtifact, type PrivacyInput, type PrivacyInputKind } from "./lib/privacy.ts";
import { extractReviewFrames } from "./lib/video-review.ts";
import type { PrivacyReviewManifest } from "./lib/agent-vision.ts";

interface VideoSpec {
  path: string;
  action_boundaries_seconds: number[];
}

interface PreparationSpec {
  schema_version: 1;
  inputs: PrivacyInput[];
  videos: VideoSpec[];
  screenshots: string[];
  frame_output_directory: string;
}

const args = process.argv.slice(2);
const goalDirectory = args.shift();
const specPath = args.shift();
const option = (name: string, fallback: string): string => {
  const index = args.indexOf(name);
  return index >= 0 ? (args[index + 1] ?? "") : fallback;
};

if (!goalDirectory || !specPath) {
  console.error("Usage: prepare-privacy-review.ts <goal-dir> <spec-relative-path> [--output proof/privacy-report.json] [--receipt proof/automated/agent-vision-receipt.json]");
  process.exit(2);
}

const goalRoot = resolve(goalDirectory);
const outputPath = option("--output", "proof/privacy-report.json");
const receiptPath = option("--receipt", "proof/automated/agent-vision-receipt.json");
assertPortableRelativePath(outputPath);
assertPortableRelativePath(receiptPath);

const inputKinds = new Set<PrivacyInputKind>(["dom_snapshot_json", "url", "log", "generated_text"]);
const parsed: unknown = JSON.parse(readFileSync(resolveRegularFile(goalRoot, specPath), "utf8"));
if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("privacy preparation spec must be an object");
const record = parsed as Record<string, unknown>;
const keys = Object.keys(record).sort().join("\0");
if (keys !== ["frame_output_directory", "inputs", "schema_version", "screenshots", "videos"].sort().join("\0") || record.schema_version !== 1) {
  throw new Error("privacy preparation spec must use the exact schema_version 1 fields");
}
if (!Array.isArray(record.inputs) || !Array.isArray(record.videos) || !Array.isArray(record.screenshots) || typeof record.frame_output_directory !== "string") {
  throw new Error("privacy preparation spec has invalid fields");
}
assertPortableRelativePath(record.frame_output_directory);

const inputs = record.inputs.map((item, index): PrivacyInput => {
  if (!item || typeof item !== "object" || Array.isArray(item)) throw new Error(`inputs[${index}] must be an object`);
  const input = item as Record<string, unknown>;
  if (Object.keys(input).sort().join("\0") !== ["kind", "path"].sort().join("\0")) throw new Error(`inputs[${index}] has unexpected fields`);
  if (typeof input.path !== "string" || typeof input.kind !== "string" || !inputKinds.has(input.kind as PrivacyInputKind)) {
    throw new Error(`inputs[${index}] is invalid`);
  }
  assertPortableRelativePath(input.path);
  return { path: input.path, kind: input.kind as PrivacyInputKind };
});

const videos = record.videos.map((item, index): VideoSpec => {
  if (!item || typeof item !== "object" || Array.isArray(item)) throw new Error(`videos[${index}] must be an object`);
  const video = item as Record<string, unknown>;
  if (Object.keys(video).sort().join("\0") !== ["action_boundaries_seconds", "path"].sort().join("\0")) throw new Error(`videos[${index}] has unexpected fields`);
  if (typeof video.path !== "string" || !Array.isArray(video.action_boundaries_seconds) || !video.action_boundaries_seconds.every((value) => typeof value === "number" && Number.isFinite(value))) {
    throw new Error(`videos[${index}] is invalid`);
  }
  assertPortableRelativePath(video.path);
  return {
    path: video.path,
    action_boundaries_seconds: [...new Set(video.action_boundaries_seconds as number[])].sort((left, right) => left - right),
  };
});

const screenshots = record.screenshots.map((path, index): string => {
  if (typeof path !== "string") throw new Error(`screenshots[${index}] must be a path string`);
  assertPortableRelativePath(path);
  return path;
});

assertNoPortableCollisions([...inputs.map((item) => item.path), ...videos.map((item) => item.path), ...screenshots, outputPath, receiptPath]);
const scanned = scanPrivacyInputs(goalRoot, inputs);
const videoReviews = videos.map((video, index) => {
  const stem = basename(video.path).replace(/\.[^.]+$/, "").replaceAll(/[^a-zA-Z0-9-]+/g, "-").replace(/^-|-$/g, "").toLowerCase() || "video";
  const directory = `${record.frame_output_directory}/${String(index + 1).padStart(2, "0")}-${stem}`;
  return extractReviewFrames(goalRoot, video.path, video.action_boundaries_seconds, directory);
});
const artifacts = [
  ...scanned.artifacts,
  ...videos.map((video) => videoArtifact(goalRoot, video.path)),
  ...screenshots.map((path) => imageArtifact(goalRoot, path)),
].sort((left, right) => left.path.localeCompare(right.path, "en"));

const manifest: PrivacyReviewManifest = {
  schema_version: 1,
  kind: "privacy-review",
  generated_at: new Date().toISOString(),
  automated_scan: {
    status: scanned.findings.length === 0 ? "PASS" : "FAIL",
    finding_count: scanned.findings.length,
  },
  artifacts,
  findings: scanned.findings,
  video_reviews: videoReviews,
  agent_vision: {
    status: "PENDING",
    receipt_path: receiptPath,
    instructions: [
      "Inspect every extracted frame at full resolution using agent vision.",
      "Check secrets, personal data, internal URLs, unrelated accounts, and accidental UI.",
      "Write a separate PASS receipt only when every artifact and frame hash exactly matches this manifest.",
      "Unresolved or ambiguous content blocks upload and commit; mask or recreate the artifact.",
    ],
  },
};

const parent = posix.dirname(outputPath);
if (parent !== ".") resolveDirectory(goalRoot, parent);
const outputAbsolute = join(goalRoot, outputPath);
const temporary = `${outputAbsolute}.${process.pid}.tmp`;
writeFileSync(temporary, `${JSON.stringify(manifest, null, 2)}\n`, { flag: "wx" });
renameSync(temporary, outputAbsolute);

console.log(JSON.stringify({
  output: outputPath,
  automated_scan: manifest.automated_scan.status,
  findings: manifest.findings.length,
  artifacts: manifest.artifacts.length,
  review_frames: manifest.video_reviews.reduce((total, review) => total + review.frames.length, 0),
  required_agent_vision_receipt: receiptPath,
}, null, 2));

if (manifest.automated_scan.status !== "PASS") process.exitCode = 1;
