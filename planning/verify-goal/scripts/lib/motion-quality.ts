import type { CaptureReceipt } from "./capture-receipt.ts";
import { NANOSECONDS_PER_SECOND, validateCaptureReceipt } from "./capture-receipt.ts";
import { PROOF_FPS } from "./video-proof.ts";

export type MotionWindowKind = "cursor" | "scroll" | "zoom" | "static";

export interface MotionWindow {
  id: string;
  kind: MotionWindowKind;
  startFrame: number;
  endFrameExclusive: number;
}

export interface MotionPlan {
  schemaVersion: 1;
  fps: 60;
  videoPath?: string;
  captureReceipt?: string;
  windows: MotionWindow[];
}

export interface MotionWindowResult {
  id: string;
  kind: MotionWindowKind;
  startFrame: number;
  endFrameExclusive: number;
  transitions: number;
  stalledTransitions: number;
  allowedStalledTransitions: number;
  longestStalledFrameRun: number;
  status: "passed" | "failed" | "excluded_static";
  failures: string[];
}

export interface MotionQualityResult {
  valid: boolean;
  failures: string[];
  windows: MotionWindowResult[];
}

const MIN_MOTION_FRAMES = 6;
const BROAD_CHOP_FRACTION = 0.10;
const MAX_ISOLATED_STALLED_TRANSITIONS = 2;
const MAX_STALLED_FRAME_RUN = 2;

function object(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function parseMotionPlan(value: unknown): MotionPlan {
  if (!object(value) || value.schemaVersion !== 1 || value.fps !== PROOF_FPS || !Array.isArray(value.windows)) {
    throw new Error("motion plan must use schemaVersion 1, fps 60, and a windows array");
  }
  const windows = value.windows.map((candidate, index): MotionWindow => {
    if (!object(candidate)) throw new Error(`motion window ${index} must be an object`);
    const { id, kind, startFrame, endFrameExclusive } = candidate;
    if (typeof id !== "string" || !/^[A-Z][A-Z0-9-]*$/.test(id)) {
      throw new Error(`motion window ${index} needs a stable uppercase ID`);
    }
    if (kind !== "cursor" && kind !== "scroll" && kind !== "zoom" && kind !== "static") {
      throw new Error(`motion window ${id} has invalid kind`);
    }
    if (!Number.isSafeInteger(startFrame) || !Number.isSafeInteger(endFrameExclusive)) {
      throw new Error(`motion window ${id} frame bounds must be integers`);
    }
    return { id, kind, startFrame: startFrame as number, endFrameExclusive: endFrameExclusive as number };
  });
  return {
    schemaVersion: 1,
    fps: PROOF_FPS,
    windows,
    ...(typeof value.videoPath === "string" ? { videoPath: value.videoPath } : {}),
    ...(typeof value.captureReceipt === "string" ? { captureReceipt: value.captureReceipt } : {}),
  };
}

export function validateMotionPlan(plan: MotionPlan, frameCount: number): string[] {
  const failures: string[] = [];
  const ids = new Set<string>();
  const sorted = [...plan.windows].sort((left, right) => left.startFrame - right.startFrame);
  if (plan.windows.length === 0) failures.push("motion plan needs at least one motion or static window");

  for (const window of plan.windows) {
    if (ids.has(window.id)) failures.push(`duplicate motion window ID: ${window.id}`);
    ids.add(window.id);
    if (window.startFrame < 0 || window.endFrameExclusive > frameCount || window.startFrame >= window.endFrameExclusive) {
      failures.push(`motion window ${window.id} is outside video frame bounds`);
    }
    const length = window.endFrameExclusive - window.startFrame;
    if (window.kind !== "static" && length < MIN_MOTION_FRAMES) {
      failures.push(`motion window ${window.id} needs at least ${MIN_MOTION_FRAMES} frames`);
    }
  }
  for (let index = 1; index < sorted.length; index += 1) {
    const previous = sorted[index - 1]!;
    const current = sorted[index]!;
    if (current.startFrame < previous.endFrameExclusive) {
      failures.push(`motion windows ${previous.id} and ${current.id} overlap`);
    }
  }
  return failures;
}

function sourceTransitionActive(receipt: CaptureReceipt, transitionIndex: number): boolean {
  const current = receipt.outputSlots[transitionIndex + 1]!;
  const previous = receipt.outputSlots[transitionIndex]!;
  const frameIntervalNs = NANOSECONDS_PER_SECOND / BigInt(PROOF_FPS);
  const currentLateness = BigInt(current.latenessNs);
  return current.sourceSha256 !== previous.sourceSha256 && currentLateness < frameIntervalNs;
}

function analyzeWindow(
  window: MotionWindow,
  visualTransitions: readonly boolean[],
  captureReceipt: CaptureReceipt | undefined,
): MotionWindowResult {
  if (window.kind === "static") {
    return {
      ...window,
      transitions: Math.max(0, window.endFrameExclusive - window.startFrame - 1),
      stalledTransitions: 0,
      allowedStalledTransitions: 0,
      longestStalledFrameRun: 0,
      status: "excluded_static",
      failures: [],
    };
  }

  const failures: string[] = [];
  const transitions = window.endFrameExclusive - window.startFrame - 1;
  const allowedStalledTransitions = Math.max(
    MAX_ISOLATED_STALLED_TRANSITIONS,
    Math.floor(transitions * BROAD_CHOP_FRACTION),
  );
  let stalledTransitions = 0;
  let currentStalledFrameRun = 1;
  let longestStalledFrameRun = 1;

  for (let transitionIndex = window.startFrame; transitionIndex < window.endFrameExclusive - 1; transitionIndex += 1) {
    let active = visualTransitions[transitionIndex] === true;
    if ((window.kind === "cursor" || window.kind === "scroll") && captureReceipt) {
      active = active && sourceTransitionActive(captureReceipt, transitionIndex);
    }
    if (active) {
      currentStalledFrameRun = 1;
      continue;
    }
    stalledTransitions += 1;
    currentStalledFrameRun += 1;
    longestStalledFrameRun = Math.max(longestStalledFrameRun, currentStalledFrameRun);
  }

  if ((window.kind === "cursor" || window.kind === "scroll") && !captureReceipt) {
    failures.push(`${window.kind} window requires a passing capture receipt`);
  }
  if (longestStalledFrameRun > MAX_STALLED_FRAME_RUN) {
    failures.push(`contains a ${longestStalledFrameRun}-frame repeated/stalled run; maximum is 2`);
  }
  if (stalledTransitions > allowedStalledTransitions) {
    failures.push(
      `${stalledTransitions}/${transitions} transitions stalled; maximum is ${allowedStalledTransitions}`,
    );
  }

  return {
    ...window,
    transitions,
    stalledTransitions,
    allowedStalledTransitions,
    longestStalledFrameRun,
    status: failures.length === 0 ? "passed" : "failed",
    failures,
  };
}

export function analyzeMotionQuality(
  plan: MotionPlan,
  frameCount: number,
  visualTransitions: readonly boolean[],
  captureReceipt?: CaptureReceipt,
): MotionQualityResult {
  const failures = validateMotionPlan(plan, frameCount);
  if (visualTransitions.length !== Math.max(0, frameCount - 1)) {
    failures.push(`decoded visual transition count must be ${Math.max(0, frameCount - 1)}`);
  }
  if (captureReceipt) failures.push(...validateCaptureReceipt(captureReceipt, frameCount));

  const windows = failures.length === 0
    ? plan.windows.map((window) => analyzeWindow(window, visualTransitions, captureReceipt))
    : [];
  for (const window of windows) {
    for (const failure of window.failures) failures.push(`${window.id}: ${failure}`);
  }
  return { valid: failures.length === 0, failures, windows };
}
