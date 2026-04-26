---
name: codebase-tour
description: Map a codebase feature-by-feature into a human-readable system tour grounded in real code. Use when the user wants to understand the whole system, onboard quickly into an unfamiliar repo, enumerate major product areas, or create/update high-level architecture, journey, provider, and glossary docs.
---

# Codebase Tour

Guide a code-verified but human-readable tour of a codebase one major feature at a time. This is the high-level onboarding layer: help someone become dangerous fast without drowning them in implementation detail.

Do not trust existing docs as source of truth. Verify from code, config, schemas, jobs, tests, and integrations.

## Quick Start

1. **Pick the doc home**
   - If the repo already has a docs convention, follow it.
   - Otherwise create:
     - `SYSTEM_OVERVIEW.md`
     - `docs/codebase-tour/`
     - `docs/codebase-tour/glossary.md`
     - feature inventory section in `SYSTEM_OVERVIEW.md`

2. **Survey the repo**
   - Read root `README.md`, `AGENTS.md`, nearest `SKILLS.md`, package manifests, env examples, schema files, routes, jobs/workers, and E2E tests if present.
   - Identify the 5-10 major distinct areas, such as auth, onboarding, billing, content generation, marketplace, admin ops, analytics, imports, or integrations.

3. **Create the canonical feature inventory before deep mapping**
   - Add a compact inventory to `SYSTEM_OVERVIEW.md`.
   - For each major area track:
     - status: `unmapped | mapped | deep-dived | tested`
     - primary actors
     - key providers
     - confidence: `low | medium | high`

4. **Offer an area picker**
   - Ask which area to map first unless the user already chose.
   - Offer:
     - `quick map`
     - `deep journey debug map`

## Per-Area Workflow

For the chosen area:

1. **Trace the real flow**
   - entry points
   - main actors
   - persistent state and tables/models
   - async jobs/events
   - external providers/webhooks
   - important architecture-shaping libraries only if they materially affect how the system works
   - timeouts, retries, rate limits, and fallback paths
   - admin/internal surfaces
   - existing tests

2. **Write the area doc**
   - Use one doc per area inside the doc home.
   - Prefer this structure:
     - verification coverage
     - big Mermaid flow diagram
     - mental model
     - plain-English flow
     - state changes
     - providers/platforms
     - notable libraries only when they matter architecturally
     - test checkpoints
     - debug handles
     - review decisions / tradeoffs
     - drift resolution notes
     - deep-dive handoff
     - quick recall
     - understanding checkpoint
     - bugs / questions found

3. **Keep the system index current**
   - Update `SYSTEM_OVERVIEW.md` with:
     - a simple top-level architecture map
     - links to completed area docs
     - current tour progress

4. **Keep the glossary current**
   - Add repeated or confusing terms:
     - user roles
     - object names
     - provider names
     - business states
     - key tables/models with business meaning

5. **Resolve drift as you go**
   - If docs and code disagree, do not just note it and move on.
   - Classify it:
     - intended -> update docs now
     - bug -> flag or fix
     - unclear -> ask the user and leave an explicit ambiguity note only if still unresolved

## Writing Rules

- Write for a founder, operator, or newly onboarded engineer.
- Use plain language first. Mention code paths only when they materially reduce ambiguity.
- Distinguish:
  - user-visible behavior
  - internal ops behavior
  - background automation
- Call out stale docs/comments when code disagrees.
- State what was actually verified so the reader can judge confidence.
- When a step feels odd, classify it:
  - intended
  - bug
  - confusing UX
  - ops workaround
  - product debt
  - deliberate tradeoff

## Completion Loop

When one area is done:

1. Say: "You now understand exactly how this area works."
2. Summarize what changed in docs.
3. Call out the top tradeoffs or bugs found.
4. Give the best next deep dive candidate.
5. Run a compact understanding checkpoint unless the user wants speed over recall.
6. Ask whether to:
   - test this area
   - fix a flagged issue
   - note follow-up and continue
   - switch to the next area

## Output Standard

The tour should make a new developer quickly answer:

- What are the major features of this system?
- How does a user move through one of them?
- What state changes?
- Which providers are involved?
- Where would I look first if this broke?
- What is still uncertain or only partially verified?

## Compact Output Contracts

### Feature Inventory

Every tour starts by updating a compact inventory in `SYSTEM_OVERVIEW.md`:

```md
| Area | Status | Actors | Key providers | Confidence |
| --- | --- | --- | --- | --- |
```

### Verification Coverage

Every area doc should declare what was actually verified:

```md
## Verification Coverage
- Routes/API: verified | partial | not checked
- Tables/schema: verified | partial | not checked
- Jobs/events: verified | partial | not checked
- Providers/webhooks: verified | partial | not checked
- Tests: verified | partial | not checked
- Browser/runtime check: verified | partial | not checked
- Confidence: low | medium | high
```

### Deep-Dive Handoff

Every area doc should end with the best next technical slice:

```md
## Deep-Dive Handoff
- Parent journey: `...`
- Best next slice: `...`
- Why: ...
- Open questions:
  - ...
```

### Drift Resolution Protocol

If drift appears, resolve it in this order:

```text
code vs docs drift
   |
   +--> intended? -> update docs now
   +--> bug? -> flag/fix/log
   +--> unclear? -> ask user, leave explicit ambiguity only if unresolved
```

### Quick Recall

Every area doc should end with a short pressure-useful summary:

```md
## Quick Recall
- What this area does:
- Main entry points:
- Source of truth:
- Top 3 tables/models:
- Top 3 providers:
- First 3 places to check when broken:
- Biggest trap:
```

### Understanding Checkpoint

Before moving on, ask the user a few sharp recall questions:

- `normal mode`: 2 questions
- `rigorous mode`: 4 questions

Keep them specific enough that a dev who answers well can speak off the cuff on a call or debug the area under pressure.
