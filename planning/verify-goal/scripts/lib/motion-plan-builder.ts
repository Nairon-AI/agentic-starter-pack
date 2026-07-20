import type { CaptureReceipt } from "./capture-receipt.ts";
import { PROOF_FPS } from "./video-proof.ts";
import type { MotionWindow } from "./motion-quality.ts";

export interface BrowserMotionEvent {
  schemaVersion: 1;
  id: string;
  plannedWindowId: string;
  kind: "cursor" | "scroll";
  startedAtEpochMs: number;
  endedAtEpochMs: number;
  requestedDurationMs: number;
}

function object(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export function parseBrowserMotionEvents(value: unknown): BrowserMotionEvent[] {
  if (!Array.isArray(value)) throw new Error("browser motion events must be an array");
  return value.map((item, index): BrowserMotionEvent => {
    if (!object(item)) throw new Error(`browser motion event ${index} must be an object`);
    const event = item as Partial<BrowserMotionEvent>;
    if (event.schemaVersion !== 1 || (event.kind !== "cursor" && event.kind !== "scroll")) throw new Error(`browser motion event ${index} has invalid schema/kind`);
    if (typeof event.id !== "string" || !event.id || typeof event.plannedWindowId !== "string" || !/^[A-Z][A-Z0-9-]*$/.test(event.plannedWindowId)) {
      throw new Error(`browser motion event ${index} needs id and uppercase plannedWindowId`);
    }
    if (![event.startedAtEpochMs, event.endedAtEpochMs, event.requestedDurationMs].every((number) => typeof number === "number" && Number.isFinite(number))) {
      throw new Error(`browser motion event ${event.id} has invalid timing`);
    }
    if (event.endedAtEpochMs! <= event.startedAtEpochMs! || event.requestedDurationMs! <= 0) throw new Error(`browser motion event ${event.id} has non-positive duration`);
    return event as BrowserMotionEvent;
  });
}

export function motionWindowsFromEvents(receipt: CaptureReceipt, events: readonly BrowserMotionEvent[]): MotionWindow[] {
  if (receipt.startedAtEpochMs === null || receipt.targetFrameCount <= 0) throw new Error("capture receipt needs start time and frame count");
  const ids = new Set<string>();
  return events.map((event): MotionWindow => {
    if (ids.has(event.plannedWindowId)) throw new Error(`duplicate plannedWindowId: ${event.plannedWindowId}`);
    ids.add(event.plannedWindowId);
    const startFrame = Math.max(0, Math.floor((event.startedAtEpochMs - receipt.startedAtEpochMs!) * PROOF_FPS / 1000));
    const endFrameExclusive = Math.min(receipt.targetFrameCount, Math.ceil((event.endedAtEpochMs - receipt.startedAtEpochMs!) * PROOF_FPS / 1000) + 1);
    if (startFrame >= receipt.targetFrameCount || endFrameExclusive <= 0 || endFrameExclusive - startFrame < 6) {
      throw new Error(`browser motion event ${event.id} does not map to at least six captured frames`);
    }
    return { id: event.plannedWindowId, kind: event.kind, startFrame, endFrameExclusive };
  });
}
