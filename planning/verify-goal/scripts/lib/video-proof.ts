import { spawn, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { createReadStream, promises as fs } from "node:fs";
import { dirname, extname } from "node:path";

export const PROOF_FPS = 60;
export const PROOF_WIDTH = 1920;
export const PROOF_HEIGHT = 1080;

interface ProbeStream {
  codec_type?: string;
  codec_name?: string;
  pix_fmt?: string;
  width?: number;
  height?: number;
  r_frame_rate?: string;
  avg_frame_rate?: string;
  time_base?: string;
  start_pts?: number | string;
  duration_ts?: number | string;
  nb_frames?: string;
  nb_read_frames?: string;
}

interface ProbeFormat {
  format_name?: string;
}

interface ProbeFrame {
  pts?: number | string;
  duration?: number | string;
}

interface StreamProbe {
  streams?: ProbeStream[];
  format?: ProbeFormat;
}

interface FrameProbe {
  frames?: ProbeFrame[];
}

export interface ProofVideoValidation {
  valid: boolean;
  failures: string[];
  frameCount: number;
  timeBase: string;
  frameStepPts: string;
  stream: ProbeStream | null;
  format: ProbeFormat | null;
}

export interface ProofVideoReceipt extends ProofVideoValidation {
  schemaVersion: 1;
  videoPath: string;
  sha256: string;
  byteSize: number;
  ffprobeVersion: string;
}

export function parseRational(value: string): { numerator: bigint; denominator: bigint } | null {
  const match = /^(\d+)\/(\d+)$/.exec(value);
  if (!match) return null;
  const numerator = BigInt(match[1]!);
  const denominator = BigInt(match[2]!);
  if (numerator <= 0n || denominator <= 0n) return null;
  return { numerator, denominator };
}

function integer(value: number | string | undefined): bigint | null {
  if (typeof value === "number" && Number.isSafeInteger(value)) return BigInt(value);
  if (typeof value === "string" && /^-?\d+$/.test(value)) return BigInt(value);
  return null;
}

export function validateProbeDocuments(
  videoPath: string,
  streamProbe: StreamProbe,
  frameProbe: FrameProbe,
): ProofVideoValidation {
  const failures: string[] = [];
  const streams = streamProbe.streams ?? [];
  const videoStreams = streams.filter((stream) => stream.codec_type === "video");
  const stream = videoStreams[0] ?? null;
  const format = streamProbe.format ?? null;
  const frames = frameProbe.frames ?? [];

  if (extname(videoPath).toLowerCase() !== ".mp4" || !format?.format_name?.split(",").includes("mp4")) {
    failures.push("container must be MP4");
  }
  if (streams.length !== 1 || videoStreams.length !== 1) {
    failures.push("container must have exactly one video stream and no audio or auxiliary streams");
  }
  if (stream?.codec_name !== "h264") failures.push("codec must be H.264");
  if (stream?.pix_fmt !== "yuv420p") failures.push("pixel format must be yuv420p");
  if (stream?.width !== PROOF_WIDTH || stream?.height !== PROOF_HEIGHT) {
    failures.push(`resolution must be ${PROOF_WIDTH}x${PROOF_HEIGHT}`);
  }
  if (stream?.r_frame_rate !== `${PROOF_FPS}/1`) failures.push("real frame rate must be 60/1");
  if (stream?.avg_frame_rate !== `${PROOF_FPS}/1`) failures.push("average frame rate must be 60/1");

  const timeBase = stream?.time_base ? parseRational(stream.time_base) : null;
  let frameStep: bigint | null = null;
  if (!timeBase) {
    failures.push("video stream needs a positive rational time base");
  } else if (timeBase.denominator % (BigInt(PROOF_FPS) * timeBase.numerator) !== 0n) {
    failures.push("time base cannot represent exact 1/60-second frame steps");
  } else {
    frameStep = timeBase.denominator / (BigInt(PROOF_FPS) * timeBase.numerator);
  }

  const startPts = integer(stream?.start_pts);
  if (startPts !== 0n) failures.push("video stream must start at PTS 0");
  if (frames.length === 0) failures.push("video must contain decoded frames");

  if (frameStep !== null) {
    for (let index = 0; index < frames.length; index += 1) {
      const frame = frames[index]!;
      const pts = integer(frame.pts);
      const duration = integer(frame.duration);
      const expectedPts = BigInt(index) * frameStep;
      if (pts !== expectedPts) {
        failures.push(`frame ${index} PTS must be ${expectedPts}, received ${String(frame.pts)}`);
        break;
      }
      if (duration !== frameStep) {
        failures.push(`frame ${index} duration must be ${frameStep}, received ${String(frame.duration)}`);
        break;
      }
    }

    const durationTs = integer(stream?.duration_ts);
    const expectedDuration = BigInt(frames.length) * frameStep;
    if (durationTs !== expectedDuration) {
      failures.push(`stream duration_ts must be ${expectedDuration}, received ${String(stream?.duration_ts)}`);
    }
  }

  const declaredFrames = integer(stream?.nb_frames);
  const readFrames = integer(stream?.nb_read_frames);
  if (declaredFrames !== BigInt(frames.length)) {
    failures.push(`declared frame count must equal decoded count ${frames.length}`);
  }
  if (readFrames !== BigInt(frames.length)) {
    failures.push(`ffprobe read frame count must equal decoded count ${frames.length}`);
  }

  return {
    valid: failures.length === 0,
    failures,
    frameCount: frames.length,
    timeBase: stream?.time_base ?? "",
    frameStepPts: frameStep?.toString() ?? "",
    stream,
    format,
  };
}

function runProbe(arguments_: string[]): unknown {
  const result = spawnSync("ffprobe", arguments_, {
    encoding: "utf8",
    maxBuffer: 128 * 1024 * 1024,
  });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(result.stderr.trim() || `ffprobe exited with ${result.status}`);
  return JSON.parse(result.stdout) as unknown;
}

export function probeProofVideo(videoPath: string): ProofVideoValidation {
  const streamProbe = runProbe([
    "-v", "error",
    "-count_frames",
    "-show_streams",
    "-show_format",
    "-show_entries",
    "format=format_name:stream=codec_type,codec_name,pix_fmt,width,height,r_frame_rate,avg_frame_rate,time_base,start_pts,duration_ts,nb_frames,nb_read_frames",
    "-of", "json",
    videoPath,
  ]) as StreamProbe;
  const frameProbe = runProbe([
    "-v", "error",
    "-select_streams", "v:0",
    "-show_frames",
    "-show_entries", "frame=pts,duration",
    "-of", "json",
    videoPath,
  ]) as FrameProbe;
  return validateProbeDocuments(videoPath, streamProbe, frameProbe);
}

export async function sha256File(path: string): Promise<{ sha256: string; byteSize: number }> {
  const hash = createHash("sha256");
  let byteSize = 0;
  for await (const chunk of createReadStream(path)) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    hash.update(buffer);
    byteSize += buffer.byteLength;
  }
  return { sha256: hash.digest("hex"), byteSize };
}

export function commandVersion(command: string): string {
  const result = spawnSync(command, ["-version"], { encoding: "utf8" });
  if (result.error || result.status !== 0) return "unavailable";
  return result.stdout.split(/\r?\n/, 1)[0]?.trim() ?? "unknown";
}

export async function buildProofVideoReceipt(videoPath: string): Promise<ProofVideoReceipt> {
  const validation = probeProofVideo(videoPath);
  const file = await sha256File(videoPath);
  return {
    schemaVersion: 1,
    videoPath,
    ...file,
    ffprobeVersion: commandVersion("ffprobe"),
    ...validation,
  };
}

export async function writeJsonAtomic(path: string, value: unknown): Promise<void> {
  await fs.mkdir(dirname(path), { recursive: true });
  const temporaryPath = `${path}.${process.pid}.tmp`;
  await fs.writeFile(temporaryPath, `${JSON.stringify(value, null, 2)}\n`, { encoding: "utf8", mode: 0o600 });
  await fs.rename(temporaryPath, path);
}

export interface GrayFrameActivity {
  activeTransitions: boolean[];
  changedPixels: number[];
  frameCount: number;
}

export async function decodeGrayFrameActivity(
  videoPath: string,
  width = 480,
  height = 270,
  lumaDelta = 8,
  minimumChangedPixels = 3,
): Promise<GrayFrameActivity> {
  const frameBytes = width * height;
  const child = spawn("ffmpeg", [
    "-hide_banner", "-loglevel", "error",
    "-i", videoPath,
    "-map", "0:v:0",
    "-vf", `scale=${width}:${height}:flags=area,format=gray`,
    "-fps_mode", "passthrough",
    "-f", "rawvideo",
    "-pix_fmt", "gray",
    "pipe:1",
  ], { stdio: ["ignore", "pipe", "pipe"] });
  const childClosed = new Promise<number | null>((resolve, reject) => {
    child.once("error", reject);
    child.once("close", resolve);
  });

  let pending = Buffer.alloc(0);
  let previous: Buffer | undefined;
  let frameCount = 0;
  const activeTransitions: boolean[] = [];
  const changedPixels: number[] = [];
  let stderr = "";

  child.stderr.setEncoding("utf8");
  child.stderr.on("data", (chunk: string) => {
    if (stderr.length < 1024 * 1024) stderr += chunk;
  });

  for await (const chunk of child.stdout) {
    pending = pending.length === 0 ? Buffer.from(chunk) : Buffer.concat([pending, chunk]);
    while (pending.length >= frameBytes) {
      const frame = pending.subarray(0, frameBytes);
      pending = pending.subarray(frameBytes);
      if (previous) {
        let changed = 0;
        for (let index = 0; index < frameBytes; index += 1) {
          if (Math.abs(frame[index]! - previous[index]!) >= lumaDelta) changed += 1;
        }
        changedPixels.push(changed);
        activeTransitions.push(changed >= minimumChangedPixels);
      }
      previous = Buffer.from(frame);
      frameCount += 1;
    }
  }

  const exitCode = await childClosed;
  if (exitCode !== 0) throw new Error(stderr.trim() || `ffmpeg exited with ${exitCode}`);
  if (pending.length !== 0) throw new Error(`ffmpeg returned a partial gray frame (${pending.length} bytes)`);
  return { activeTransitions, changedPixels, frameCount };
}
