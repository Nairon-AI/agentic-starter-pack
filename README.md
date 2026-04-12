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

- installs all 87 skills
- auto-installs supported third-party CLIs for selected skills
- rewrites the local `skills/` folder into the same category layout as this repo for easier browsing
- backs up an existing `AGENTS.md`
- writes our recommended starter `AGENTS.md`

On macOS, the launcher installs Zig via Homebrew if needed. The installer builds a temporary flat source from the category folders, then runs `npx skills@latest add` against that generated source.

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
cli/         zeke-based installer CLI
scripts/     bootstrap launcher and helper scripts
```

The category folders are the real source of truth. The CLI builds a temporary flat install source from them before calling `npx skills add`.

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

## License

[MIT](LICENSE)

---

<div align="center">

*Built by [Nairon AI](https://github.com/Nairon-AI)*

**Default agentic setup for new repos.**

</div>
