import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { probeProofVideo } from "../lib/video-proof.ts";

test("integer-frame shallow zoom emits strict output and hash-bound motion receipt", (t) => {
  const directory = mkdtempSync(join(tmpdir(), "verify-goal-zoom-"));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const inputPath = join(directory, "input.mp4");
  const outputPath = join(directory, "output.mp4");
  const receiptPath = join(directory, "zoom.json");
  execFileSync("ffmpeg", [
    "-hide_banner", "-loglevel", "error",
    "-f", "lavfi", "-i", "smptebars=size=1920x1080:rate=60:duration=0.2",
    "-an", "-c:v", "libx264", "-preset", "ultrafast", "-pix_fmt", "yuv420p",
    "-r", "60", "-fps_mode", "cfr", inputPath,
  ]);
  execFileSync(process.execPath, [
    "scripts/apply-shallow-zoom.ts",
    inputPath,
    outputPath,
    "960,540,0,5,6,12,1.25",
    "--receipt", receiptPath,
  ], { cwd: new URL("../..", import.meta.url) });
  const receipt = JSON.parse(readFileSync(receiptPath, "utf8")) as {
    valid: boolean;
    input: { sha256: string; frameCount: number };
    output: { sha256: string; frameCount: number };
    motion: { valid: boolean; windows: Array<{ kind: string; startFrame: number; endFrameExclusive: number }> };
  };
  assert.equal(receipt.valid, true);
  assert.equal(receipt.motion.valid, true);
  assert.equal(receipt.input.frameCount, 12);
  assert.equal(receipt.output.frameCount, 12);
  assert.notEqual(receipt.input.sha256, receipt.output.sha256);
  assert.deepEqual(receipt.motion.windows.map((window) => [window.kind, window.startFrame, window.endFrameExclusive]), [
    ["zoom", 0, 6],
    ["zoom", 6, 12],
  ]);
  const validation = probeProofVideo(outputPath);
  assert.equal(validation.valid, true, validation.failures.join("\n"));
});

test("fractional zoom timing is rejected", (t) => {
  const directory = mkdtempSync(join(tmpdir(), "verify-goal-zoom-invalid-"));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  assert.throws(() => execFileSync(process.execPath, [
    "scripts/apply-shallow-zoom.ts",
    join(directory, "input.mp4"),
    join(directory, "output.mp4"),
    "960,540,0.5,6,12,18,1.25",
  ], { cwd: new URL("../..", import.meta.url), stdio: "pipe" }), /status 1|Command failed/);
});
