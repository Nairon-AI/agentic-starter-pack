#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { extname } from "node:path";
import { analyzeMotionQuality, type MotionPlan, type MotionWindow } from "./lib/motion-quality.ts";
import {
  buildProofVideoReceipt,
  decodeGrayFrameActivity,
  writeJsonAtomic,
} from "./lib/video-proof.ts";

interface ZoomSegment {
  targetX: number;
  targetY: number;
  startFrame: number;
  focusedFrame: number;
  releaseFrame: number;
  endFrameExclusive: number;
  maxZoom: number;
}

function usage(): never {
  console.error(
    "Usage: apply-shallow-zoom.ts <input.mp4> <output.mp4> " +
      "<x,y,startFrame,focusedFrame,releaseFrame,endFrameExclusive[,max=1.25]> [...] " +
      "[--receipt <zoom-receipt.json>]",
  );
  process.exit(2);
}

const [inputPath, outputPath, ...remaining] = process.argv.slice(2);
if (!inputPath || !outputPath) usage();
if (extname(inputPath).toLowerCase() !== ".mp4" || extname(outputPath).toLowerCase() !== ".mp4") {
  throw new Error("Input and output must use the .mp4 extension");
}

let receiptPath = outputPath.replace(/\.mp4$/i, ".zoom.json");
const zoomSpecs: string[] = [];
for (let index = 0; index < remaining.length; index += 1) {
  if (remaining[index] === "--receipt") {
    const candidate = remaining[index + 1];
    if (!candidate) usage();
    receiptPath = candidate;
    index += 1;
  } else {
    zoomSpecs.push(remaining[index]!);
  }
}
if (zoomSpecs.length === 0) usage();

const segments: ZoomSegment[] = zoomSpecs.map((spec, index) => {
  const values = spec.split(",").map(Number);
  if ((values.length !== 6 && values.length !== 7) || values.some((value) => !Number.isFinite(value))) {
    throw new Error(`Invalid zoom spec ${index + 1}: ${spec}`);
  }
  const [targetX, targetY, startFrame, focusedFrame, releaseFrame, endFrameExclusive, maxZoom = 1.25] =
    values as [number, number, number, number, number, number, number?];
  if (![targetX, targetY, startFrame, focusedFrame, releaseFrame, endFrameExclusive].every(Number.isSafeInteger)) {
    throw new Error(`Zoom spec ${index + 1} coordinates and frame bounds must be integers`);
  }
  if (targetX < 0 || targetX >= 1920 || targetY < 0 || targetY >= 1080) {
    throw new Error(`Zoom spec ${index + 1} target must be inside 1920x1080`);
  }
  if (!(startFrame < focusedFrame && focusedFrame <= releaseFrame && releaseFrame < endFrameExclusive)) {
    throw new Error(`Zoom spec ${index + 1} requires start < focused <= release < endExclusive`);
  }
  if (focusedFrame - startFrame + 1 < 6 || endFrameExclusive - releaseFrame < 6) {
    throw new Error(`Zoom spec ${index + 1} zoom-in and zoom-out phases each need at least 6 frames`);
  }
  if (maxZoom < 1.15 || maxZoom > 1.3) {
    throw new Error(`Zoom spec ${index + 1} must stay between 1.15 and 1.30`);
  }
  return { targetX, targetY, startFrame, focusedFrame, releaseFrame, endFrameExclusive, maxZoom };
}).sort((left, right) => left.startFrame - right.startFrame);

for (let index = 1; index < segments.length; index += 1) {
  const current = segments[index]!;
  const previous = segments[index - 1]!;
  if (current.startFrame < previous.endFrameExclusive) {
    throw new Error(`Zoom specs ${index} and ${index + 1} overlap`);
  }
}

const input = await buildProofVideoReceipt(inputPath);
const preflightFailures = [...input.failures];
for (let index = 0; index < segments.length; index += 1) {
  if (segments[index]!.endFrameExclusive > input.frameCount) {
    preflightFailures.push(`zoom spec ${index + 1} extends beyond input frame count ${input.frameCount}`);
  }
}
if (preflightFailures.length > 0) {
  const receipt = { schemaVersion: 1, valid: false, input, output: null, segments, failures: preflightFailures };
  await writeJsonAtomic(receiptPath, receipt);
  console.error(`Shallow zoom preflight failed:\n- ${preflightFailures.join("\n- ")}`);
  process.exit(1);
}

const ease = (frame: string, start: number, end: number): string => {
  const progress = `((${frame})-${start})/(${end}-${start})`;
  return `(3*pow(${progress},2)-2*pow(${progress},3))`;
};
const frame = "on";
const segmentZoom = ({ startFrame, focusedFrame, releaseFrame, endFrameExclusive, maxZoom }: ZoomSegment): string => {
  const zoomIn = `1+(${maxZoom}-1)*${ease(frame, startFrame, focusedFrame)}`;
  const zoomOut = `${maxZoom}-(${maxZoom}-1)*${ease(frame, releaseFrame, endFrameExclusive - 1)}`;
  return `if(lt(${frame},${focusedFrame}),${zoomIn},if(lt(${frame},${releaseFrame}),${maxZoom},${zoomOut}))`;
};
const active = (segment: ZoomSegment): string =>
  `between(${frame},${segment.startFrame},${segment.endFrameExclusive - 1})`;
const zoom = segments.reduceRight(
  (fallback, segment) => `if(${active(segment)},${segmentZoom(segment)},${fallback})`,
  "1",
);
const x = segments.reduceRight(
  (fallback, segment) =>
    `if(${active(segment)},max(0,min(iw-iw/zoom,${segment.targetX}-iw/(2*zoom))),${fallback})`,
  "0",
);
const y = segments.reduceRight(
  (fallback, segment) =>
    `if(${active(segment)},max(0,min(ih-ih/zoom,${segment.targetY}-ih/(2*zoom))),${fallback})`,
  "0",
);
const filter = `zoompan=z='${zoom}':x='${x}':y='${y}':d=1:s=1920x1080:fps=60,scale=in_range=full:out_range=tv,format=yuv420p`;
const ffmpegArguments = [
  "-hide_banner", "-loglevel", "error", "-y", "-i", inputPath,
  "-vf", filter,
  "-an", "-c:v", "libx264", "-preset", "veryfast", "-crf", "18", "-pix_fmt", "yuv420p",
  "-r", "60", "-fps_mode", "cfr", "-frames:v", String(input.frameCount), "-movflags", "+faststart",
  outputPath,
];
const render = spawnSync("ffmpeg", ffmpegArguments, { stdio: "inherit" });
if (render.error) throw render.error;
if (render.status !== 0) process.exit(render.status ?? 1);

const output = await buildProofVideoReceipt(outputPath);
const windows: MotionWindow[] = [];
for (let index = 0; index < segments.length; index += 1) {
  const segment = segments[index]!;
  const number = String(index + 1).padStart(2, "0");
  windows.push({
    id: `MW-ZOOM-IN-${number}`,
    kind: "zoom",
    startFrame: segment.startFrame,
    endFrameExclusive: segment.focusedFrame + 1,
  });
  if (segment.releaseFrame > segment.focusedFrame + 1) {
    windows.push({
      id: `MW-ZOOM-HOLD-${number}`,
      kind: "static",
      startFrame: segment.focusedFrame + 1,
      endFrameExclusive: segment.releaseFrame,
    });
  }
  windows.push({
    id: `MW-ZOOM-OUT-${number}`,
    kind: "zoom",
    startFrame: segment.releaseFrame,
    endFrameExclusive: segment.endFrameExclusive,
  });
}
const motionPlan: MotionPlan = { schemaVersion: 1, fps: 60, videoPath: outputPath, windows };
const activity = output.valid ? await decodeGrayFrameActivity(outputPath) : null;
const motion = activity
  ? analyzeMotionQuality(motionPlan, output.frameCount, activity.activeTransitions)
  : { valid: false, failures: ["output video failed strict validation"], windows: [] };
const failures = [...output.failures];
if (output.frameCount !== input.frameCount) failures.push("zoom output frame count differs from input");
failures.push(...motion.failures);
const receipt = {
  schemaVersion: 1,
  valid: failures.length === 0,
  input,
  output,
  segments,
  motionPlan,
  motion,
  filter,
  ffmpegArguments,
  failures,
};
await writeJsonAtomic(receiptPath, receipt);
if (!receipt.valid) {
  console.error(`Shallow zoom validation failed:\n- ${failures.join("\n- ")}`);
  process.exit(1);
}
console.log(JSON.stringify({
  receiptPath,
  inputSha256: input.sha256,
  outputSha256: output.sha256,
  frameCount: output.frameCount,
  zoomWindows: motion.windows.length,
  valid: true,
}));
