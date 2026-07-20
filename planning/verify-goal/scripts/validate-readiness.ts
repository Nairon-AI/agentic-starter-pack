#!/usr/bin/env node

import { basename } from "node:path";
import { readReadiness, sha256File } from "./lib/readiness.ts";
import { validateReadiness } from "./lib/validate-readiness.ts";

const [readinessPath, ...options] = process.argv.slice(2);
if (!readinessPath) {
  console.error("Usage: validate-readiness.ts <verification-readiness.yaml> [--require-ready] [--now ISO_TIMESTAMP]");
  process.exit(2);
}
const nowIndex = options.indexOf("--now");
const now = nowIndex >= 0 ? options[nowIndex + 1] : undefined;
if (nowIndex >= 0 && !now) throw new Error("--now requires an ISO timestamp");

const data = readReadiness(readinessPath);
const failures = validateReadiness(data, {
  readinessPath,
  requireReady: options.includes("--require-ready"),
  ...(now ? { now } : {}),
});

if (failures.length > 0) {
  console.error(`Readiness validation failed for ${basename(readinessPath)}:\n- ${failures.join("\n- ")}`);
  process.exit(1);
}

console.log(JSON.stringify({
  readinessPath,
  valid: true,
  status: data.contract.status,
  phase: data.workflow.phase,
  revision: data.workflow.revision,
  readiness_sha256: sha256File(readinessPath),
}, null, 2));
