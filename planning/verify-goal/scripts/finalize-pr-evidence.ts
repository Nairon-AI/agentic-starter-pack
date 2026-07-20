#!/usr/bin/env node

import { finalizePrEvidence } from "./lib/finalize-pr-evidence.ts";

function option(args: string[], name: string): string | undefined {
  const index = args.indexOf(name);
  if (index < 0) return undefined;
  const value = args[index + 1];
  if (!value || value.startsWith("--")) throw new Error(`${name} requires a value`);
  return value;
}

const args = process.argv.slice(2);
const resultsPath = args.find((arg, index) => !arg.startsWith("--") && (index === 0 || !args[index - 1]?.startsWith("--")));
if (!resultsPath) {
  console.error("Usage: finalize-pr-evidence.ts <proof/execution-results.json> [--fixture fixture.json] [--output proof-results.md]");
  process.exit(2);
}

try {
  const fixturePath = option(args, "--fixture");
  const markdownPath = option(args, "--output");
  const token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN;
  const results = await finalizePrEvidence({
    resultsPath,
    ...(fixturePath ? { fixturePath } : {}),
    ...(markdownPath ? { markdownPath } : {}),
    ...(token ? { token } : {}),
  });
  console.log(JSON.stringify({
    resultsPath,
    state: results.pr_evidence?.state,
    mergeSha: results.pr_evidence?.merge_sha,
    cleanup: results.pr_evidence?.attachments.map((item) => ({ artifactId: item.artifact_id, state: item.cleanup_state })),
  }, null, 2));
} catch (error) {
  console.error(`PR evidence finalization BLOCKED: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
}
