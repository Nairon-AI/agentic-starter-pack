import assert from "node:assert/strict";
import test from "node:test";
import type { CaptureReceipt } from "../lib/capture-receipt.ts";
import { motionWindowsFromEvents, parseBrowserMotionEvents } from "../lib/motion-plan-builder.ts";

const capture = {
  startedAtEpochMs: 1_000,
  targetFrameCount: 600,
} as CaptureReceipt;

test("browser epoch events map deterministically to captured 60fps windows", () => {
  const events = parseBrowserMotionEvents([{
    schemaVersion: 1,
    id: "cursor-1",
    plannedWindowId: "MW-CURSOR-01",
    kind: "cursor",
    startedAtEpochMs: 1_100,
    endedAtEpochMs: 1_600,
    requestedDurationMs: 500,
  }]);
  assert.deepEqual(motionWindowsFromEvents(capture, events), [{
    id: "MW-CURSOR-01",
    kind: "cursor",
    startFrame: 6,
    endFrameExclusive: 37,
  }]);
});

test("events outside capture or without planned IDs fail closed", () => {
  assert.throws(() => parseBrowserMotionEvents([{ schemaVersion: 1, id: "x", plannedWindowId: "", kind: "scroll", startedAtEpochMs: 1, endedAtEpochMs: 2, requestedDurationMs: 1 }]), /plannedWindowId/);
  const event = parseBrowserMotionEvents([{ schemaVersion: 1, id: "x", plannedWindowId: "MW-SCROLL-01", kind: "scroll", startedAtEpochMs: 50_000, endedAtEpochMs: 51_000, requestedDurationMs: 1_000 }]);
  assert.throws(() => motionWindowsFromEvents(capture, event), /six captured frames/);
});
