import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, unlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { fileURLToPath } from "node:url";
import {
  readExecutionResults,
  renderProofResults,
  stringifyExecutionResults,
  validateExecutionResults,
} from "../lib/execution-results.ts";
import type { ExecutionResults, Receipt } from "../lib/execution-results.ts";
import { finalizePrEvidence } from "../lib/finalize-pr-evidence.ts";
import { readReadiness, sha256File } from "../lib/readiness.ts";
import type { Readiness } from "../lib/types.ts";

const NOW = "2026-07-20T08:00:00.000Z";
const COMMIT = "1111111111111111111111111111111111111111";
const MERGE = "2222222222222222222222222222222222222222";
const REMOTE_URL = "https://github.com/user-attachments/assets/11111111-1111-1111-1111-111111111111";
const REPOSITORY = "example/verify-goal-fixture";
const SCRIPT_DIRECTORY = dirname(dirname(fileURLToPath(import.meta.url)));

interface Harness {
  directory: string;
  resultsPath: string;
  markdownPath: string;
  fixturePath: string;
  localVideoPath: string;
}

function readiness(): Readiness {
  return {
    schema_version: 1,
    client: {
      name: "codex",
      version: "fixture",
      skill_revision_sha256: "a".repeat(64),
      support: "supported",
      evaluation_receipt_path: "proof/automated/evaluation.json",
    },
    approval: {
      status: "approved",
      approver_alias: "fixture-approver",
      approved_at: NOW,
      method: "typed",
      semantic_sha256: "b".repeat(64),
      proof_plan_sha256: "c".repeat(64),
    },
    contract: {
      slug: "fixture-goal",
      title: "Fixture Goal",
      status: "verified",
      work_type: "browser",
      created_at: NOW,
      verified_at: NOW,
      objective: "Prove the fixture.",
      scope: ["fixture"],
      constraints: ["local only"],
      non_goals: ["production"],
      affected_users: ["fixture user"],
      affected_systems: ["fixture app"],
      authority: ["test"],
      residual_risks: ["none identified"],
      unresolved_questions: ["None identified."],
    },
    workflow: { phase: "awaiting_merge", revision: 2, updated_at: NOW, blockers: [], completed_checks: ["proof"], next_checks: ["merge"] },
    lease: {
      state: "active",
      owner: "fixture-agent",
      run_id: "fixture-run",
      revision: 2,
      parent_readiness_sha256: null,
      acquired_at: NOW,
      released_at: null,
      takeovers: [],
    },
    source_hashes: { goal_sha256: null, proof_plan_sha256: null, checked_at: NOW },
    research: { exa: { status: "complete", queried_at: NOW, sources: [{ url: "https://example.com", authority: "authoritative", version: "fixture", checked_at: NOW, valid_until: null }] } },
    vault: { provider: "fixture", mechanism: "fixture", status: "not_required", checked_at: NOW, reference_names: [] },
    criteria: [{
      id: "SC-01",
      description: "Journey passes.",
      pass_threshold: "Observed once.",
      claim_ids: ["CL-01"],
      scenario_ids: ["S-01"],
      artifact_ids: ["AR-01"],
    }],
    claims: [{
      id: "CL-01",
      description: "Journey works.",
      required_evidence: "Video.",
      capability_ids: ["CAP-01"],
      criterion_ids: ["SC-01"],
      verifier_ids: ["V-01"],
      scenario_ids: ["S-01"],
      artifact_ids: ["AR-01"],
    }],
    capabilities: [{ id: "CAP-01", description: "Browser verification", claim_ids: ["CL-01"], verifier_id: "V-01" }],
    risks: [{ id: "RISK-01", description: "Journey regression", class: "regression", disposition: "covered", scenario_ids: ["S-01"], exclusion_reason: null }],
    verifiers: [{
      id: "V-01",
      name: "Fixture verifier",
      kind: "browser",
      version: "1.0.0",
      status: "ready",
      claim_ids: ["CL-01"],
      capability_ids: ["CAP-01"],
      sources: [{ url: "https://example.com/verifier", authority: "authoritative", version: "1.0.0", checked_at: NOW, valid_until: null }],
      installation: { status: "not_required", source: "fixture", installed_by_goal: false, receipt_path: "proof/automated/install.json" },
      authentication: {
        route: "none",
        status: "not_required",
        vault_provider: "fixture",
        reference_names: [],
        identity_alias: "fixture",
        environment: "test",
        checked_at: NOW,
        expires_at: null,
        production_approval: null,
      },
      smoke_test: { status: "passed", capability_proved: "fixture", checked_at: NOW, receipt_path: "proof/automated/smoke.json" },
      fallback_or_blocker: "block",
    }],
    scenarios: [{
      id: "S-01",
      name: "Fixture journey",
      risk: "happy_path",
      criterion_ids: ["SC-01"],
      claim_ids: ["CL-01"],
      artifact_ids: ["AR-01"],
      risk_ids: ["RISK-01"],
      identity_aliases: ["fixture-user"],
      preconditions: "Fixture reset.",
      cleanup: "Fixture reset.",
      pass_condition: "Journey observed.",
      record: true,
    }],
    artifacts: [{
      id: "AR-01",
      type: "video",
      path: "proof/recordings/01-fixture-journey.mp4",
      criterion_ids: ["SC-01"],
      claim_ids: ["CL-01"],
      scenario_ids: ["S-01"],
      required: true,
      retention: "pr_attachment",
      privacy_status: "passed",
      review_status: "passed",
    }],
    release: {
      strategy: "none",
      rationale: "fixture",
      old_path: "N/A",
      new_path: "N/A",
      transition: "N/A",
      fallback: "N/A",
      telemetry: "N/A",
      cleanup: "N/A",
    },
    evidence_lifecycle: {
      delivery: "pr",
      provider: "github",
      attachment_visibility: "link_accessible",
      pr_number: 7,
      pr_url: `https://github.com/${REPOSITORY}/pull/7`,
      pr_state: "open",
      local_video_policy: "retain_until_pr_merged",
      sanitized_manifest: "sanitized-commit-manifest.json",
    },
    handoff: { last_checkpoint: NOW, branch: "fixture", commit: COMMIT, next_action: "finalize" },
  };
}

function receipt(id: string, kind: Receipt["kind"], links: Partial<Pick<Receipt, "criterion_ids" | "scenario_ids" | "verifier_ids" | "artifact_ids">>): Receipt {
  return {
    id,
    kind,
    status: "valid",
    checked_at: NOW,
    summary: `${kind} passed.`,
    criterion_ids: links.criterion_ids ?? [],
    scenario_ids: links.scenario_ids ?? [],
    verifier_ids: links.verifier_ids ?? [],
    artifact_ids: links.artifact_ids ?? [],
    path: null,
    byte_size: null,
    sha256: null,
  };
}

function createHarness(options: { remoteBytes?: string; redirects?: string[]; stopAfterPending?: boolean } = {}): Harness {
  const directory = mkdtempSync(join(tmpdir(), "verify-goal-results-"));
  const proofDirectory = join(directory, "proof");
  const recordingsDirectory = join(proofDirectory, "recordings");
  const automatedDirectory = join(proofDirectory, "automated");
  const privacyFramesDirectory = join(proofDirectory, "privacy-frames");
  const fixtureDirectory = join(directory, "fixture");
  mkdirSync(recordingsDirectory, { recursive: true });
  mkdirSync(automatedDirectory, { recursive: true });
  mkdirSync(privacyFramesDirectory, { recursive: true });
  mkdirSync(fixtureDirectory, { recursive: true });
  const planPath = join(proofDirectory, "proof-plan.md");
  const readinessPath = join(directory, "verification-readiness.yaml");
  const resultsPath = join(proofDirectory, "execution-results.json");
  const markdownPath = join(proofDirectory, "proof-results.md");
  const fixturePath = join(fixtureDirectory, "github.json");
  const localVideoPath = join(recordingsDirectory, "01-fixture-journey.mp4");
  const remotePath = join(fixtureDirectory, "remote.mp4");
  const receiptPath = join(automatedDirectory, "fixture-receipt.json");
  const privacyPath = join(proofDirectory, "privacy-report.json");
  const visionPath = join(automatedDirectory, "agent-vision-receipt.json");
  const motionPath = join(automatedDirectory, "motion-quality.json");
  const framePath = join(privacyFramesDirectory, "fixture-000001.png");
  writeFileSync(planPath, "# Deterministic fixture proof plan\n");
  writeFileSync(localVideoPath, "same-final-video-bytes");
  writeFileSync(remotePath, options.remoteBytes ?? "same-final-video-bytes");
  writeFileSync(receiptPath, `${JSON.stringify({ status: "valid", checked_at: NOW })}\n`);
  writeFileSync(framePath, "sanitized-frame");

  const ready = readiness();
  ready.source_hashes.proof_plan_sha256 = sha256File(planPath);
  writeFileSync(readinessPath, `${JSON.stringify(ready, null, 2)}\n`);
  const videoSize = lstatSize(localVideoPath);
  const videoHash = sha256File(localVideoPath);
  const frameHash = sha256File(framePath);
  const privacy = {
    schema_version: 1,
    kind: "privacy-review",
    generated_at: NOW,
    automated_scan: { status: "PASS", finding_count: 0 },
    artifacts: [{ path: "proof/recordings/01-fixture-journey.mp4", kind: "video", sha256: videoHash, bytes: videoSize, finding_ids: [] }],
    findings: [],
    video_reviews: [{
      artifact_path: "proof/recordings/01-fixture-journey.mp4",
      artifact_sha256: videoHash,
      duration_seconds: 1,
      action_boundaries_seconds: [0],
      frames: [{ path: "proof/privacy-frames/fixture-000001.png", sha256: frameHash, time_seconds: 0, source_times_seconds: [0], reasons: ["action_boundary"] }],
    }],
    agent_vision: { status: "PENDING", receipt_path: "proof/automated/agent-vision-receipt.json", instructions: ["Watch the full fixture video."] },
  };
  writeFileSync(privacyPath, `${JSON.stringify(privacy, null, 2)}\n`);
  writeFileSync(visionPath, `${JSON.stringify({
    schema_version: 1,
    kind: "agent-vision-privacy-receipt",
    status: "PASS",
    reviewer_alias: "fixture-reviewer",
    reviewed_at: NOW,
    privacy_manifest_path: "proof/privacy-report.json",
    privacy_manifest_sha256: sha256File(privacyPath),
    artifacts: [{ path: "proof/recordings/01-fixture-journey.mp4", sha256: videoHash }],
    frames: [{ path: "proof/privacy-frames/fixture-000001.png", sha256: frameHash }],
    notes: ["No sensitive content."],
  }, null, 2)}\n`);
  writeFileSync(motionPath, `${JSON.stringify({
    schemaVersion: 1,
    videoPath: "proof/recordings/01-fixture-journey.mp4",
    videoSha256: videoHash,
    motionPlanPath: "proof/automated/motion-plan.json",
    captureReceiptPath: "proof/automated/capture.json",
    decodedFrameCount: 60,
    policy: { fps: 60, grayResolution: "480x270", lumaDelta: 8, minimumChangedPixels: 3, maximumRepeatedFrameRun: 2, broadChopFraction: 0.1, isolatedStalledTransitionAllowance: 2 },
    valid: true,
    failures: [],
    windows: [{ id: "CURSOR-1", kind: "cursor", startFrame: 0, endFrameExclusive: 60, transitions: 59, stalledTransitions: 0, allowedStalledTransitions: 5, longestStalledFrameRun: 1, status: "passed", failures: [] }],
  }, null, 2)}\n`);
  const receipts = [
    receipt("R-01", "capability_revalidation", { verifier_ids: ["V-01"] }),
    receipt("R-02", "artifact", { criterion_ids: ["SC-01"], scenario_ids: ["S-01"], artifact_ids: ["AR-01"] }),
    receipt("R-03", "privacy_scan", { artifact_ids: ["AR-01"] }),
    receipt("R-04", "visual_review", { artifact_ids: ["AR-01"] }),
    receipt("R-05", "motion_quality", { artifact_ids: ["AR-01"] }),
    receipt("R-06", "github_upload", { criterion_ids: ["SC-01"], scenario_ids: ["S-01"], artifact_ids: ["AR-01"] }),
  ];
  for (const item of receipts) {
    if (item.kind === "github_upload") continue;
    const evidencePath = item.kind === "privacy_scan" ? privacyPath
      : item.kind === "visual_review" ? visionPath
      : item.kind === "motion_quality" ? motionPath
      : receiptPath;
    item.path = item.kind === "privacy_scan" ? "proof/privacy-report.json"
      : item.kind === "visual_review" ? "proof/automated/agent-vision-receipt.json"
      : item.kind === "motion_quality" ? "proof/automated/motion-quality.json"
      : "proof/automated/fixture-receipt.json";
    item.byte_size = lstatSize(evidencePath);
    item.sha256 = sha256File(evidencePath);
  }
  const results: ExecutionResults = {
    schema_version: 1,
    goal: {
      slug: ready.contract.slug,
      title: ready.contract.title,
      source_binding: {
        readiness_path: "verification-readiness.yaml",
        readiness_sha256: sha256File(readinessPath),
        proof_plan_path: "proof/proof-plan.md",
        proof_plan_sha256: sha256File(planPath),
      },
      tested_commit: COMMIT,
      environment: "fixture",
      executed_by: "fixture-agent",
      started_at: NOW,
      completed_at: null,
    },
    overall_result: "PASS",
    workflow_phase: "awaiting_merge",
    receipts,
    criterion_results: [{ id: "SC-01", result: "PASS", claim_ids: ["CL-01"], scenario_ids: ["S-01"], artifact_ids: ["AR-01"], receipt_ids: ["R-02", "R-06"] }],
    scenario_results: [{
      id: "S-01",
      result: "PASS",
      criterion_ids: ["SC-01"],
      claim_ids: ["CL-01"],
      verifier_ids: ["V-01"],
      artifact_ids: ["AR-01"],
      receipt_ids: ["R-02", "R-06"],
      notes: "Passed.",
    }],
    verifier_results: [{
      id: "V-01",
      result: "PASS",
      claim_ids: ["CL-01"],
      auth_status: "not_required",
      smoke_status: "PASS",
      version: "1.0.0",
      environment: "fixture",
      receipt_ids: ["R-01"],
    }],
    artifact_results: [{
      id: "AR-01",
      result: "PASS",
      path: "proof/recordings/01-fixture-journey.mp4",
      criterion_ids: ["SC-01"],
      claim_ids: ["CL-01"],
      scenario_ids: ["S-01"],
      receipt_ids: ["R-02", "R-03", "R-04", "R-05", "R-06"],
      byte_size: videoSize,
      sha256: videoHash,
    }],
    privacy: { status: "PASS", automated_receipt_id: "R-03", visual_review_receipt_id: "R-04", motion_receipt_ids: ["R-05"] },
    deviations: [],
    residual_risks: [],
    failed_attempt_summary: [],
    pr_evidence: {
      provider: "github",
      state: "awaiting_merge",
      repository: REPOSITORY,
      pr_number: 7,
      pr_url: `https://github.com/${REPOSITORY}/pull/7`,
      comment_url: `https://github.com/${REPOSITORY}/pull/7#issuecomment-99`,
      tested_head_sha: COMMIT,
      merge_sha: null,
      checked_at: NOW,
      blocker: null,
      attachments: [{
        artifact_id: "AR-01",
        local_path: "proof/recordings/01-fixture-journey.mp4",
        remote_url: REMOTE_URL,
        local_byte_size: videoSize,
        local_sha256: videoHash,
        remote_byte_size: null,
        remote_sha256: null,
        verified_at: null,
        cleanup_state: "retained",
        cleaned_at: null,
      }],
    },
  };
  writeFileSync(resultsPath, stringifyExecutionResults(results));
  writeFileSync(markdownPath, renderProofResults(results));
  writeFileSync(fixturePath, `${JSON.stringify({
    schema_version: 1,
    now: NOW,
    github: {
      repository: REPOSITORY,
      pull: {
        number: 7,
        html_url: `https://github.com/${REPOSITORY}/pull/7`,
        merged: true,
        merged_at: NOW,
        head: { sha: COMMIT },
        merge_commit_sha: MERGE,
      },
      comment: {
        html_url: `https://github.com/${REPOSITORY}/pull/7#issuecomment-99`,
        body: `Evidence for ${COMMIT}\n${REMOTE_URL}`,
      },
    },
    downloads: { [REMOTE_URL]: { source_path: "remote.mp4", redirects: options.redirects ?? [] } },
    ...(options.stopAfterPending ? { stop_after_verified_pending_cleanup: true } : {}),
  }, null, 2)}\n`);
  return { directory, resultsPath, markdownPath, fixturePath, localVideoPath };
}

function lstatSize(path: string): number {
  return readFileSync(path).byteLength;
}

function cleanup(harness: Harness): void {
  assert.ok(harness.directory.startsWith(join(tmpdir(), "verify-goal-results-")));
  rmSync(harness.directory, { recursive: true, force: true });
}

test("validates graph/receipt coverage and renders deterministically", () => {
  const harness = createHarness();
  try {
    const results = readExecutionResults(harness.resultsPath);
    const ready = readReadiness(join(harness.directory, "verification-readiness.yaml"));
    assert.deepEqual(validateExecutionResults(results, ready, harness.resultsPath), []);
    assert.equal(renderProofResults(results), readFileSync(harness.markdownPath, "utf8"));
    results.artifact_results[0]!.receipt_ids = results.artifact_results[0]!.receipt_ids.filter((id) => id !== "R-03");
    assert.ok(validateExecutionResults(results, ready, harness.resultsPath).some((failure) => failure.includes("reverse result link")));
  } finally {
    cleanup(harness);
  }
});

test("native TypeScript validator and renderer CLIs run without a transpiler", () => {
  const harness = createHarness();
  try {
    const validation = spawnSync(process.execPath, [join(SCRIPT_DIRECTORY, "validate-execution-results.ts"), harness.resultsPath], { encoding: "utf8" });
    assert.equal(validation.status, 0, validation.stderr);
    const renderedPath = join(dirname(harness.markdownPath), "cli-proof-results.md");
    const rendering = spawnSync(process.execPath, [join(SCRIPT_DIRECTORY, "render-proof-results.ts"), harness.resultsPath, renderedPath], { encoding: "utf8" });
    assert.equal(rendering.status, 0, rendering.stderr);
    assert.equal(readFileSync(renderedPath, "utf8"), readFileSync(harness.markdownPath, "utf8"));
  } finally {
    cleanup(harness);
  }
});

test("fixture finalizer verifies merged PR and deletes exact retained MP4", async () => {
  const harness = createHarness();
  try {
    const finalized = await finalizePrEvidence({ resultsPath: harness.resultsPath, fixturePath: harness.fixturePath });
    assert.equal(finalized.pr_evidence?.state, "complete");
    assert.equal(finalized.pr_evidence?.merge_sha, MERGE);
    assert.equal(finalized.pr_evidence?.attachments[0]?.cleanup_state, "deleted");
    assert.equal(finalized.pr_evidence?.attachments[0]?.remote_sha256, finalized.pr_evidence?.attachments[0]?.local_sha256);
    assert.equal(exists(harness.localVideoPath), false);
    const ready = readReadiness(join(harness.directory, "verification-readiness.yaml"));
    assert.deepEqual(validateExecutionResults(finalized, ready, harness.resultsPath), []);
    assert.equal(readFileSync(harness.markdownPath, "utf8"), renderProofResults(finalized));
  } finally {
    cleanup(harness);
  }
});

test("verified_pending_cleanup receipt supports deterministic crash resume", async () => {
  const harness = createHarness({ stopAfterPending: true });
  try {
    const pending = await finalizePrEvidence({ resultsPath: harness.resultsPath, fixturePath: harness.fixturePath });
    assert.equal(pending.pr_evidence?.state, "verified_pending_cleanup");
    assert.equal(exists(harness.localVideoPath), true);
    const fixture = JSON.parse(readFileSync(harness.fixturePath, "utf8")) as Record<string, unknown>;
    delete fixture.stop_after_verified_pending_cleanup;
    writeFileSync(harness.fixturePath, `${JSON.stringify(fixture, null, 2)}\n`);
    unlinkSync(harness.localVideoPath);
    const completed = await finalizePrEvidence({ resultsPath: harness.resultsPath, fixturePath: harness.fixturePath });
    assert.equal(completed.pr_evidence?.state, "complete");
    assert.equal(exists(harness.localVideoPath), false);
  } finally {
    cleanup(harness);
  }
});

test("remote hash mismatch blocks and retains local MP4", async () => {
  const harness = createHarness({ remoteBytes: "same-final-video-bytex" });
  try {
    await assert.rejects(finalizePrEvidence({ resultsPath: harness.resultsPath, fixturePath: harness.fixturePath }), /SHA-256 mismatch/);
    assert.equal(exists(harness.localVideoPath), true);
    const blocked = readExecutionResults(harness.resultsPath);
    assert.equal(blocked.overall_result, "BLOCKED");
    assert.equal(blocked.pr_evidence?.state, "blocked");
  } finally {
    cleanup(harness);
  }
});

test("non-GitHub redirect blocks and retains local MP4", async () => {
  const harness = createHarness({ redirects: ["https://example.com/stolen.mp4"] });
  try {
    await assert.rejects(finalizePrEvidence({ resultsPath: harness.resultsPath, fixturePath: harness.fixturePath }), /allowlisted GitHub attachment CDN/);
    assert.equal(exists(harness.localVideoPath), true);
    assert.equal(readExecutionResults(harness.resultsPath).pr_evidence?.state, "blocked");
  } finally {
    cleanup(harness);
  }
});

function exists(path: string): boolean {
  try {
    readFileSync(path);
    return true;
  } catch {
    return false;
  }
}
