import { readFileSync } from "node:fs";
import { basename } from "node:path";

export const EVALUATION_ARCHETYPES = [
  "browser_video",
  "external_tool_auth",
  "local_only",
  "migration_multi_role",
] as const;

export type EvaluationArchetype = typeof EVALUATION_ARCHETYPES[number];

export interface ClientEvaluationRun {
  id: string;
  archetype: EvaluationArchetype;
  attempt: 1 | 2;
  status: "PASS";
  checked_at: string;
  contract_sha256: string;
}

export interface ClientEvaluationReceipt {
  schema_version: 1;
  client: { name: string; version: string };
  skill_revision_sha256: string;
  status: "passed";
  evaluated_at: string;
  deterministic_checks: {
    typecheck: "PASS";
    tests: "PASS";
    skill_validation: "PASS";
  };
  matrix: {
    attempts_per_archetype: 2;
    total_runs: 8;
    passed_runs: 8;
  };
  runs: ClientEvaluationRun[];
}

const SHA = /^[a-f0-9]{64}$/;

function exactKeys(value: Record<string, unknown>, expected: readonly string[], name: string): void {
  const actual = Object.keys(value).sort().join("\0");
  const wanted = [...expected].sort().join("\0");
  if (actual !== wanted) throw new Error(`${name} has unexpected or missing keys`);
}

function object(value: unknown, name: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(`${name} must be an object`);
  return value as Record<string, unknown>;
}

function validDate(value: unknown): value is string {
  return typeof value === "string" && Number.isFinite(Date.parse(value));
}

export function parseClientEvaluationReceipt(raw: string): ClientEvaluationReceipt {
  const parsed: unknown = JSON.parse(raw);
  if (`${JSON.stringify(parsed, null, 2)}\n` !== raw) throw new Error("client evaluation receipt must be canonical JSON");
  const value = object(parsed, "client evaluation receipt");
  exactKeys(value, ["schema_version", "client", "skill_revision_sha256", "status", "evaluated_at", "deterministic_checks", "matrix", "runs"], "client evaluation receipt");
  if (value.schema_version !== 1 || value.status !== "passed") throw new Error("client evaluation receipt must be schema 1 and passed");
  if (!validDate(value.evaluated_at) || typeof value.skill_revision_sha256 !== "string" || !SHA.test(value.skill_revision_sha256)) {
    throw new Error("client evaluation receipt needs timestamp and skill revision SHA-256");
  }
  const client = object(value.client, "client evaluation receipt client");
  exactKeys(client, ["name", "version"], "client evaluation receipt client");
  if (typeof client.name !== "string" || !client.name || typeof client.version !== "string" || !client.version) throw new Error("client name/version are required");
  const checks = object(value.deterministic_checks, "client evaluation deterministic checks");
  exactKeys(checks, ["typecheck", "tests", "skill_validation"], "client evaluation deterministic checks");
  if (checks.typecheck !== "PASS" || checks.tests !== "PASS" || checks.skill_validation !== "PASS") throw new Error("all deterministic evaluation checks must PASS");
  const matrix = object(value.matrix, "client evaluation matrix");
  exactKeys(matrix, ["attempts_per_archetype", "total_runs", "passed_runs"], "client evaluation matrix");
  if (matrix.attempts_per_archetype !== 2 || matrix.total_runs !== 8 || matrix.passed_runs !== 8) throw new Error("client evaluation matrix must record 8/8 runs");
  if (!Array.isArray(value.runs) || value.runs.length !== 8) throw new Error("client evaluation receipt must contain 8 runs");
  const runs = value.runs.map((item, index): ClientEvaluationRun => {
    const run = object(item, `client evaluation run ${index}`);
    exactKeys(run, ["id", "archetype", "attempt", "status", "checked_at", "contract_sha256"], `client evaluation run ${index}`);
    if (typeof run.id !== "string" || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(run.id)) throw new Error(`client evaluation run ${index} has invalid id`);
    if (!EVALUATION_ARCHETYPES.includes(run.archetype as EvaluationArchetype)) throw new Error(`client evaluation run ${run.id} has invalid archetype`);
    if (run.attempt !== 1 && run.attempt !== 2) throw new Error(`client evaluation run ${run.id} has invalid attempt`);
    if (run.status !== "PASS" || !validDate(run.checked_at) || typeof run.contract_sha256 !== "string" || !SHA.test(run.contract_sha256)) {
      throw new Error(`client evaluation run ${run.id} is not a hash-bound PASS`);
    }
    return run as unknown as ClientEvaluationRun;
  });
  if (new Set(runs.map((run) => run.id)).size !== 8) throw new Error("client evaluation run IDs must be unique");
  for (const archetype of EVALUATION_ARCHETYPES) {
    const attempts = runs.filter((run) => run.archetype === archetype).map((run) => run.attempt).sort();
    if (attempts.join(",") !== "1,2") throw new Error(`client evaluation needs attempts 1 and 2 for ${archetype}`);
  }
  return value as unknown as ClientEvaluationReceipt;
}

export function readClientEvaluationReceipt(path: string): ClientEvaluationReceipt {
  try {
    return parseClientEvaluationReceipt(readFileSync(path, "utf8"));
  } catch (error) {
    throw new Error(`${basename(path)} invalid: ${error instanceof Error ? error.message : String(error)}`);
  }
}

export function assertClientEvaluationMatches(
  receipt: ClientEvaluationReceipt,
  expected: { name: string; version: string; skillRevisionSha256: string },
): void {
  if (receipt.client.name !== expected.name || receipt.client.version !== expected.version) throw new Error("client evaluation name/version mismatch");
  if (receipt.skill_revision_sha256 !== expected.skillRevisionSha256) throw new Error("client evaluation skill revision mismatch");
}
