import assert from "node:assert/strict";
import { test } from "node:test";
import type { CaptureReceipt } from "../lib/capture-receipt.ts";
import { scheduledOffsetNs } from "../lib/capture-receipt.ts";
import {
  analyzeMotionQuality,
  parseMotionPlan,
  type MotionPlan,
} from "../lib/motion-quality.ts";

function plan(kind: "cursor" | "scroll" | "zoom" | "static", frames = 30): MotionPlan {
  return {
    schemaVersion: 1,
    fps: 60,
    windows: [{ id: "MW-01", kind, startFrame: 0, endFrameExclusive: frames }],
  };
}

function captureReceipt(frameCount: number, sourceHashes?: string[]): CaptureReceipt {
  const hashes = sourceHashes ?? Array.from({ length: frameCount }, (_, index) => index.toString(16).padStart(64, "0"));
  return {
    schemaVersion: 1,
    status: "passed",
    outputPath: "fixture.mp4",
    outputSha256: "f".repeat(64),
    outputByteSize: 1,
    fps: 60,
    targetDurationSeconds: frameCount / 60,
    targetFrameCount: frameCount,
    startedAtEpochMs: 1,
    finishedAt: "2026-01-01T00:00:00.000Z",
    ffmpegVersion: "fixture",
    ffmpegArguments: [],
    failure: "",
    sourceFrames: [],
    outputSlots: hashes.map((sourceSha256, index) => ({
      index,
      scheduledOffsetNs: scheduledOffsetNs(index).toString(),
      writtenOffsetNs: scheduledOffsetNs(index).toString(),
      latenessNs: "0",
      sourceSequence: index + 1,
      sourceSha256,
    })),
  };
}

test("motion plan requires integer, non-overlapping frame windows", () => {
  assert.throws(
    () => parseMotionPlan({ schemaVersion: 1, fps: 60, windows: [{ id: "bad", kind: "zoom", startFrame: 0.5, endFrameExclusive: 10 }] }),
    /uppercase ID|integers/,
  );
  const result = analyzeMotionQuality({
    schemaVersion: 1,
    fps: 60,
    windows: [
      { id: "MW-01", kind: "zoom", startFrame: 0, endFrameExclusive: 10 },
      { id: "MW-02", kind: "static", startFrame: 9, endFrameExclusive: 12 },
    ],
  }, 12, Array(11).fill(true));
  assert.equal(result.valid, false);
  assert.match(result.failures.join("\n"), /overlap/);
});

test("one or two isolated stalled transitions remain allowed", () => {
  const activity = Array(29).fill(true) as boolean[];
  activity[5] = false;
  activity[17] = false;
  const result = analyzeMotionQuality(plan("zoom"), 30, activity);
  assert.equal(result.valid, true);
  assert.equal(result.windows[0]?.stalledTransitions, 2);
});

test("three-frame repeated run fails", () => {
  const activity = Array(29).fill(true) as boolean[];
  activity[5] = false;
  activity[6] = false;
  const result = analyzeMotionQuality(plan("zoom"), 30, activity);
  assert.equal(result.valid, false);
  assert.match(result.failures.join("\n"), /3-frame repeated\/stalled run/);
});

test("dispersed stalls beyond broad-chop allowance fail", () => {
  const activity = Array(19).fill(true) as boolean[];
  activity[2] = false;
  activity[7] = false;
  activity[13] = false;
  const result = analyzeMotionQuality(plan("zoom", 20), 20, activity);
  assert.equal(result.valid, false);
  assert.match(result.failures.join("\n"), /transitions stalled/);
});

test("static holds are excluded from motion metrics", () => {
  const result = analyzeMotionQuality(plan("static", 20), 20, Array(19).fill(false));
  assert.equal(result.valid, true);
  assert.equal(result.windows[0]?.status, "excluded_static");
});

test("cursor motion also fails on a three-frame source stall", () => {
  const hashes = Array.from({ length: 20 }, (_, index) => index.toString(16).padStart(64, "0"));
  hashes[6] = hashes[5]!;
  hashes[7] = hashes[5]!;
  const result = analyzeMotionQuality(plan("cursor", 20), 20, Array(19).fill(true), captureReceipt(20, hashes));
  assert.equal(result.valid, false);
  assert.match(result.failures.join("\n"), /3-frame repeated\/stalled run/);
});

test("cursor and scroll windows require the source timing receipt", () => {
  const result = analyzeMotionQuality(plan("scroll", 20), 20, Array(19).fill(true));
  assert.equal(result.valid, false);
  assert.match(result.failures.join("\n"), /requires a passing capture receipt/);
});
