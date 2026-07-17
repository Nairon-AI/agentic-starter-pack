---
name: figure-it-out
description: "Design an auditable playbook when no narrower one fits: a large migration, an ambitious multi-part change, or work a human reviews after stepping away. Scales rigor to the task, runs a hypothesis loop, and logs decisions via show-me-your-work. Use for /figure-it-out, 'figure it out', a large migration, or when no narrower playbook applies."
---

# Figure it out

When the task matches no playbook, design one. The deliverable before any code is the workflow itself: a sequence of phases that scales rigor to the task, runs the scientific method, and leaves a decision trail a human can audit after stepping away. Bias toward more rigor. The cost of building the wrong thing dwarfs the cost of being careful.

Do not reinvent a playbook already present in the repo. Route focused work to narrower skills such as `diagnose`, `rca`, `speedup-proof`, `prototype`, `implement`, or `plan`. Use this skill for large cross-cutting work or work the user will review after stepping away. The rigor and audit trail are the point.

## Start

Use the environment's plan or task tracker. Make the first item read `brain/principles.md` and the linked principles relevant to this task. Then add the phases below.

## Phase A: Frame

Ground first, then commit. Don't start the run until you can state:

- The definition of done as a falsifiable predicate. Follow `brain/principles/prove-it-works.md`; "done well" must be checkable.
- Scope, quantified: rough units and effort, plus the blockers grounding surfaced. Raise them before spending hours, not after fifty doomed commits.
- The rigor level, biased high. One-way doors and high blast radius get more; reversible low-stakes steps get less. Rigor is gates and artifacts, not "try harder".

Present the framing and tradeoffs before committing to a long run. Follow `brain/principles/never-block-on-the-human.md` for reversible work, but keep one checkpoint before a multi-hour run.

## Phase B: Design the workflow

Decompose into atomic, independently landable units. Sequence riskiest-unknown-first so option value stays high. Follow `brain/principles/foundational-thinking.md`: scaffold and verification precede features.

- Build the verification harness before the work, with the baseline captured from the pre-change state, so the check reads as "old value vs new value".
- For one-way-door design decisions, run `architect` (which uses `arena`) with diverse, isolated candidates and an independent judge. Skip it for mechanical work whose shape is concrete. Do not rerun an arena over a settled design without new evidence.
- Decide what fans out. Parallelize only across genuine seams. Give each worker isolated files or state; use worktrees or branches only when authorized and useful. Follow `brain/principles/serialize-shared-state-mutations.md`.
- Write the designed phase list down. That list is what the human reviews.

Then put the design into motion. Add concrete workflow steps to the tracker. Run each under the Phase C loop discipline and append a Phase D log row as each step lands.

## Phase C: Run the loop

Each unit is an experiment: state the hypothesis, make the smallest change, measure against the predicate on the real artifact, keep it if it advanced, and undo only that unit in a recoverable way if it did not. Preserve unrelated user changes.
Apply `principle-sequence-verifiable-units`, verifying each unit before starting the next instead of batching checks at the end.

- Verify by inspecting the artifact, never a self-report. When something passes too easily, suspect the observation method before the system. A blank screenshot passes a lazy gate.
- Pair delegated work with a judge and audit the delegates' artifacts yourself before trusting them. If a worker games the gate, reset and harden the contract. If the gate itself is wrong, fix the gate in its own change rather than routing around it.
- A verdict is VERIFIED, NOT VERIFIED, or INCONCLUSIVE. Inconclusive is not a pass. Don't hide a negative.

## Phase D: Keep the audit trail

Log the run via `show-me-your-work`: one canonical TSV with a row per decision and unit, evidence as links. Commit the trail only when confidence must be shown in review. Prefer evidence from scripts a reviewer can rerun.

## Phase E: Verify and hand back

Check the whole against the Phase A predicate on the real product, not just the harness. Follow `brain/principles/encode-lessons-in-structure.md`: turn recurring corrections into a gate, lint rule, check, or script.

**Reply:** the playbook you designed, the rigor level and why, the decision-trail path, what's verified against the predicate, and what's still open.
