import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { assertClientEvaluationMatches, readClientEvaluationReceipt } from "./client-evaluation.ts";
import { approvalDigest, REQUIRED, goalPaths, isSafeRelativePath, renderGoal, sha256File, sha256Text } from "./readiness.ts";
import type {
  Artifact,
  Capability,
  Claim,
  Criterion,
  GraphItem,
  Readiness,
  Risk,
  Scenario,
  SourceReference,
  ValidationOptions,
  Verifier,
} from "./types.ts";

const ID_PATTERNS = {
  criterion: /^SC-\d{2,}$/,
  claim: /^CL-\d{2,}$/,
  capability: /^CP-\d{2,}$/,
  risk: /^RISK-\d{2,}$/,
  verifier: /^V-\d{2,}$/,
  scenario: /^S-\d{2,}$/,
  artifact: /^AR-\d{2,}$/,
} as const;

type IdentifierKind = keyof typeof ID_PATTERNS;

function exactObjectKeys(value: unknown, expected: readonly string[], name: string, failures: string[]): void {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    failures.push(`${name} must be an object`);
    return;
  }
  const actual = Object.keys(value).sort();
  const wanted = [...expected].sort();
  for (const key of actual) if (!wanted.includes(key)) failures.push(`${name} has unexpected key: ${key}`);
  for (const key of wanted) if (!actual.includes(key)) failures.push(`${name} missing key: ${key}`);
}

function closedSchema(data: Readiness, failures: string[]): void {
  exactObjectKeys(data.client, ["name", "version", "skill_revision_sha256", "support", "evaluation_receipt_path"], "client", failures);
  exactObjectKeys(data.approval, ["status", "approver_alias", "approved_at", "method", "semantic_sha256", "proof_plan_sha256"], "approval", failures);
  exactObjectKeys(data.contract, ["slug", "title", "status", "work_type", "created_at", "verified_at", "objective", "scope", "constraints", "non_goals", "affected_users", "affected_systems", "authority", "residual_risks", "unresolved_questions"], "contract", failures);
  exactObjectKeys(data.workflow, ["phase", "revision", "updated_at", "blockers", "completed_checks", "next_checks"], "workflow", failures);
  exactObjectKeys(data.lease, ["state", "owner", "run_id", "revision", "parent_readiness_sha256", "acquired_at", "released_at", "takeovers"], "lease", failures);
  exactObjectKeys(data.source_hashes, ["goal_sha256", "proof_plan_sha256", "checked_at"], "source_hashes", failures);
  exactObjectKeys(data.research, ["exa"], "research", failures);
  exactObjectKeys(data.research?.exa, ["status", "queried_at", "sources"], "research.exa", failures);
  exactObjectKeys(data.vault, ["provider", "mechanism", "status", "checked_at", "reference_names"], "vault", failures);
  data.criteria?.forEach((item, index) => exactObjectKeys(item, ["id", "description", "pass_threshold", "claim_ids", "scenario_ids", "artifact_ids"], `criteria[${index}]`, failures));
  data.claims?.forEach((item, index) => exactObjectKeys(item, ["id", "description", "required_evidence", "capability_ids", "criterion_ids", "verifier_ids", "scenario_ids", "artifact_ids"], `claims[${index}]`, failures));
  data.capabilities?.forEach((item, index) => exactObjectKeys(item, ["id", "description", "claim_ids", "verifier_id"], `capabilities[${index}]`, failures));
  data.risks?.forEach((item, index) => exactObjectKeys(item, ["id", "description", "class", "disposition", "scenario_ids", "exclusion_reason"], `risks[${index}]`, failures));
  data.verifiers?.forEach((item, index) => {
    exactObjectKeys(item, ["id", "name", "kind", "version", "status", "claim_ids", "capability_ids", "sources", "installation", "authentication", "smoke_test", "fallback_or_blocker"], `verifiers[${index}]`, failures);
    item.sources?.forEach((source, sourceIndex) => exactObjectKeys(source, ["url", "authority", "version", "checked_at", "valid_until"], `verifiers[${index}].sources[${sourceIndex}]`, failures));
    exactObjectKeys(item.installation, ["status", "source", "installed_by_goal", "receipt_path"], `verifiers[${index}].installation`, failures);
    exactObjectKeys(item.authentication, ["route", "status", "vault_provider", "reference_names", "identity_alias", "environment", "checked_at", "expires_at", "production_approval"], `verifiers[${index}].authentication`, failures);
    if (item.authentication?.production_approval) {
      const keys = Object.keys(item.authentication.production_approval);
      if (!keys.includes("status")) failures.push(`verifiers[${index}].authentication.production_approval missing key: status`);
      for (const key of keys) if (!["status", "approved_at", "approver_alias"].includes(key)) failures.push(`verifiers[${index}].authentication.production_approval has unexpected key: ${key}`);
    }
    exactObjectKeys(item.smoke_test, ["status", "capability_proved", "checked_at", "receipt_path"], `verifiers[${index}].smoke_test`, failures);
  });
  data.scenarios?.forEach((item, index) => exactObjectKeys(item, ["id", "name", "risk", "criterion_ids", "claim_ids", "artifact_ids", "risk_ids", "identity_aliases", "preconditions", "cleanup", "pass_condition", "record"], `scenarios[${index}]`, failures));
  data.artifacts?.forEach((item, index) => exactObjectKeys(item, ["id", "type", "path", "criterion_ids", "claim_ids", "scenario_ids", "required", "retention", "privacy_status", "review_status"], `artifacts[${index}]`, failures));
  exactObjectKeys(data.release, ["strategy", "rationale", "old_path", "new_path", "transition", "fallback", "telemetry", "cleanup"], "release", failures);
  exactObjectKeys(data.evidence_lifecycle, ["delivery", "provider", "attachment_visibility", "pr_number", "pr_url", "pr_state", "local_video_policy", "sanitized_manifest"], "evidence_lifecycle", failures);
  exactObjectKeys(data.handoff, ["last_checkpoint", "branch", "commit", "next_action"], "handoff", failures);
  data.lease?.takeovers?.forEach((item, index) => exactObjectKeys(item, ["previous_owner", "previous_run_id", "successor", "reason", "at", "source_revision", "source_readiness_sha256", "goal_sha256", "proof_plan_sha256"], `lease.takeovers[${index}]`, failures));
}

function unresolved(value: unknown, path = "$"): string[] {
  if (typeof value === "string") {
    if (value === REQUIRED || /<[^>\n]+>|\{\{[^}\n]+\}\}/.test(value)) return [path];
    return [];
  }
  if (Array.isArray(value)) return value.flatMap((item, index) => unresolved(item, `${path}[${index}]`));
  if (value && typeof value === "object") {
    return Object.entries(value).flatMap(([key, item]) => unresolved(item, `${path}.${key}`));
  }
  return [];
}

function array<T>(value: unknown): T[] {
  return Array.isArray(value) ? value as T[] : [];
}

function mapById<T extends GraphItem>(items: unknown, kind: IdentifierKind, failures: string[]): Map<string, T> {
  const output = new Map<string, T>();
  for (const item of array(items)) {
    if (!item || typeof item !== "object") {
      failures.push(`${kind} entry must be an object`);
      continue;
    }
    const candidate = item as { id?: unknown };
    const id = typeof candidate.id === "string" ? candidate.id : "";
    if (!ID_PATTERNS[kind].test(id)) failures.push(`invalid ${kind} id: ${String(candidate.id)}`);
    if (output.has(id)) failures.push(`duplicate ${kind} id: ${id}`);
    output.set(id, item as T);
  }
  if (output.size === 0) failures.push(`at least one ${kind} is required`);
  const ids = [...output.keys()];
  const sorted = [...ids].sort((left, right) => left.localeCompare(right));
  if (ids.some((id, index) => id !== sorted[index])) failures.push(`${kind} entries must be sorted by id`);
  return output;
}

function requireLinks<T extends GraphItem>(
  ownerKind: string,
  owner: GraphItem,
  field: string,
  targetKind: string,
  targets: Map<string, T>,
  reverseField: string,
  failures: string[],
): void {
  const ownerRecord = owner as unknown as Record<string, unknown>;
  const ids = array<string>(ownerRecord[field]);
  if (ids.length === 0) failures.push(`${ownerKind} ${owner.id} needs ${field}`);
  if (new Set(ids).size !== ids.length) failures.push(`${ownerKind} ${owner.id} has duplicate ${field}`);
  for (const id of ids) {
    const target = targets.get(id);
    if (!target) {
      failures.push(`${ownerKind} ${owner.id} references missing ${targetKind} ${id}`);
      continue;
    }
    const targetRecord = target as unknown as Record<string, unknown>;
    if (!array<string>(targetRecord[reverseField]).includes(owner.id)) {
      failures.push(`${ownerKind} ${owner.id} → ${targetKind} ${id} missing reverse ${reverseField}`);
    }
  }
}

function validDate(value: unknown): value is string {
  return typeof value === "string" && Number.isFinite(Date.parse(value));
}

function validSource(source: unknown): source is SourceReference {
  if (!source || typeof source !== "object") return false;
  const candidate = source as Partial<SourceReference>;
  return typeof candidate.url === "string"
    && /^(https?:\/\/|repo:\/\/)/.test(candidate.url)
    && new Set(["authoritative", "discovery"]).has(candidate.authority ?? "")
    && typeof candidate.version === "string"
    && candidate.version.length > 0
    && validDate(candidate.checked_at)
    && (candidate.valid_until === null || validDate(candidate.valid_until));
}

export function validateReadiness(
  data: Readiness,
  { readinessPath, requireReady = false, now = new Date().toISOString(), goalContent }: ValidationOptions = {},
): string[] {
  const failures: string[] = [];
  const ready = requireReady || data?.contract?.status === "verified";
  const paths = readinessPath ? goalPaths(readinessPath) : null;
  if (!validDate(now)) failures.push("validation --now must be an ISO timestamp");

  if (data?.schema_version !== 1) failures.push("schema_version must be 1");
  const dataRecord = data as unknown as Record<string, unknown>;
  const topLevelKeys = ["schema_version", "client", "approval", "contract", "workflow", "lease", "source_hashes", "research", "vault", "criteria", "claims", "capabilities", "risks", "verifiers", "scenarios", "artifacts", "release", "evidence_lifecycle", "handoff"];
  for (const key of ["client", "approval", "contract", "workflow", "lease", "source_hashes", "research", "vault", "release", "evidence_lifecycle", "handoff"]) {
    if (!dataRecord[key] || typeof dataRecord[key] !== "object") failures.push(`missing object: ${key}`);
  }
  for (const key of Object.keys(dataRecord)) if (!topLevelKeys.includes(key)) failures.push(`unexpected top-level key: ${key}`);
  closedSchema(data, failures);

  const criteria = mapById<Criterion>(data?.criteria, "criterion", failures);
  const claims = mapById<Claim>(data?.claims, "claim", failures);
  const capabilities = mapById<Capability>(data?.capabilities, "capability", failures);
  const risks = mapById<Risk>(data?.risks, "risk", failures);
  const verifiers = mapById<Verifier>(data?.verifiers, "verifier", failures);
  const scenarios = mapById<Scenario>(data?.scenarios, "scenario", failures);
  const artifacts = mapById<Artifact>(data?.artifacts, "artifact", failures);

  for (const item of criteria.values()) {
    requireLinks("criterion", item, "claim_ids", "claim", claims, "criterion_ids", failures);
    requireLinks("criterion", item, "scenario_ids", "scenario", scenarios, "criterion_ids", failures);
    requireLinks("criterion", item, "artifact_ids", "artifact", artifacts, "criterion_ids", failures);
  }
  for (const item of claims.values()) {
    requireLinks("claim", item, "criterion_ids", "criterion", criteria, "claim_ids", failures);
    requireLinks("claim", item, "capability_ids", "capability", capabilities, "claim_ids", failures);
    requireLinks("claim", item, "verifier_ids", "verifier", verifiers, "claim_ids", failures);
    requireLinks("claim", item, "scenario_ids", "scenario", scenarios, "claim_ids", failures);
    requireLinks("claim", item, "artifact_ids", "artifact", artifacts, "claim_ids", failures);
  }
  for (const item of capabilities.values()) {
    requireLinks("capability", item, "claim_ids", "claim", claims, "capability_ids", failures);
    const verifier = verifiers.get(item.verifier_id);
    if (!verifier) failures.push(`capability ${item.id} references missing verifier ${item.verifier_id}`);
    else if (!verifier.capability_ids.includes(item.id)) failures.push(`capability ${item.id} → verifier ${item.verifier_id} missing reverse capability_ids`);
    for (const claimId of item.claim_ids) {
      const claim = claims.get(claimId);
      if (claim && !claim.verifier_ids.includes(item.verifier_id)) failures.push(`claim ${claimId} must link capability verifier ${item.verifier_id}`);
    }
  }
  for (const item of verifiers.values()) {
    requireLinks("verifier", item, "claim_ids", "claim", claims, "verifier_ids", failures);
    const capabilityIds = array<string>(item.capability_ids);
    if (capabilityIds.length === 0) failures.push(`verifier ${item.id} needs capability_ids`);
    for (const capabilityId of capabilityIds) {
      const capability = capabilities.get(capabilityId);
      if (!capability) failures.push(`verifier ${item.id} references missing capability ${capabilityId}`);
      else if (capability.verifier_id !== item.id) failures.push(`verifier ${item.id} has capability ${capabilityId} owned by ${capability.verifier_id}`);
    }
  }
  for (const item of risks.values()) {
    if (item.disposition === "covered") {
      requireLinks("risk", item, "scenario_ids", "scenario", scenarios, "risk_ids", failures);
      if (item.exclusion_reason !== null) failures.push(`covered risk ${item.id} cannot have exclusion_reason`);
    } else if (item.disposition === "excluded") {
      if (array<string>(item.scenario_ids).length > 0) failures.push(`excluded risk ${item.id} cannot link scenarios`);
      if (typeof item.exclusion_reason !== "string" || item.exclusion_reason.trim().length === 0) failures.push(`excluded risk ${item.id} needs a reason`);
    } else failures.push(`risk ${item.id} has invalid disposition`);
  }
  for (const item of scenarios.values()) {
    requireLinks("scenario", item, "criterion_ids", "criterion", criteria, "scenario_ids", failures);
    requireLinks("scenario", item, "claim_ids", "claim", claims, "scenario_ids", failures);
    requireLinks("scenario", item, "artifact_ids", "artifact", artifacts, "scenario_ids", failures);
    requireLinks("scenario", item, "risk_ids", "risk", risks, "scenario_ids", failures);
    const videoArtifacts = array<string>(item.artifact_ids).filter((id) => artifacts.get(id)?.type === "video");
    if (Boolean(item.record) !== (videoArtifacts.length > 0)) {
      failures.push(`scenario ${item.id} record must match linked video artifacts`);
    }
    if (array<string>(item.identity_aliases).length === 0) failures.push(`scenario ${item.id} needs identity_aliases`);
    for (const field of ["preconditions", "cleanup", "pass_condition"] as const) {
      if (typeof item[field] !== "string" || item[field].trim().length === 0) failures.push(`scenario ${item.id} needs ${field}`);
    }
  }
  for (const item of artifacts.values()) {
    requireLinks("artifact", item, "criterion_ids", "criterion", criteria, "artifact_ids", failures);
    requireLinks("artifact", item, "claim_ids", "claim", claims, "artifact_ids", failures);
    requireLinks("artifact", item, "scenario_ids", "scenario", scenarios, "artifact_ids", failures);
    if (!isSafeRelativePath(item.path)) failures.push(`artifact ${item.id} has unsafe path: ${item.path}`);
    if (item.type === "video" && !/^proof\/recordings\/\d{2}-[a-z0-9]+(?:-[a-z0-9]+)+\.mp4$/.test(item.path ?? "")) {
      failures.push(`video artifact ${item.id} needs ordered descriptive MP4 path`);
    }
    const media = item.type === "video" || item.type === "screenshot";
    const expectedRetention = data.evidence_lifecycle?.delivery === "pr" && media
      ? "pr_attachment"
      : data.evidence_lifecycle?.delivery === "no_pr" && media
        ? "local_only"
        : "commit_if_sanitized";
    if (item.retention !== expectedRetention) failures.push(`artifact ${item.id} retention must be ${expectedRetention}`);
  }

  const artifactPaths = [...artifacts.values()].map((item) => item.path);
  const normalizedPaths = artifactPaths.map((path) => path.normalize("NFC").toLocaleLowerCase("en-US"));
  if (new Set(normalizedPaths).size !== normalizedPaths.length) failures.push("artifact paths have duplicate case/Unicode-normalized values");

  const phase = data.workflow?.phase;
  if (data.contract?.status === "draft") {
    if (!new Set(["authoring", "blocked"]).has(phase)) failures.push("Draft contract phase must be authoring or blocked");
    if (data.approval?.status === "approved") failures.push("Draft contract cannot retain active approval");
    if (data.contract.verified_at !== null) failures.push("Draft contract verified_at must be null");
  } else if (data.contract?.status === "verified") {
    if (!new Set(["ready", "executing", "awaiting_merge", "complete", "blocked"]).has(phase)) failures.push("Verified contract has invalid workflow phase");
  } else failures.push("contract.status must be draft or verified");

  if (ready) {
    const unresolvedPaths = unresolved(data);
    if (unresolvedPaths.length > 0) failures.push(`unresolved values: ${unresolvedPaths.join(", ")}`);
    if (data.contract?.status !== "verified") failures.push("ready validation requires contract.status=verified");
    if (!validDate(data.contract?.created_at) || !validDate(data.contract?.verified_at)) failures.push("verified contract needs valid created_at and verified_at");
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(data.contract?.slug ?? "")) failures.push("contract slug must be kebab-case");
    if (!array<string>(data.contract?.unresolved_questions).every((item) => /^none identified\.?$/i.test(item))) {
      failures.push("verified contract cannot retain unresolved questions");
    }
    if (data.workflow?.phase === "ready" && array<string>(data.workflow?.blockers).length > 0) failures.push("ready contract cannot retain blockers");
    if (array<string>(data.workflow?.next_checks).length > 0) failures.push("verified contract cannot retain next checks");
    for (const check of ["inventory", "exa_gap_analysis", "capability_smoke_tests", "proof_plan", "approval"]) {
      if (!data.workflow.completed_checks.includes(check)) failures.push(`verified contract missing completed check: ${check}`);
    }
    if (data.client?.support !== "supported") failures.push("verified contract requires a supported current client");
    if (!isSafeRelativePath(data.client?.evaluation_receipt_path)) {
      failures.push("supported client evaluation receipt is missing");
    } else if (paths && !existsSync(join(paths.root, data.client.evaluation_receipt_path))) {
      failures.push("supported client evaluation receipt is missing");
    } else if (paths) {
      try {
        const receipt = readClientEvaluationReceipt(join(paths.root, data.client.evaluation_receipt_path));
        assertClientEvaluationMatches(receipt, {
          name: data.client.name,
          version: data.client.version,
          skillRevisionSha256: data.client.skill_revision_sha256,
        });
      } catch (error) {
        failures.push(error instanceof Error ? error.message : String(error));
      }
    }
    const exaSources = array<SourceReference>(data.research?.exa?.sources);
    if (data.research?.exa?.status !== "complete" || !validDate(data.research?.exa?.queried_at) || !exaSources.every(validSource) || exaSources.length === 0) {
      failures.push("verified contract needs completed Exa research with dated primary sources");
    }
    if (!new Set(["ready", "not_required"]).has(data.vault?.status)) failures.push("vault status must be ready or not_required");
    if (!validDate(data.vault?.checked_at)) failures.push("vault needs checked_at");

    for (const verifier of verifiers.values()) {
      if (verifier.status !== "ready") failures.push(`verifier ${verifier.id} is not ready`);
      const verifierSources = array<SourceReference>(verifier.sources);
      if (!verifierSources.every(validSource) || verifierSources.length === 0 || !verifierSources.some((source) => source.authority === "authoritative")) failures.push(`verifier ${verifier.id} needs dated authoritative sources`);
      for (const source of verifierSources) {
        if (source.valid_until && Date.parse(source.valid_until) < Date.parse(now)) failures.push(`verifier ${verifier.id} source is stale: ${source.url}`);
      }
      if (!new Set(["ready", "not_required"]).has(verifier.installation?.status)) failures.push(`verifier ${verifier.id} installation is not ready`);
      if (verifier.installation?.status === "ready") {
        const receipt = verifier.installation.receipt_path;
        if (!isSafeRelativePath(receipt) || (paths && !existsSync(join(paths.root, receipt)))) failures.push(`verifier ${verifier.id} installation receipt is missing`);
      }
      const auth = verifier.authentication ?? {};
      if (!new Set(["ready", "not_required"]).has(auth.status)) failures.push(`verifier ${verifier.id} authentication is not ready`);
      if (auth.route === "none" && auth.status !== "not_required") failures.push(`verifier ${verifier.id} none auth must be not_required`);
      if (auth.route !== "none" && auth.status !== "ready") failures.push(`verifier ${verifier.id} selected auth route must be ready`);
      if (auth.route === "vault" && data.vault?.status !== "ready") failures.push(`verifier ${verifier.id} needs a ready repository vault`);
      if (auth.environment === "production" && auth.production_approval?.status !== "approved") failures.push(`verifier ${verifier.id} production auth lacks explicit approval`);
      if (!validDate(auth.checked_at)) failures.push(`verifier ${verifier.id} auth needs checked_at`);
      if (auth.expires_at && (!validDate(auth.expires_at) || Date.parse(auth.expires_at) < Date.parse(now))) failures.push(`verifier ${verifier.id} authentication is expired`);
      if (verifier.smoke_test?.status !== "passed" || !validDate(verifier.smoke_test?.checked_at)) failures.push(`verifier ${verifier.id} capability smoke test did not pass`);
      const smokeReceipt = verifier.smoke_test?.receipt_path;
      if (!isSafeRelativePath(smokeReceipt) || (paths && !existsSync(join(paths.root, smokeReceipt)))) failures.push(`verifier ${verifier.id} smoke-test receipt is missing`);
    }

    const allowedStrategies = new Set(["flag", "cohort_canary", "shadow_dual_run", "phased_migration", "rollback_forward_fix", "none"]);
    if (!allowedStrategies.has(data.release?.strategy)) failures.push("invalid release strategy");
    const lifecycle = data.evidence_lifecycle ?? {};
    if (lifecycle.delivery === "pr" && lifecycle.local_video_policy !== "retain_until_pr_merged") failures.push("PR delivery must retain local video until PR merge");
    if (lifecycle.delivery === "pr" && (lifecycle.provider !== "github" || lifecycle.attachment_visibility !== "link_accessible")) failures.push("PR delivery supports GitHub link-accessible attachments only");
    if (lifecycle.delivery === "no_pr" && lifecycle.local_video_policy !== "retain_indefinitely") failures.push("no-PR delivery must retain local video indefinitely");
    if (lifecycle.delivery === "no_pr" && (lifecycle.provider !== "none" || lifecycle.attachment_visibility !== "none")) failures.push("no-PR delivery must use provider/visibility none");
    if (!new Set(["pr", "no_pr"]).has(lifecycle.delivery)) failures.push("delivery must be pr or no_pr");

    if (requireReady && phase !== "ready") failures.push("--require-ready requires workflow.phase=ready");
    if (["ready", "complete", "blocked"].includes(phase) && data.lease?.state !== "released") failures.push(`${phase} phase requires released lease`);
    if (["authoring", "executing", "awaiting_merge"].includes(phase) && data.lease?.state !== "active") failures.push(`${phase} phase requires active lease`);
    if (!Number.isInteger(data.workflow?.revision) || data.workflow.revision < 1 || data.lease?.revision !== data.workflow.revision) failures.push("workflow and lease revisions must match positive integer");
    if (data.workflow.revision > 1 && !/^[a-f0-9]{64}$/.test(data.lease.parent_readiness_sha256 ?? "")) failures.push("mutated readiness needs parent_readiness_sha256");
    for (const takeover of data.lease.takeovers) {
      if (![takeover.source_readiness_sha256, takeover.goal_sha256, takeover.proof_plan_sha256].every((value) => /^[a-f0-9]{64}$/.test(value))) failures.push("takeover receipt needs exact source hashes");
      if (!takeover.reason || !validDate(takeover.at)) failures.push("takeover receipt needs reason and timestamp");
    }

    const approval = data.approval;
    const proofPlanSha = paths && existsSync(paths.plan) ? sha256File(paths.plan) : data.source_hashes?.proof_plan_sha256;
    if (approval?.status !== "approved" || !approval.approver_alias || !validDate(approval.approved_at) || !approval.method || !proofPlanSha) {
      failures.push("verified contract needs explicit hash-bound approval");
    } else {
      if (approval.proof_plan_sha256 !== proofPlanSha) failures.push("approval proof-plan hash is stale");
      if (approval.semantic_sha256 !== approvalDigest(data, proofPlanSha)) failures.push("approval semantic hash is stale; return contract to Draft");
      if (data.contract.verified_at && Date.parse(data.contract.verified_at) < Date.parse(approval.approved_at)) failures.push("verified_at cannot predate approval");
    }

    if (paths) {
      const goalExists = existsSync(paths.goal);
      const planExists = existsSync(paths.plan);
      const projectedGoal = goalContent ?? (goalExists ? readFileSync(paths.goal, "utf8") : null);
      if (projectedGoal === null || !planExists) failures.push("GOAL.md and proof plan must exist");
      if (projectedGoal !== null && projectedGoal !== renderGoal(data)) failures.push("GOAL.md is stale; rerun render-goal.ts");
      if (projectedGoal !== null && data.source_hashes?.goal_sha256 !== sha256Text(projectedGoal)) failures.push("GOAL.md source hash is stale");
      if (planExists && data.source_hashes?.proof_plan_sha256 !== sha256File(paths.plan)) failures.push("proof plan source hash is stale");
      if (!validDate(data.source_hashes?.checked_at)) failures.push("source hashes need checked_at");
    }
  }

  return failures;
}
