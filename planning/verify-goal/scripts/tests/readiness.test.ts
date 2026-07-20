import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { approvalDigest, readReadiness, renderGoal, sha256File } from "../lib/readiness.ts";
import type { Readiness } from "../lib/types.ts";
import { validateReadiness } from "../lib/validate-readiness.ts";

const skillRoot = dirname(dirname(dirname(fileURLToPath(import.meta.url))));
const template = readFileSync(join(skillRoot, "assets", "verification-readiness-template.yaml"), "utf8");
const now = "2026-07-20T12:00:00.000Z";
const future = "2026-07-21T12:00:00.000Z";
const hash = "a".repeat(64);

function clientEvaluationReceipt(): string {
  const archetypes = ["browser_video", "external_tool_auth", "local_only", "migration_multi_role"];
  const runs = archetypes.flatMap((archetype) => [1, 2].map((attempt) => ({
    id: `${archetype.replaceAll("_", "-")}-${attempt}`,
    archetype,
    attempt,
    status: "PASS",
    checked_at: now,
    contract_sha256: hash,
  })));
  return `${JSON.stringify({
    schema_version: 1,
    client: { name: "codex", version: "fixture-client" },
    skill_revision_sha256: hash,
    status: "passed",
    evaluated_at: now,
    deterministic_checks: { typecheck: "PASS", tests: "PASS", skill_validation: "PASS" },
    matrix: { attempts_per_archetype: 2, total_runs: 8, passed_runs: 8 },
    runs,
  }, null, 2)}\n`;
}

function draft(): Readiness {
  return JSON.parse(
    template
      .replaceAll("{{goal_slug}}", "fixture-goal")
      .replaceAll("{{goal_title}}", "Fixture Goal")
      .replaceAll("{{created_at}}", now),
  ) as Readiness;
}

function ready(): Readiness {
  const data = draft();
  data.client = {
    name: "codex",
    version: "fixture-client",
    skill_revision_sha256: hash,
    support: "supported",
    evaluation_receipt_path: "proof/receipts/client-evaluation.json",
  };
  data.contract = {
    ...data.contract,
    status: "verified",
    work_type: "feature",
    verified_at: now,
    objective: "Ship an observable safe outcome.",
    scope: ["One bounded behavior"],
    constraints: ["No production mutation"],
    non_goals: ["Unrelated behavior"],
    affected_users: ["test user"],
    affected_systems: ["fixture app"],
    authority: ["repository tests"],
    residual_risks: ["None identified."],
    unresolved_questions: ["None identified."],
  };
  data.workflow = {
    phase: "ready",
    revision: 2,
    updated_at: now,
    blockers: [],
    completed_checks: ["inventory", "exa_gap_analysis", "capability_smoke_tests", "proof_plan", "approval"],
    next_checks: [],
  };
  data.lease = {
    state: "released",
    owner: "author",
    run_id: "run-1",
    revision: 2,
    parent_readiness_sha256: hash,
    acquired_at: now,
    released_at: now,
    takeovers: [],
  };
  data.source_hashes = { goal_sha256: hash, proof_plan_sha256: hash, checked_at: now };
  data.research.exa = {
    status: "complete",
    queried_at: now,
    sources: [{ url: "https://example.test/verifier", authority: "discovery", version: "2026-07", checked_at: now, valid_until: future }],
  };
  data.vault = { provider: "fixture-vault", mechanism: "test injection", status: "not_required", checked_at: now, reference_names: [] };
  data.criteria[0]!.description = "User observes the result.";
  data.criteria[0]!.pass_threshold = "Exact result appears once.";
  data.claims[0]!.description = "The result is persisted.";
  data.claims[0]!.required_evidence = "Repository assertion.";
  data.capabilities[0]!.description = "Read persisted fixture state.";
  data.verifiers[0] = {
    ...data.verifiers[0]!,
    name: "fixture-test",
    version: "1.0.0",
    status: "ready",
    sources: [{ url: "repo://tests/fixture.test.ts", authority: "authoritative", version: hash, checked_at: now, valid_until: null }],
    installation: { status: "not_required", source: "repository", installed_by_goal: false, receipt_path: "proof/receipts/install.json" },
    authentication: {
      route: "none",
      status: "not_required",
      vault_provider: "fixture-vault",
      reference_names: [],
      identity_alias: "test-user",
      environment: "test",
      checked_at: now,
      expires_at: null,
      production_approval: null,
    },
    smoke_test: { status: "passed", capability_proved: "Reads fixture state", checked_at: now, receipt_path: "proof/receipts/smoke.json" },
    fallback_or_blocker: "None identified.",
  };
  data.risks[0]!.description = "Happy path does not produce the expected state.";
  data.scenarios[0] = {
    ...data.scenarios[0]!,
    name: "Persist fixture state",
    risk: "happy_path",
    identity_aliases: ["test-user"],
    preconditions: "Clean fixture state.",
    cleanup: "Reset fixture state.",
    pass_condition: "Expected state appears once.",
  };
  data.release = {
    strategy: "none",
    rationale: "Local fixture only.",
    old_path: "N/A",
    new_path: "Repository assertion.",
    transition: "N/A",
    fallback: "Revert change.",
    telemetry: "Test result.",
    cleanup: "Remove fixture state.",
  };
  data.evidence_lifecycle = {
    delivery: "no_pr",
    provider: "none",
    attachment_visibility: "none",
    pr_number: null,
    pr_url: null,
    pr_state: "not_created",
    local_video_policy: "retain_indefinitely",
    sanitized_manifest: "sanitized-commit-manifest.json",
  };
  data.handoff = { last_checkpoint: null, branch: "fixture-branch", commit: null, next_action: "Run /goal." };
  data.approval = {
    status: "approved",
    approver_alias: "developer",
    approved_at: now,
    method: "structured-input",
    semantic_sha256: null,
    proof_plan_sha256: hash,
  };
  data.approval.semantic_sha256 = approvalDigest(data, hash);
  return data;
}

test("Draft template has a structurally complete ID graph", () => {
  assert.deepEqual(validateReadiness(draft(), { now }), []);
});

test("ready contract accepts hash-bound explicit approval", () => {
  assert.deepEqual(validateReadiness(ready(), { requireReady: true, now }), []);
});

test("routine receipt refresh keeps approval valid", () => {
  const data = ready();
  data.verifiers[0]!.authentication.checked_at = "2026-07-20T13:00:00.000Z";
  data.verifiers[0]!.smoke_test.checked_at = "2026-07-20T13:00:00.000Z";
  assert.equal(approvalDigest(data, hash), data.approval.semantic_sha256);
});

test("meaningful proof change invalidates approval", () => {
  const data = ready();
  data.criteria[0]!.pass_threshold = "A different result.";
  assert.match(validateReadiness(data, { requireReady: true, now }).join("\n"), /approval semantic hash is stale/);
});

test("broken capability graph fails", () => {
  const data = draft();
  data.capabilities[0]!.verifier_id = "V-99";
  assert.match(validateReadiness(data, { now }).join("\n"), /missing verifier V-99/);
});

test("closed readiness schema rejects ignored nested keys", () => {
  const data = draft() as Readiness & { workflow: Readiness["workflow"] & { typo_state?: string } };
  data.workflow.typo_state = "hidden";
  assert.match(validateReadiness(data, { now }).join("\n"), /workflow has unexpected key: typo_state/);
});

test("readiness parser rejects noncanonical or duplicate-key JSON", () => {
  const root = mkdtempSync(join(tmpdir(), "verify-goal-readiness-"));
  const path = join(root, "verification-readiness.yaml");
  writeFileSync(path, '{"schema_version":1,"schema_version":1}\n');
  assert.throws(() => readReadiness(path), /canonical two-space JSON/);
});

test("checkpoint uses revision, byte hash, owner, and run-id CAS", () => {
  const root = mkdtempSync(join(tmpdir(), "verify-goal-checkpoint-"));
  const proof = join(root, "proof");
  mkdirSync(proof);
  const data = draft();
  data.lease.owner = "author";
  data.lease.run_id = "run-1";
  const readinessPath = join(root, "verification-readiness.yaml");
  writeFileSync(readinessPath, `${JSON.stringify(data, null, 2)}\n`);
  writeFileSync(join(root, "GOAL.md"), renderGoal(data));
  writeFileSync(join(proof, "proof-plan.md"), "# Draft proof plan\n");
  const originalSha = sha256File(readinessPath);
  const script = join(skillRoot, "scripts", "checkpoint-readiness.ts");
  const first = spawnSync(process.execPath, [script, root, "--expected-revision", "1", "--expected-sha256", originalSha, "--owner", "author", "--run-id", "run-1", "--action", "checkpoint"], { encoding: "utf8" });
  assert.equal(first.status, 0, first.stderr);
  const updated = readReadiness(readinessPath);
  assert.equal(updated.workflow.revision, 2);
  assert.equal(updated.lease.parent_readiness_sha256, originalSha);

  const stale = spawnSync(process.execPath, [script, root, "--expected-revision", "1", "--expected-sha256", originalSha, "--owner", "author", "--run-id", "run-1", "--action", "checkpoint"], { encoding: "utf8" });
  assert.notEqual(stale.status, 0);
  assert.match(stale.stderr, /stale readiness bytes|stale revision/);
});

test("approval command binds semantics and proof plan after explicit approval", () => {
  const root = mkdtempSync(join(tmpdir(), "verify-goal-approval-"));
  const proof = join(root, "proof");
  const receipts = join(proof, "receipts");
  mkdirSync(receipts, { recursive: true });
  const data = ready();
  data.contract.status = "draft";
  data.contract.verified_at = null;
  data.workflow.phase = "authoring";
  data.workflow.revision = 1;
  data.workflow.completed_checks = ["inventory", "exa_gap_analysis", "capability_smoke_tests", "proof_plan"];
  data.workflow.next_checks = ["approval"];
  data.lease.state = "active";
  data.lease.revision = 1;
  data.lease.parent_readiness_sha256 = null;
  data.lease.released_at = null;
  data.source_hashes = { goal_sha256: null, proof_plan_sha256: null, checked_at: null };
  data.approval = { status: "pending", approver_alias: null, approved_at: null, method: null, semantic_sha256: null, proof_plan_sha256: null };
  const readinessPath = join(root, "verification-readiness.yaml");
  writeFileSync(readinessPath, `${JSON.stringify(data, null, 2)}\n`);
  writeFileSync(join(root, "GOAL.md"), renderGoal(data));
  writeFileSync(join(receipts, "client-evaluation.json"), clientEvaluationReceipt());
  writeFileSync(join(receipts, "smoke.json"), '{"status":"passed"}\n');
  const plan = `# Proof plan: Fixture Goal

- **Video applicability:** no — no browser surface
- **Recording duration:** N/A

## Proof contract

Exact fixture proof.

## Identities and fixtures

| Alias | Role/state | Vault/auth mechanism | Fixture/reset method |
| --- | --- | --- | --- |
| \`test-user\` | tester | none | reset fixture |

## Risk coverage

| Risk ID | Class | Material risk | Disposition | Scenario IDs | Exclusion reason |
| --- | --- | --- | --- | --- | --- |
| \`RISK-01\` | other | Happy path fails | covered | \`S-01\` | N/A |

## Scenario matrix

| ID | Risk class | Risk IDs | Criteria | Claims | Artifacts | Record? | Status |
| --- | --- | --- | --- | --- | --- | --- | --- |
| \`S-01\` | happy_path | \`RISK-01\` | \`SC-01\` | \`CL-01\` | \`AR-01\` | no | planned |

## Scenario S-01: Persist fixture state

- **Purpose:** Prove fixture state.
- **Criterion IDs:** \`SC-01\`
- **Claim IDs:** \`CL-01\`
- **Artifact IDs:** \`AR-01\`
- **Risk IDs:** \`RISK-01\`
- **Identity:** \`test-user\`
- **Preconditions:** Clean fixture state.
- **Recording:** N/A — nonvisual
- **Other evidence:** proof/automated/sc-01.json

| Step | Actor | Exact user-visible action | Expected visible result | Underlying assertion/evidence |
| --- | --- | --- | --- | --- |
| 1 | \`test-user\` | run fixture | state persists | AR-01 |

- **Cleanup/reset:** Reset fixture state.
- **Pass condition:** Expected state appears once.

## Release and transition proof

No release required.

## Privacy preflight

No sensitive surfaces.

## Execution order and stop conditions

1. Run assertion.
`;
  writeFileSync(join(proof, "proof-plan.md"), plan);
  const originalSha = sha256File(readinessPath);
  const script = join(skillRoot, "scripts", "approve-readiness.ts");
  const result = spawnSync(process.execPath, [script, root, "--expected-revision", "1", "--expected-sha256", originalSha, "--owner", "author", "--approver", "developer", "--method", "structured-input"], { encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr);
  const approved = readReadiness(readinessPath);
  assert.equal(approved.contract.status, "verified");
  assert.equal(approved.approval.status, "approved");
  assert.equal(approved.workflow.phase, "ready");
  assert.equal(approved.lease.state, "released");
  assert.deepEqual(validateReadiness(approved, { readinessPath, requireReady: true, now: approved.approval.approved_at! }), []);
});
