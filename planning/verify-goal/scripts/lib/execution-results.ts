import { createHash } from "node:crypto";
import {
  closeSync,
  existsSync,
  fsyncSync,
  lstatSync,
  openSync,
  readFileSync,
  renameSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { assertAgentVisionPass } from "./agent-vision.ts";
import { readReadiness, resolveInside, sha256File } from "./readiness.ts";
import type { Readiness } from "./types.ts";

export type ProofResult = "PASS" | "FAIL" | "BLOCKED";
export type ResultsPhase = "executing" | "awaiting_merge" | "complete" | "blocked";
export type ReceiptKind =
  | "automated_assertion"
  | "capability_revalidation"
  | "artifact"
  | "privacy_scan"
  | "visual_review"
  | "motion_quality"
  | "github_upload"
  | "github_merge";
export type PrEvidenceState =
  | "not_uploaded"
  | "awaiting_merge"
  | "verified_pending_cleanup"
  | "complete"
  | "blocked";
export type CleanupState = "retained" | "verified_pending_cleanup" | "deleted" | "not_applicable";

export interface SourceBinding {
  readiness_path: string;
  readiness_sha256: string;
  proof_plan_path: string;
  proof_plan_sha256: string;
}

export interface Receipt {
  id: string;
  kind: ReceiptKind;
  status: "valid";
  checked_at: string;
  summary: string;
  criterion_ids: string[];
  scenario_ids: string[];
  verifier_ids: string[];
  artifact_ids: string[];
  path: string | null;
  byte_size: number | null;
  sha256: string | null;
}

export interface CriterionResult {
  id: string;
  result: ProofResult;
  claim_ids: string[];
  scenario_ids: string[];
  artifact_ids: string[];
  receipt_ids: string[];
}

export interface ScenarioResult {
  id: string;
  result: ProofResult;
  criterion_ids: string[];
  claim_ids: string[];
  verifier_ids: string[];
  artifact_ids: string[];
  receipt_ids: string[];
  notes: string;
}

export interface VerifierResult {
  id: string;
  result: ProofResult;
  claim_ids: string[];
  auth_status: "valid" | "not_required" | "invalid";
  smoke_status: "PASS" | "FAIL";
  version: string;
  environment: string;
  receipt_ids: string[];
}

export interface ArtifactResult {
  id: string;
  result: ProofResult;
  path: string;
  criterion_ids: string[];
  claim_ids: string[];
  scenario_ids: string[];
  receipt_ids: string[];
  byte_size: number;
  sha256: string;
}

export interface AttachmentReceipt {
  artifact_id: string;
  local_path: string;
  remote_url: string;
  local_byte_size: number;
  local_sha256: string;
  remote_byte_size: number | null;
  remote_sha256: string | null;
  verified_at: string | null;
  cleanup_state: CleanupState;
  cleaned_at: string | null;
}

export interface PrEvidence {
  provider: "github";
  state: PrEvidenceState;
  repository: string;
  pr_number: number | null;
  pr_url: string | null;
  comment_url: string | null;
  tested_head_sha: string;
  merge_sha: string | null;
  checked_at: string | null;
  blocker: string | null;
  attachments: AttachmentReceipt[];
}

export interface ExecutionResults {
  schema_version: 1;
  goal: {
    slug: string;
    title: string;
    source_binding: SourceBinding;
    tested_commit: string;
    environment: string;
    executed_by: string;
    started_at: string;
    completed_at: string | null;
  };
  overall_result: ProofResult;
  workflow_phase: ResultsPhase;
  receipts: Receipt[];
  criterion_results: CriterionResult[];
  scenario_results: ScenarioResult[];
  verifier_results: VerifierResult[];
  artifact_results: ArtifactResult[];
  privacy: {
    status: "PASS" | "FAIL" | "N/A";
    automated_receipt_id: string | null;
    visual_review_receipt_id: string | null;
    motion_receipt_ids: string[];
  };
  deviations: string[];
  residual_risks: string[];
  failed_attempt_summary: string[];
  pr_evidence: PrEvidence | null;
}

const SHA_PATTERN = /^[a-f0-9]{64}$/;
const COMMIT_PATTERN = /^(?:[a-f0-9]{40}|[a-f0-9]{64})$/;
const ID_PATTERNS = {
  criterion: /^SC-\d{2,}$/,
  scenario: /^S-\d{2,}$/,
  verifier: /^V-\d{2,}$/,
  artifact: /^AR-\d{2,}$/,
  receipt: /^R-\d{2,}$/,
} as const;
const RECEIPT_KINDS = new Set<ReceiptKind>([
  "automated_assertion",
  "capability_revalidation",
  "artifact",
  "privacy_scan",
  "visual_review",
  "motion_quality",
  "github_upload",
  "github_merge",
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function array<T>(value: unknown): T[] {
  return Array.isArray(value) ? value as T[] : [];
}

function validDate(value: unknown): value is string {
  return typeof value === "string" && Number.isFinite(Date.parse(value));
}

function equalSet(left: string[], right: string[]): boolean {
  return left.length === right.length && new Set(left).size === left.length && left.every((id) => right.includes(id));
}

function mapExact<T extends { id: string }>(
  values: unknown,
  expected: string[],
  kind: keyof typeof ID_PATTERNS,
  failures: string[],
): Map<string, T> {
  const output = new Map<string, T>();
  for (const value of array<unknown>(values)) {
    if (!isRecord(value) || typeof value.id !== "string" || !ID_PATTERNS[kind].test(value.id)) {
      failures.push(`invalid ${kind} result id: ${isRecord(value) ? String(value.id) : String(value)}`);
      continue;
    }
    if (output.has(value.id)) failures.push(`duplicate ${kind} result: ${value.id}`);
    output.set(value.id, value as unknown as T);
  }
  const actual = [...output.keys()];
  if (!equalSet(actual, expected)) failures.push(`${kind} results must exactly cover readiness IDs; expected ${expected.join(", ") || "none"}`);
  return output;
}

function safeHashFile(path: string): { byteSize: number; sha256: string; symlink: boolean } | null {
  try {
    const stat = lstatSync(path);
    if (!stat.isFile()) return null;
    return { byteSize: stat.size, sha256: sha256File(path), symlink: stat.isSymbolicLink() };
  } catch {
    return null;
  }
}

function validateReceiptLinks(
  owner: { id: string; receipt_ids: string[] },
  kind: "criterion" | "scenario" | "verifier" | "artifact",
  receipts: Map<string, Receipt>,
  failures: string[],
): void {
  const ids = array<string>(owner.receipt_ids);
  if (ids.length === 0 || new Set(ids).size !== ids.length) failures.push(`${kind} ${owner.id} needs unique receipt_ids`);
  const linkField = `${kind}_ids` as "criterion_ids" | "scenario_ids" | "verifier_ids" | "artifact_ids";
  for (const id of ids) {
    const receipt = receipts.get(id);
    if (!receipt) failures.push(`${kind} ${owner.id} references missing valid receipt ${id}`);
    else if (!array<string>(receipt[linkField]).includes(owner.id)) failures.push(`receipt ${id} lacks reverse ${linkField} link to ${owner.id}`);
  }
}

function validateReceiptFiles(receipts: Map<string, Receipt>, root: string, failures: string[]): void {
  for (const receipt of receipts.values()) {
    if (receipt.status !== "valid") failures.push(`receipt ${receipt.id} status must be valid`);
    if (!RECEIPT_KINDS.has(receipt.kind)) failures.push(`receipt ${receipt.id} has invalid kind: ${String(receipt.kind)}`);
    if (!validDate(receipt.checked_at)) failures.push(`receipt ${receipt.id} needs valid checked_at`);
    if (typeof receipt.summary !== "string" || receipt.summary.trim() === "") failures.push(`receipt ${receipt.id} needs summary`);
    for (const field of ["criterion_ids", "scenario_ids", "verifier_ids", "artifact_ids"] as const) {
      const values = array<string>(receipt[field]);
      if (new Set(values).size !== values.length) failures.push(`receipt ${receipt.id} has duplicate ${field}`);
    }
    if (receipt.path === null) {
      if (receipt.byte_size !== null || receipt.sha256 !== null) failures.push(`receipt ${receipt.id} null path requires null size/hash`);
      if (!new Set<ReceiptKind>(["github_upload", "github_merge"]).has(receipt.kind)) failures.push(`receipt ${receipt.id} kind ${receipt.kind} requires a hashed receipt file`);
      continue;
    }
    try {
      const path = resolveInside(root, receipt.path);
      const actual = safeHashFile(path);
      if (!actual || actual.symlink) failures.push(`receipt ${receipt.id} path must be an existing non-symlink file`);
      else {
        if (receipt.byte_size !== actual.byteSize) failures.push(`receipt ${receipt.id} byte_size mismatch`);
        if (receipt.sha256 !== actual.sha256) failures.push(`receipt ${receipt.id} sha256 mismatch`);
      }
    } catch (error) {
      failures.push(`receipt ${receipt.id} path invalid: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}

function validateMotionReceipt(receipt: Receipt, artifact: ArtifactResult, root: string, failures: string[]): void {
  if (!receipt.path) {
    failures.push(`motion receipt ${receipt.id} needs a hashed file`);
    return;
  }
  try {
    const parsed = JSON.parse(readFileSync(resolveInside(root, receipt.path), "utf8")) as Record<string, unknown>;
    const policy = isRecord(parsed.policy) ? parsed.policy : {};
    const windows = array<Record<string, unknown>>(parsed.windows);
    if (parsed.schemaVersion !== 1 || parsed.valid !== true || array(parsed.failures).length !== 0) failures.push(`motion receipt ${receipt.id} must be schema 1 PASS`);
    if (parsed.videoSha256 !== artifact.sha256 || !Number.isSafeInteger(parsed.decodedFrameCount) || Number(parsed.decodedFrameCount) <= 0) {
      failures.push(`motion receipt ${receipt.id} does not bind a decoded video result`);
    }
    if (policy.fps !== 60 || policy.maximumRepeatedFrameRun !== 2) failures.push(`motion receipt ${receipt.id} must enforce exact 60fps and two-frame maximum repeat`);
    if (windows.length === 0 || windows.some((window) => window.status !== "passed" && window.status !== "excluded_static")) {
      failures.push(`motion receipt ${receipt.id} needs passing planned motion/static windows`);
    }
  } catch (error) {
    failures.push(`motion receipt ${receipt.id} invalid: ${error instanceof Error ? error.message : String(error)}`);
  }
}

export function readExecutionResults(path: string): ExecutionResults {
  try {
    return JSON.parse(readFileSync(path, "utf8")) as ExecutionResults;
  } catch (error) {
    throw new Error(`${basename(path)} must be valid JSON: ${error instanceof Error ? error.message : String(error)}`);
  }
}

export function hashBytes(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

export function validateExecutionResults(
  data: ExecutionResults,
  readiness: Readiness,
  resultsPath: string,
  { allowBlocked = false }: { allowBlocked?: boolean } = {},
): string[] {
  const failures: string[] = [];
  const root = resolve(dirname(dirname(resultsPath)));
  if (data?.schema_version !== 1) failures.push("schema_version must be 1");
  if (data?.goal?.slug !== readiness.contract.slug) failures.push("goal.slug must match readiness");
  if (data?.goal?.title !== readiness.contract.title) failures.push("goal.title must match readiness");
  if (!COMMIT_PATTERN.test(data?.goal?.tested_commit ?? "")) failures.push("goal.tested_commit must be a full 40- or 64-character commit SHA");
  if (!validDate(data?.goal?.started_at)) failures.push("goal.started_at must be a valid timestamp");
  if (data?.goal?.completed_at !== null && !validDate(data.goal.completed_at)) failures.push("goal.completed_at must be null or valid timestamp");
  if (typeof data?.goal?.environment !== "string" || data.goal.environment.trim() === "") failures.push("goal.environment is required");
  if (typeof data?.goal?.executed_by !== "string" || data.goal.executed_by.trim() === "") failures.push("goal.executed_by is required");

  const binding = data?.goal?.source_binding;
  if (!isRecord(binding)) failures.push("goal.source_binding is required");
  else {
    try {
      const readinessPath = resolveInside(root, String(binding.readiness_path ?? ""));
      const planPath = resolveInside(root, String(binding.proof_plan_path ?? ""));
      if (readinessPath !== join(root, "verification-readiness.yaml")) failures.push("source_binding.readiness_path must be verification-readiness.yaml");
      if (planPath !== join(root, "proof", "proof-plan.md")) failures.push("source_binding.proof_plan_path must be proof/proof-plan.md");
      if (!existsSync(readinessPath) || binding.readiness_sha256 !== sha256File(readinessPath)) failures.push("source_binding readiness SHA-256 is stale");
      if (!existsSync(planPath) || binding.proof_plan_sha256 !== sha256File(planPath)) failures.push("source_binding proof-plan SHA-256 is stale");
      if (readiness.source_hashes.proof_plan_sha256 && binding.proof_plan_sha256 !== readiness.source_hashes.proof_plan_sha256) {
        failures.push("source_binding proof-plan SHA-256 differs from readiness source hash");
      }
    } catch (error) {
      failures.push(`invalid source binding: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  if (!allowBlocked && data?.overall_result !== "PASS") failures.push("overall_result must be PASS");
  if (!allowBlocked && !["awaiting_merge", "complete"].includes(data?.workflow_phase)) failures.push("passing results phase must be awaiting_merge or complete");

  const receipts = mapExact<Receipt>(data?.receipts, array<Receipt>(data?.receipts).map((item) => item.id), "receipt", failures);
  validateReceiptFiles(receipts, root, failures);

  const criterionResults = mapExact<CriterionResult>(data?.criterion_results, readiness.criteria.map((item) => item.id), "criterion", failures);
  const scenarioResults = mapExact<ScenarioResult>(data?.scenario_results, readiness.scenarios.map((item) => item.id), "scenario", failures);
  const verifierResults = mapExact<VerifierResult>(data?.verifier_results, readiness.verifiers.map((item) => item.id), "verifier", failures);
  const artifactResults = mapExact<ArtifactResult>(data?.artifact_results, readiness.artifacts.map((item) => item.id), "artifact", failures);

  for (const receipt of receipts.values()) {
    const linked: Array<readonly [string, Map<string, { receipt_ids: string[] }>]> = [
      ...receipt.criterion_ids.map((id) => [id, criterionResults] as const),
      ...receipt.scenario_ids.map((id) => [id, scenarioResults] as const),
      ...receipt.verifier_ids.map((id) => [id, verifierResults] as const),
      ...receipt.artifact_ids.map((id) => [id, artifactResults] as const),
    ];
    if (linked.length === 0) failures.push(`receipt ${receipt.id} must link at least one readiness graph result`);
    for (const [id, results] of linked) {
      const result = results.get(id);
      if (!result) failures.push(`receipt ${receipt.id} links unknown graph result ${id}`);
      else if (!result.receipt_ids.includes(receipt.id)) failures.push(`receipt ${receipt.id} lacks reverse result link from ${id}`);
    }
  }

  for (const criterion of readiness.criteria) {
    const result = criterionResults.get(criterion.id);
    if (!result) continue;
    if (result.result !== "PASS") failures.push(`criterion ${result.id} result must be PASS`);
    if (!equalSet(array<string>(result.claim_ids), criterion.claim_ids)) failures.push(`criterion ${result.id} claim_ids mismatch`);
    if (!equalSet(array<string>(result.scenario_ids), criterion.scenario_ids)) failures.push(`criterion ${result.id} scenario_ids mismatch`);
    if (!equalSet(array<string>(result.artifact_ids), criterion.artifact_ids)) failures.push(`criterion ${result.id} artifact_ids mismatch`);
    validateReceiptLinks(result, "criterion", receipts, failures);
  }

  for (const scenario of readiness.scenarios) {
    const result = scenarioResults.get(scenario.id);
    if (!result) continue;
    const expectedVerifiers = [...new Set(readiness.claims.filter((claim) => scenario.claim_ids.includes(claim.id)).flatMap((claim) => claim.verifier_ids))];
    if (result.result !== "PASS") failures.push(`scenario ${result.id} result must be PASS`);
    if (!equalSet(array<string>(result.criterion_ids), scenario.criterion_ids)) failures.push(`scenario ${result.id} criterion_ids mismatch`);
    if (!equalSet(array<string>(result.claim_ids), scenario.claim_ids)) failures.push(`scenario ${result.id} claim_ids mismatch`);
    if (!equalSet(array<string>(result.verifier_ids), expectedVerifiers)) failures.push(`scenario ${result.id} verifier_ids mismatch`);
    if (!equalSet(array<string>(result.artifact_ids), scenario.artifact_ids)) failures.push(`scenario ${result.id} artifact_ids mismatch`);
    if (typeof result.notes !== "string") failures.push(`scenario ${result.id} notes must be a string`);
    validateReceiptLinks(result, "scenario", receipts, failures);
  }

  for (const verifier of readiness.verifiers) {
    const result = verifierResults.get(verifier.id);
    if (!result) continue;
    if (result.result !== "PASS") failures.push(`verifier ${result.id} result must be PASS`);
    if (!equalSet(array<string>(result.claim_ids), verifier.claim_ids)) failures.push(`verifier ${result.id} claim_ids mismatch`);
    if (!new Set(["valid", "not_required"]).has(result.auth_status)) failures.push(`verifier ${result.id} auth_status must be valid/not_required`);
    if (result.smoke_status !== "PASS") failures.push(`verifier ${result.id} smoke_status must be PASS`);
    if (result.version !== verifier.version) failures.push(`verifier ${result.id} version differs from readiness`);
    if (typeof result.environment !== "string" || result.environment.trim() === "") failures.push(`verifier ${result.id} environment is required`);
    validateReceiptLinks(result, "verifier", receipts, failures);
  }

  const attachmentMap = new Map((data.pr_evidence?.attachments ?? []).map((item) => [item.artifact_id, item]));
  for (const artifact of readiness.artifacts) {
    const result = artifactResults.get(artifact.id);
    if (!result) continue;
    if (result.result !== "PASS") failures.push(`artifact ${result.id} result must be PASS`);
    if (result.path !== artifact.path) failures.push(`artifact ${result.id} path differs from readiness`);
    if (!equalSet(array<string>(result.criterion_ids), artifact.criterion_ids)) failures.push(`artifact ${result.id} criterion_ids mismatch`);
    if (!equalSet(array<string>(result.claim_ids), artifact.claim_ids)) failures.push(`artifact ${result.id} claim_ids mismatch`);
    if (!equalSet(array<string>(result.scenario_ids), artifact.scenario_ids)) failures.push(`artifact ${result.id} scenario_ids mismatch`);
    if (!Number.isSafeInteger(result.byte_size) || result.byte_size < 0 || !SHA_PATTERN.test(result.sha256)) failures.push(`artifact ${result.id} needs byte_size and SHA-256`);
    validateReceiptLinks(result, "artifact", receipts, failures);
    try {
      const actual = safeHashFile(resolveInside(root, result.path));
      const deletedVideo = artifact.type === "video" && attachmentMap.get(artifact.id)?.cleanup_state === "deleted";
      const pendingMissingVideo = artifact.type === "video"
        && data.pr_evidence?.state === "verified_pending_cleanup"
        && attachmentMap.get(artifact.id)?.cleanup_state === "verified_pending_cleanup";
      if (!actual && !deletedVideo && !pendingMissingVideo) failures.push(`artifact ${result.id} file is missing`);
      if (actual?.symlink) failures.push(`artifact ${result.id} must not be a symlink`);
      if (actual && (actual.byteSize !== result.byte_size || actual.sha256 !== result.sha256)) failures.push(`artifact ${result.id} file size/hash mismatch`);
    } catch (error) {
      failures.push(`artifact ${result.id} path invalid: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  const visualArtifacts = readiness.artifacts.filter((item) => item.type === "video" || item.type === "screenshot");
  const videoArtifacts = readiness.artifacts.filter((item) => item.type === "video");
  const receiptKind = (id: string | null): ReceiptKind | null => id ? receipts.get(id)?.kind ?? null : null;
  if (visualArtifacts.length > 0) {
    if (data.privacy?.status !== "PASS") failures.push("visual evidence requires privacy.status=PASS");
    if (receiptKind(data.privacy?.automated_receipt_id) !== "privacy_scan") failures.push("visual evidence requires valid automated privacy receipt");
    if (receiptKind(data.privacy?.visual_review_receipt_id) !== "visual_review") failures.push("visual evidence requires valid full visual-review receipt");
    const automated = data.privacy?.automated_receipt_id ? receipts.get(data.privacy.automated_receipt_id) : undefined;
    const visual = data.privacy?.visual_review_receipt_id ? receipts.get(data.privacy.visual_review_receipt_id) : undefined;
    if (automated?.path !== "proof/privacy-report.json" || visual?.path !== "proof/automated/agent-vision-receipt.json") {
      failures.push("visual privacy receipts must use the canonical privacy report and agent-vision receipt paths");
    } else {
      try {
        const allowMissingPaths = new Set((data.pr_evidence?.attachments ?? [])
          .filter((item) => item.cleanup_state === "deleted" || item.cleanup_state === "verified_pending_cleanup")
          .map((item) => item.local_path));
        assertAgentVisionPass(root, automated.path, visual.path, { allowMissingPaths });
      } catch (error) {
        failures.push(`agent-vision privacy gate failed: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
  } else if (data.privacy?.status !== "N/A") failures.push("nonvisual proof privacy.status must be N/A");
  if (videoArtifacts.length > 0) {
    const motionIds = array<string>(data.privacy?.motion_receipt_ids);
    if (motionIds.length === 0 || motionIds.some((id) => receipts.get(id)?.kind !== "motion_quality")) failures.push("video evidence requires valid motion-quality receipt(s)");
    const coveredVideoIds: string[] = [];
    for (const id of motionIds) {
      const receipt = receipts.get(id);
      if (!receipt || receipt.kind !== "motion_quality") continue;
      if (receipt.artifact_ids.length !== 1) {
        failures.push(`motion receipt ${id} must bind exactly one video artifact`);
        continue;
      }
      const artifact = artifactResults.get(receipt.artifact_ids[0]!);
      if (!artifact || !videoArtifacts.some((item) => item.id === artifact.id)) failures.push(`motion receipt ${id} must bind a planned video artifact`);
      else {
        coveredVideoIds.push(artifact.id);
        validateMotionReceipt(receipt, artifact, root, failures);
      }
    }
    if (!equalSet(coveredVideoIds, videoArtifacts.map((item) => item.id))) failures.push("motion receipts must exactly cover every planned video");
  }

  validatePrEvidence(data, readiness, root, attachmentMap, failures);
  for (const field of ["deviations", "residual_risks", "failed_attempt_summary"] as const) {
    if (!Array.isArray(data?.[field]) || data[field].some((item) => typeof item !== "string")) failures.push(`${field} must be a string array`);
  }
  return failures;
}

function validatePrEvidence(
  data: ExecutionResults,
  readiness: Readiness,
  root: string,
  attachmentMap: Map<string, AttachmentReceipt>,
  failures: string[],
): void {
  const delivery = readiness.evidence_lifecycle.delivery;
  const evidence = data.pr_evidence;
  if (delivery === "no_pr") {
    if (evidence !== null) failures.push("no_pr delivery requires pr_evidence=null");
    if (data.workflow_phase !== "complete") failures.push("no_pr passing results must be complete");
    return;
  }
  if (delivery !== "pr") {
    failures.push("readiness delivery must be pr or no_pr");
    return;
  }
  if (!evidence) {
    failures.push("PR delivery requires pr_evidence");
    return;
  }
  if (evidence.provider !== "github") failures.push("only GitHub PR evidence is supported");
  if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(evidence.repository)) failures.push("pr_evidence.repository must be owner/name");
  if (!Number.isSafeInteger(evidence.pr_number) || Number(evidence.pr_number) < 1) failures.push("pr_evidence.pr_number must be positive integer");
  const canonicalPrUrl = `https://github.com/${evidence.repository}/pull/${evidence.pr_number}`;
  if (evidence.pr_url !== canonicalPrUrl) failures.push("pr_evidence.pr_url must be canonical GitHub PR URL");
  if (typeof evidence.comment_url !== "string" || !evidence.comment_url.startsWith(`${canonicalPrUrl}#issuecomment-`)) failures.push("pr_evidence.comment_url must identify the evidence comment");
  if (evidence.tested_head_sha !== data.goal.tested_commit) failures.push("PR tested head must match goal.tested_commit");
  if (readiness.handoff.commit && readiness.handoff.commit !== data.goal.tested_commit) failures.push("tested commit differs from readiness handoff commit");

  const visualIds = readiness.artifacts.filter((item) => item.type === "video" || item.type === "screenshot").map((item) => item.id);
  if (!equalSet([...attachmentMap.keys()], visualIds)) failures.push("PR attachment receipts must exactly cover every video/screenshot artifact");
  for (const artifactId of visualIds) {
    const artifact = readiness.artifacts.find((item) => item.id === artifactId);
    const result = data.artifact_results.find((item) => item.id === artifactId);
    const attachment = attachmentMap.get(artifactId);
    if (!artifact || !result || !attachment) continue;
    if (attachment.local_path !== artifact.path) failures.push(`attachment ${artifactId} local_path differs from readiness`);
    if (attachment.local_byte_size !== result.byte_size || attachment.local_sha256 !== result.sha256) failures.push(`attachment ${artifactId} local receipt differs from artifact result`);
    try {
      resolveInside(root, attachment.local_path);
    } catch (error) {
      failures.push(`attachment ${artifactId} local_path invalid: ${error instanceof Error ? error.message : String(error)}`);
    }
    try {
      assertAllowedAttachmentUrl(attachment.remote_url);
    } catch (error) {
      failures.push(`attachment ${artifactId} remote_url invalid: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  if (visualIds.length > 0) {
    const uploadReceipts = data.receipts.filter((item) => item.kind === "github_upload");
    if (uploadReceipts.length !== 1 || !equalSet(uploadReceipts[0]?.artifact_ids ?? [], visualIds)) {
      failures.push("PR visual evidence requires one valid GitHub upload receipt covering every attachment");
    }
  }
  if (!validDate(evidence.checked_at)) failures.push("PR evidence requires checked_at timestamp");

  if (evidence.state === "awaiting_merge") {
    if (data.workflow_phase !== "awaiting_merge") failures.push("awaiting_merge evidence requires workflow_phase=awaiting_merge");
    if (evidence.merge_sha !== null || evidence.blocker !== null) failures.push("awaiting_merge evidence cannot have merge SHA/blocker");
    for (const attachment of evidence.attachments) {
      const type = readiness.artifacts.find((item) => item.id === attachment.artifact_id)?.type;
      const expectedCleanup = type === "video" ? "retained" : "not_applicable";
      if (attachment.cleanup_state !== expectedCleanup) failures.push(`awaiting_merge attachment ${attachment.artifact_id} cleanup state must be ${expectedCleanup}`);
      if (attachment.remote_byte_size !== null || attachment.remote_sha256 !== null || attachment.verified_at !== null || attachment.cleaned_at !== null) {
        failures.push(`awaiting_merge attachment ${attachment.artifact_id} cannot claim post-merge verification/cleanup`);
      }
    }
  } else if (evidence.state === "verified_pending_cleanup") {
    if (!COMMIT_PATTERN.test(evidence.merge_sha ?? "")) failures.push("verified_pending_cleanup requires merge_sha");
    for (const attachment of evidence.attachments) {
      const type = readiness.artifacts.find((item) => item.id === attachment.artifact_id)?.type;
      const expectedCleanup = type === "video" ? "verified_pending_cleanup" : "not_applicable";
      if (attachment.cleanup_state !== expectedCleanup) failures.push(`attachment ${attachment.artifact_id} cleanup state must be ${expectedCleanup}`);
      if (attachment.remote_byte_size !== attachment.local_byte_size || attachment.remote_sha256 !== attachment.local_sha256 || !validDate(attachment.verified_at)) {
        failures.push(`attachment ${attachment.artifact_id} lacks exact remote verification receipt`);
      }
    }
  } else if (evidence.state === "complete") {
    if (data.workflow_phase !== "complete" || data.overall_result !== "PASS" || !validDate(data.goal.completed_at)) failures.push("complete PR evidence requires PASS/complete/timestamp");
    if (!COMMIT_PATTERN.test(evidence.merge_sha ?? "")) failures.push("complete PR evidence requires merge_sha");
    for (const attachment of evidence.attachments) {
      const type = readiness.artifacts.find((item) => item.id === attachment.artifact_id)?.type;
      if (type === "video" && (attachment.cleanup_state !== "deleted" || !validDate(attachment.cleaned_at))) failures.push(`complete video ${attachment.artifact_id} must be deleted with timestamp`);
      if (type !== "video" && (attachment.cleanup_state !== "not_applicable" || attachment.cleaned_at !== null)) failures.push(`non-video attachment ${attachment.artifact_id} cleanup must be not_applicable`);
      if (attachment.remote_byte_size !== attachment.local_byte_size || attachment.remote_sha256 !== attachment.local_sha256 || !validDate(attachment.verified_at)) {
        failures.push(`complete attachment ${attachment.artifact_id} lacks exact remote verification receipt`);
      }
    }
  } else if (evidence.state === "blocked") {
    if (data.workflow_phase !== "blocked" || data.overall_result !== "BLOCKED" || !evidence.blocker) failures.push("blocked PR evidence needs BLOCKED state and reason");
  } else if (evidence.state !== "not_uploaded") failures.push(`invalid PR evidence state: ${String(evidence.state)}`);
}

export function resolveResultsReadiness(resultsPath: string, results: ExecutionResults): { path: string; readiness: Readiness } {
  const root = resolve(dirname(dirname(resultsPath)));
  const path = resolveInside(root, results.goal.source_binding.readiness_path);
  return { path, readiness: readReadiness(path) };
}

export function stringifyExecutionResults(data: ExecutionResults): string {
  return `${JSON.stringify(data, null, 2)}\n`;
}

export function writeFileAtomic(path: string, content: string): void {
  const temporary = `${path}.tmp-${process.pid}`;
  let descriptor: number | null = null;
  try {
    descriptor = openSync(temporary, "wx", 0o600);
    writeFileSync(descriptor, content, "utf8");
    fsyncSync(descriptor);
    closeSync(descriptor);
    descriptor = null;
    renameSync(temporary, path);
    const directoryDescriptor = openSync(dirname(path), "r");
    try {
      fsyncSync(directoryDescriptor);
    } finally {
      closeSync(directoryDescriptor);
    }
  } catch (error) {
    if (descriptor !== null) closeSync(descriptor);
    if (existsSync(temporary)) unlinkSync(temporary);
    throw error;
  }
}

function cell(value: unknown): string {
  const text = Array.isArray(value) ? value.join(", ") : String(value ?? "");
  return text.replaceAll("|", "\\|").replaceAll("\n", " ");
}

function displayList(values: string[]): string {
  return values.length === 0 ? "- None." : values.map((value) => `- ${value}`).join("\n");
}

export function renderProofResults(data: ExecutionResults): string {
  const binding = data.goal.source_binding;
  const criterionRows = data.criterion_results.map((item) =>
    `| ${cell(item.id)} | ${item.result} | ${cell(item.claim_ids)} | ${cell(item.scenario_ids)} | ${cell(item.artifact_ids)} | ${cell(item.receipt_ids)} |`,
  ).join("\n");
  const scenarioRows = data.scenario_results.map((item) =>
    `| ${cell(item.id)} | ${item.result} | ${cell(item.criterion_ids)} | ${cell(item.claim_ids)} | ${cell(item.verifier_ids)} | ${cell(item.artifact_ids)} | ${cell(item.receipt_ids)} | ${cell(item.notes)} |`,
  ).join("\n");
  const verifierRows = data.verifier_results.map((item) =>
    `| ${cell(item.id)} | ${item.result} | ${cell(item.claim_ids)} | ${cell(item.version)} | ${cell(item.environment)} | ${cell(item.auth_status)} | ${cell(item.smoke_status)} | ${cell(item.receipt_ids)} |`,
  ).join("\n");
  const artifactRows = data.artifact_results.map((item) =>
    `| ${cell(item.id)} | ${item.result} | ${cell(item.path)} | ${item.byte_size} | ${item.sha256} | ${cell(item.criterion_ids)} | ${cell(item.claim_ids)} | ${cell(item.scenario_ids)} | ${cell(item.receipt_ids)} |`,
  ).join("\n");
  const receiptRows = data.receipts.map((item) =>
    `| ${cell(item.id)} | ${cell(item.kind)} | ${cell(item.status)} | ${cell(item.checked_at)} | ${cell(item.criterion_ids)} | ${cell(item.scenario_ids)} | ${cell(item.verifier_ids)} | ${cell(item.artifact_ids)} | ${cell(item.path ?? "embedded")} | ${cell(item.summary)} |`,
  ).join("\n");
  const evidence = data.pr_evidence;
  const attachmentRows = evidence?.attachments.map((item) =>
    `| ${cell(item.artifact_id)} | ${cell(item.remote_url)} | ${item.local_byte_size} | ${cell(item.local_sha256)} | ${cell(item.remote_byte_size ?? "pending")} | ${cell(item.remote_sha256 ?? "pending")} | ${cell(item.verified_at ?? "pending")} | ${cell(item.cleanup_state)} |`,
  ).join("\n") ?? "";

  return `# Proof results: ${data.goal.title}

> Deterministic projection of \`execution-results.json\`. Edit the JSON, then rerun the renderer.

- **Goal:** ${data.goal.slug}
- **Environment:** ${data.goal.environment}
- **Build/commit tested:** ${data.goal.tested_commit}
- **Executed by:** ${data.goal.executed_by}
- **Started:** ${data.goal.started_at}
- **Completed:** ${data.goal.completed_at ?? "pending"}
- **Overall result:** ${data.overall_result}
- **Workflow phase:** ${data.workflow_phase}
- **Readiness binding:** \`${binding.readiness_path}\` / \`${binding.readiness_sha256}\`
- **Proof-plan binding:** \`${binding.proof_plan_path}\` / \`${binding.proof_plan_sha256}\`

## Criterion results

| Criterion | Result | Claims | Scenarios | Artifacts | Receipts |
| --- | --- | --- | --- | --- | --- |
${criterionRows}

## Scenario results

| Scenario | Result | Criteria | Claims | Verifiers | Artifacts | Receipts | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- |
${scenarioRows}

## Verifier results

| Verifier | Result | Claims | Version | Environment | Auth | Smoke | Receipts |
| --- | --- | --- | --- | --- | --- | --- | --- |
${verifierRows}

## Artifact results

| Artifact | Result | Path | Bytes | SHA-256 | Criteria | Claims | Scenarios | Receipts |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
${artifactRows}

## Valid receipts

| Receipt | Kind | Status | Checked | Criteria | Scenarios | Verifiers | Artifacts | Path | Summary |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
${receiptRows}

## Artifact quality and privacy

- **Status:** ${data.privacy.status}
- **Automated privacy receipt:** ${data.privacy.automated_receipt_id ?? "N/A"}
- **Full visual-review receipt:** ${data.privacy.visual_review_receipt_id ?? "N/A"}
- **Motion-quality receipts:** ${cell(data.privacy.motion_receipt_ids.length > 0 ? data.privacy.motion_receipt_ids : ["N/A"])}

## Deviations from plan

${displayList(data.deviations)}

## Residual risks

${displayList(data.residual_risks)}

## PR evidence

- **Provider:** ${evidence?.provider ?? "N/A"}
- **State:** ${evidence?.state ?? "N/A"}
- **PR:** ${evidence?.pr_url ?? "N/A"}
- **Evidence comment:** ${evidence?.comment_url ?? "N/A"}
- **Tested head:** ${evidence?.tested_head_sha ?? "N/A"}
- **Merge SHA:** ${evidence?.merge_sha ?? "N/A"}
- **Checked:** ${evidence?.checked_at ?? "N/A"}
- **Blocker:** ${evidence?.blocker ?? "None"}

| Artifact | Remote URL | Local bytes | Local SHA-256 | Remote bytes | Remote SHA-256 | Verified | Cleanup |
| --- | --- | --- | --- | --- | --- | --- | --- |
${attachmentRows}

## Failed-attempt summary

${displayList(data.failed_attempt_summary)}
`;
}

export function assertAllowedAttachmentUrl(value: string): URL {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error("must be an absolute URL");
  }
  if (url.protocol !== "https:" || url.username || url.password || url.port) throw new Error("must use credential-free HTTPS on the default port");
  const host = url.hostname.toLowerCase();
  const githubPath = host === "github.com" && url.pathname.startsWith("/user-attachments/");
  const fixedHosts = new Set([
    "objects.githubusercontent.com",
    "user-images.githubusercontent.com",
    "private-user-images.githubusercontent.com",
    "github-production-user-asset-6210df.s3.amazonaws.com",
  ]);
  if (!githubPath && !fixedHosts.has(host)) throw new Error(`host/path is not an allowlisted GitHub attachment CDN: ${host}`);
  return url;
}
