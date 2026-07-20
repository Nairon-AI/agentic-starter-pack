---
name: verify-goal
description: Create a researched, durable, approval-gated goal contract whose verification tools, repository-vault authentication, exact proof steps, rollout safety, and evidence lifecycle are ready before execution. Use when the user asks to set, create, refine, save, or verify a goal; asks whether an agent has everything needed to prove completion; wants a proof-driven alternative to a raw `/goal`; or explicitly invokes `$verify-goal`.
---

# Verify Goal

Create `goals/<slug>/GOAL.md` plus its machine readiness source and proof plan. Author and verify the contract; never implement the goal or start native `/goal` execution.

## Guardrails

- Require Node 22.18 or newer for bundled TypeScript scripts. On older Node, stop and explain how to upgrade. Do not download a runner or use duplicate compiled JavaScript.
- Run only for explicit goal authoring or `$verify-goal` invocation.
- Keep discovery read-only except goal-package files and approved safe verifier setup.
- Never call `create_goal`, implement product work, change production, or publish git/PR state while authoring.
- Never mark Verified with an unresolved criterion link, blocker, verifier, repository-vault path, authentication, capability check, exact scenario step, rollout safeguard, or approval.
- Never store secret values, tokens, cookies, CLI auth files, personal data, or machine-local configuration in the goal package.
- Do not use Treg. Assume a repository-approved secrets vault exists; find its documented mechanism.
- Match evidence to risk. Video supports proof; it never replaces automated/API/data assertions.

## Workflow

### 1. Orient and create Draft

- Call `get_goal` to expose current native-goal state. Do not replace it.
- Read repository instructions, docs, code, tests, configuration, vault setup, release workflow, and prior decisions.
- Identify outcome, work type, users/systems, scope, exclusions, authority, external boundaries, risks, rollout, and immutable version source.
- Create the package:

```bash
node <skill-dir>/scripts/create-goal-contract.ts <slug> [title]
```

The generator creates `GOAL.md`, JSON-compatible `verification-readiness.yaml`, sanitized commit manifest, exact proof plan/results, and evidence directories. `verification-readiness.yaml` is canonical; never edit rendered `GOAL.md` directly.

Read [references/readiness-and-handoff.md](references/readiness-and-handoff.md) completely. Claim or take over its single-writer lease before editing.

### 2. Close every capability gap

Read [references/tool-gap-analysis.md](references/tool-gap-analysis.md) completely.

- Map every success criterion to claims, verifier capabilities, scenarios, and planned artifacts using stable IDs.
- Inventory repo-native tests/scripts, installed CLIs, MCP servers, APIs, observability, environments, identities, and the repository vault.
- Run the required scoped Exa pass. If Exa must be installed/restarted, checkpoint Draft state and stop exactly as the reference requires.
- Prefer repo-native verification, then official vendor CLI/API/MCP, then the smallest safe tool.
- Install missing official tools automatically only when user-scoped, reversible, non-privileged, free, and outside project dependencies. Ask before system/project mutation, paid services, credential creation, or production.
- Authenticate each selected verifier during authoring through the repository vault. If the vault cannot support a safe provider test account, pause for user-assisted direct CLI login.
- Health-check/version-check and run a harmless capability smoke test. Store only safe receipt metadata and paths.
- Keep goal-installed verifier tools and safe test logins after completion. Never remove pre-existing tools or auth.

### 3. Define contract and exact proof

Fill `verification-readiness.yaml`, not `GOAL.md`:

- outcome, scope, constraints, non-goals, roles/systems, authority, risks, questions;
- full criterion → claim → authenticated verifier → scenario → artifact graph;
- Exa and authoritative sources with access dates and versions;
- repository-vault mechanism, safe reference names, identity alias, environment, auth timestamp, expiry, smoke receipts;
- risk-shaped release strategy: flag, cohort/canary, shadow/dual-run, phased migration, rollback/forward-fix, or justified `none`;
- evidence delivery: GitHub `pr` with `retain_until_pr_merged`, or `no_pr` with `retain_indefinitely`; other PR providers are unsupported in this release.

Fill `proof/proof-plan.md` before any browser command. Every scenario needs exact numbered user actions, expected observation per meaningful step, underlying assertion, identities/fixtures, reset, pass condition, criterion/claim/artifact IDs, and recording decision. Cover every identified material risk, role, state, and transition class. Give a reason for each excluded class. Do not impose a fixed failure-scenario cap or attempt every meaningless combination.

During execution, store machine-enforceable run state in `proof/execution-results.json`. Render `proof-results.md` from it and bind both files to readiness hashes.

```bash
node <skill-dir>/scripts/render-proof-results.ts goals/<slug>/proof/execution-results.json
node <skill-dir>/scripts/validate-execution-results.ts goals/<slug>/proof/execution-results.json
node <skill-dir>/scripts/list-sanitized-commit-files.ts goals/<slug> --json
```

For browser scenarios, read [references/browser-proof.md](references/browser-proof.md) completely. For PR delivery, read [references/pr-evidence.md](references/pr-evidence.md) completely.

### 4. Checkpoint and validate Draft

Checkpoint with compare-and-swap revision safety:

```bash
node <skill-dir>/scripts/checkpoint-readiness.ts goals/<slug> \
  --expected-revision <N> --expected-sha256 <HASH> \
  --owner <alias> --run-id <id> --action checkpoint
node <skill-dir>/scripts/render-goal.ts goals/<slug>/verification-readiness.yaml
node <skill-dir>/scripts/validate-readiness.ts goals/<slug>/verification-readiness.yaml
node <skill-dir>/scripts/validate-proof-plan.ts goals/<slug>/proof/proof-plan.md
node <skill-dir>/scripts/validate-goal-contract.ts goals/<slug>/GOAL.md
```

Fix every machine-detectable problem. Human approval owns only irreducible judgment such as risk sufficiency.

### 5. Obtain explicit approval

Present objective, criteria, exclusions, capability/auth receipts, proof scenarios, rollout, lifecycle, retained risks, and exact contract. Use native structured user input; typed approval is fallback. Never infer approval.

- Revision requested: keep Draft, edit canonical readiness/plan, checkpoint, render, and revalidate.
- Approved: run the hash-binding approval command with the exact approver alias and native UI method:

```bash
node <skill-dir>/scripts/approve-readiness.ts goals/<slug> \
  --expected-revision <N> --expected-sha256 <HASH> \
  --owner <author-alias> --approver <approver-alias> --method structured-input
```

Use `--method typed` only for explicit typed fallback approval. The command refuses blockers, remaining checks, stale bytes, invalid proof plans, missing receipts, unsupported clients, and incomplete graphs; it renders Verified output and releases the authoring lease atomically.

Bind approval to the approved build, proof, access, and release meaning. Require fresh approval when any of those change. Compatible login refreshes, test results, receipts, timestamps, lease updates, and PR-state updates keep approval only when validators pass.

Run all validators again, including:

```bash
node <skill-dir>/scripts/validate-readiness.ts \
  goals/<slug>/verification-readiness.yaml --require-ready
```

Only a passing ready contract receives `# ✅ Verified Goal` and its copyable command:

```text
/goal Execute the verified goal contract at goals/<slug>/GOAL.md
```

### 6. Hand off

Report the contract path and start command. Tell the executor to inspect current `/goal` state first.

During execution the contract requires:

- acquire/take over the lease; revalidate source hashes, vault access, auth, tool versions, environment, and capability smoke tests;
- repair only compatible small drift and update receipts; major tool/permission/environment/scope drift returns the contract to Draft;
- run automated assertions, reset, then clean scenario replay;
- retain only final passing footage; summarize failed attempts without retaining raw/failed video;
- keep PR goals active through `awaiting_merge`, merged-PR verification, exact remote SHA-256, receipt update, and local MP4 deletion;
- retain no-PR MP4 locally indefinitely;
- stage only paths printed by the sanitized manifest command; never `git add .` or `git add -A`;
- complete native goal only after every criterion and cleanup gate passes. Fail closed without deleting the only evidence.

## Skill release gate

Read [references/evaluation.md](references/evaluation.md) before changing this skill. Every revision must pass deterministic checks plus two isolated fresh-agent attempts for each of four fake archetypes on the current client: local-only, external tool/auth, browser/video, and migration/multi-role. Any mandatory-invariant failure blocks handoff. Other clients remain best-effort until they pass the same gate.
