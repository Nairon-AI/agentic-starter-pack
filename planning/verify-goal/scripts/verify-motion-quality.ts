#!/usr/bin/env node

import { promises as fs } from "node:fs";
import { dirname, resolve } from "node:path";
import type { CaptureReceipt } from "./lib/capture-receipt.ts";
import { parseCaptureReceipt } from "./lib/capture-receipt.ts";
import { analyzeMotionQuality, parseMotionPlan, type MotionQualityResult } from "./lib/motion-quality.ts";
import {
  buildProofVideoReceipt,
  decodeGrayFrameActivity,
  writeJsonAtomic,
} from "./lib/video-proof.ts";

function usage(): never {
  console.error(
    "Usage: verify-motion-quality.ts <video.mp4> <motion-plan.json> " +
      "[--capture-receipt <capture.json>] [--receipt <motion-receipt.json>]",
  );
  process.exit(2);
}

const [videoPath, planPath, ...flags] = process.argv.slice(2);
if (!videoPath || !planPath) usage();
let captureReceiptPath: string | undefined;
let receiptPath = videoPath.replace(/\.mp4$/i, ".motion.json");
for (let index = 0; index < flags.length; index += 2) {
  const flag = flags[index];
  const value = flags[index + 1];
  if (!value) usage();
  if (flag === "--capture-receipt") captureReceiptPath = value;
  else if (flag === "--receipt") receiptPath = value;
  else usage();
}

const plan = parseMotionPlan(JSON.parse(await fs.readFile(planPath, "utf8")) as unknown);
if (!captureReceiptPath && plan.captureReceipt) {
  captureReceiptPath = resolve(dirname(planPath), plan.captureReceipt);
}
const captureReceipt = captureReceiptPath
  ? parseCaptureReceipt(JSON.parse(await fs.readFile(captureReceiptPath, "utf8")) as unknown) as CaptureReceipt
  : undefined;
const video = await buildProofVideoReceipt(videoPath);
const failures = [...video.failures];
let motion: MotionQualityResult = { valid: false, failures: [], windows: [] };
let decodedFrameCount = 0;
if (video.valid) {
  const activity = await decodeGrayFrameActivity(videoPath);
  decodedFrameCount = activity.frameCount;
  if (activity.frameCount !== video.frameCount) {
    failures.push(`gray decoder returned ${activity.frameCount} frames; ffprobe returned ${video.frameCount}`);
  } else {
    motion = analyzeMotionQuality(plan, video.frameCount, activity.activeTransitions, captureReceipt);
    failures.push(...motion.failures);
  }
}

const receipt = {
  schemaVersion: 1,
  videoPath,
  videoSha256: video.sha256,
  motionPlanPath: planPath,
  captureReceiptPath: captureReceiptPath ?? null,
  decodedFrameCount,
  policy: {
    fps: 60,
    grayResolution: "480x270",
    lumaDelta: 8,
    minimumChangedPixels: 3,
    maximumRepeatedFrameRun: 2,
    broadChopFraction: 0.10,
    isolatedStalledTransitionAllowance: 2,
  },
  valid: failures.length === 0,
  failures,
  windows: motion.windows,
};
await writeJsonAtomic(receiptPath, receipt);
if (!receipt.valid) {
  console.error(`Motion quality validation failed:\n- ${receipt.failures.join("\n- ")}`);
  process.exit(1);
}
console.log(JSON.stringify({
  receiptPath,
  videoPath,
  videoSha256: video.sha256,
  windows: receipt.windows.length,
  valid: true,
}));
