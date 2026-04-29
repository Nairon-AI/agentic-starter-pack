<div align="center">

# Agentic Starter Pack

### Default repo setup for coding agents

**One agent prompt -> starter AGENTS.md -> 175 portable skills + brain vault**
*Context, planning, frontend, engineering, security, writing, marketing, and persistent-agent-memory workflows in one public repo.*

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Skills](https://img.shields.io/badge/Skills-175-111827.svg)](#skill-catalog)

---

*Our default agentic starter pack when we begin a new project.*

</div>

---

## Quick start

### Agent installer prompt

Paste this into Claude Code, Codex, or any repo-aware coding agent while it is working from the root of the repo you want to equip:

```text
Install the Nairon Agentic Starter Pack from https://github.com/Nairon-AI/agentic-starter-pack/ into this repo.

Do the full install cleanly:
- Read this repo's existing AGENTS.md, CLAUDE.md, README.md, and nearest SKILLS.md first.
- Preserve existing work. Back up before overwriting. Do not use git add -A.
- Install every starter-pack skill into this repo's normal agent skill location.
- Add a browsable skills/ mirror using the starter-pack category folders.
- Back up existing AGENTS.md, then install the starter-pack AGENTS.md.
- Add the starter brain/ vault without overwriting existing brain notes.
- If this repo uses Claude Code, install the .claude brain hooks and merge hook settings instead of replacing unrelated settings.
- Install optional helper CLIs only when missing and useful here: agent-browser, desloppify, gh.
- Verify the result: installed skills exist, skills/ exists, AGENTS.md exists, brain/index.md exists, Claude hooks work when applicable.
- Show git status, changed files, checks run, and any warnings.
```

### What gets installed

- **175 skills** - task-specific workflows for context, planning, frontend polish, engineering cleanup, security, writing, and marketing. They give agents concrete procedures instead of vibes.
- **Categorized `skills/` mirror** - browsable source layout inside the target repo, useful for humans and future agents to inspect or edit installed skills.
- **Starter `AGENTS.md`** - repo-local operating rules: type checks, tests, git safety, PR workflow, browser validation, and handoff expectations.
- **`brain/` vault** - persistent Obsidian-compatible memory for project principles, plans, gotchas, and durable lessons across sessions.
- **Brain loop skills** - `brain`, `reflect`, `ruminate`, `meditate`, `plan`, and `review` keep the vault useful: write memories, mine old sessions, prune stale notes, plan work, and review against principles.
- **Claude Code hooks** - optional `.claude/hooks` integration loads `brain/index.md` at session start and keeps the brain index synced after edits.
- **Optional tool dependencies** - install CLIs such as `agent-browser`, `desloppify`, and `gh` only when the corresponding skills are useful in that repo.

---

## Repo layout

```text
context/     source of truth for context skills
planning/    source of truth for planning skills
frontend/    source of truth for frontend skills
engineering/ source of truth for engineering skills
security/    source of truth for security skills
writing/     source of truth for writing skills
marketing/   source of truth for marketing skills
brain/       starter persistent-memory vault and principles
.claude/     optional Claude Code brain hooks
scripts/     helper scripts for building the flat skill install source
```

The category folders are the real source of truth. `scripts/build-install-source.sh` builds a temporary flat install source for `npx skills add`.

---

## Skill catalog

### `context/`

- `brain`, `meditate`, `obsidian-vault`, `project-context`, `reflect`, `ruminate`

### `planning/`

- `grill-me`, `plan`, `prd-to-issues`, `prd-to-plan`, `scaffold-exercises`, `write-a-spec`

### `frontend/accessibility`

- `contrast-checker`, `link-purpose`, `refactor`, `use-of-color`, `wcag-audit-patterns`

### `frontend/core`

- `antfu-web-design-guidelines`, `baseline-ui`, `canvas-design`, `design-and-refine`, `design-interface`, `design-lab`, `design-taste-frontend`
- `fixing-accessibility`, `fixing-metadata`, `fixing-motion-performance`, `frontend-design`, `image-first-frontend`, `interaction-design`
- `interface-design`, `make-interfaces-feel-better`, `stitch-design-system`, `ui-skills`, `web-design-guidelines`

### `frontend/frameworks`

- `antfu`, `antfu-vue-best-practices`, `antfu-vue-router-best-practices`, `antfu-vue-testing-best-practices`
- `create-adaptable-composable`, `next-best-practices`, `next-cache-components`, `next-upgrade`, `nuxt`, `pinia`, `pnpm`
- `react-native-best-practices`, `shadcn`, `slidev`, `swiftui-ui-patterns`, `tsdown`, `turborepo`, `unocss`
- `vite`, `vitepress`, `vitest`, `vue`, `vue-best-practices`, `vue-debug-guides`, `vue-jsx-best-practices`
- `vue-options-api-best-practices`, `vue-pinia-best-practices`, `vue-router-best-practices`, `vue-testing-best-practices`, `vueuse-functions`

### `frontend/motion`

- `12-principles-of-animation`, `frontend-slides`, `generating-sounds-with-ai`, `mastering-animate-presence`
- `morphing-icons`, `pseudo-elements`, `remotion-best-practices`, `sounds-on-the-web`, `to-spring-or-not-to-spring`, `transitions-dev`

### `frontend/specialists`

- `adapt`, `animate`, `audit`, `bencium-innovative-ux-designer`, `bolder`, `brutalist-skill`, `clarify`, `colorize`, `critique`
- `delight`, `distill`, `emil-design-eng`, `gpt-tasteskill`, `harden`, `impeccable`, `layout`, `minimalist-skill`
- `oklch-skill`, `optimize`, `output-skill`, `overdrive`, `polish`, `quieter`, `redesign-skill`, `shape`, `soft-skill`
- `stitch-skill`, `taste-skill`, `typeset`, `ui-ux-pro-max`

### `frontend/threejs`

- `threejs-animation`, `threejs-fundamentals`, `threejs-geometry`, `threejs-interaction`, `threejs-lighting`
- `threejs-loaders`, `threejs-materials`, `threejs-postprocessing`, `threejs-shaders`, `threejs-textures`

### `frontend/tools`

- `agent-browser`, `budge`, `rams`, `react-doctor`

### `engineering/`

- `browser-qa`, `desloppify`, `git-guardrails`, `github-triage`, `how`, `improve-agents-md`
- `codebase-tour`, `feature-deep-dive`, `improve-codebase-architecture`, `issue-triage`, `rca`
- `review`, `review-for-engineering-taste`, `setup-pre-commit`, `tdd`, `write-a-skill`

### `security/`

- `security-review`, `security-scan`, `threat-model`, `vuln-validate`

### `writing/`

- `edit-article`, `humanizer`

### `marketing/foundation`

- `product-marketing-context`, `customer-research`, `content-strategy`
- `marketing-ideas`, `marketing-psychology`, `pricing-strategy`

### `marketing/cro`

- `ab-test-setup`, `page-cro`, `signup-flow-cro`, `onboarding-cro`
- `form-cro`, `popup-cro`, `paywall-upgrade-cro`, `lead-magnets`

### `marketing/content`

- `copywriting`, `copy-editing`, `cold-email`, `email-sequence`, `social-content`

### `marketing/seo`

- `ai-seo`, `seo-audit`, `programmatic-seo`, `schema-markup`, `site-architecture`, `competitor-alternatives`

### `marketing/distribution`

- `paid-ads`, `ad-creative`, `launch-strategy`, `community-marketing`

### `marketing/revenue`

- `churn-prevention`, `free-tool-strategy`, `referral-program`, `revops`, `sales-enablement`

---

## License

[MIT](LICENSE)

---

<div align="center">

*Built by [Nairon AI](https://github.com/Nairon-AI)*

**Default agentic setup for new repos.**

</div>
