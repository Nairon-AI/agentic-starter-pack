import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { computeSkillRevision } from "../lib/skill-revision.ts";

test("skill revision is deterministic and excludes its evaluation receipt", () => {
  const root = mkdtempSync(join(tmpdir(), "verify-goal-skill-revision-"));
  mkdirSync(join(root, "assets"));
  writeFileSync(join(root, "SKILL.md"), "one\n");
  writeFileSync(join(root, "assets", "current-client-evaluation.json"), "first\n");
  const first = computeSkillRevision(root);
  writeFileSync(join(root, "assets", "current-client-evaluation.json"), "second\n");
  assert.equal(computeSkillRevision(root), first);
  writeFileSync(join(root, "SKILL.md"), "two\n");
  assert.notEqual(computeSkillRevision(root), first);
});
