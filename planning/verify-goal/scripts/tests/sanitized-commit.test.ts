import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, unlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import test from "node:test";
import type { AgentVisionReceipt, PrivacyReviewManifest } from "../lib/agent-vision.ts";
import { assertAgentVisionPass } from "../lib/agent-vision.ts";
import { buildSanitizedCommitAllowlist, readSanitizedPolicy } from "../lib/sanitized-commit.ts";
import { assertNoPortableCollisions, sha256Bytes, sha256Path } from "../lib/safe-paths.ts";

function write(path: string, content: string): void {
  writeFileSync(path, content);
}

function createGoalFixture(): { repository: string; goal: string; evidencePath: string } {
  const repository = mkdtempSync(join(tmpdir(), "verify-goal-sanitized-test-"));
  const goal = join(repository, "goals", "demo");
  mkdirSync(join(goal, "proof", "automated"), { recursive: true });
  execFileSync("git", ["init", "-q"], { cwd: repository });
  const files = new Map<string, string>([
    ["GOAL.md", "# Verified Goal\n"],
    ["verification-readiness.yaml", "{\"schema_version\":1}\n"],
    ["proof/proof-plan.md", "# Proof plan\n"],
    ["proof/execution-results.json", "{\"schema_version\":1}\n"],
    ["proof/proof-results.md", "# Proof results\n"],
    ["proof/automated/evidence.json", "{\"status\":\"PASS\"}\n"],
  ]);
  for (const [path, content] of files) write(join(goal, path), content);
  const policy = {
    schema_version: 1,
    include_exact: [
      "GOAL.md",
      "verification-readiness.yaml",
      "sanitized-commit-manifest.json",
      "proof/proof-plan.md",
      "proof/execution-results.json",
      "proof/proof-results.md",
      "proof/remote-receipts.json",
      "proof/privacy-report.json",
    ],
    include_directories: [{ path: "proof/automated", extensions: [".json", ".md", ".txt", ".xml"], max_file_bytes: 1048576 }],
    exclude_directories: ["proof/recordings", "proof/screenshots", "proof/traces", "proof/logs"],
    exclude_names: [".env", ".env.local", "cookies.json", "auth.json", "token.json"],
  };
  write(join(goal, "sanitized-commit-manifest.json"), `${JSON.stringify(policy, null, 2)}\n`);
  const artifacts = [...files.keys()].map((path) => {
    const absolute = join(goal, path);
    return {
      path,
      kind: "generated_text" as const,
      sha256: sha256Path(absolute),
      bytes: readFileSync(absolute).byteLength,
      finding_ids: [],
    };
  });
  const manifest: PrivacyReviewManifest = {
    schema_version: 1,
    kind: "privacy-review",
    generated_at: "2026-07-20T00:00:00.000Z",
    automated_scan: { status: "PASS", finding_count: 0 },
    artifacts,
    findings: [],
    video_reviews: [],
    agent_vision: {
      status: "PENDING",
      receipt_path: "proof/automated/agent-vision-receipt.json",
      instructions: ["Review exact hashes."],
    },
  };
  const privacyPath = join(goal, "proof", "privacy-report.json");
  write(privacyPath, `${JSON.stringify(manifest, null, 2)}\n`);
  const receipt: AgentVisionReceipt = {
    schema_version: 1,
    kind: "agent-vision-privacy-receipt",
    status: "PASS",
    reviewer_alias: "agent-reviewer",
    reviewed_at: "2026-07-20T00:01:00.000Z",
    privacy_manifest_path: "proof/privacy-report.json",
    privacy_manifest_sha256: sha256Path(privacyPath),
    artifacts: artifacts.map(({ path, sha256 }) => ({ path, sha256 })),
    frames: [],
    notes: [],
  };
  write(join(goal, "proof", "automated", "agent-vision-receipt.json"), `${JSON.stringify(receipt, null, 2)}\n`);
  return { repository, goal, evidencePath: join(goal, "proof", "automated", "evidence.json") };
}

test("agent-vision receipt and sanitized allowlist bind exact reviewed hashes", (context) => {
  const fixture = createGoalFixture();
  context.after(() => rmSync(fixture.repository, { recursive: true, force: true }));
  const validated = assertAgentVisionPass(fixture.goal, "proof/privacy-report.json", "proof/automated/agent-vision-receipt.json");
  assert.equal(validated.receipt.status, "PASS");
  const result = buildSanitizedCommitAllowlist(fixture.goal, { checkStaged: false });
  assert.deepEqual(result.files.map((file) => file.path), [...result.files.map((file) => file.path)].sort((a, b) => a.localeCompare(b, "en")));
  assert.ok(result.files.some((file) => file.path === "proof/automated/evidence.json"));
  assert.ok(result.files.some((file) => file.path === "proof/automated/agent-vision-receipt.json"));

  write(fixture.evidencePath, "{\"status\":\"CHANGED\"}\n");
  assert.throws(
    () => buildSanitizedCommitAllowlist(fixture.goal, { checkStaged: false }),
    /mutated after privacy (?:preparation|review)/,
  );
});

test("nonvisual sanitized package needs automated scan but no visual receipt", (context) => {
  const fixture = createGoalFixture();
  context.after(() => rmSync(fixture.repository, { recursive: true, force: true }));
  unlinkSync(join(fixture.goal, "proof", "automated", "agent-vision-receipt.json"));
  assert.doesNotThrow(() => buildSanitizedCommitAllowlist(fixture.goal, { checkStaged: false }));
});

test("sanitized allowlist rejects unexpected prestaged files", (context) => {
  const fixture = createGoalFixture();
  context.after(() => rmSync(fixture.repository, { recursive: true, force: true }));
  write(join(fixture.repository, "unexpected.txt"), "not part of reviewed goal package\n");
  execFileSync("git", ["add", "unexpected.txt"], { cwd: fixture.repository });
  assert.throws(() => buildSanitizedCommitAllowlist(fixture.goal), /unexpected prestaged files: unexpected\.txt/);
});

test("sanitized path mechanics reject traversal, symlinks, case and NFC ambiguity", (context) => {
  const fixture = createGoalFixture();
  context.after(() => rmSync(fixture.repository, { recursive: true, force: true }));
  const invalidPolicy = JSON.parse(readFileSync(join(fixture.goal, "sanitized-commit-manifest.json"), "utf8")) as Record<string, unknown>;
  invalidPolicy.include_exact = [...(invalidPolicy.include_exact as string[]), "../escape.txt"];
  const invalidPolicyPath = join(fixture.goal, "invalid-policy.json");
  write(invalidPolicyPath, `${JSON.stringify(invalidPolicy)}\n`);
  assert.throws(() => readSanitizedPolicy(invalidPolicyPath), /traversal segment/);
  assert.throws(() => assertNoPortableCollisions(["proof/automated/A.json", "proof/automated/a.json"]), /case path collision/);
  assert.throws(() => assertNoPortableCollisions(["proof/automated/cafe\u0301.json"]), /not NFC-normalized/);

  const link = join(fixture.goal, "proof", "automated", "linked.json");
  symlinkSync(fixture.evidencePath, link);
  assert.throws(() => buildSanitizedCommitAllowlist(fixture.goal, { checkStaged: false }), /symlink forbidden/);
});

test("agent-vision PASS cannot survive a changed privacy manifest", (context) => {
  const fixture = createGoalFixture();
  context.after(() => rmSync(fixture.repository, { recursive: true, force: true }));
  const privacyPath = join(fixture.goal, "proof", "privacy-report.json");
  write(privacyPath, `${readFileSync(privacyPath, "utf8").trim()}\n `);
  assert.throws(
    () => assertAgentVisionPass(fixture.goal, "proof/privacy-report.json", "proof/automated/agent-vision-receipt.json"),
    /manifest hash is stale/,
  );
});

test("hash helper uses raw bytes", () => {
  assert.notEqual(sha256Bytes("a\n"), sha256Bytes("a\r\n"));
});
