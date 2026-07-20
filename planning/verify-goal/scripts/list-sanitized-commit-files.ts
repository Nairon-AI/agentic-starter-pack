#!/usr/bin/env node

import { resolve } from "node:path";
import { buildSanitizedCommitAllowlist } from "./lib/sanitized-commit.ts";

const args = process.argv.slice(2);
const goalDirectory = args.shift();
const option = (name: string, fallback: string): string => {
  const index = args.indexOf(name);
  return index >= 0 ? (args[index + 1] ?? "") : fallback;
};

if (!goalDirectory) {
  console.error("Usage: list-sanitized-commit-files.ts <goal-dir> [--policy sanitized-commit-manifest.json] [--privacy-report proof/privacy-report.json] [--agent-vision-receipt proof/automated/agent-vision-receipt.json] [--json]");
  process.exit(2);
}

const result = buildSanitizedCommitAllowlist(resolve(goalDirectory), {
  policyPath: option("--policy", "sanitized-commit-manifest.json"),
  privacyManifestPath: option("--privacy-report", "proof/privacy-report.json"),
  agentVisionReceiptPath: option("--agent-vision-receipt", "proof/automated/agent-vision-receipt.json"),
});

if (args.includes("--json")) {
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
} else {
  process.stdout.write(result.files.map((file) => file.path).join("\n"));
  if (result.files.length > 0) process.stdout.write("\n");
}
