#!/usr/bin/env node

import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { once } from "node:events";
import { performance } from "node:perf_hooks";
import { extname } from "node:path";
import type { CapturedSourceFrame, CaptureOutputSlot, CaptureReceipt } from "./lib/capture-receipt.ts";
import { scheduledOffsetNs } from "./lib/capture-receipt.ts";
import {
  PROOF_FPS,
  commandVersion,
  sha256File,
  writeJsonAtomic,
} from "./lib/video-proof.ts";

const DEFAULT_CONNECT_TIMEOUT_MS = 10_000;
const DEFAULT_FIRST_FRAME_TIMEOUT_MS = 10_000;
const DEFAULT_BACKPRESSURE_TIMEOUT_MS = 1_000;
const DEFAULT_FINALIZE_TIMEOUT_MS = 30_000;

interface Options {
  streamUrl: string;
  outputPath: string;
  durationSeconds: number;
  receiptPath: string;
  connectTimeoutMs: number;
  firstFrameTimeoutMs: number;
  backpressureTimeoutMs: number;
  finalizeTimeoutMs: number;
}

interface LatestSource {
  sequence: number;
  receivedNs: bigint;
  sha256: string;
  bytes: Buffer;
}

function usage(): never {
  console.error(
    "Usage: capture-stream-60fps.ts <agent-browser-stream-ws-url> <output.mp4> <seconds> " +
      "[--receipt <capture.json>] [--connect-timeout-ms <ms>] [--first-frame-timeout-ms <ms>]",
  );
  process.exit(2);
}

function positiveInteger(value: string | undefined, name: string): number {
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed <= 0) throw new Error(`${name} must be a positive integer`);
  return parsed;
}

function parseOptions(arguments_: string[]): Options {
  const [streamUrl, outputPath, durationText, ...flags] = arguments_;
  const durationSeconds = Number(durationText);
  if (!streamUrl || !outputPath || !Number.isFinite(durationSeconds) || durationSeconds <= 0) usage();
  if (extname(outputPath).toLowerCase() !== ".mp4") throw new Error("Output must use the .mp4 extension");
  const targetFrames = durationSeconds * PROOF_FPS;
  if (!Number.isSafeInteger(targetFrames)) throw new Error("duration must resolve to an exact integer count of 60fps frames");
  if (durationSeconds > 300) throw new Error("capture duration cannot exceed 300 seconds");

  let receiptPath = outputPath.replace(/\.mp4$/i, ".capture.json");
  let connectTimeoutMs = DEFAULT_CONNECT_TIMEOUT_MS;
  let firstFrameTimeoutMs = DEFAULT_FIRST_FRAME_TIMEOUT_MS;
  let backpressureTimeoutMs = DEFAULT_BACKPRESSURE_TIMEOUT_MS;
  let finalizeTimeoutMs = DEFAULT_FINALIZE_TIMEOUT_MS;
  for (let index = 0; index < flags.length; index += 2) {
    const flag = flags[index];
    const value = flags[index + 1];
    if (!value) usage();
    if (flag === "--receipt") receiptPath = value;
    else if (flag === "--connect-timeout-ms") connectTimeoutMs = positiveInteger(value, flag);
    else if (flag === "--first-frame-timeout-ms") firstFrameTimeoutMs = positiveInteger(value, flag);
    else if (flag === "--backpressure-timeout-ms") backpressureTimeoutMs = positiveInteger(value, flag);
    else if (flag === "--finalize-timeout-ms") finalizeTimeoutMs = positiveInteger(value, flag);
    else usage();
  }
  return {
    streamUrl,
    outputPath,
    durationSeconds,
    receiptPath,
    connectTimeoutMs,
    firstFrameTimeoutMs,
    backpressureTimeoutMs,
    finalizeTimeoutMs,
  };
}

function epochMilliseconds(): number {
  return performance.timeOrigin + performance.now();
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number, label: string): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => reject(new Error(`${label} timed out after ${timeoutMs}ms`)), timeoutMs);
        timer.unref();
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

async function waitUntil(deadlineNs: bigint): Promise<void> {
  while (true) {
    const remainingNs = deadlineNs - process.hrtime.bigint();
    if (remainingNs <= 0n) return;
    const delayMs = Number(remainingNs / 1_000_000n);
    await new Promise<void>((resolve) => setTimeout(resolve, Math.max(0, delayMs - 1)));
  }
}

function parseFrameMessage(data: unknown): Buffer | null {
  let message: unknown;
  try {
    message = JSON.parse(String(data)) as unknown;
  } catch {
    throw new Error("stream returned malformed JSON");
  }
  if (typeof message !== "object" || message === null) return null;
  const candidate = message as { type?: unknown; data?: unknown };
  if (candidate.type !== "frame") return null;
  if (typeof candidate.data !== "string" || candidate.data.length === 0) {
    throw new Error("stream frame is missing base64 JPEG data");
  }
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(candidate.data)) throw new Error("stream frame contains invalid base64");
  const bytes = Buffer.from(candidate.data, "base64");
  if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8 || bytes.at(-2) !== 0xff || bytes.at(-1) !== 0xd9) {
    throw new Error("stream frame must be a complete JPEG image");
  }
  return bytes;
}

const options = parseOptions(process.argv.slice(2));
if (typeof WebSocket === "undefined") throw new Error("Node.js must provide global WebSocket support");

const ffmpegArguments = [
  "-hide_banner", "-loglevel", "error", "-y",
  "-f", "image2pipe", "-c:v", "mjpeg", "-framerate", String(PROOF_FPS), "-i", "pipe:0",
  "-an",
  "-vf", "scale=1920:1080:force_original_aspect_ratio=decrease:in_range=full:out_range=tv,pad=1920:1080:(ow-iw)/2:(oh-ih)/2,format=yuv420p",
  "-c:v", "libx264", "-preset", "veryfast", "-crf", "18", "-pix_fmt", "yuv420p",
  "-r", String(PROOF_FPS), "-fps_mode", "cfr", "-movflags", "+faststart",
  options.outputPath,
];
const receipt: CaptureReceipt = {
  schemaVersion: 1,
  status: "capturing",
  outputPath: options.outputPath,
  outputSha256: "",
  outputByteSize: 0,
  fps: PROOF_FPS,
  targetDurationSeconds: options.durationSeconds,
  targetFrameCount: options.durationSeconds * PROOF_FPS,
  startedAtEpochMs: null,
  finishedAt: "",
  ffmpegVersion: commandVersion("ffmpeg"),
  ffmpegArguments,
  sourceFrames: [],
  outputSlots: [],
  failure: "",
};

let fatalError: Error | undefined;
const ffmpeg = spawn("ffmpeg", ffmpegArguments, { stdio: ["pipe", "inherit", "inherit"] });
const ffmpegClosed = new Promise<[number | null, NodeJS.Signals | null]>((resolve) => {
  ffmpeg.once("close", (code, signal) => resolve([code, signal]));
});
ffmpeg.once("error", (error) => {
  fatalError = error;
  firstSourceResolve?.();
  firstSourceResolve = undefined;
});
const socket = new WebSocket(options.streamUrl);
let latestSource: LatestSource | undefined;
let firstSourceResolve: (() => void) | undefined;
let sourceSequence = 0;

const firstSource = new Promise<void>((resolve) => {
  firstSourceResolve = resolve;
});

socket.addEventListener("message", (event) => {
  try {
    const bytes = parseFrameMessage(event.data);
    if (!bytes) return;
    const receivedNs = process.hrtime.bigint();
    const sha256 = createHash("sha256").update(bytes).digest("hex");
    sourceSequence += 1;
    latestSource = { sequence: sourceSequence, receivedNs, sha256, bytes };
    if (receipt.startedAtEpochMs !== null) {
      receipt.sourceFrames.push({
        sequence: sourceSequence,
        receivedOffsetNs: (receivedNs - startNs).toString(),
        sha256,
        byteSize: bytes.byteLength,
      });
    }
    firstSourceResolve?.();
    firstSourceResolve = undefined;
  } catch (error) {
    fatalError = error instanceof Error ? error : new Error(String(error));
    firstSourceResolve?.();
    firstSourceResolve = undefined;
  }
});
socket.addEventListener("error", () => {
  fatalError = new Error("stream WebSocket failed");
});

let startNs = 0n;

async function writeFrame(bytes: Buffer): Promise<void> {
  if (ffmpeg.stdin.write(bytes)) return;
  await withTimeout(
    Promise.race([
      once(ffmpeg.stdin, "drain").then(() => undefined),
      ffmpegClosed.then(([code]) => Promise.reject(new Error(`ffmpeg closed during capture with code ${code}`))),
    ]),
    options.backpressureTimeoutMs,
    "ffmpeg backpressure",
  );
}

async function runCapture(): Promise<void> {
  await withTimeout(once(socket, "open").then(() => undefined), options.connectTimeoutMs, "WebSocket connection");
  await withTimeout(firstSource, options.firstFrameTimeoutMs, "first stream frame");
  if (fatalError) throw fatalError;
  if (!latestSource) throw new Error("stream opened without a usable first frame");

  startNs = latestSource.receivedNs;
  receipt.startedAtEpochMs = epochMilliseconds() - Number(process.hrtime.bigint() - startNs) / 1_000_000;
  receipt.sourceFrames.push({
    sequence: latestSource.sequence,
    receivedOffsetNs: "0",
    sha256: latestSource.sha256,
    byteSize: latestSource.bytes.byteLength,
  });

  for (let index = 0; index < receipt.targetFrameCount; index += 1) {
    const scheduledNs = startNs + scheduledOffsetNs(index);
    await waitUntil(scheduledNs);
    if (fatalError) throw fatalError;
    const source = latestSource;
    if (!source) throw new Error(`no source frame available for output slot ${index}`);
    await writeFrame(source.bytes);
    const writtenNs = process.hrtime.bigint();
    const slot: CaptureOutputSlot = {
      index,
      scheduledOffsetNs: scheduledOffsetNs(index).toString(),
      writtenOffsetNs: (writtenNs - startNs).toString(),
      latenessNs: (writtenNs > scheduledNs ? writtenNs - scheduledNs : 0n).toString(),
      sourceSequence: source.sequence,
      sourceSha256: source.sha256,
    };
    receipt.outputSlots.push(slot);
  }

  socket.close();
  ffmpeg.stdin.end();
  const [exitCode] = await withTimeout(ffmpegClosed, options.finalizeTimeoutMs, "ffmpeg finalize");
  if (exitCode !== 0) throw new Error(`ffmpeg exited with code ${exitCode}`);
  const output = await sha256File(options.outputPath);
  receipt.outputSha256 = output.sha256;
  receipt.outputByteSize = output.byteSize;
  receipt.status = "passed";
}

try {
  await runCapture();
} catch (error) {
  receipt.status = "failed";
  receipt.failure = error instanceof Error ? error.message : String(error);
  socket.close();
  ffmpeg.stdin.destroy();
  if (ffmpeg.exitCode === null) ffmpeg.kill("SIGTERM");
} finally {
  receipt.finishedAt = new Date().toISOString();
  await writeJsonAtomic(options.receiptPath, receipt);
}

if (receipt.status !== "passed") {
  console.error(`60fps capture failed: ${receipt.failure}`);
  process.exit(1);
}
console.log(JSON.stringify({
  receiptPath: options.receiptPath,
  outputPath: receipt.outputPath,
  outputSha256: receipt.outputSha256,
  outputByteSize: receipt.outputByteSize,
  sourceFrameCount: receipt.sourceFrames.length,
  outputSlotCount: receipt.outputSlots.length,
  valid: true,
}));
process.exit(0);
