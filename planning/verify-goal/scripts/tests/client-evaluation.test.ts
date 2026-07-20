import assert from "node:assert/strict";
import test from "node:test";
import { assertClientEvaluationMatches, parseClientEvaluationReceipt } from "../lib/client-evaluation.ts";

const HASH = "a".repeat(64);

function receipt(): string {
  const runs = ["browser_video", "external_tool_auth", "local_only", "migration_multi_role"].flatMap((archetype) => [1, 2].map((attempt) => ({
    id: `${archetype.replaceAll("_", "-")}-${attempt}`,
    archetype,
    attempt,
    status: "PASS",
    checked_at: "2026-07-20T00:00:00.000Z",
    contract_sha256: HASH,
  })));
  return `${JSON.stringify({
    schema_version: 1,
    client: { name: "codex", version: "codex-cli fixture" },
    skill_revision_sha256: HASH,
    status: "passed",
    evaluated_at: "2026-07-20T00:00:00.000Z",
    deterministic_checks: { typecheck: "PASS", tests: "PASS", skill_validation: "PASS" },
    matrix: { attempts_per_archetype: 2, total_runs: 8, passed_runs: 8 },
    runs,
  }, null, 2)}\n`;
}

test("client evaluation requires exact 4x2 hash-bound matrix", () => {
  const parsed = parseClientEvaluationReceipt(receipt());
  assert.doesNotThrow(() => assertClientEvaluationMatches(parsed, { name: "codex", version: "codex-cli fixture", skillRevisionSha256: HASH }));
  assert.throws(() => parseClientEvaluationReceipt(receipt().replace('"passed_runs": 8', '"passed_runs": 7')), /8\/8/);
  assert.throws(() => parseClientEvaluationReceipt(receipt().replace('"attempt": 2', '"attempt": 1')), /attempts 1 and 2/);
  assert.throws(() => assertClientEvaluationMatches(parsed, { name: "codex", version: "new", skillRevisionSha256: HASH }), /name\/version mismatch/);
});
