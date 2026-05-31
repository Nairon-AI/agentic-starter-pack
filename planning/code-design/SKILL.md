---
name: code-design
description: Create a high-quality code design document through an iterative research/design/audit workflow
aliases: code-design,design-doc,iterative-design,architecture-design
usage: /goal code-design --doc .ai/docs/realtime-voice/design-feature-name.md --title "Feature name" --minutes 7 -- Describe the issue, feature, constraints, known files, and desired outcome
examples: /goal code-design --doc .ai/docs/realtime-voice/design-copy-capture-command.md --title "Copy capture command" --minutes 7 -- Design a command that copies the current capture buffer to the clipboard; /goal iterative-design --doc .ai/docs/realtime-voice/design-utterance-aggregation-delay.md --title "Utterance aggregation delay" --minutes 10 -- Design configurable transcript aggregation before capture/backend routing
allow_commands: true
command_timeout_ms: 10000
command_output_limit: 30000
---

Create a code design document for the requested issue, feature, improvement, or architectural change.

<design_goal_request>
  <title>{{title}}</title>
  <target_design_doc>{{doc}}</target_design_doc>
  <minimum_effort_floor_minutes>{{minutes}}</minimum_effort_floor_minutes>
  <context>{{args}}</context>
</design_goal_request>

This is a **design-document goal**, not an implementation goal. Do not edit runtime/source code for the feature unless the user explicitly authorizes implementation in the goal context. Design artifacts, validation probes for the design document, and documentation edits directly needed for the design goal are allowed when appropriate.

## Phase 1: Goal initialization and readiness

1. Confirm that this goal is already initialized from the reusable `iterative-code-design` goal template.
2. Confirm the target design document path: `{{doc}}`.
3. Confirm the minimum effort floor: `{{minutes}}` minutes.
   - Treat this as a hard minimum eligibility floor only.
   - Do not use `sleep` to satisfy the floor.
   - Take all time necessary for a clean, high-quality architectural design.
   - Do not stop just because the floor is met.
4. Read `AGENTS.md` and any project-local instructions relevant to the target files/workstream.
5. Read project design/style guides when present:
   - `.ai/docs/architecture-and-system-design-style.md`
   - `.ai/docs/code-style.md`
6. If this template itself is being revised, read `.ai/docs/prompt-template-authoring.md` first.
7. Explicitly restate the design objectives, scope, constraints, and repository guidance before drafting.

Use this initial read-only repository context, then inspect targeted files directly as needed:

<repo_status>
!`git status --short --untracked-files=all`
</repo_status>

<existing_design_docs>
!`find .ai/docs -type f -name 'design-*.md' 2>/dev/null | sort | tail -80`
</existing_design_docs>

## Phase 2: Design scope and objectives

Design the cleanest, most robust implementation possible for `{{title}}`, grounded in the provided context and inspected code/docs.

The design must keep the architecture:

- **Encapsulated**: separate provider/model/platform mechanics from core domain/routing logic or equivalent ownership boundaries.
- **Provider-neutral where appropriate**: avoid vendor-locking behavior in core domain layers. Keep provider-specific behavior under provider-owned modules.
- **Decoupled**: minimize scattered conditionals by relying on typed behavior/configuration boundaries.
- **Testable**: define deterministic validation, live validation where required, and false-green risks.
- **Maintainable**: keep file ownership clear, avoid vague managers/abstractions, and prefer small concrete modules.
- **Design-compressed**: when later evidence shows an existing code shape is too narrow, prefer reshaping that existing decision over adding a second nearby path.

The design document must answer:

- What user/problem outcome is being designed?
- What current code/docs/evidence are relevant?
- What architecture and file ownership should be used?
- What existing code or design decisions constrain this work?
- Which existing assumptions might become too narrow because of this work?
- What state, replay, lifecycle, UI, provider, or OS boundaries are affected?
- What edge cases and failure modes matter?
- What validation proves the design and later implementation?
- What is explicitly out of scope?

## Phase 3: Baseline design inventory

Before drafting the proposed design, create a `Baseline design inventory` section in `{{doc}}`.

This is mandatory. Do not skip it. Do not treat it as optional background research.

The inventory must list the existing design decisions in the current repo that constrain, shape, or risk being invalidated by the requested design.

A baseline decision can come from:

- current code structure;
- current file or module ownership;
- existing types, commands, tools, events, state, lifecycle hooks, provider boundaries, UI boundaries, or persistence paths;
- prior design docs;
- issue docs or validation probes;
- git history for the target files when useful;
- earlier implementation choices visible in the current code.

For every relevant existing decision, write one row in this format:

| id | source | decision | location | current assumption | why it matters now | pressure signal |
| --- | --- | --- | --- | --- | --- | --- |
| B1 | existing code | Realtime requests enter Pi through `pi-realtime.request` custom messages instead of normal user messages | `.pi/extensions/pi-realtime/runtime.ts`, `.pi/extensions/pi-realtime/service.ts` | Realtime-originated work must remain visibly distinct from typed user turns | The new design must preserve backend routing semantics | If the design adds another request route or wraps this path, review whether the original route should be widened instead |

Rules:

1. `id` must be stable within the document: `B1`, `B2`, `B3`.
2. `source` must name where the decision came from, such as `existing code`, `design doc`, `issue doc`, `validation probe`, or `git history`.
3. `decision` must describe the actual design choice, not a vague topic.
4. `location` must name concrete files, symbols, docs, or probes.
5. `current assumption` must state what the existing design appears to believe.
6. `why it matters now` must connect the existing decision to this requested design.
7. `pressure signal` must say what kind of future finding would force this decision to be reviewed.

If no baseline decision is found, the design document must include a `Baseline design inventory` section with:

- files/docs/probes inspected;
- why none of them constrain the requested design;
- what evidence would change that conclusion.

Do not proceed to the main proposed design until this baseline section exists.

## Phase 4: Iterative design loop

Iterate continuously through this loop until the design is semantically complete.

Each iteration must include all six steps below. Do not skip the design compression review.

### 1. Interrogate

For each iteration, formulate and answer the 5 most critical technical questions about the design.

Cover:

- functional requirements;
- architecture;
- code ownership;
- baseline decisions from the `Baseline design inventory`;
- edge cases;
- maintainability;
- extensibility;
- project standards;
- validation;
- known risks.

At least one question in each iteration must explicitly reference one or more baseline decision ids, such as `B1` or `B3`.

### 2. Research

Inspect the codebase, docs, examples, design guides, validation probes, prior issue/design docs, and external docs if needed.

Do not rely on memory when concrete file evidence is available.

Record the important files/docs inspected inside the design document.

When research touches a file, symbol, behavior, state path, provider path, lifecycle hook, command, or tool already named in the `Baseline design inventory`, record that connection in the design document.

### 3. Synthesize

Integrate findings directly into `{{doc}}`:

- design choices;
- rejected alternatives;
- API/type/state sketches when useful;
- file-by-file implementation shape;
- validation plan;
- live-validation requirements and caveats;
- risks and mitigations;
- unresolved questions or blockers.

Every new proposed design choice that constrains implementation must be recorded in a `Proposed design decision ledger`.

Use this format:

| id | decision | location | reason | assumption | related baseline ids |
| --- | --- | --- | --- | --- | --- |
| D1 | Add a provider-neutral capture buffer service instead of putting capture state in the command handler | `.pi/extensions/pi-realtime/service.ts`, `.pi/extensions/pi-realtime/runtime.ts` | Keeps command wiring separate from capture state | Capture buffering is core realtime domain behavior | B2, B4 |

Rules:

1. `id` must be stable within the document: `D1`, `D2`, `D3`.
2. `decision` must name the actual implementation-shaping choice.
3. `location` must name concrete files, symbols, docs, or probes.
4. `reason` must explain why this shape is better than a local patch.
5. `assumption` must state what the proposed design depends on.
6. `related baseline ids` must list every baseline decision this proposed choice touches. Use `none` only when the choice truly does not touch an existing decision.

### 4. Design compression review

This step is mandatory in every iteration after synthesis.

Review every row in:

- `Baseline design inventory`;
- `Proposed design decision ledger`.

For each row, answer these exact checks:

1. Does the current proposed design touch the same `location`?
2. Does the current proposed design reuse the same behavior, state, event, tool, command, provider boundary, UI boundary, lifecycle hook, or persistence path?
3. Does the current proposed design make the recorded `current assumption` or `assumption` too narrow?
4. Would keeping this decision force the implementation plan to add a new branch, helper, adapter, mode, fallback, wrapper, or parallel path near the same `location`?
5. Would rewriting, splitting, or merging this decision make the final implementation smaller, clearer, or more consistent?

For every `yes`, add or update a `Compression review` section in `{{doc}}`.

Use this format:

| review id | decision id | trigger | finding | action | design update required |
| --- | --- | --- | --- | --- | --- |
| C1 | B2 | New command also needs capture text | Existing command-local capture shape would create a second capture path | rewrite | Move capture ownership into provider-neutral service before designing the command |

The `action` must be exactly one of:

- `keep`: the existing or proposed decision still fits the final design.
- `rewrite`: replace the decision with a broader or simpler design.
- `split`: separate two responsibilities that were combined too early.
- `merge`: fold the new behavior into an existing path instead of adding another path.
- `defer`: leave the pressure unresolved, with the exact reason and risk named.

Operational rules:

1. If action is `rewrite`, `split`, or `merge`, update the proposed design before continuing to the next iteration.
2. If action is `keep`, the finding must explain why the current shape still fits.
3. If action is `defer`, the design must name the exact risk left for implementation or future work.
4. Do not write vague findings like `reviewed`, `looks fine`, or `no issue`.
5. Do not call the design complete while a compression review says `rewrite`, `split`, or `merge` and the document has not been updated to match that action.

### 5. Reformat

Review the whole design document for coherence.

Restructure unclear sections so the document becomes the best possible draft so far, not a chronological scratchpad.

The baseline inventory, proposed decision ledger, and compression review must remain readable as durable design evidence. They may be reorganized, but they must not be deleted unless their content is replaced by an equally explicit section.

### 6. Repeat

Continue iterating until all are true:

- the `{{minutes}}` minute floor has been met;
- the `Baseline design inventory` exists and is grounded in inspected files/docs/probes;
- the `Proposed design decision ledger` covers every implementation-shaping proposed decision;
- the `Compression review` has evaluated every baseline and proposed decision touched by the final design;
- every `rewrite`, `split`, or `merge` action has been reflected in the final proposed design;
- the design document is complete, internally coherent, and strong enough to guide implementation without major architecture decisions left to the implementer.

## Phase 5: Design document requirements

Write the final design document to:

`{{doc}}`

Recommended structure:

1. `# Design: {{title}}`
2. Intent / problem statement.
3. Scope and non-goals.
4. Current evidence and inspected files.
5. Baseline design inventory.
6. Proposed behavior.
7. Architecture and file ownership.
8. Proposed design decision ledger.
9. Compression review.
10. State/replay/lifecycle considerations if relevant.
11. UI/command/tool/provider/platform considerations if relevant.
12. Edge cases and failure modes.
13. Validation plan.
14. Implementation sequence or patch-shape guidance.
15. Open questions / decisions needed, if any.
16. Completion audit against project guides.

Do not include placeholder sections like `TODO`, `TBD`, or empty headings. If a section is not applicable, explicitly say why or omit it.

The `Baseline design inventory`, `Proposed design decision ledger`, and `Compression review` sections are not optional. If one of them has no rows, the section must explain why, using inspected evidence.

## Phase 6: Final validation and closeout

Before marking the goal complete:

1. Audit `{{doc}}` against:
   - `AGENTS.md`;
   - `.ai/docs/architecture-and-system-design-style.md` when present;
   - `.ai/docs/code-style.md` when present;
   - any workstream-specific docs discovered during research.
2. Verify the document exists and has no placeholders:
   - `test -f {{doc}}`
   - `rg -n "TODO|TBD|FIXME|placeholder" {{doc}}` should find nothing unless discussing those words as concepts.
3. Verify the document is visible or intentionally ignored according to repo policy:
   - `git status --short --untracked-files=all`
   - `git check-ignore -v {{doc}} || true`
4. Verify that the design-compression sections exist:
   - `rg -n "Baseline design inventory|Proposed design decision ledger|Compression review" {{doc}}`
5. Verify that compression actions are resolved:
   - No `rewrite`, `split`, or `merge` action may remain without a matching design update described in the document.
   - Every `defer` action must name the risk, reason, and owner of the future decision.
6. If the design proposes code changes, specify the exact validation gates a future implementation must run.
7. Mark the goal complete only after all completion gates are met:
   - minimum floor met;
   - design semantically complete;
   - baseline design inventory completed;
   - proposed design decision ledger completed;
   - compression review completed;
   - unresolved compression actions either applied or explicitly deferred with risk.

Final response must include:

- design doc path;
- key design decisions;
- baseline decisions reviewed;
- compression actions taken;
- files/docs inspected;
- validation/check commands run;
- unresolved decisions, if any;
- whether the document is tracked or ignored by git policy.

---
IMPORTANT:
----
Do not treat the minimum minute mark as a completion gate, instead of treat it as only the earliest possible wrap-up point.
 1. Iterate until the design is actually high-quality and complete.
 2. Use the N-minute floor only as a minimum eligibility check, not as a completion gate.
 3. If the floor is met but the design still has unresolved structure, weak sections, missing research, or insufficient audit, keep going.
 4. Only mark the goal complete after both are true:
     - floor met
     - design semantically complete

 The instruction “take all the time necessary” should override any impulse to stop at the minimum.
