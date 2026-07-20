#!/usr/bin/env node

import { readFileSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import { readReadiness, renderGoal } from "./lib/readiness.ts";
import { validateReadiness } from "./lib/validate-readiness.ts";

const [goalPath] = process.argv.slice(2);
if (!goalPath) {
  console.error("Usage: validate-goal-contract.ts <GOAL.md>");
  process.exit(2);
}

const readinessPath = join(dirname(goalPath), "verification-readiness.yaml");
const readiness = readReadiness(readinessPath);
const actual = readFileSync(goalPath, "utf8");
const expected = renderGoal(readiness);
const failures = validateReadiness(readiness, {
  readinessPath,
  requireReady: readiness.contract.status === "verified" && readiness.workflow.phase === "ready",
});

if (actual !== expected) failures.push("GOAL.md does not exactly match its readiness source; rerun render-goal.ts");

if (failures.length > 0) {
  console.error(`Goal contract validation failed for ${basename(goalPath)}:\n- ${failures.join("\n- ")}`);
  process.exit(1);
}

console.log(JSON.stringify({
  goalPath,
  readinessPath,
  valid: true,
  status: readiness.contract.status,
  phase: readiness.workflow.phase,
  revision: readiness.workflow.revision,
}, null, 2));
