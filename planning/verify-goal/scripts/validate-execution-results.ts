#!/usr/bin/env node

import { basename } from "node:path";
import {
  readExecutionResults,
  resolveResultsReadiness,
  validateExecutionResults,
} from "./lib/execution-results.ts";

const args = process.argv.slice(2);
const resultsPath = args.find((arg) => !arg.startsWith("--"));
const allowBlocked = args.includes("--allow-blocked");
if (!resultsPath) {
  console.error("Usage: validate-execution-results.ts <proof/execution-results.json> [--allow-blocked]");
  process.exit(2);
}

const results = readExecutionResults(resultsPath);
const { path: readinessPath, readiness } = resolveResultsReadiness(resultsPath, results);
const failures = validateExecutionResults(results, readiness, resultsPath, { allowBlocked });
if (failures.length > 0) {
  console.error(`Execution-results validation failed for ${basename(resultsPath)}:\n- ${failures.join("\n- ")}`);
  process.exit(1);
}

console.log(JSON.stringify({ resultsPath, readinessPath, valid: true, phase: results.workflow_phase }, null, 2));
