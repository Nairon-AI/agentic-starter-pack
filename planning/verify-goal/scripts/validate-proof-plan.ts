#!/usr/bin/env node

import { readFileSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import { readReadiness } from "./lib/readiness.ts";

const [planPath, suppliedReadinessPath] = process.argv.slice(2);
if (!planPath) {
  console.error("Usage: validate-proof-plan.ts <proof-plan.md> [verification-readiness.yaml]");
  process.exit(2);
}

const readinessPath = suppliedReadinessPath || join(dirname(dirname(planPath)), "verification-readiness.yaml");
const readiness = readReadiness(readinessPath);
const plan = readFileSync(planPath, "utf8");
const failures = [];
const requiredSections = [
  "# Proof plan:",
  "## Proof contract",
  "## Identities and fixtures",
  "## Risk coverage",
  "## Scenario matrix",
  "## Release and transition proof",
  "## Privacy preflight",
  "## Execution order and stop conditions",
];
for (const section of requiredSections) if (!plan.includes(section)) failures.push(`missing required section: ${section}`);

const placeholders = [...plan.matchAll(/<[^>\n]+>|\{\{[^}\n]+\}\}/g)].map((match) => match[0]);
if (placeholders.length > 0) failures.push(`unresolved placeholders: ${[...new Set(placeholders)].join(", ")}`);

const scenarioSections = [...plan.matchAll(/^## Scenario (S-\d{2,}):[^\n]+\n([\s\S]*?)(?=^## Scenario S-\d{2,}:|^## Motion and emphasis plan|^## Release and transition proof|(?![\s\S]))/gm)];
const sectionMap = new Map<string, string>();
for (const match of scenarioSections) {
  const id = match[1];
  const body = match[2];
  if (id && body !== undefined) sectionMap.set(id, body);
}
const expectedIds = readiness.scenarios.map((scenario) => scenario.id);
for (const id of expectedIds) if (!sectionMap.has(id)) failures.push(`missing detailed scenario: ${id}`);
for (const id of sectionMap.keys()) if (!expectedIds.includes(id)) failures.push(`plan has unknown scenario: ${id}`);

for (const risk of readiness.risks) {
  const row = plan.split("\n").find((line) => line.startsWith("|") && line.includes(`\`${risk.id}\``));
  if (!row) {
    failures.push(`missing risk coverage row: ${risk.id}`);
    continue;
  }
  if (!row.includes(risk.disposition)) failures.push(`risk ${risk.id} disposition does not match readiness`);
  for (const scenarioId of risk.scenario_ids) if (!row.includes(`\`${scenarioId}\``)) failures.push(`risk ${risk.id} row missing scenario ${scenarioId}`);
  if (risk.disposition === "excluded" && risk.exclusion_reason && !row.includes(risk.exclusion_reason)) failures.push(`risk ${risk.id} row missing exclusion reason`);
}

const extractIds = (body: string, label: string, pattern: RegExp): string[] => {
  const line = body.match(new RegExp(`\\*\\*${label}:\\*\\*([^\\n]+)`))?.[1] ?? "";
  return [...line.matchAll(pattern)].map((match) => match[0]);
};
const equalSet = (left: string[], right: string[]): boolean => left.length === right.length && left.every((value) => right.includes(value));

for (const scenario of readiness.scenarios) {
  const body = sectionMap.get(scenario.id) ?? "";
  for (const field of ["Purpose", "Criterion IDs", "Claim IDs", "Artifact IDs", "Risk IDs", "Identity", "Preconditions", "Recording", "Cleanup/reset", "Pass condition"]) {
    if (!body.includes(`**${field}:**`)) failures.push(`scenario ${scenario.id} missing ${field}`);
  }
  if (!/^\|\s*1\s*\|/m.test(body)) failures.push(`scenario ${scenario.id} has no exact step 1`);
  const criterionIds = extractIds(body, "Criterion IDs", /SC-\d{2,}/g);
  const claimIds = extractIds(body, "Claim IDs", /CL-\d{2,}/g);
  const artifactIds = extractIds(body, "Artifact IDs", /AR-\d{2,}/g);
  const riskIds = extractIds(body, "Risk IDs", /RISK-\d{2,}/g);
  if (!equalSet(criterionIds, scenario.criterion_ids)) failures.push(`scenario ${scenario.id} criterion IDs do not match readiness`);
  if (!equalSet(claimIds, scenario.claim_ids)) failures.push(`scenario ${scenario.id} claim IDs do not match readiness`);
  if (!equalSet(artifactIds, scenario.artifact_ids)) failures.push(`scenario ${scenario.id} artifact IDs do not match readiness`);
  if (!equalSet(riskIds, scenario.risk_ids)) failures.push(`scenario ${scenario.id} risk IDs do not match readiness`);
  if (!scenario.identity_aliases.every((alias) => body.includes(`\`${alias}\``))) failures.push(`scenario ${scenario.id} identities do not match readiness`);
  if (!body.includes(scenario.preconditions)) failures.push(`scenario ${scenario.id} preconditions do not match readiness`);
  if (!body.includes(scenario.cleanup)) failures.push(`scenario ${scenario.id} cleanup does not match readiness`);
  if (!body.includes(scenario.pass_condition)) failures.push(`scenario ${scenario.id} pass condition does not match readiness`);
  for (const artifactId of scenario.artifact_ids) {
    const artifact = readiness.artifacts.find((item) => item.id === artifactId);
    if (artifact && !body.includes(artifact.path) && artifact.type !== "video") failures.push(`scenario ${scenario.id} does not name artifact path ${artifact.path}`);
    if (artifact?.type === "video" && !body.includes(artifact.path)) failures.push(`scenario ${scenario.id} does not name recording ${artifact.path}`);
  }
}

const anyVideo = readiness.scenarios.some((scenario) => scenario.record);
const applicability = plan.match(/\*\*Video applicability:\*\*\s*(yes|no)\b/i)?.[1]?.toLowerCase();
if (applicability !== (anyVideo ? "yes" : "no")) failures.push(`Video applicability must be ${anyVideo ? "yes" : "no"}`);
if (!anyVideo && !/\*\*Video applicability:\*\*\s*no\s*(?:—|-|:)\s*\S+/i.test(plan)) failures.push("video-inapplicable plan needs a reason");
if (anyVideo && !plan.includes("## Motion and emphasis plan")) failures.push("video plan needs Motion and emphasis plan");

const duration = plan.match(/\*\*Recording duration:\*\*\s*(\d+)/i)?.[1];
if (anyVideo && (!duration || Number(duration) <= 0 || Number(duration) > 300)) failures.push("video duration must be 1–300 seconds");

if (failures.length > 0) {
  console.error(`Proof plan validation failed for ${basename(planPath)}:\n- ${failures.join("\n- ")}`);
  process.exit(1);
}

console.log(JSON.stringify({ planPath, readinessPath, valid: true, scenarios: expectedIds, video: anyVideo }, null, 2));
