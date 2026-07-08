---
name: blindspot-pass
description: Discover unknowns before expensive work. Use before ambiguous or risky product, architecture, UX, operations, billing, onboarding, data, migration, launch, or go-to-market work; when the user asks for a blindspot pass, unknown unknowns, ambiguity review, assumption check, or better agent prompt; or when an agent needs to clarify assumptions before implementation.
---

# Blindspot Pass

Use this skill to shrink ambiguity before code, plans, PRDs, launches, migrations, or operator/user-facing changes. The goal is not to ask every possible question. The goal is to find the few unknowns that would make the current path wrong.

## Rules

- Read the territory before theorizing: repo docs, code, tests, notes, business context, and current behavior where relevant.
- Prefer evidence over generic best practice.
- Do not edit product code during a blindspot pass unless the user explicitly asks you to continue into implementation.
- Ask only questions the repo/context cannot answer and where the answer changes scope, architecture, UX, sequencing, risk, or success criteria.
- Include a recommended default with each question.
- Split independent surfaces across subagents when the work is large and subagents are available.
- Keep output concise. This is a decision aid, not a research report.

## Context Anchors

Check these sources before making recommendations when they exist:

- Repo operating docs: `AGENTS.md`, `README.md`, `SKILLS.md`, nearest area docs.
- Persistent context: `brain/index.md`, `memory/`, `docs/`, ADRs, specs, PRDs, plans, runbooks.
- Product/UX context: personas, user-model docs, onboarding docs, admin/operator docs, analytics definitions.
- Code context: affected flows, tests, migrations, schemas, feature flags, provider integrations.
- External constraints only when necessary: vendor docs, legal/security rules, platform limits, pricing, dates.

Use repo-specific assumptions only when backed by docs or prior context. Otherwise mark them as assumptions.

## Workflow

1. **Re-anchor**
   - Restate the goal and success criteria in one or two lines.
   - Name the surface: product, code, UX, ops, GTM, data, migration, personal workflow, or mixed.
   - Identify which docs/code/context you will inspect.

2. **Map the territory**
   - Inspect current files, flows, docs, tests, metrics definitions, provider constraints, or operating process.
   - Note facts with file paths or source names where possible.
   - Separate current behavior from intended behavior.

3. **Classify unknowns**
   - **Known knowns:** Prompt or repo clearly says this.
   - **Known unknowns:** Open decisions already visible.
   - **Unknown knowns:** Implicit expectations the user may recognize only when shown, especially taste, ops habits, customer language, launch posture, or "obvious" assumptions.
   - **Unknown unknowns:** Likely hidden risks, missing constraints, edge cases, stale docs, untested paths, or places an agent would probably guess wrong.

4. **Rank by decision impact**
   - **High:** changes architecture, data model, migration lane, entitlement behavior, checkout, provider integration, security/privacy, ops workflow, or customer-facing promise.
   - **Medium:** changes UX flow, copy, instrumentation, test strategy, sequencing, rollout, or support burden.
   - **Low:** can be handled conservatively during implementation.

5. **Recommend next move**
   - **Proceed:** enough clarity; give a small implementation plan.
   - **Prototype:** create a cheap mock/probe before real wiring.
   - **Investigate:** send agents into specific files/flows/tests.
   - **Interview:** ask the smallest set of high-impact questions.
   - **De-scope:** narrow the task before implementation.

## Output Shape

```markdown
**Blindspot Pass**
Goal: ...
Surface: ...

**What I Verified**
- ...

**Unknowns**
- High: ...
- Medium: ...
- Low: ...

**Questions That Change The Work**
1. ... Recommended default: ...

**Recommended Next Move**
...

**Agent Prompts**
- ...
```

## During Implementation

If the user asks you to continue after the blindspot pass, keep brief notes for non-trivial work in the repo's scratch/context area, such as `.context/implementation-notes.md`, when available. Log only meaningful assumptions, deviations, and follow-ups. Do not turn it into a narrative diary.
