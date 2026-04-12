# Agent Skills Repo

This repo is the portable starter pack we use at the beginning of new projects.

## Purpose

- Keep every skill portable across coding agents.
- Prefer `AGENTS.md` over agent-specific instruction files.
- Do not add repo-specific orchestration, hidden local tooling, or vendor-locked setup into public skills.

## Core Rules

### Write portable skills

- Skills in this repo must work without private repo state, hidden CLIs, or product-specific folders.
- If a workflow depends on local infrastructure, rewrite it to a generic version or do not publish it here.
- Prefer neutral paths and conventions over agent- or company-specific ones.

### The description is routing logic

- Frontmatter `description` is for the model, not for marketing copy.
- Say what the skill does and when it should trigger.
- Use language like `Use when...`, `Route here when...`, or `Triggers on...`.

### Do not state the obvious

- Assume the agent already knows how to read files, run tests, and edit code.
- Spend tokens on non-obvious constraints, failure modes, routing rules, and gotchas.

### Use progressive disclosure

- Keep `SKILL.md` focused.
- Move bulky detail into `references/`, `examples.md`, `workflow.md`, or `scripts/` when needed.
- Keep supporting docs one hop away from `SKILL.md`.

### Prefer scripts for deterministic work

- If the same shell or Python logic keeps being reconstructed, put it in `scripts/`.
- Use prose for judgment and routing, not boilerplate automation.

### Verify before claiming success

- Run the narrowest relevant validation for the files you changed before saying work is done.
- If the repo has tests, typechecks, linters, or install checks for the touched surface, run them unless you are blocked.
- In the final handoff, say exactly what you ran and what you could not run.
- Before marking work complete, prefer repo-native checks over guessed commands.

### Include gotchas

- Mature skills should document repeated failure modes.
- Capture edge cases, order-dependent steps, misleading errors, and common bad assumptions.

## Editing Rules

### Keep names aligned

- Folder name must match frontmatter `name`.
- Use kebab-case.
- If you rename a skill, update the README and any install examples in the same change.

### Verify before claiming

- Do not claim a skill is ready, portable, or installable without checking it.
- For repo-wide validation, run:

```bash
npx skills@latest add . --list
```

- If you changed routing or wording, also scan for stale machine- or vendor-specific references:

```bash
rg -n "(/Users/|/mnt/|~/.claude|\\.claude|CLAUDE_|agent-browser install|your-org|your-repo)" . --glob '!.git/**'
```

### Do not sweep up unrelated changes

- Stage only the files you intended to change.
- Before committing, run `git status` and verify the diff matches the task.
- Never use `git add -A` or `git add .` in this repo.
- Commit only files you changed in the current session.

### No AI attribution

- Do not add generated-by or co-authored-by AI lines to commits or docs unless explicitly requested.

### No push without permission

- Local commits are fine.
- Do not push to a remote unless the user explicitly asks for it.

### Ask before overriding repo guardrails

- If the user's request conflicts with repo rules, safety guidance, or deployment workflow, stop and ask before overriding them.
- Do not silently pick the user's request over the repo's established process when the tradeoff is risky.

### Do not touch long-running processes unless asked

- Do not start local dev servers, stop servers, kill processes, or restart background services unless the user explicitly asks for that environment work.
- Default job is to change code and run narrow validation, not to mutate the user's runtime setup.
- Before doing local environment work, read the nearest setup docs first instead of guessing commands.

### Treat dangerous git operations as opt-in only

- Never use `git reset --hard`, `git checkout .`, `git clean -fd`, `git stash`, `git commit --no-verify`, or any force push unless the user explicitly requests it.
- On shared branches, avoid history-rewriting operations. If a fix would require rewriting history, stop and ask first.
- If a conflict touches files you did not change, stop and ask instead of guessing.

### Read local context before changing product behavior

- Before changing UX, copy, onboarding, domain concepts, or workflow behavior, look for repo-local context first.
- Prioritize `project-context/`, `business-context/`, `docs/`, `README.md`, and nearby `SKILLS.md` files over generic SaaS assumptions.
- Use the repo's own domain language in docs and issue templates.
- In monorepos, read the most relevant local README or workflow doc for the specific app or package before choosing commands.

### Load frontend skills deliberately

- If project-local frontend skills exist, load them before making user-facing UI changes.
- For significant frontend work, the base stack is `ui-skills`, `frontend-design`, and at least one specialist skill such as `arrange`, `typeset`, `colorize`, `animate`, or `polish`.
- Also load `baseline-ui` for frontend implementation guardrails, plus `fixing-accessibility`, `fixing-motion-performance`, and `fixing-metadata` when those concerns are in scope.
- Before designing UI, read `project-context/design-context.md` if present, then relevant files in `project-context/`, `business-context/`, `docs/`, and the nearest README.
- Preserve the existing design system when the repo already has one. Only push for a new visual direction when the task is explicitly a redesign or a new surface.
- Verify user-facing frontend work in a browser before calling it done. Check desktop and mobile layouts and make sure overlays, fixed elements, and dialogs stay usable within the viewport.

## AGENTS.md Guidance

- `AGENTS.md` is the primary instruction surface.
- `CLAUDE.md` is legacy compatibility only.
- When updating starter instructions, optimize for:
  - concise final outputs
  - explicit verification
  - non-destructive git behavior
  - portable commands
  - agent-agnostic wording

## README Requirements

When the catalog changes:

- keep the top-level bootstrap command working
- keep the skill count correct
- keep install examples aligned with current folder names
- describe the repo as the starter set we use across projects
