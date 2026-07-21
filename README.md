<div align="center">

# Agentic Starter Pack

### Default repo setup for coding agents

**One agent prompt -> starter AGENTS.md -> 252 portable skills + brain vault**
*Context, planning, frontend, engineering, security, writing, marketing, and persistent-agent-memory workflows in one public repo.*

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Skills](https://img.shields.io/badge/Skills-253-111827.svg)](#skill-catalog)

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
- Install optional helper CLIs only when missing and useful here: agent-browser, browse, bb, desloppify, gh.
- Verify the result: installed skills exist, skills/ exists, AGENTS.md exists, brain/index.md exists, Claude hooks work when applicable.
- Show git status, changed files, checks run, and any warnings.
```

### What gets installed

- **253 skills** - task-specific workflows for context, planning, frontend polish, engineering cleanup, security, writing, and marketing. They give agents concrete procedures instead of vibes.
- **Curated third-party skills** - not every skill here was created by Nairon AI. This repo is a starter pack: a curated, adapted bundle of skills we have found useful while operating products.
- **Categorized `skills/` mirror** - browsable source layout inside the target repo, useful for humans and future agents to inspect or edit installed skills.
- **Starter `AGENTS.md`** - repo-local operating rules: type checks, tests, git safety, PR workflow, browser validation, and handoff expectations.
- **`brain/` vault** - persistent Obsidian-compatible memory for project principles, plans, gotchas, and durable lessons across sessions.
- **Brain loop skills** - `brain`, `reflect`, `ruminate`, `meditate`, `plan`, and `review` keep the vault useful: write memories, mine old sessions, prune stale notes, plan work, and review against principles.
- **Claude Code hooks** - optional `.claude/hooks` integration loads `brain/index.md` at session start and keeps the brain index synced after edits.
- **Optional tool dependencies** - install CLIs such as `agent-browser`, `browse`, `bb`, `desloppify`, and `gh` only when the corresponding skills are useful in that repo.

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

For Grill Me specifically, `planning/grill-me/` is canonical. User-level, `.agents`, `.claude`, and other installed copies must be produced from a pinned release or commit of that directory rather than maintained independently or fetched live from `main` on every session.

An installed Grill Me copy may warn about a newer canonical release. It updates only after explicit approval: preserve the decision log, back up the exact proven installation, install the pinned release, verify its skill and references, then restart the agent session.

### Maintainer note

Do not run or initialize the `no-mistakes` CLI while maintaining this repository. Its bundled files are catalog content for downstream installs only. Use repo-native checks and push directly to `origin` only when explicitly authorized. See `AGENTS.md` for the repository-local rule.

---

## Skill catalog

### `context/`

- `automate-me`, `brain`, `claude-handoff`, `handoff`, `meditate`, `obsidian-vault`, `project-context`, `recall`, `reflect`, `ruminate`, `show-me-your-work`

### `planning/`

- `architect`, `arena`, `blindspot-pass`, `code-design`, `decision-mapping`, `design-an-interface`, `figure-it-out`, `grill-me`, `loop-me`, `plan`, `prd-to-issues`, `prd-to-plan`, `premortem`, `scaffold-exercises`, `to-issues`, `to-prd`, `verify-goal`, `write-a-spec`

### `frontend/accessibility`

- `contrast-checker`, `link-purpose`, `refactor`, `use-of-color`, `wcag-audit-patterns`

### `frontend/core`

- `antfu-web-design-guidelines`, `baseline-ui`, `canvas-design`, `design-and-refine`, `design-interface`, `design-lab`, `design-taste-frontend`
- `fixing-accessibility`, `fixing-metadata`, `fixing-motion-performance`, `frontend-design`, `hallmark`, `image-first-frontend`, `interaction-design`
- `interface-design`, `make-interfaces-feel-better`, `stitch-design-system`, `ui-skills`, `web-design-guidelines`

### `frontend/frameworks`

- `antfu`, `antfu-vue-best-practices`, `antfu-vue-router-best-practices`, `antfu-vue-testing-best-practices`
- `create-adaptable-composable`, `next-best-practices`, `next-cache-components`, `next-upgrade`, `nuxt`, `pinia`, `pnpm`
- `react-native-best-practices`, `shadcn`, `slidev`, `swiftui-ui-patterns`, `tsdown`, `turborepo`, `unocss`, `vercel-composition-patterns`
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

- `agent-browser`, `browser-trace`, `budge`, `dogfood`, `rams`

### `engineering/`

- `ask-matt`, `blast-radius`, `browser-qa`, `code-review`, `codebase-design`, `desloppify`, `diagnose`, `diagnosing-bugs`, `domain-modeling`, `feature-deep-dive`, `git-guardrails`, `git-guardrails-claude-code`, `github-triage`, `how`
- `implement`, `improve-agents-md`, `improve-codebase-architecture`, `interrogate`, `issue-triage`, `maintain-verification-skill`, `migrate-to-shoehorn`, `napkin-math`, `no-mistakes`, `pr-walkthrough`, `principle-build-the-lever`, `principle-model-the-domain`, `principle-sequence-verifiable-units`, `principle-type-system-discipline`
- `prototype`, `qa`, `rca`, `rebuild-mental-model`, `request-refactor-plan`, `research`, `resolving-merge-conflicts`, `review`, `review-for-engineering-taste`, `setup-matt-pocock-skills`, `setup-pre-commit`, `speedup-proof`, `tdd`, `teach`, `teach-implementation`, `thermo-nuclear-code-quality-review`
- `to-spec`, `to-tickets`, `triage`, `typescript-best-practices`, `ubiquitous-language`, `verifier-setup`, `wayfinder`, `why`, `wizard`, `write-a-skill`, `writing-great-skills`, `zoom-out`

### `security/`

- `security-review`, `security-scan`, `threat-model`, `vuln-validate`

### `writing/`

- `bro`, `caveman`, `edit-article`, `feedback`, `humanizer`, `stop-slop`, `writing-beats`, `writing-fragments`, `writing-shape`

### `marketing/foundation`

- `product-marketing`, `customer-research`, `content-strategy`
- `marketing-ideas`, `marketing-psychology`, `pricing`, `marketing-plan`

### `marketing/cro`

- `ab-testing`, `cro`, `signup`, `onboarding`
- `popups`, `paywalls`, `lead-magnets`
- `startup-user-simulator`

### `marketing/content`

- `copywriting`, `copy-editing`, `cold-email`, `emails`, `social`
- `video`, `image`, `sms`

### `marketing/seo`

- `ai-seo`, `seo-audit`, `programmatic-seo`, `schema`, `site-architecture`, `competitors`, `aso`

### `marketing/distribution`

- `ads`, `ad-creative`, `launch`, `community-marketing`
- `co-marketing`, `directory-submissions`

### `marketing/revenue`

- `analytics`, `churn-prevention`, `free-tools`, `referrals`, `revops`, `sales-enablement`
- `prospecting`, `competitor-profiling`, `first-customer-finder`

---

## Credits

This starter pack bundles skills from multiple authors and projects. Some are ours; many are adapted, mirrored, or inspired by work from the broader agent-skills ecosystem.

Special thanks to:

- [Matt Pocock](https://x.com/mattpocockuk) / `mattpocock/skills` - engineering, planning, and writing workflows.
- [Corey Haines](https://www.corey.co/) - marketing strategy concepts adapted in the marketing planning skills.
- [Anthony Fu](https://github.com/antfu) - generated framework skills and source tooling patterns.
- [Emil Kowalski](https://animations.dev/) - design engineering and motion philosophy.
- [Raphael Salaja](https://github.com/raphael-salaja) - web motion skills.
- [Chris Tate](https://github.com/ctate) / [Vercel Labs](https://github.com/vercel-labs/agent-browser) - `agent-browser` and `dogfood` browser automation skills.
- [Hardik Pandya](https://hvpandya.com) - `stop-slop` writing skill.
- [Francesco Mistero / Kappaemme-git](https://github.com/Kappaemme-git) - startup validation, customer discovery, and performance proof skills.
- [Lauren Tan / pstack](https://github.com/cursor/plugins/tree/main/pstack) - rigorous engineering workflows, evidence gathering, and verification practices.
- [WikiProject AI Cleanup](https://en.wikipedia.org/wiki/Wikipedia:Signs_of_AI_writing) - AI-writing pattern references used by `humanizer`.
- [vuejs-ai](https://github.com/vuejs-ai) and other open-source skill authors whose work helped shape this pack.

If a skill has its own license, metadata, README, or source reference, treat that as authoritative. This repo is a practical starter pack, not a claim that every included skill originated here.

---

## License

[MIT](LICENSE)

---

<div align="center">

*Built by [Nairon AI](https://github.com/Nairon-AI)*

**Default agentic setup for new repos.**

</div>
