import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { basename, dirname, join, relative, resolve, sep } from "node:path";
import type { Readiness } from "./types.ts";

export const REQUIRED = "__REQUIRED__";

export function readReadiness(path: string): Readiness {
  try {
    const content = readFileSync(path, "utf8");
    const parsed = JSON.parse(content) as Readiness;
    if (content !== `${JSON.stringify(parsed, null, 2)}\n`) {
      throw new Error("must use canonical two-space JSON with unique keys and one trailing newline");
    }
    return parsed;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`${basename(path)} must contain JSON-compatible YAML: ${message}`);
  }
}

export function sha256File(path: string): string {
  return createHash("sha256").update(readFileSync(path).toString("hex"), "hex").digest("hex");
}

export function sha256Text(content: string): string {
  return createHash("sha256").update(content, "utf8").digest("hex");
}

export function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  const entries = Object.entries(value as Record<string, unknown>).sort(([left], [right]) => left.localeCompare(right));
  return `{${entries.map(([key, item]) => `${JSON.stringify(key)}:${canonicalJson(item)}`).join(",")}}`;
}

export function semanticContract(data: Readiness, proofPlanSha256: string): unknown {
  return {
    schema_version: data.schema_version,
    client: data.client,
    contract: {
      slug: data.contract.slug,
      title: data.contract.title,
      work_type: data.contract.work_type,
      objective: data.contract.objective,
      scope: data.contract.scope,
      constraints: data.contract.constraints,
      non_goals: data.contract.non_goals,
      affected_users: data.contract.affected_users,
      affected_systems: data.contract.affected_systems,
      authority: data.contract.authority,
      residual_risks: data.contract.residual_risks,
    },
    vault: {
      provider: data.vault.provider,
      mechanism: data.vault.mechanism,
      reference_names: data.vault.reference_names,
    },
    criteria: data.criteria,
    claims: data.claims,
    capabilities: data.capabilities,
    risks: data.risks,
    verifiers: data.verifiers.map((verifier) => ({
      id: verifier.id,
      name: verifier.name,
      kind: verifier.kind,
      version: verifier.version,
      claim_ids: verifier.claim_ids,
      capability_ids: verifier.capability_ids,
      sources: verifier.sources.map((source) => ({
        url: source.url,
        authority: source.authority,
        version: source.version,
      })),
      installation: {
        source: verifier.installation.source,
        installed_by_goal: verifier.installation.installed_by_goal,
      },
      authentication: {
        route: verifier.authentication.route,
        vault_provider: verifier.authentication.vault_provider,
        reference_names: verifier.authentication.reference_names,
        identity_alias: verifier.authentication.identity_alias,
        environment: verifier.authentication.environment,
      },
      capability_proved: verifier.smoke_test.capability_proved,
      fallback_or_blocker: verifier.fallback_or_blocker,
    })),
    scenarios: data.scenarios,
    artifacts: data.artifacts,
    release: data.release,
    delivery: {
      delivery: data.evidence_lifecycle.delivery,
      provider: data.evidence_lifecycle.provider,
      attachment_visibility: data.evidence_lifecycle.attachment_visibility,
      local_video_policy: data.evidence_lifecycle.local_video_policy,
    },
    proof_plan_sha256: proofPlanSha256,
  };
}

export function approvalDigest(data: Readiness, proofPlanSha256: string): string {
  return sha256Text(canonicalJson(semanticContract(data, proofPlanSha256)));
}

export function isSafeRelativePath(path: unknown): path is string {
  if (typeof path !== "string" || path.length === 0 || path.includes("\0")) return false;
  if (path.startsWith("/") || path.startsWith("~") || /^[A-Za-z]:[\\/]/.test(path)) return false;
  const normalized = path.replaceAll("\\", "/");
  return !normalized.split("/").includes("..");
}

export function resolveInside(root: string, path: string): string {
  if (!isSafeRelativePath(path)) throw new Error(`unsafe relative path: ${path}`);
  const rootPath = resolve(root);
  const output = resolve(rootPath, path);
  const rel = relative(rootPath, output);
  if (rel === "" || (!rel.startsWith(`..${sep}`) && rel !== ".." && !rel.startsWith(sep))) return output;
  throw new Error(`path escapes goal directory: ${path}`);
}

function cell(value: unknown): string {
  const text = Array.isArray(value) ? value.join(", ") : String(value ?? "");
  return text.replaceAll("|", "\\|").replaceAll("\n", " ");
}

function bullets(values: string[]): string {
  return values.map((value) => `- ${value}`).join("\n");
}

function yamlString(value: unknown): string {
  return JSON.stringify(value ?? "");
}

export function renderGoal(data: Readiness): string {
  const { contract, workflow, research, vault, release, evidence_lifecycle: lifecycle, handoff } = data;
  const verified = contract.status === "verified";
  const heading = verified ? `# ✅ Verified Goal: ${contract.title}` : `# Draft Goal: ${contract.title}`;
  const start = verified
    ? `/goal Execute the verified goal contract at goals/${contract.slug}/GOAL.md`
    : "Unavailable while Draft. Explicit approval must mark this contract Verified first.";

  const criteria = data.criteria.map((item) =>
    `| ${cell(item.id)} | ${cell(item.description)} | ${cell(item.pass_threshold)} | ${cell(item.claim_ids)} | ${cell(item.scenario_ids)} | ${cell(item.artifact_ids)} |`,
  ).join("\n");
  const verifiers = data.verifiers.map((item) =>
    `| ${cell(item.id)} | ${cell(item.name)} | ${cell(item.kind)} | ${cell(item.version)} | ${cell(item.status)} | ${cell(item.claim_ids)} | ${cell(item.capability_ids)} | ${cell(item.authentication.route)} / ${cell(item.authentication.status)} / ${cell(item.authentication.identity_alias)} / ${cell(item.authentication.environment)} | ${cell(item.smoke_test.status)}: ${cell(item.smoke_test.capability_proved)} |`,
  ).join("\n");
  const capabilities = data.capabilities.map((item) =>
    `| ${cell(item.id)} | ${cell(item.description)} | ${cell(item.claim_ids)} | ${cell(item.verifier_id)} |`,
  ).join("\n");
  const scenarios = data.scenarios.map((item) =>
    `| ${cell(item.id)} | ${cell(item.name)} | ${cell(item.risk)} | ${cell(item.criterion_ids)} | ${cell(item.claim_ids)} | ${cell(item.artifact_ids)} | ${item.record ? "yes" : "no"} |`,
  ).join("\n");
  const artifacts = data.artifacts.map((item) =>
    `| ${cell(item.id)} | ${cell(item.type)} | ${cell(item.path)} | ${cell(item.scenario_ids)} | ${item.required ? "yes" : "no"} |`,
  ).join("\n");

  return `---
schema_version: 1
slug: ${yamlString(contract.slug)}
title: ${yamlString(contract.title)}
status: ${yamlString(contract.status)}
work_type: ${yamlString(contract.work_type)}
created_at: ${yamlString(contract.created_at)}
verified_at: ${contract.verified_at ? yamlString(contract.verified_at) : "null"}
---

${heading}

> Machine source: [\`verification-readiness.yaml\`](verification-readiness.yaml). Do not edit this rendered file by hand.

- **Approval:** ${cell(data.approval.status)} by ${cell(data.approval.approver_alias ?? "N/A")} at ${cell(data.approval.approved_at ?? "N/A")}
- **Client:** ${cell(data.client.name)} ${cell(data.client.version)} (${cell(data.client.support)})

## Objective

${contract.objective}

## Scope and constraints

### In scope

${bullets(contract.scope)}

### Constraints

${bullets(contract.constraints)}

### Non-goals

${bullets(contract.non_goals)}

- **Affected users:** ${cell(contract.affected_users)}
- **Affected systems:** ${cell(contract.affected_systems)}
- **Authority:** ${cell(contract.authority)}

## Success criteria

| ID | Observable criterion | Pass threshold | Claims | Scenarios | Artifacts |
| --- | --- | --- | --- | --- | --- |
${criteria}

## Verification capability matrix

- **Exa research:** ${cell(research.exa.status)} at ${cell(research.exa.queried_at)}
- **Repository vault:** ${cell(vault.provider)} / ${cell(vault.mechanism)} / ${cell(vault.status)}

| ID | Capability | Claims | Verifier |
| --- | --- | --- | --- |
${capabilities}

| ID | Verifier | Kind | Version | Status | Claims | Capabilities | Authentication | Capability smoke test |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
${verifiers}

## Release safety

- **Strategy:** ${release.strategy}
- **Rationale:** ${release.rationale}
- **Old/default path:** ${release.old_path}
- **New path:** ${release.new_path}
- **Transition:** ${release.transition}
- **Fallback:** ${release.fallback}
- **Telemetry:** ${release.telemetry}
- **Cleanup:** ${release.cleanup}

## Proof contract

- **Exact steps:** [\`proof/proof-plan.md\`](proof/proof-plan.md)
- **Order:** automated assertions → reset → clean scenario replay

| Scenario | Name | Risk | Criteria | Claims | Artifacts | Record |
| --- | --- | --- | --- | --- | --- | --- |
${scenarios}

| Artifact | Type | Planned path | Scenarios | Required |
| --- | --- | --- | --- | --- |
${artifacts}

## Evidence handoff and retention

- **Delivery:** ${lifecycle.delivery}
- **Provider/visibility:** ${lifecycle.provider} / ${lifecycle.attachment_visibility}
- **PR:** ${cell(lifecycle.pr_url ?? "N/A")} (${cell(lifecycle.pr_state)})
- **Local video policy:** ${lifecycle.local_video_policy}
- **Sanitized commit manifest:** [\`${lifecycle.sanitized_manifest}\`](${lifecycle.sanitized_manifest})
- PR delivery remains active through merge, remote re-download, exact SHA-256 match, receipt update, and local MP4 deletion.

## Handoff and workflow

- **Phase:** ${workflow.phase}
- **Branch:** ${handoff.branch}
- **Checkpoint commit:** ${cell(handoff.commit ?? "not published")}
- **Next action:** ${handoff.next_action}

## Residual risks

${bullets(contract.residual_risks)}

## Unresolved questions

${bullets(contract.unresolved_questions)}

## Start

${start}
`;
}

export function goalPaths(readinessPath: string): { root: string; goal: string; plan: string } {
  const root = dirname(readinessPath);
  return {
    root,
    goal: join(root, "GOAL.md"),
    plan: join(root, "proof", "proof-plan.md"),
  };
}
