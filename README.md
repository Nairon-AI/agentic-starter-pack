<div align="center">

# Agentic Starter Pack

### Default repo bootstrap for coding agents

**One command -> installer CLI -> starter AGENTS.md -> 87 portable skills**
*Context, planning, frontend, engineering, security, writing, and marketing skills in one public repo.*

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Skills](https://img.shields.io/badge/Skills-87-111827.svg)](#skill-catalog)
[![Zig](https://img.shields.io/badge/Zig-CLI-f7a41d.svg)](https://ziglang.org/)

---

*Our default agentic starter pack when we begin a new project.*

</div>

---

## Quick start

Run this from the root of any repo:

```bash
curl -fsSL https://raw.githubusercontent.com/Nairon-AI/agentic-starter-pack/main/scripts/bootstrap.sh | bash
```

This command:

- opens the installer CLI
- lets you install all 87 skills or choose specific skills
- auto-installs supported third-party CLIs for selected skills
- backs up an existing `AGENTS.md`
- writes our recommended starter `AGENTS.md`

On macOS, the launcher installs Zig via Homebrew if needed. The actual skill install still runs through `npx skills@latest add`, so it stays compatible with the standard Agent Skills ecosystem.

---

## How the CLI works

The bootstrap flow is:

1. Download the repo tarball for `Nairon-AI/agentic-starter-pack`
2. Launch the Zig installer CLI from the bundled `cli/`
3. Prompt:
   - `1` installs all skills plus the starter `AGENTS.md`
   - `2` opens the interactive `npx skills` picker for specific skills
4. After install, auto-install supported tool dependencies for selected skills:
   - `browser-qa` -> `agent-browser`
   - `desloppify` -> `desloppify`
   - `github-triage` -> `gh`
5. If skills were actually installed, write the starter `AGENTS.md`
6. If the picker is cancelled before install, do not write `AGENTS.md`

When the launcher is run without a TTY, it falls back to `install all`.

---

## Repo layout

```text
skills/      install-compatible source of truth for every skill
context/     grouped browsing aliases for context skills
planning/    grouped browsing aliases for planning skills
frontend/    grouped browsing aliases for frontend skills
engineering/ grouped browsing aliases for engineering skills
security/    grouped browsing aliases for security skills
writing/     grouped browsing aliases for writing skills
marketing/   grouped browsing aliases for marketing skills
cli/         zeke-based installer CLI
scripts/     bootstrap launcher and helper scripts
```

The root category folders are for browsing. `skills/` is the source of truth that `npx skills add` reads.

---

## Skill catalog

### `context/`

- `project-context`, `obsidian-vault`

### `planning/`

- `grill-me`, `prd-to-issues`, `prd-to-plan`, `scaffold-exercises`, `write-a-spec`

### `frontend/core`

- `frontend-design`, `ui-skills`, `design-interface`, `design-and-refine`, `design-taste-frontend`
- `baseline-ui`, `fixing-accessibility`, `fixing-metadata`, `fixing-motion-performance`

### `frontend/specialists`

- `adapt`, `animate`, `arrange`, `audit`, `bolder`, `clarify`, `colorize`, `critique`, `delight`, `distill`
- `extract`, `harden`, `normalize`, `onboard`, `optimize`, `overdrive`, `polish`, `quieter`, `teach-impeccable`, `typeset`

### `engineering/`

- `browser-qa`, `desloppify`, `git-guardrails`, `github-triage`, `improve-agents-md`
- `improve-codebase-architecture`, `issue-triage`, `review-for-engineering-taste`, `setup-pre-commit`, `tdd`, `write-a-skill`

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

## Notes

- Every skill in this repo is intended to be installable in arbitrary repos, not just ours.
- Repo-specific hooks, hidden local tooling, and hard-coded local paths have been removed or rewritten.
- The starter `AGENTS.md` is the baseline we recommend when a project does not already have strong agent instructions.
- `analytics-tracking` stays excluded from this repo by design.

---

## License

[MIT](LICENSE)

---

<div align="center">

*Built by [Nairon AI](https://github.com/Nairon-AI)*

**Default agentic setup for new repos.**

</div>
