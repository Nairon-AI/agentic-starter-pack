---
name: feature-deep-dive
description: Perform a technical end-to-end deep dive on one specific feature, grill the design, and produce a debug-grade map of how it actually works. Use when the user wants to deeply understand one subsystem, trace a feature from UI to data to jobs to providers, stress-test assumptions, or create a technical explainer for a single area.
---

# Feature Deep Dive

Take one feature or subsystem and understand it deeply enough to debug, change, review, or redesign it with confidence. This is the technical layer that comes after a high-level tour.

Do not change code unless the user explicitly asks. Start with understanding.

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

Before closing the deep dive, ask:

- `normal mode`: 2 questions
- `rigorous mode`: 4 questions

Questions should verify the reader can explain the feature off the cuff and debug a bad production state quickly.
