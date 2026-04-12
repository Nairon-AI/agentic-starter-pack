# Agent Skills

This is our default agentic starter pack when we begin a new project.

## Quick Start

Run this from the root of any repo:

```bash
curl -fsSL https://raw.githubusercontent.com/Nairon-AI/agentic-starter-pack/main/scripts/bootstrap.sh | bash
```

This single command will:

- open the installer CLI
- let you install all 53 skills or choose specific skills
- back up an existing `AGENTS.md`
- write our recommended starter `AGENTS.md`

It uses the `nairon-skills` installer CLI under the hood. On macOS, the launcher will install Zig via Homebrew if it is missing. The actual skill installation still uses `npx skills@latest add` so it stays compatible with the standard Agent Skills ecosystem.

If someone wants to choose specific skills instead, they can run the CLI directly after cloning the repo.

## Project Context

These are the context-building skills we use early so agents are not working from scratch:

- **project-context** — scaffold the repo-local context vault, persist durable repo knowledge, and maintain the canonical business glossary
- **improve-agents-md** — restructure long `AGENTS.md` files so coding agents follow them more reliably

## Planning & Design

- **design-interface** — explore multiple interface designs and compare tradeoffs
- **design-and-refine** — generate multiple UI directions, compare them, and synthesize the winner
- **frontend-design** — the core aesthetic and implementation baseline for distinctive frontend work
- **ui-skills** — the orchestration layer that routes frontend tasks through the right specialist skills
- **design-taste-frontend** — high-agency frontend generation constraints that counter common LLM UI clichés
- **grill-me** — stress-test a plan or design by resolving each branch of the decision tree
- **write-a-spec** — create a feature spec or refactor RFC and publish it as a GitHub issue or local Markdown file
- **prd-to-plan** — turn a PRD into phased tracer-bullet implementation plan files
- **prd-to-issues** — turn a PRD into independently grabbable issues or local issue drafts
- **improve-codebase-architecture** — surface architectural friction and propose deeper module boundaries

## Frontend Specialists

- **adapt** — adapt layouts and interactions for different devices and usage contexts
- **animate** — add purposeful motion, micro-interactions, and feedback
- **arrange** — improve composition, spacing, hierarchy, and rhythm
- **audit** — run a technical UI audit across accessibility, performance, theming, and responsiveness
- **baseline-ui** — enforce a strong anti-slop baseline for implementation choices
- **bolder** — push a safe design toward more distinct visual impact
- **clarify** — improve UX copy, labels, errors, and instructions
- **colorize** — introduce more expressive color intentionally
- **critique** — evaluate UI quality, hierarchy, cognitive load, and design effectiveness
- **delight** — add personality, joy, and memorable interaction moments
- **distill** — simplify cluttered or noisy interfaces
- **extract** — turn repeated UI patterns into reusable components and tokens
- **fixing-accessibility** — fix accessibility issues without rewriting the whole UI
- **fixing-metadata** — ship correct titles, descriptions, canonicals, and share metadata
- **fixing-motion-performance** — fix janky motion and rendering bottlenecks
- **harden** — add resilience for edge cases, overflow, i18n, and failures
- **normalize** — bring drifted UI back in line with the design system
- **onboard** — improve first-run UX, onboarding, and empty states
- **optimize** — make UI loading, rendering, and motion faster
- **overdrive** — build technically ambitious, high-impact UI moments
- **polish** — perform a final pass on spacing, states, consistency, and detail
- **quieter** — tone down visually aggressive interfaces without making them bland
- **teach-impeccable** — gather durable design context and save it to portable repo-local files
- **typeset** — improve typography, readability, and hierarchy

## Development & Review

- **tdd** — work in red-green-refactor vertical slices
- **desloppify** — improve maintainability across dead code, duplication, complexity, naming, and architecture
- **review-for-engineering-taste** — catch subtle design papercuts that create long-term slop
- **issue-triage** — run conversational QA intake or deep-dive one issue into a root-cause and TDD fix plan

## Security

- **threat-model** — generate a STRIDE-based threat model for a repo
- **security-scan** — scan diffs and code changes for likely vulnerabilities
- **security-review** — do a focused exploitability-driven security review
- **vuln-validate** — separate real vulnerabilities from false positives

## Tooling & Workflow

- **browser-qa** — browser automation and browser QA with `agent-browser`, including install guidance
- **git-guardrails** — install local guardrails that block dangerous git commands
- **setup-pre-commit** — add Husky, lint-staged, Prettier, typecheck, and test hooks
- **github-triage** — run structured GitHub triage with state labels and agent briefs
- **analytics-tracking** — define, implement, and validate analytics events and conversion measurement
- **obsidian-vault** — search, create, and organize Obsidian notes without hard-coded local paths
- **scaffold-exercises** — scaffold exercise repositories and validate them against the current repo’s own checks

## Writing & Knowledge

- **edit-article** — restructure and tighten article drafts
- **write-a-skill** — create new skills with good routing, progressive disclosure, and useful resources

## Notes

- Every skill in this repo is intended to be installable in arbitrary repos, not just ours.
- Where a workflow used to assume repo-specific hooks, hidden local tooling, or hard-coded local paths, it has been rewritten to use portable repo-local files or clear prerequisites instead.
- The starter `AGENTS.md` in this repo is the baseline we recommend when a new project does not already have strong agent instructions.
- The launcher command is the only command most users need.
