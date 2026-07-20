import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { tmpdir } from "node:os";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { imageArtifact, scanPrivacyInputs } from "../lib/privacy.ts";
import { extractReviewFrames, parseSceneScoreOutput, selectFrameCandidates } from "../lib/video-review.ts";
import { sha256Path } from "../lib/safe-paths.ts";

const fixtures = join(dirname(fileURLToPath(import.meta.url)), "fixtures");

test("privacy scanner finds DOM, URL, generated-text, and PII risks without echoing values", () => {
  const result = scanPrivacyInputs(fixtures, [
    { path: "dom-leaky.json", kind: "dom_snapshot_json" },
    { path: "generated-leaky.txt", kind: "generated_text" },
    { path: "url-leaky.txt", kind: "url" },
  ]);
  const rules = new Set(result.findings.map((finding) => finding.rule_id));
  assert.ok(rules.has("SENSITIVE_DOM_FIELD"));
  assert.ok(rules.has("EMAIL"));
  assert.ok(rules.has("SECRET_ASSIGNMENT"));
  assert.ok(rules.has("URL_PRIVATE_HOST"));
  assert.ok(rules.has("URL_SENSITIVE_QUERY"));
  const serialized = JSON.stringify(result.findings);
  assert.doesNotMatch(serialized, /fake-password-for-detector|fake-query-token|person@example\.test/);
});

test("privacy scanner passes sanitized DOM and logs", () => {
  const result = scanPrivacyInputs(fixtures, [
    { path: "dom-safe.json", kind: "dom_snapshot_json" },
    { path: "safe.log", kind: "log" },
  ]);
  assert.deepEqual(result.findings, []);
  assert.equal(result.artifacts.length, 2);
});

test("screenshot artifacts require supported extension and matching image signature", (context) => {
  const root = mkdtempSync(join(tmpdir(), "verify-goal-image-review-test-"));
  context.after(() => rmSync(root, { recursive: true, force: true }));
  writeFileSync(join(root, "proof.png"), Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  assert.equal(imageArtifact(root, "proof.png").kind, "image");
  writeFileSync(join(root, "fake.png"), "not-an-image");
  assert.throws(() => imageArtifact(root, "fake.png"), /signature/);
});

test("scene metadata parser and deterministic frame selection cover all review reasons", () => {
  const parsed = parseSceneScoreOutput([
    "frame:0 pts:0 pts_time:0",
    "lavfi.scene_score=0.000000",
    "frame:30 pts:30000 pts_time:0.5",
    "lavfi.scene_score=0.420000",
  ].join("\n"));
  assert.deepEqual(parsed, [
    { time_seconds: 0, score: 0 },
    { time_seconds: 0.5, score: 0.42 },
  ]);
  const candidates = selectFrameCandidates([
    { time_seconds: 0, score: 0 },
    { time_seconds: 0.5, score: 0.42 },
    { time_seconds: 2.1, score: 0.04 },
    { time_seconds: 2.2, score: 0.05 },
    { time_seconds: 12, score: 0 },
  ], 20, [5]);
  assert.deepEqual([...new Set(candidates.flatMap((candidate) => candidate.reasons))].sort(), [
    "action_boundary",
    "dense_moving",
    "scene_change",
    "static_sparse",
  ]);
  assert.deepEqual(candidates.map((candidate) => candidate.time_seconds), [...candidates.map((candidate) => candidate.time_seconds)].sort((a, b) => a - b));
  assert.equal(new Set(candidates.map((candidate) => candidate.time_seconds)).size, candidates.length);
});

test("video extractor emits unique hash-bound action and sparse frames", (context) => {
  const available = spawnSync("ffmpeg", ["-version"], { stdio: "ignore" });
  if (available.status !== 0) {
    context.skip("ffmpeg unavailable");
    return;
  }
  const root = mkdtempSync(join(tmpdir(), "verify-goal-video-review-test-"));
  context.after(() => rmSync(root, { recursive: true, force: true }));
  mkdirSync(join(root, "proof", "recordings"), { recursive: true });
  const video = join(root, "proof", "recordings", "demo.mp4");
  const generated = spawnSync("ffmpeg", [
    "-hide_banner", "-loglevel", "error",
    "-f", "lavfi",
    "-i", "testsrc2=size=320x180:rate=10:duration=2",
    "-c:v", "libx264",
    "-pix_fmt", "yuv420p",
    video,
  ], { encoding: "utf8" });
  assert.equal(generated.status, 0, generated.stderr);
  const review = extractReviewFrames(root, "proof/recordings/demo.mp4", [1], "proof/privacy-frames/demo");
  assert.ok(review.frames.length > 0);
  assert.equal(review.artifact_sha256, sha256Path(video));
  assert.ok(review.frames.some((frame) => frame.reasons.includes("action_boundary")));
  assert.ok(review.frames.some((frame) => frame.reasons.includes("static_sparse")));
  assert.equal(new Set(review.frames.map((frame) => frame.sha256)).size, review.frames.length);
  for (const frame of review.frames) assert.equal(frame.sha256, sha256Path(join(root, frame.path)));
});
