#!/usr/bin/env node

import { existsSync, lstatSync, renameSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  approvalDigest,
  goalPaths,
  readReadiness,
  renderGoal,
  resolveInside,
  sha256File,
  sha256Text,
} from "./lib/readiness.ts";
import { validateReadiness } from "./lib/validate-readiness.ts";

const args = process.argv.slice(2);
const goalDirectory = args.shift();
const option = (name: string): string | undefined => {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : undefined;
};
const revisionText = option("--expected-revision");
const expectedSha = option("--expected-sha256");
const owner = option("--owner");
const approver = option("--approver");
const method = option("--method");

if (!goalDirectory || !revisionText || !expectedSha || !owner || !approver || !new Set(["structured-input", "typed"]).has(method ?? "")) {
  console.error("Usage: approve-readiness.ts <goal-dir> --expected-revision N --expected-sha256 HASH --owner ALIAS --approver ALIAS --method structured-input|typed");
  process.exit(2);
}

const root = resolve(goalDirectory);
const readinessPath = join(root, "verification-readiness.yaml");
const data = structuredClone(readReadiness(readinessPath));
const expectedRevision = Number(revisionText);
const now = new Date().toISOString();
const currentReadinessSha = sha256File(readinessPath);

if (currentReadinessSha !== expectedSha) throw new Error("stale readiness bytes");
if (data.workflow.revision !== expectedRevision || data.lease.revision !== expectedRevision) throw new Error("stale readiness revision");
if (data.contract.status !== "draft" || data.workflow.phase !== "authoring") throw new Error("approval requires a Draft authoring contract");
if (data.lease.state !== "active" || data.lease.owner !== owner) throw new Error("approval requires the active lease owner");
if (data.workflow.blockers.length > 0 || data.workflow.next_checks.some((check) => check !== "approval")) throw new Error("approval requires zero blockers and no remaining check except approval");

const { goal, plan } = goalPaths(readinessPath);
if (!existsSync(plan)) throw new Error("proof plan is missing");
const planValidation = spawnSync(
  process.execPath,
  [fileURLToPath(new URL("./validate-proof-plan.ts", import.meta.url)), plan, readinessPath],
  { encoding: "utf8" },
);
if (planValidation.error) throw planValidation.error;
if (planValidation.status !== 0) throw new Error(`proof plan validation failed:\n${planValidation.stderr.trim()}`);
const planSha = sha256File(plan);

data.contract.status = "verified";
data.contract.verified_at = now;
data.workflow.phase = "ready";
data.workflow.next_checks = [];
if (!data.workflow.completed_checks.includes("approval")) data.workflow.completed_checks.push("approval");
data.workflow.revision += 1;
data.workflow.updated_at = now;
data.lease.state = "released";
data.lease.released_at = now;
data.lease.revision = data.workflow.revision;
data.lease.parent_readiness_sha256 = currentReadinessSha;
data.source_hashes.proof_plan_sha256 = planSha;
data.source_hashes.checked_at = now;
data.approval = {
  status: "approved",
  approver_alias: approver,
  approved_at: now,
  method: method as "structured-input" | "typed",
  semantic_sha256: null,
  proof_plan_sha256: planSha,
};
data.approval.semantic_sha256 = approvalDigest(data, planSha);

const goalContent = renderGoal(data);
data.source_hashes.goal_sha256 = sha256Text(goalContent);

const requiredReceipts = [
  data.client.evaluation_receipt_path,
  ...data.verifiers.flatMap((verifier) => [
    verifier.installation.status === "ready" ? verifier.installation.receipt_path : null,
    verifier.smoke_test.receipt_path,
  ]),
].filter((path): path is string => Boolean(path));
for (const receipt of requiredReceipts) {
  const path = resolveInside(root, receipt);
  if (!existsSync(path)) throw new Error(`required receipt is missing: ${receipt}`);
  const stat = lstatSync(path);
  if (!stat.isFile() || stat.isSymbolicLink()) throw new Error(`receipt must be a regular non-symlink file: ${receipt}`);
}

const failures = validateReadiness(data, { readinessPath, requireReady: true, now, goalContent });
if (failures.length > 0) throw new Error(`approval validation failed:\n- ${failures.join("\n- ")}`);

const writeAtomic = (path: string, content: string): void => {
  const temporary = `${path}.${process.pid}.tmp`;
  writeFileSync(temporary, content);
  renameSync(temporary, path);
};
writeAtomic(goal, goalContent);
writeAtomic(readinessPath, `${JSON.stringify(data, null, 2)}\n`);

console.log(JSON.stringify({ readinessPath, goal, revision: data.workflow.revision, approval: data.approval }, null, 2));
import { spawnSync } from "node:child_process";
