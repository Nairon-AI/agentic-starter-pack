#!/usr/bin/env node

import { existsSync, renameSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { approvalDigest, goalPaths, readReadiness, renderGoal, sha256File, sha256Text } from "./lib/readiness.ts";

const args = process.argv.slice(2);
const goalDirectory = args.shift();
const option = (name: string): string | undefined => {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : undefined;
};
const expectedRevisionText = option("--expected-revision");
const ownerOption = option("--owner");
const actionOption = option("--action");
const expectedSha = option("--expected-sha256");
const runIdOption = option("--run-id");

if (!goalDirectory || !expectedRevisionText || !expectedSha || !ownerOption || !actionOption || !runIdOption) {
  console.error("Usage: checkpoint-readiness.ts <goal-dir> --expected-revision N --expected-sha256 HASH --owner ALIAS --run-id ID --action checkpoint|release|acquire|takeover [--reason TEXT]");
  process.exit(2);
}

const root = resolve(goalDirectory);
const readinessPath = join(root, "verification-readiness.yaml");
const data = readReadiness(readinessPath);
const expectedRevision = Number(expectedRevisionText);
const owner = ownerOption;
const action = actionOption;
const runId = runIdOption;
const reason = option("--reason") || "";
const now = new Date().toISOString();
const planPath = join(root, "proof", "proof-plan.md");
let approvalInvalidated = false;
const currentReadinessSha = sha256File(readinessPath);

if (currentReadinessSha !== expectedSha) throw new Error(`stale readiness bytes: expected ${expectedSha}, current ${currentReadinessSha}`);

if (data.workflow.revision !== expectedRevision || data.lease.revision !== expectedRevision) {
  throw new Error(`stale revision: expected ${expectedRevision}, workflow=${data.workflow.revision}, lease=${data.lease.revision}`);
}

const currentPaths = goalPaths(readinessPath);
if (data.source_hashes.goal_sha256 && (!existsSync(currentPaths.goal) || sha256File(currentPaths.goal) !== data.source_hashes.goal_sha256)) throw new Error("GOAL.md source hash changed outside the current readiness revision");
if (data.source_hashes.proof_plan_sha256
  && (!existsSync(currentPaths.plan) || sha256File(currentPaths.plan) !== data.source_hashes.proof_plan_sha256)
  && new Set(["acquire", "takeover"]).has(action)) {
  throw new Error("cannot acquire or take over readiness with an uncheckpointed proof-plan change");
}

if (data.approval.status === "approved" && existsSync(planPath)) {
  const planSha = sha256File(planPath);
  const currentDigest = approvalDigest(data, planSha);
  if (data.approval.proof_plan_sha256 !== planSha || data.approval.semantic_sha256 !== currentDigest) {
    data.approval.status = "invalidated";
    data.contract.status = "draft";
    data.contract.verified_at = null;
    data.workflow.phase = "authoring";
    if (!data.workflow.next_checks.includes("approval")) data.workflow.next_checks.push("approval");
    approvalInvalidated = true;
  }
}

if (action === "checkpoint") {
  if (data.lease.state !== "active" || data.lease.owner !== owner || data.lease.run_id !== runId) throw new Error("checkpoint requires the active lease owner and run id");
} else if (action === "release") {
  if (data.lease.state !== "active" || data.lease.owner !== owner || data.lease.run_id !== runId) throw new Error("release requires the active lease owner and run id");
  data.lease.state = "released";
  data.lease.released_at = now;
} else if (action === "acquire") {
  if (data.lease.state !== "released") throw new Error("acquire requires a released lease");
  data.lease.state = "active";
  data.lease.owner = owner;
  data.lease.run_id = runId;
  data.lease.acquired_at = now;
  data.lease.released_at = null;
} else if (action === "takeover") {
  if (!reason) throw new Error("takeover requires --reason");
  data.lease.takeovers.push({
    previous_owner: data.lease.owner,
    previous_run_id: data.lease.run_id,
    successor: owner,
    reason,
    at: now,
    source_revision: expectedRevision,
    source_readiness_sha256: currentReadinessSha,
    goal_sha256: data.source_hashes.goal_sha256 ?? sha256File(currentPaths.goal),
    proof_plan_sha256: data.source_hashes.proof_plan_sha256 ?? sha256File(currentPaths.plan),
  });
  data.lease.state = "active";
  data.lease.owner = owner;
  data.lease.run_id = runId;
  data.lease.acquired_at = now;
  data.lease.released_at = null;
} else {
  throw new Error(`unknown action: ${action}`);
}

data.workflow.revision += 1;
data.workflow.updated_at = now;
data.lease.revision = data.workflow.revision;
data.lease.parent_readiness_sha256 = currentReadinessSha;

const writeAtomic = (path: string, content: string): void => {
  const temporary = `${path}.${process.pid}.tmp`;
  writeFileSync(temporary, content);
  renameSync(temporary, path);
};

const { goal, plan } = goalPaths(readinessPath);
const goalContent = renderGoal(data);
data.source_hashes = {
  goal_sha256: sha256Text(goalContent),
  proof_plan_sha256: sha256File(plan),
  checked_at: now,
};
writeAtomic(goal, goalContent);
writeAtomic(readinessPath, `${JSON.stringify(data, null, 2)}\n`);

console.log(JSON.stringify({ readinessPath, action, owner, runId: data.lease.run_id, revision: data.workflow.revision, readiness_sha256: sha256File(readinessPath), approval_invalidated: approvalInvalidated, source_hashes: data.source_hashes }, null, 2));
