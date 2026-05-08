---
name: codebase-tour
description: Map a codebase feature-by-feature into a human-readable system tour grounded in real code. Use when the user wants to understand the whole system, onboard quickly into an unfamiliar repo, enumerate major product areas, or create/update high-level architecture, journey, provider, and glossary docs.
---

# Codebase Tour

Guide a code-verified but human-readable tour of a codebase one major feature at a time. This is the high-level onboarding layer: help someone become dangerous fast without drowning them in implementation detail.

Do not trust existing docs as source of truth. Verify from code, config, schemas, jobs, tests, and integrations.

Default posture: a generic "codebase tour" is not just a document-generation task. It is an interactive teaching workflow. Walk the developer from high-level architecture down into code-backed areas, check their understanding at each layer, and do not move on until their explanation is accurate enough to build on.

## Truth-seeking posture

I value truth over being right. Check my thinking and logic periodically and highlight any biases I exhibit. Show me the angles I do not see or systematically ignore and mark them with 📐 emoji

If you think there is some possible problem or mistake in my logic (either in the question, or my assumptions), point it out and mark it with ☝️emoji

Developers should run this tour when onboarding into a repo and periodically when they need to refresh their mental model. If they are about to build on a specific existing area, hand off to `feature-deep-dive` before implementation.

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

5. **Run the guided walkthrough**
   - For a generic tour/onboarding request, walk the user through the system top-down:
     - verification/confidence level
     - product/domain mental model
     - top-level architecture
     - major surfaces and actors
     - major data objects
     - feature inventory
     - third-party providers and what each owns
     - code boundaries and debug entry points
     - traps/drift/legacy names
     - current architecture vs target/future architecture
     - improvement opportunities found during the tour
     - best first feature deep dives
   - Keep each teaching chunk small enough for the user to repeat back.
   - After each chunk, ask the user to explain their understanding in their own words.
   - Compare the user's explanation against what was verified in code.
   - If their explanation is vague, incomplete, or slightly wrong, correct it and ask one or two gap-revealing follow-up questions before continuing.
   - Do not proceed to the next layer just because the user says "yes" if their recap shows a real gap.
   - If the user wants speed over recall, still do a compact checkpoint at major layers.
   - End every walkthrough response with an ASCII progress bar showing how far through the tour the user is and what remains.
   - Alongside the progress bar, include estimated time/questions left and a confidence checklist showing which layers the developer has proven they understand and which layers are still pending.

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

6. **Capture improvement opportunities**
   - Codebase tours are primarily for understanding current behavior, but they should also preserve durable future-work context.
   - Keep current code truth separate from target architecture.
   - Create or update a future-improvements doc in the tour home, for example `docs/codebase-tour/future-improvements.md`.
   - For each item, record:
     - current behavior
     - target behavior
     - why it matters
     - likely impacted areas/providers
     - recommended next step: PRD/spec, feature deep dive, issue, spike, or cleanup
   - Do not present future-state as existing system behavior.
   - Do not let speculative ideas block the current tour unless they expose a misunderstanding of current code.

## Writing Rules

- Write for a founder, operator, or newly onboarded engineer.
- Use plain language first. Mention code paths only when they materially reduce ambiguity.
- Distinguish:
  - user-visible behavior
  - internal ops behavior
  - background automation
- Call out stale docs/comments when code disagrees.
- State what was actually verified so the reader can judge confidence.
- Separate `Current code` from `Target / future direction` when both matter.
- When a step feels odd, classify it:
  - intended
  - bug
  - confusing UX
  - ops workaround
  - product debt
  - deliberate tradeoff

## Completion Loop

When one area is done:

1. Run a final understanding checkpoint for the completed layer or area.
2. Ask the user to explain:
   - what the area does
   - which actors use it
   - which state changes
   - which providers are involved
   - where they would debug first
3. Validate their recap against the code-verified map.
4. If the recap is accurate, say: "You now understand this area well enough to navigate and discuss it."
5. If the recap is not accurate, reteach the missing piece and ask again.
6. Summarize what changed in docs.
7. Call out the top tradeoffs or bugs found.
8. Give the best next deep dive candidate.
9. Ask whether to:
   - test this area
   - fix a flagged issue
   - note follow-up and continue
   - switch to the next area

Do not tell a developer they understand the whole codebase until they can accurately explain the architecture, key areas, major data objects, third-party providers, and first debug handles without relying on vague labels.

## Output Standard

The tour should make a new developer quickly answer:

- What are the major features of this system?
- How does a user move through one of them?
- What state changes?
- Which providers are involved?
- Where would I look first if this broke?
- What is still uncertain or only partially verified?
- What improvement opportunities were found, and which ones need a deeper spec before implementation?
- How much of the tour is complete, and what layers remain?

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

### Future Improvements

Every generic tour should create or update a compact future-improvements report:

```md
| Opportunity | Current code | Target direction | Why it matters | Next step |
| --- | --- | --- | --- | --- |
```

Rules:

- Keep it separate from verified current architecture.
- Include owner areas/providers if known.
- Prefer actionable next steps over wishlists.
- If an opportunity affects an existing feature area, require `feature-deep-dive` before implementation.

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

Before moving on, ask the user to repeat back the layer in their own words, then ask a few sharp recall questions:

- `normal mode`: 2 questions
- `rigorous mode`: 4 questions

Keep them specific enough that a dev who answers well can speak off the cuff on a call or debug the area under pressure.

Checkpoint examples:

- "Explain the difference between the user-facing surface and the background/media lane."
- "Which provider owns publishing, and which provider owns entitlement state?"
- "If this flow breaks, what are your first three files or systems to inspect?"
- "What is one vocabulary trap in this area?"

### ASCII Progress Bar

Every guided-tour response should end with a compact ASCII progress bar, estimated time/questions left, and confidence checklist.

Use this format:

```text
Tour progress: [####------] 4/10 layers
Done: verification, mental model, architecture, feature inventory
Now: major data objects
Next: providers, code boundaries, traps, deep-dive picker
ETA: ~20-30 min, ~6-8 checkpoint questions left

Confidence:
[x] Mental model - user accurately explained client-app vs content-server
[x] Architecture - user explained public/agent/admin surfaces and provider lanes
[ ] Major data objects
[ ] Third-party providers
```

Rules:

- Keep the bar ASCII-only.
- Update the numerator and labels as the user proves understanding.
- Do not mark a layer complete until the user's teach-back is accurate enough.
- In `Confidence`, name the specific area and why it is checked off.
- Use `[x]` for proven understanding, `[~]` for partial understanding, and `[ ]` for not yet checked.
- If a recap is directionally right but misses an important boundary, mark it `[~]` until corrected.
- Include `ETA` as a rough range, not a promise. Base it on remaining layers, expected checkpoint questions, and how much correction the user needs.
- Include approximate checkpoint questions left so developers can feel the remaining cognitive load.
- If the user asks a side question, keep the same progress and note `Now: side question`.
- For a full-codebase tour, default layers are:
  - verification/confidence
  - mental model
  - top-level architecture
  - feature inventory
  - major data objects
  - third-party providers
  - code boundaries/debug handles
  - traps/current-vs-target architecture
  - improvement opportunities
  - deep-dive picker/final confidence check
