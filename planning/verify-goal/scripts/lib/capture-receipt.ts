import { PROOF_FPS } from "./video-proof.ts";

export interface CapturedSourceFrame {
  sequence: number;
  receivedOffsetNs: string;
  sha256: string;
  byteSize: number;
}

export interface CaptureOutputSlot {
  index: number;
  scheduledOffsetNs: string;
  writtenOffsetNs: string;
  latenessNs: string;
  sourceSequence: number;
  sourceSha256: string;
}

export interface CaptureReceipt {
  schemaVersion: 1;
  status: "capturing" | "passed" | "failed";
  outputPath: string;
  outputSha256: string;
  outputByteSize: number;
  fps: 60;
  targetDurationSeconds: number;
  targetFrameCount: number;
  startedAtEpochMs: number | null;
  finishedAt: string;
  ffmpegVersion: string;
  ffmpegArguments: string[];
  sourceFrames: CapturedSourceFrame[];
  outputSlots: CaptureOutputSlot[];
  failure: string;
}

export const NANOSECONDS_PER_SECOND = 1_000_000_000n;

function object(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function parseCaptureReceipt(value: unknown): CaptureReceipt {
  if (!object(value) || value.schemaVersion !== 1 || !Array.isArray(value.sourceFrames) || !Array.isArray(value.outputSlots)) {
    throw new Error("capture receipt must use schemaVersion 1 with sourceFrames and outputSlots arrays");
  }
  return value as unknown as CaptureReceipt;
}

export function scheduledOffsetNs(index: number): bigint {
  if (!Number.isSafeInteger(index) || index < 0) throw new Error("slot index must be a non-negative integer");
  return (BigInt(index) * NANOSECONDS_PER_SECOND) / BigInt(PROOF_FPS);
}

export function validateCaptureReceipt(receipt: CaptureReceipt, expectedFrameCount: number): string[] {
  const failures: string[] = [];
  if (receipt.schemaVersion !== 1) failures.push("capture receipt schemaVersion must be 1");
  if (receipt.status !== "passed") failures.push("capture receipt status must be passed");
  if (receipt.fps !== PROOF_FPS) failures.push("capture receipt fps must be 60");
  if (receipt.targetFrameCount !== expectedFrameCount) failures.push("capture target frame count differs from video");
  if (receipt.outputSlots.length !== expectedFrameCount) failures.push("capture output slot count differs from video");
  for (let index = 0; index < receipt.outputSlots.length; index += 1) {
    const slot = receipt.outputSlots[index]!;
    if (slot.index !== index) failures.push(`capture slot ${index} has wrong index ${slot.index}`);
    if (slot.scheduledOffsetNs !== scheduledOffsetNs(index).toString()) {
      failures.push(`capture slot ${index} has wrong scheduled deadline`);
    }
    if (!/^[a-f0-9]{64}$/.test(slot.sourceSha256)) failures.push(`capture slot ${index} has invalid source hash`);
    if (!/^\d+$/.test(slot.writtenOffsetNs) || !/^\d+$/.test(slot.latenessNs)) {
      failures.push(`capture slot ${index} has invalid timing values`);
    }
    if (!Number.isSafeInteger(slot.sourceSequence) || slot.sourceSequence <= 0) {
      failures.push(`capture slot ${index} has invalid source sequence`);
    }
  }
  return failures;
}
