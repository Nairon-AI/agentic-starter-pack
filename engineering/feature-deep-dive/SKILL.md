---
name: feature-deep-dive
description: Perform a technical end-to-end deep dive on one specific feature, grill the design, and produce a debug-grade map of how it actually works. Use when the user wants to deeply understand one subsystem, trace a feature from UI to data to jobs to providers, stress-test assumptions, or create a technical explainer for a single area.
---

# Feature Deep Dive

Take one feature or subsystem and understand it deeply enough to debug, change, review, or redesign it with confidence. This is the technical layer that comes after a high-level tour.

Do not change code unless the user explicitly asks. Start with understanding.

Default posture: a feature deep dive is the prerequisite for building on an existing feature area. Before implementing a feature, upgrade, or meaningful change on top of existing behavior, first verify the developer understands the current feature end-to-end: UI/API entry points, state ownership, jobs, providers, failure modes, tests, and debug handles.

This is also an interactive teaching workflow. Do not only write a technical explainer. Walk the developer through each layer, ask them to repeat their understanding, validate it against the code, and push back when their explanation is too vague or misses an important boundary.

## Truth-seeking posture

I value truth over being right. Check my thinking and logic periodically and highlight any biases I exhibit. Show me the angles I do not see or systematically ignore and mark them with 📐 emoji

If you think there is some possible problem or mistake in my logic (either in the question, or my assumptions), point it out and mark it with ☝️emoji

## Quick Start

1. **Choose one feature only**
   - Narrow the scope to a single vertical slice or subsystem.
   - Examples:
     - invite claim
     - promotion scheduling
     - content generation callback flow
     - search ranking

2. **Choose the doc home**
   - If the repo has a convention, follow it.
   - Otherwise create `docs/feature-deep-dives/<feature-slug>.md`.

3. **Frame the feature before tracing**
   - user goal
   - trigger
   - success condition
   - core business object(s)
   - boundaries

4. **Anchor to the high-level tour when available**
   - Start from the parent journey doc if one exists.
   - Inherit:
     - parent journey
     - why this slice matters
     - open questions from the high-level tour

## Deep-Dive Workflow

1. **Trace end-to-end**
   - UI or entry point
   - API or command boundary
   - services/helpers
   - persistence
   - jobs/events/background work
   - external integrations
   - tests and fixtures

2. **Build the technical map**
   - runtime path
   - state machine
   - important types/contracts
   - invariants and assumptions
   - hidden branches
   - retries, idempotency, race conditions
   - permissions and role gates
   - observability and debug handles
   - source of truth
   - owner surface
   - first alert/debug surface

3. **Grill the feature**
   - Why is state owned here and not elsewhere?
   - What is the source of truth?
   - What happens on duplicate requests?
   - What happens on partial failure?
   - What behavior is legacy/backcompat?
   - What manual ops step exists because code is weak?
   - What tests would catch the most important regressions?

4. **Resolve drift as you go**
   - If code and docs disagree:
     - intended -> update docs now
     - bug -> flag or fix
     - unclear -> ask the user and leave ambiguity explicit only if unresolved

5. **Separate intended from accidental behavior**
   - intended design
   - current actual behavior
   - bugs
   - product debt
   - risky ambiguity

6. **Teach the feature layer by layer**
   - Walk from outside-in, then inside-out:
     - user/business goal
     - trigger and entry points
     - UI/API boundary
     - service/helper path
     - persistence and source of truth
     - jobs/events/background work
     - external providers/webhooks
     - permissions/role gates
     - failure modes/retries/idempotency
     - observability/debug playbook
     - tests that protect it
   - After each layer, ask the developer to explain what they understood.
   - Validate the explanation against the code map.
   - If it is vague, ask a sharper question that reveals the gap.
   - If it is wrong, correct it and ask them to restate before moving on.
   - Do not proceed to implementation until the developer can accurately explain the feature's source of truth, runtime path, provider dependencies, and first debug handles.
   - End every walkthrough response with an ASCII progress bar showing how far through the feature deep dive the user is and what remains.
   - Alongside the progress bar, include estimated time/questions left and a confidence checklist showing which feature layers the developer has proven they understand and which layers are still pending.

## Recommended Output

Use sections like:

- overview
- verification coverage
- actor and boundary map
- runtime path
- state transitions
- contracts and important types
- failure modes and retries
- permissions and security notes
- observability/debug playbook
- test surface
- questions to ask the team
- top risks / recommended fixes
- quick recall
- understanding checkpoint

## Writing Rules

- Be technical, but organized.
- Cite specific files, functions, tables, and tests when useful.
- Prefer diagrams and state tables over long prose.
- Do not confuse "how it should work" with "what the code does today".
- When unsure, verify with code rather than infer.
- Keep sections short enough that someone can use them live on a call or during an incident.

## Completion Standard

The deep dive should let a strong engineer answer:

- What exactly happens, in order?
- Which files and boundaries matter most?
- What can fail, race, or drift?
- Which assumptions are safe vs shaky?
- What should be tested before changing it?
- Where do I look first when this breaks in production?

Before closing, require a final teach-back. The user should be able to explain the feature clearly enough that you can say: "You now understand this feature well enough to build on it without guessing." If they cannot, keep teaching the missing layer.

## Compact Output Contracts

### Verification Coverage

Every deep dive should declare what was actually checked:

```md
## Verification Coverage
- Entry points/UI: verified | partial | not checked
- API/services: verified | partial | not checked
- Tables/schema: verified | partial | not checked
- Jobs/events: verified | partial | not checked
- Providers/webhooks: verified | partial | not checked
- Tests/fixtures: verified | partial | not checked
- Browser/runtime check: verified | partial | not checked
- Confidence: low | medium | high
```

### Parent Handoff

When possible, inherit context from the tour:

```md
## Parent Journey Handoff
- Parent journey: `...`
- Reason this slice matters:
- Open questions inherited:
  - ...
```

### Pressure Debug Table

For important steps, include:

```md
| Step | Source of truth | Owner surface | First alert/debug surface |
| --- | --- | --- | --- |
```

### Quick Recall

End with a compact memory/debug summary:

```md
## Quick Recall
- What this feature does:
- Main trigger:
- Source of truth:
- Top 3 files/boundaries:
- Top 3 tables/models:
- Top 3 providers:
- First 3 places to check when broken:
- Biggest trap:
```

### Understanding Checkpoint

Before closing the deep dive, ask the user to repeat back the feature in their own words, then ask:

- `normal mode`: 2 questions
- `rigorous mode`: 4 questions

Questions should verify the reader can explain the feature off the cuff and debug a bad production state quickly.

Checkpoint examples:

- "What is the source of truth for this feature?"
- "What happens on duplicate requests or partial provider failure?"
- "Which state transition would you inspect first if production looks stuck?"
- "Which tests would give you confidence before changing this?"
- "Which behavior is intended, and which behavior is legacy or accidental?"

### ASCII Progress Bar

Every guided deep-dive response should end with a compact ASCII progress bar, estimated time/questions left, and confidence checklist.

Use this format:

```text
Deep-dive progress: [#####-----] 5/10 layers
Done: goal, trigger, UI/API boundary, services, persistence
Now: jobs/events
Next: providers, failure modes, observability, tests, final teach-back
ETA: ~25-40 min, ~6-10 checkpoint questions left

Confidence:
[x] User goal - user explained the business outcome and actor
[x] UI/API boundary - user identified the entry point and request path
[~] Persistence - user knows the table but not yet source-of-truth rules
[ ] Jobs/events
[ ] Providers/failures
```

Rules:

- Keep the bar ASCII-only.
- Update the numerator and labels only after accurate teach-back.
- In `Confidence`, name the specific feature layer and why it is checked off.
- Use `[x]` for proven understanding, `[~]` for partial understanding, and `[ ]` for not yet checked.
- If the user's recap is too vague to build on, keep the layer `[~]` or `[ ]` and ask a sharper follow-up.
- Include `ETA` as a rough range, not a promise. Base it on remaining layers, expected checkpoint questions, and how much correction the user needs.
- Include approximate checkpoint questions left so developers can feel the remaining cognitive load before build-readiness.
- If the user asks a side question, keep the same progress and note `Now: side question`.
- For a feature deep dive, default layers are:
  - user/business goal
  - trigger and entry points
  - UI/API boundary
  - service/helper path
  - persistence/source of truth
  - jobs/events/background work
  - external providers/webhooks
  - permissions/failure modes/retries
  - observability/tests/debug playbook
  - final teach-back/build-readiness check
