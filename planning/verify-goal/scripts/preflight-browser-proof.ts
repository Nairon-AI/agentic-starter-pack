#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { accessSync, constants, statfsSync } from "node:fs";
import { join, resolve } from "node:path";
import { nodeVersionSupported, requiredProofBytes } from "./lib/proof-preflight.ts";
import { resolveInside } from "./lib/readiness.ts";
import { writeJsonAtomic } from "./lib/video-proof.ts";

const [goalDirectory, durationText, ...flags] = process.argv.slice(2);
if (!goalDirectory || !durationText) {
  console.error("Usage: preflight-browser-proof.ts <goal-dir> <duration-seconds> [--receipt proof/receipts/browser-preflight.json]");
  process.exit(2);
}
const durationSeconds = Number(durationText);
const requiredBytes = requiredProofBytes(durationSeconds);
const receiptIndex = flags.indexOf("--receipt");
if (flags.length > 0 && (receiptIndex !== 0 || flags.length !== 2 || !flags[1])) throw new Error("invalid preflight options");
const root = resolve(goalDirectory);
const outputDirectories = [join(root, "proof", "recordings"), join(root, "proof", "privacy-frames"), join(root, "proof", "receipts")];
const checks: Array<{ name: string; status: "PASS" | "FAIL"; detail: string }> = [];

checks.push({ name: "node", status: nodeVersionSupported(process.version) ? "PASS" : "FAIL", detail: process.version });
for (const command of ["agent-browser", "ffmpeg", "ffprobe"]) {
  const args = command === "agent-browser" ? ["--version"] : ["-version"];
  const result = spawnSync(command, args, { encoding: "utf8" });
  const detail = result.error ? result.error.message : `${result.stdout}${result.stderr}`.split(/\r?\n/, 1)[0]?.trim() ?? "unknown";
  checks.push({ name: command, status: !result.error && result.status === 0 ? "PASS" : "FAIL", detail });
}
for (const directory of outputDirectories) {
  try {
    accessSync(directory, constants.R_OK | constants.W_OK);
    checks.push({ name: `writable:${directory}`, status: "PASS", detail: "read/write access" });
  } catch (error) {
    checks.push({ name: `writable:${directory}`, status: "FAIL", detail: error instanceof Error ? error.message : String(error) });
  }
}
const fileSystem = statfsSync(join(root, "proof", "recordings"), { bigint: true });
const availableBytes = fileSystem.bavail * fileSystem.bsize;
checks.push({
  name: "disk",
  status: availableBytes >= requiredBytes ? "PASS" : "FAIL",
  detail: `${availableBytes} available; ${requiredBytes} required`,
});
const headedEnvironment = String(process.env.AGENT_BROWSER_HEADED ?? "").toLowerCase();
checks.push({
  name: "headless-policy",
  status: new Set(["", "0", "false", "no"]).has(headedEnvironment) ? "PASS" : "FAIL",
  detail: "every command must set AGENT_BROWSER_HEADED=false and omit --headed",
});
const receipt = {
  schema_version: 1,
  status: checks.every((check) => check.status === "PASS") ? "PASS" : "FAIL",
  checked_at: new Date().toISOString(),
  duration_seconds: durationSeconds,
  required_bytes: requiredBytes.toString(),
  available_bytes: availableBytes.toString(),
  checks,
};
const receiptPath = resolveInside(root, flags[1] ?? "proof/receipts/browser-preflight.json");
await writeJsonAtomic(receiptPath, receipt);
console.log(JSON.stringify({ receiptPath, status: receipt.status, required_bytes: receipt.required_bytes, available_bytes: receipt.available_bytes }));
if (receipt.status !== "PASS") process.exitCode = 1;
