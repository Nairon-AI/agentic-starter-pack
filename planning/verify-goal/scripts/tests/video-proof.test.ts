import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { parseMotionPlan, analyzeMotionQuality } from "../lib/motion-quality.ts";
import {
  decodeGrayFrameActivity,
  probeProofVideo,
  validateProbeDocuments,
} from "../lib/video-proof.ts";

function fixtureProbe(frameCount = 12) {
  const step = 256;
  return {
    streams: [{
      codec_type: "video",
      codec_name: "h264",
      pix_fmt: "yuv420p",
      width: 1920,
      height: 1080,
      r_frame_rate: "60/1",
      avg_frame_rate: "60/1",
      time_base: "1/15360",
      start_pts: 0,
      duration_ts: frameCount * step,
      nb_frames: String(frameCount),
      nb_read_frames: String(frameCount),
    }],
    format: { format_name: "mov,mp4,m4a,3gp,3g2,mj2" },
  };
}

function fixtureFrames(frameCount = 12) {
  return { frames: Array.from({ length: frameCount }, (_, index) => ({ pts: index * 256, duration: 256 })) };
}

test("exact 60fps PTS timeline passes", () => {
  const result = validateProbeDocuments("fixture.mp4", fixtureProbe(), fixtureFrames());
  assert.equal(result.valid, true);
  assert.equal(result.frameCount, 12);
  assert.equal(result.frameStepPts, "256");
});

test("metadata-only CFR cannot hide a bad PTS or frame count", () => {
  const frames = fixtureFrames();
  frames.frames[5]!.pts += 256;
  const result = validateProbeDocuments("fixture.mp4", fixtureProbe(), frames);
  assert.equal(result.valid, false);
  assert.match(result.failures.join("\n"), /frame 5 PTS/);

  const short = validateProbeDocuments("fixture.mp4", fixtureProbe(), fixtureFrames(11));
  assert.equal(short.valid, false);
  assert.match(short.failures.join("\n"), /declared frame count|duration_ts/);
});

test("audio or auxiliary streams fail the silent proof contract", () => {
  const probe = fixtureProbe();
  probe.streams.push({ codec_type: "audio" } as (typeof probe.streams)[number]);
  const result = validateProbeDocuments("fixture.mp4", probe, fixtureFrames());
  assert.equal(result.valid, false);
  assert.match(result.failures.join("\n"), /exactly one video stream/);
});

test("real ffmpeg fixture passes format, PTS, count, and motion checks", async (t) => {
  const directory = mkdtempSync(join(tmpdir(), "verify-goal-video-"));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const videoPath = join(directory, "moving.mp4");
  execFileSync("ffmpeg", [
    "-hide_banner", "-loglevel", "error",
    "-f", "lavfi", "-i", "testsrc2=size=1920x1080:rate=60:duration=0.2",
    "-an", "-c:v", "libx264", "-preset", "ultrafast", "-pix_fmt", "yuv420p",
    "-r", "60", "-fps_mode", "cfr", "-movflags", "+faststart", videoPath,
  ]);
  const validation = probeProofVideo(videoPath);
  assert.equal(validation.valid, true, validation.failures.join("\n"));
  const activity = await decodeGrayFrameActivity(videoPath);
  const fixturePath = fileURLToPath(new URL("./fixtures/motion-plan.json", import.meta.url));
  const plan = parseMotionPlan(JSON.parse(readFileSync(fixturePath, "utf8")) as unknown);
  const motion = analyzeMotionQuality(plan, activity.frameCount, activity.activeTransitions);
  assert.equal(motion.valid, true, motion.failures.join("\n"));
});

test("real static 60fps fixture fails a planned zoom-motion window", async (t) => {
  const directory = mkdtempSync(join(tmpdir(), "verify-goal-static-"));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const videoPath = join(directory, "static.mp4");
  execFileSync("ffmpeg", [
    "-hide_banner", "-loglevel", "error",
    "-f", "lavfi", "-i", "color=c=black:size=1920x1080:rate=60:duration=0.2",
    "-an", "-c:v", "libx264", "-preset", "ultrafast", "-pix_fmt", "yuv420p",
    "-r", "60", "-fps_mode", "cfr", videoPath,
  ]);
  const activity = await decodeGrayFrameActivity(videoPath);
  const motion = analyzeMotionQuality({
    schemaVersion: 1,
    fps: 60,
    windows: [{ id: "MW-STATIC-AS-MOTION", kind: "zoom", startFrame: 0, endFrameExclusive: 12 }],
  }, activity.frameCount, activity.activeTransitions);
  assert.equal(motion.valid, false);
  assert.match(motion.failures.join("\n"), /repeated\/stalled run/);
});
