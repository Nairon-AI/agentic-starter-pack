#!/usr/bin/env node

import { readFileSync } from "node:fs";
import { basename } from "node:path";
import { parseCaptureReceipt, validateCaptureReceipt } from "./lib/capture-receipt.ts";
import { parseBrowserMotionEvents, motionWindowsFromEvents } from "./lib/motion-plan-builder.ts";
import { parseMotionPlan, validateMotionPlan, type MotionWindow } from "./lib/motion-quality.ts";
import { writeJsonAtomic } from "./lib/video-proof.ts";

const [capturePath, eventsPath, outputPath, ...flags] = process.argv.slice(2);
if (!capturePath || !eventsPath || !outputPath) {
  console.error("Usage: build-motion-plan.ts <capture.json> <browser-motion-events.json> <motion-plan.json> [--zoom-receipt <zoom.json>] [--video-path <final.mp4>]");
  process.exit(2);
}
const option = (name: string): string | undefined => {
  const index = flags.indexOf(name);
  return index >= 0 ? flags[index + 1] : undefined;
};
const knownFlags = new Set(["--zoom-receipt", "--video-path"]);
for (let index = 0; index < flags.length; index += 2) {
  if (!knownFlags.has(flags[index] ?? "") || !flags[index + 1]) throw new Error(`invalid option: ${flags[index] ?? "missing"}`);
}

const capture = parseCaptureReceipt(JSON.parse(readFileSync(capturePath, "utf8")) as unknown);
const captureFailures = validateCaptureReceipt(capture, capture.targetFrameCount);
if (captureFailures.length > 0) throw new Error(`capture receipt failed:\n- ${captureFailures.join("\n- ")}`);
const events = parseBrowserMotionEvents(JSON.parse(readFileSync(eventsPath, "utf8")) as unknown);
const windows: MotionWindow[] = motionWindowsFromEvents(capture, events);
const zoomReceiptPath = option("--zoom-receipt");
if (zoomReceiptPath) {
  const zoom = JSON.parse(readFileSync(zoomReceiptPath, "utf8")) as Record<string, unknown>;
  if (zoom.schemaVersion !== 1 || zoom.valid !== true || !zoom.motionPlan) throw new Error("zoom receipt must be schema 1 PASS with motionPlan");
  windows.push(...parseMotionPlan(zoom.motionPlan).windows);
}
windows.sort((left, right) => left.startFrame - right.startFrame || left.id.localeCompare(right.id, "en"));
const failures = validateMotionPlan({ schemaVersion: 1, fps: 60, windows }, capture.targetFrameCount);
if (failures.length > 0) throw new Error(`combined motion plan failed:\n- ${failures.join("\n- ")}`);
const plan = {
  schemaVersion: 1,
  fps: 60,
  videoPath: option("--video-path") ?? capture.outputPath,
  captureReceipt: basename(capturePath),
  windows,
};
await writeJsonAtomic(outputPath, plan);
console.log(JSON.stringify({ outputPath, videoPath: plan.videoPath, windows: windows.length, valid: true }));
