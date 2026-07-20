#!/usr/bin/env node

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { assertClientEvaluationMatches, readClientEvaluationReceipt } from "./lib/client-evaluation.ts";
import { readExecutionResults, renderProofResults } from "./lib/execution-results.ts";
import { readReadiness, renderGoal, sha256File } from "./lib/readiness.ts";
import { computeSkillRevision } from "./lib/skill-revision.ts";

const [goalSlug, ...titleWords] = process.argv.slice(2);

if (!goalSlug || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(goalSlug)) {
  console.error("Usage: create-goal-contract.ts <kebab-case-goal-slug> [title]");
  process.exit(2);
}

const skillDirectory = dirname(dirname(fileURLToPath(import.meta.url)));
const goalDirectory = resolve("goals", goalSlug);
const proofDirectory = join(goalDirectory, "proof");
const directories = ["recordings", "screenshots", "traces", "logs", "automated", "receipts", "privacy-frames"];
const suppliedTitle = titleWords.join(" ").trim();
const title = suppliedTitle || goalSlug.split("-").map((word) => word.charAt(0).toUpperCase() + word.slice(1)).join(" ");
const replacements = new Map([
  ["{{goal_slug}}", goalSlug],
  ["{{goal_title}}", title],
  ["{{created_at}}", new Date().toISOString()],
]);

mkdirSync(proofDirectory, { recursive: true });
for (const directory of directories) mkdirSync(join(proofDirectory, directory), { recursive: true });

const files: Array<readonly [string, string]> = [
  ["verification-readiness-template.yaml", join(goalDirectory, "verification-readiness.yaml")],
  ["sanitized-commit-manifest.json", join(goalDirectory, "sanitized-commit-manifest.json")],
  ["proof-plan-template.md", join(proofDirectory, "proof-plan.md")],
  ["execution-results-template.json", join(proofDirectory, "execution-results.json")],
  ["pr-attachments-template.json", join(proofDirectory, "pr-attachments.json")],
];
const createdFiles = [];
const preservedFiles = [];

for (const [templateName, outputPath] of files) {
  if (existsSync(outputPath)) {
    preservedFiles.push(outputPath);
    continue;
  }

  let content = readFileSync(join(skillDirectory, "assets", templateName), "utf8");
  for (const [placeholder, value] of replacements) content = content.replaceAll(placeholder, value);
  if (templateName.endsWith(".json") || templateName.endsWith(".yaml")) {
    content = `${JSON.stringify(JSON.parse(content), null, 2)}\n`;
  }
  writeFileSync(outputPath, content);
  createdFiles.push(outputPath);
}

const executionResultsPath = join(proofDirectory, "execution-results.json");
const proofResultsPath = join(proofDirectory, "proof-results.md");
if (!existsSync(proofResultsPath)) {
  writeFileSync(proofResultsPath, renderProofResults(readExecutionResults(executionResultsPath)));
  createdFiles.push(proofResultsPath);
} else {
  preservedFiles.push(proofResultsPath);
}

const readinessPath = join(goalDirectory, "verification-readiness.yaml");
const evaluationAssetPath = join(skillDirectory, "assets", "current-client-evaluation.json");
const evaluationReceiptPath = join(proofDirectory, "receipts", "client-evaluation.json");
if (createdFiles.includes(readinessPath) && existsSync(evaluationAssetPath)) {
  const evaluation = readClientEvaluationReceipt(evaluationAssetPath);
  const skillRevisionSha256 = computeSkillRevision(skillDirectory);
  assertClientEvaluationMatches(evaluation, {
    name: evaluation.client.name,
    version: evaluation.client.version,
    skillRevisionSha256,
  });
  writeFileSync(evaluationReceiptPath, readFileSync(evaluationAssetPath));
  createdFiles.push(evaluationReceiptPath);
  const readiness = readReadiness(readinessPath);
  readiness.client = {
    name: evaluation.client.name,
    version: evaluation.client.version,
    skill_revision_sha256: skillRevisionSha256,
    support: "supported",
    evaluation_receipt_path: "proof/receipts/client-evaluation.json",
  };
  writeFileSync(readinessPath, `${JSON.stringify(readiness, null, 2)}\n`);
}

const goalPath = join(goalDirectory, "GOAL.md");
if (!existsSync(goalPath)) {
  writeFileSync(goalPath, renderGoal(readReadiness(readinessPath)));
  createdFiles.push(goalPath);
} else {
  preservedFiles.push(goalPath);
}

console.log(JSON.stringify({ goalDirectory, proofDirectory, createdFiles, preservedFiles, directories, readiness_sha256: sha256File(readinessPath) }, null, 2));
