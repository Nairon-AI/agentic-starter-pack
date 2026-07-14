---
name: speedup-proof
description: Find software performance hotspots, propose focused safe optimizations, require explicit user approval before changing any project file, and prove or reject approved changes with repeatable before-and-after benchmarks. Use when Codex is asked to make code faster, optimize a function or hot path, reduce runtime work, investigate a performance regression, benchmark a command, validate a refactor, compare performance before and after a change, or produce an evidence-backed optimization report while preserving behavior.
---

# Speedup Proof

Treat every optimization as a falsifiable experiment: inspect first, propose one exact change, obtain explicit approval, preserve behavior, measure a baseline, implement only the approved change, verify correctness, measure again, and keep only a result supported by evidence.

## Require approval before edits

Treat invocation of `$speedup-proof` as consent to inspect the project, never as consent to modify it.

- Always begin with read-only analysis, even when the initial request says optimize, apply, fix, implement, or use `prove` mode.
- Do not create or edit project files, benchmark harnesses, tests, reports, dependency files, configuration, worktrees, or generated artifacts before the approval checkpoint.
- Do not install dependencies, run formatters, execute migrations, or run commands that can mutate project state before approval.
- Never interpret broad phrases such as `optimize this codebase`, `do it`, or a bare skill invocation as approval for an unseen patch.
- Ask for approval only after showing a concrete bounded proposal. Do not ask for blank-cheque approval before analysis.

Present this checkpoint and stop:

```markdown
## Proposed speedup

- Hotspot: file and line
- Evidence: why this path is likely costly
- Exact files to change or create
- Proposed transformation
- Behavior that must remain identical
- Benchmark and test plan
- Main risk
- Scope: one logical optimization

No project files have been modified. Do you want me to apply this exact change?
```

Continue only after the user explicitly approves that displayed proposal. Approval applies only to the listed files and transformation. If the scope, file list, behavior, dependencies, or optimization changes, stop and request fresh approval. Never apply a second unrelated optimization under the first approval.

## Select a mode

- Use `prove` when asked to optimize, fix, improve, or speed up code. Inspect, propose, wait for approval, then measure, edit, verify, remeasure, and report.
- Use `audit` when asked to inspect, analyze, scan, or report. Rank candidates without editing source files.
- Use `regression` when asked what became slower in a branch, commit, PR, or recent change. Compare equivalent workloads without disturbing uncommitted work.

Never edit files in `audit` mode. In every other mode, require the approval checkpoint before modifying project state.

## Run the proof workflow

### 1. Establish the contract

- Identify the exact function, endpoint, render path, query, build step, or command in scope.
- Record outputs, ordering, errors, side effects, public APIs, permissions, persistence, and other behavior that must remain stable.
- Detect the relevant tests, typecheck, lint, and build commands.
- Choose realistic input sizes and distributions. Do not prove a production claim with a toy fixture.

### 2. Find and rank candidates

- Prefer profiler output, telemetry, traces, slow tests, query logs, or existing benchmarks.
- Otherwise inspect likely hot paths for repeated scans, nested lookups, unnecessary allocations, repeated parsing or serialization, N+1 I/O, render churn, duplicate filesystem work, and avoidable recomputation.
- Rank candidates by execution frequency × input size × unit cost × confidence.
- Read `references/optimization-patterns.md` when selecting transformations.
- Pick one high-confidence candidate. Do not bundle unrelated changes into one measurement.

### 3. Request approval

- Show the required approval checkpoint with the exact hotspot, evidence, files, transformation, preserved behavior, benchmark, tests, and risk.
- State clearly that no project files have been modified.
- Stop and wait for explicit approval.
- If approval is denied, offer the read-only findings and make no changes.

### 4. Measure the baseline

- Reuse an existing benchmark only when it exercises the relevant behavior.
- Otherwise create the smallest harness that imports real production code and uses deterministic, representative fixtures.
- Exclude fixture construction from the timed region unless setup is part of the user-visible workload.
- Run at least 2 warmups and 7 measured iterations. Use more for short or variable work.
- Keep runtime, dependencies, machine conditions, fixtures, caches, and command equivalent before and after.
- Use median as the primary metric; retain p95, range, and coefficient of variation.
- Read `references/measurement-playbook.md` before creating a new benchmark.
- Use the bundled runner when command-level timing is appropriate:

```bash
python3 scripts/benchmark_command.py --label before --warmups 2 --runs 9 --output before.json -- python3 benchmark.py
```

If the workload depends on uncontrolled network latency, shared remote services, changing data, or interactive timing, isolate the variable or return `INCONCLUSIVE`.

### 5. Make the approved safe change

- Modify only the files and behavior described in the approved proposal.
- Add or strengthen a focused correctness test first when behavior is ambiguous.
- Preserve output equality, ordering, side effects, authorization, error handling, and public interfaces.
- Keep the patch small enough to attribute the measured effect.
- Do not add caching without an invalidation strategy.
- Do not remove validation, security, logging, accessibility, or error handling to manufacture a speedup.

### 6. Verify and remeasure

- Run the narrowest correctness test, then the broadest relevant test/build/typecheck.
- Rerun the exact same benchmark under equivalent conditions.
- Compare the two evidence files:

```bash
python3 scripts/compare_results.py before.json after.json comparison.json --correctness passed
```

- Reject or revert the optimization if it breaks behavior or causes a regression. Never retain a slower patch only because its Big-O estimate looks cleaner.

### 7. Report the verdict

Use one evidence label:

- `PROVEN` — Correctness checks pass and stable measurements beat the noise threshold.
- `INCONCLUSIVE` — The difference is too small, noisy, unrepresentative, or correctness is unverified.
- `REGRESSION` — The after measurement is materially slower or correctness fails.
- `UNMEASURED` — No credible benchmark could be constructed within scope.

Never claim a speedup from Big-O reasoning, code appearance, one run, or an estimated percentage. Complexity analysis may explain an observed result; it cannot replace measurement.

## Create the native report

For a completed `prove` or `regression` run, create:

- `outputs/speedup-proof-results.json` — machine-readable benchmark and comparison evidence.
- `outputs/speedup-proof-report.md` — the user-facing report that opens directly in Codex and renders on GitHub.

Prepare a context JSON following `references/report-schema.md`, then run:

```bash
python3 scripts/generate_report.py comparison.json context.json outputs/speedup-proof-report.md
```

Include the target, contract, verdict, before/after table, exact workload, modification, clickable changed-file links, tests, reproduction steps, limitations, and residual risks. Open or link the Markdown report in Codex; do not leave the user with raw logs alone.

## Protect regression comparisons

- Preserve uncommitted work.
- Prefer an existing separate worktree or create a temporary worktree for the comparison revision.
- Keep dependency versions, runtime, fixtures, environment, warmups, and runs identical.
- Do not rewrite history, reset the working tree, or modify lockfiles merely to benchmark.
- Attribute a regression to the revision only when the workloads are equivalent.

## Hand off the result

Report the verdict first, then:

1. Before and after medians
2. Percentage change and speedup ratio when proven
3. Benchmark command, input scale, warmups, runs, and variability
4. Files changed
5. Correctness checks
6. Limitations or residual risk
7. Link to `outputs/speedup-proof-report.md`

If no safe measurable win exists, say so directly. An honest `INCONCLUSIVE` result is more valuable than an invented optimization.
