#!/usr/bin/env node

import { dirname, join } from "node:path";
import { readExecutionResults, renderProofResults, writeFileAtomic } from "./lib/execution-results.ts";

const [resultsPath, outputPath] = process.argv.slice(2);
if (!resultsPath) {
  console.error("Usage: render-proof-results.ts <proof/execution-results.json> [proof/proof-results.md]");
  process.exit(2);
}

const resolvedOutput = outputPath || join(dirname(resultsPath), "proof-results.md");
const results = readExecutionResults(resultsPath);
writeFileAtomic(resolvedOutput, renderProofResults(results));
console.log(JSON.stringify({ resultsPath, outputPath: resolvedOutput, rendered: true }, null, 2));
