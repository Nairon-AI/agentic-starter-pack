#!/usr/bin/env node

import { renameSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { goalPaths, readReadiness, renderGoal } from "./lib/readiness.ts";

const [readinessPath] = process.argv.slice(2);
if (!readinessPath) {
  console.error("Usage: render-goal.ts <verification-readiness.yaml>");
  process.exit(2);
}

const data = readReadiness(readinessPath);
const { goal } = goalPaths(readinessPath);
const temporary = join(goalPaths(readinessPath).root, `.GOAL.md.${process.pid}.tmp`);
writeFileSync(temporary, renderGoal(data));
renameSync(temporary, goal);
console.log(JSON.stringify({ readinessPath, goal, status: data.contract?.status }, null, 2));
