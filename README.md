# Agent Skills

This is our default agentic starter pack when we begin a new project.

## Quick Start

Run this from the root of any repo:

```bash
curl -fsSL https://raw.githubusercontent.com/Nairon-AI/agentic-starter-pack/main/scripts/bootstrap.sh | bash
```

This single command will:

- open the installer CLI
- let you install all 87 skills or choose specific skills
- auto-install required third-party CLI tools for selected skills when supported
- back up an existing `AGENTS.md`
- write our recommended starter `AGENTS.md`

It uses the `nairon-skills` installer CLI under the hood. On macOS, the launcher will install Zig via Homebrew if it is missing. The actual skill installation still uses `npx skills@latest add` so it stays compatible with the standard Agent Skills ecosystem.

## Repo Layout

```text
skills/   # install-compatible source of truth for every skill
catalog/  # grouped browsing view of the same skills
cli/      # zeke-based installer CLI
scripts/  # bootstrap launcher and helper scripts
```

The `catalog/` folder is there for humans. The `skills/` folder is the installable source of truth that `npx skills add` reads.

## Skill Catalog

### `catalog/context`

- `project-context`, `obsidian-vault`

### `catalog/planning`

- `grill-me`, `prd-to-issues`, `prd-to-plan`, `scaffold-exercises`, `write-a-spec`

### `catalog/frontend/core`

- `frontend-design`, `ui-skills`, `design-interface`, `design-and-refine`, `design-taste-frontend`
- `baseline-ui`, `fixing-accessibility`, `fixing-metadata`, `fixing-motion-performance`

### `catalog/frontend/specialists`

- `adapt`, `animate`, `arrange`, `audit`, `bolder`, `clarify`, `colorize`, `critique`, `delight`, `distill`
- `extract`, `harden`, `normalize`, `onboard`, `optimize`, `overdrive`, `polish`, `quieter`, `teach-impeccable`, `typeset`

### `catalog/engineering`

- `browser-qa`, `desloppify`, `git-guardrails`, `github-triage`, `improve-agents-md`
- `improve-codebase-architecture`, `issue-triage`, `review-for-engineering-taste`, `setup-pre-commit`, `tdd`, `write-a-skill`

### `catalog/security`

- `security-review`, `security-scan`, `threat-model`, `vuln-validate`

### `catalog/writing`

- `edit-article`, `humanizer`

### `catalog/marketing/foundation`

- `product-marketing-context`, `customer-research`, `content-strategy`
- `marketing-ideas`, `marketing-psychology`, `pricing-strategy`

### `catalog/marketing/cro`

- `ab-test-setup`, `page-cro`, `signup-flow-cro`, `onboarding-cro`
- `form-cro`, `popup-cro`, `paywall-upgrade-cro`, `lead-magnets`

### `catalog/marketing/content`

- `copywriting`, `copy-editing`, `cold-email`, `email-sequence`, `social-content`

### `catalog/marketing/seo`

- `ai-seo`, `seo-audit`, `programmatic-seo`, `schema-markup`, `site-architecture`, `competitor-alternatives`

### `catalog/marketing/distribution`

- `paid-ads`, `ad-creative`, `launch-strategy`, `community-marketing`

### `catalog/marketing/revenue`

- `churn-prevention`, `free-tool-strategy`, `referral-program`, `revops`, `sales-enablement`

## Notes

- Every skill in this repo is intended to be installable in arbitrary repos, not just ours.
- Where a workflow used to assume repo-specific hooks, hidden local tooling, or hard-coded local paths, it has been rewritten to use portable repo-local files or clear prerequisites instead.
- The starter `AGENTS.md` in this repo is the baseline we recommend when a new project does not already have strong agent instructions.
- `analytics-tracking` stays excluded from this repo by design.
- The launcher command is the only command most users need.
