import { readFileSync, realpathSync } from "node:fs";
import { relative } from "node:path";
import { scanPrivacyText, type PrivacyFinding, type ScannedArtifact } from "./privacy.ts";
import type { VideoReview } from "./video-review.ts";
import {
  assertNoPortableCollisions,
  assertPortableRelativePath,
  resolveRegularFile,
  sha256Bytes,
  sha256Path,
} from "./safe-paths.ts";

export interface PrivacyReviewManifest {
  schema_version: 1;
  kind: "privacy-review";
  generated_at: string;
  automated_scan: {
    status: "PASS" | "FAIL";
    finding_count: number;
  };
  artifacts: ScannedArtifact[];
  findings: PrivacyFinding[];
  video_reviews: VideoReview[];
  agent_vision: {
    status: "PENDING";
    receipt_path: string;
    instructions: string[];
  };
}

export interface HashBinding {
  path: string;
  sha256: string;
}

export interface AgentVisionReceipt {
  schema_version: 1;
  kind: "agent-vision-privacy-receipt";
  status: "PASS";
  reviewer_alias: string;
  reviewed_at: string;
  privacy_manifest_path: string;
  privacy_manifest_sha256: string;
  artifacts: HashBinding[];
  frames: HashBinding[];
  notes: string[];
}

function object(value: unknown, name: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(`${name} must be an object`);
  return value as Record<string, unknown>;
}

function exactKeys(value: Record<string, unknown>, expected: readonly string[], name: string): void {
  const actual = Object.keys(value).sort((left, right) => left.localeCompare(right, "en"));
  const wanted = [...expected].sort((left, right) => left.localeCompare(right, "en"));
  if (actual.join("\0") !== wanted.join("\0")) throw new Error(`${name} has unexpected or missing keys`);
}

function parseBindings(value: unknown, name: string): HashBinding[] {
  if (!Array.isArray(value)) throw new Error(`${name} must be an array`);
  return value.map((item, index) => {
    const record = object(item, `${name}[${index}]`);
    exactKeys(record, ["path", "sha256"], `${name}[${index}]`);
    if (typeof record.path !== "string") throw new Error(`${name}[${index}].path must be a string`);
    assertPortableRelativePath(record.path);
    if (typeof record.sha256 !== "string" || !/^[a-f0-9]{64}$/.test(record.sha256)) {
      throw new Error(`${name}[${index}].sha256 must be lowercase SHA-256`);
    }
    return { path: record.path, sha256: record.sha256 };
  });
}

function bindingKey(binding: HashBinding): string {
  return `${binding.path}\0${binding.sha256}`;
}

function assertExactBindings(actual: readonly HashBinding[], expected: readonly HashBinding[], name: string): void {
  assertNoPortableCollisions(actual.map((item) => item.path));
  const left = actual.map(bindingKey).sort((a, b) => a.localeCompare(b, "en"));
  const right = expected.map(bindingKey).sort((a, b) => a.localeCompare(b, "en"));
  if (left.join("\n") !== right.join("\n")) throw new Error(`${name} do not exactly match privacy manifest hashes`);
}

export function readPrivacyManifest(path: string): PrivacyReviewManifest {
  const raw = readFileSync(path, "utf8");
  if (scanPrivacyText(raw).length > 0) throw new Error("privacy manifest contains secret, PII, or sensitive URL material");
  const parsed: unknown = JSON.parse(raw);
  const value = object(parsed, "privacy manifest");
  exactKeys(value, ["schema_version", "kind", "generated_at", "automated_scan", "artifacts", "findings", "video_reviews", "agent_vision"], "privacy manifest");
  if (value.schema_version !== 1 || value.kind !== "privacy-review") throw new Error("unsupported privacy manifest");
  if (typeof value.generated_at !== "string" || !Number.isFinite(Date.parse(value.generated_at))) throw new Error("privacy manifest needs generated_at");
  const automated = object(value.automated_scan, "privacy manifest automated_scan");
  exactKeys(automated, ["status", "finding_count"], "privacy manifest automated_scan");
  if ((automated.status !== "PASS" && automated.status !== "FAIL") || !Number.isSafeInteger(automated.finding_count) || Number(automated.finding_count) < 0) {
    throw new Error("privacy manifest automated_scan is invalid");
  }
  if (!Array.isArray(value.artifacts) || !Array.isArray(value.findings) || !Array.isArray(value.video_reviews)) {
    throw new Error("privacy manifest artifact, finding, and video arrays are required");
  }
  const artifactPaths: string[] = [];
  for (const [index, item] of value.artifacts.entries()) {
    const artifact = object(item, `privacy manifest artifacts[${index}]`);
    exactKeys(artifact, ["path", "kind", "sha256", "bytes", "finding_ids"], `privacy manifest artifacts[${index}]`);
    if (typeof artifact.path !== "string") throw new Error(`privacy manifest artifacts[${index}].path is invalid`);
    assertPortableRelativePath(artifact.path);
    artifactPaths.push(artifact.path);
    if (!new Set(["dom_snapshot_json", "url", "log", "generated_text", "video", "image"]).has(String(artifact.kind))) throw new Error(`privacy manifest artifacts[${index}].kind is invalid`);
    if (typeof artifact.sha256 !== "string" || !/^[a-f0-9]{64}$/.test(artifact.sha256)) throw new Error(`privacy manifest artifacts[${index}].sha256 is invalid`);
    if (!Number.isSafeInteger(artifact.bytes) || Number(artifact.bytes) < 0) throw new Error(`privacy manifest artifacts[${index}].bytes is invalid`);
    if (!Array.isArray(artifact.finding_ids) || !artifact.finding_ids.every((id) => typeof id === "string" && /^PF-\d{4,}$/.test(id))) throw new Error(`privacy manifest artifacts[${index}].finding_ids is invalid`);
  }
  assertNoPortableCollisions(artifactPaths);
  if (Number(automated.finding_count) !== value.findings.length) throw new Error("privacy manifest finding_count mismatch");
  for (const [index, item] of value.findings.entries()) {
    const finding = object(item, `privacy manifest findings[${index}]`);
    exactKeys(finding, ["id", "artifact_path", "rule_id", "category", "location", "fingerprint_sha256"], `privacy manifest findings[${index}]`);
    if (typeof finding.id !== "string" || !/^PF-\d{4,}$/.test(finding.id)) throw new Error(`privacy manifest findings[${index}].id is invalid`);
    if (typeof finding.artifact_path !== "string" || !artifactPaths.includes(finding.artifact_path)) throw new Error(`privacy manifest findings[${index}].artifact_path is invalid`);
    if (typeof finding.fingerprint_sha256 !== "string" || !/^[a-f0-9]{64}$/.test(finding.fingerprint_sha256)) throw new Error(`privacy manifest findings[${index}].fingerprint is invalid`);
  }
  const framePaths: string[] = [];
  for (const [videoIndex, item] of value.video_reviews.entries()) {
    const review = object(item, `privacy manifest video_reviews[${videoIndex}]`);
    exactKeys(review, ["artifact_path", "artifact_sha256", "duration_seconds", "action_boundaries_seconds", "frames"], `privacy manifest video_reviews[${videoIndex}]`);
    if (typeof review.artifact_path !== "string" || typeof review.artifact_sha256 !== "string" || !/^[a-f0-9]{64}$/.test(review.artifact_sha256)) throw new Error(`privacy manifest video_reviews[${videoIndex}] artifact is invalid`);
    assertPortableRelativePath(review.artifact_path);
    if (!Number.isFinite(review.duration_seconds) || Number(review.duration_seconds) <= 0) throw new Error(`privacy manifest video_reviews[${videoIndex}] duration is invalid`);
    if (!Array.isArray(review.action_boundaries_seconds) || !review.action_boundaries_seconds.every((time) => typeof time === "number" && Number.isFinite(time))) throw new Error(`privacy manifest video_reviews[${videoIndex}] actions are invalid`);
    if (!Array.isArray(review.frames) || review.frames.length === 0) throw new Error(`privacy manifest video_reviews[${videoIndex}] needs frames`);
    for (const [frameIndex, frameItem] of review.frames.entries()) {
      const frame = object(frameItem, `privacy manifest video_reviews[${videoIndex}].frames[${frameIndex}]`);
      exactKeys(frame, ["path", "sha256", "time_seconds", "source_times_seconds", "reasons"], `privacy manifest video_reviews[${videoIndex}].frames[${frameIndex}]`);
      if (typeof frame.path !== "string" || typeof frame.sha256 !== "string" || !/^[a-f0-9]{64}$/.test(frame.sha256)) throw new Error(`privacy manifest video_reviews[${videoIndex}].frames[${frameIndex}] is invalid`);
      assertPortableRelativePath(frame.path);
      framePaths.push(frame.path);
      if (!Number.isFinite(frame.time_seconds)) throw new Error(`privacy manifest video_reviews[${videoIndex}].frames[${frameIndex}] time is invalid`);
      if (!Array.isArray(frame.source_times_seconds) || !frame.source_times_seconds.every((time) => typeof time === "number" && Number.isFinite(time))) throw new Error(`privacy manifest video_reviews[${videoIndex}].frames[${frameIndex}] sources are invalid`);
      if (!Array.isArray(frame.reasons) || frame.reasons.length === 0 || !frame.reasons.every((reason) => new Set(["scene_change", "action_boundary", "dense_moving", "static_sparse"]).has(String(reason)))) throw new Error(`privacy manifest video_reviews[${videoIndex}].frames[${frameIndex}] reasons are invalid`);
    }
  }
  assertNoPortableCollisions(framePaths);
  const agentVision = object(value.agent_vision, "privacy manifest agent_vision");
  exactKeys(agentVision, ["status", "receipt_path", "instructions"], "privacy manifest agent_vision");
  if (agentVision.status !== "PENDING" || typeof agentVision.receipt_path !== "string") throw new Error("privacy manifest agent_vision is invalid");
  assertPortableRelativePath(agentVision.receipt_path);
  if (!Array.isArray(agentVision.instructions) || !agentVision.instructions.every((item) => typeof item === "string")) throw new Error("privacy manifest agent_vision instructions are invalid");
  return parsed as PrivacyReviewManifest;
}

export function readAgentVisionReceipt(path: string): AgentVisionReceipt {
  const raw = readFileSync(path, "utf8");
  if (scanPrivacyText(raw).length > 0) throw new Error("agent-vision receipt contains secret, PII, or sensitive URL material");
  const parsed: unknown = JSON.parse(raw);
  const value = object(parsed, "agent-vision receipt");
  exactKeys(value, [
    "schema_version",
    "kind",
    "status",
    "reviewer_alias",
    "reviewed_at",
    "privacy_manifest_path",
    "privacy_manifest_sha256",
    "artifacts",
    "frames",
    "notes",
  ], "agent-vision receipt");
  if (value.schema_version !== 1 || value.kind !== "agent-vision-privacy-receipt" || value.status !== "PASS") {
    throw new Error("agent-vision receipt must be schema 1 PASS");
  }
  if (typeof value.reviewer_alias !== "string" || value.reviewer_alias.trim() === "") throw new Error("agent-vision receipt needs reviewer_alias");
  if (typeof value.reviewed_at !== "string" || !Number.isFinite(Date.parse(value.reviewed_at))) throw new Error("agent-vision receipt needs reviewed_at");
  if (typeof value.privacy_manifest_path !== "string") throw new Error("agent-vision receipt needs privacy_manifest_path");
  assertPortableRelativePath(value.privacy_manifest_path);
  if (typeof value.privacy_manifest_sha256 !== "string" || !/^[a-f0-9]{64}$/.test(value.privacy_manifest_sha256)) {
    throw new Error("agent-vision receipt needs privacy_manifest_sha256");
  }
  if (!Array.isArray(value.notes) || !value.notes.every((item) => typeof item === "string")) throw new Error("agent-vision receipt notes must be strings");
  const artifacts = parseBindings(value.artifacts, "agent-vision receipt artifacts");
  const frames = parseBindings(value.frames, "agent-vision receipt frames");
  return { ...(parsed as Omit<AgentVisionReceipt, "artifacts" | "frames">), artifacts, frames };
}

function manifestFrameBindings(manifest: PrivacyReviewManifest): HashBinding[] {
  return manifest.video_reviews.flatMap((review) => review.frames.map((frame) => ({ path: frame.path, sha256: frame.sha256 })));
}

export function assertAgentVisionPass(
  goalRoot: string,
  privacyManifestPath: string,
  receiptPath: string,
  options: { allowMissingPaths?: ReadonlySet<string> } = {},
): { manifest: PrivacyReviewManifest; receipt: AgentVisionReceipt } {
  const manifestAbsolute = resolveRegularFile(goalRoot, privacyManifestPath);
  const receiptAbsolute = resolveRegularFile(goalRoot, receiptPath);
  const manifest = readPrivacyManifest(manifestAbsolute);
  const receipt = readAgentVisionReceipt(receiptAbsolute);
  if (manifest.automated_scan.status !== "PASS" || manifest.automated_scan.finding_count !== 0 || manifest.findings.length !== 0) {
    throw new Error("automated privacy scan must PASS with zero findings");
  }
  if (manifest.agent_vision.status !== "PENDING") throw new Error("privacy manifest agent_vision state must remain PENDING");
  if (manifest.agent_vision.receipt_path !== receiptPath) throw new Error("privacy manifest expects a different agent-vision receipt");
  if (receipt.privacy_manifest_path !== privacyManifestPath) throw new Error("agent-vision receipt references a different privacy manifest");
  if (receipt.privacy_manifest_sha256 !== sha256Path(manifestAbsolute)) throw new Error("agent-vision receipt manifest hash is stale");
  const expectedArtifacts = manifest.artifacts.map(({ path, sha256 }) => ({ path, sha256 }));
  const expectedFrames = manifestFrameBindings(manifest);
  const videoArtifacts = new Map(manifest.artifacts.filter((artifact) => artifact.kind === "video").map((artifact) => [artifact.path, artifact.sha256]));
  if (videoArtifacts.size !== manifest.video_reviews.length) throw new Error("every video artifact needs exactly one video review");
  for (const review of manifest.video_reviews) {
    if (videoArtifacts.get(review.artifact_path) !== review.artifact_sha256) throw new Error(`video review hash mismatch: ${review.artifact_path}`);
  }
  assertExactBindings(receipt.artifacts, expectedArtifacts, "agent-vision artifact bindings");
  assertExactBindings(receipt.frames, expectedFrames, "agent-vision frame bindings");
  for (const binding of [...expectedArtifacts, ...expectedFrames]) {
    if (options.allowMissingPaths?.has(binding.path)) continue;
    const actual = sha256Path(resolveRegularFile(goalRoot, binding.path));
    if (actual !== binding.sha256) throw new Error(`artifact mutated after privacy preparation: ${binding.path}`);
  }
  const manifestRelative = relative(realpathSync(goalRoot), manifestAbsolute).split("\\").join("/");
  if (manifestRelative !== privacyManifestPath) throw new Error("privacy manifest path spelling mismatch");
  if (sha256Bytes(readFileSync(manifestAbsolute)) !== receipt.privacy_manifest_sha256) throw new Error("privacy manifest hash mismatch");
  return { manifest, receipt };
}
