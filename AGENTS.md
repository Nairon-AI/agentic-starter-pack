Sacrifice grammar for concision in your final output.

Spin off multiple sub agents if it helps you complete any work asked of you, faster.

# Project AGENTS

A repository using this starter AGENTS.md as the default operating guide for coding agents.

---

## Quick Start

| Surface | Canonical guide |
| --- | --- |
| Repo setup | `README.md` |
| Local app/package workflow | nearest `README.md` + nearest `SKILLS.md` |
| Local dev start/stop flow | repo-local docs or repo-local skills when present |

**All active development should follow the repo's own local guides first.** For detailed setup, start with the nearest README and the most relevant `SKILLS.md`.

---

## Critical Rules

### Type Checks Are Mandatory

Before marking ANY task complete, run the repo-native type checks for every surface you changed.

<important if="you are writing or modifying tests">

### Run Tests

Run the narrowest relevant test suite for the files and behaviors you touched.

</important>

### Never Start/Kill Servers

Don't run local dev servers or kill processes **unless explicitly requested** (e.g. "start servers", "kill servers", "run the app locally"). Default job is to write code only.

<important if="you are starting, stopping, or setting up the local dev server">

### Local App Phrase Map (Do Exactly This)

Always read the nearest README first before local setup/start/stop actions.

- **"Run the app locally"** or **"Start the local dev server"**
  - Read the repo-local setup flow first
  - Then use the repo's canonical local start workflow
- **"Stop the app"** or **"Stop the local dev server"**
  - Use the repo's canonical stop workflow
- **"Restart local dev server"**
  - Run stop flow, then start flow

</important>

### No AI Attribution

Don't include "Generated with Claude Code" or "Co-Authored-By: Claude" in commits or PRs.

### No Pushing Without Permission

**NEVER push to remote (**`git push`**) without explicit user confirmation.**

**Rules:**

- Commits are fine — commit freely to the local branch
- Don't push work-in-progress code to any remote branch
- Don't push just to "save progress" — that's what local commits are for
- The only exception is a repo-specific review/fix loop where pushes are expected as part of the fix cycle

### Committing

**ONLY commit files YOU changed in THIS session.**

- ALWAYS include `fixes #<number>` or `closes #<number>` in commit messages when a related issue/PR exists
- NEVER use `git add -A` or `git add .` — these sweep up changes from other agents
- ALWAYS use `git add <specific-file-paths>` listing only files you modified
- Before committing, run `git status` and verify you are only staging YOUR files
- Track which files you created/modified/deleted during the session

### User Override

If user instructions conflict with rules here, ask for confirmation before overriding. Only then execute.

<important if="you are creating, updating, or merging pull requests">

### Deployment Workflow (PR Previews > Staging)

**Default flow (most features):**

1. Work on feature branch locally, commit freely
2. When ready to test: create PR against `main`
3. Use a preview environment for the PR if the repo provides one
4. Test in the preview environment
5. Commit sub-tasks one by one to the same PR branch
6. When fully tested: merge PR to main → production

**Only use staging for URL-dependent features** — payment webhooks, external callbacks, OAuth redirects, or anything else that cannot be validated in normal preview environments. Everything else should go through PR preview environments when available.

**Why not staging for everything?** Multiple developers pushing incomplete features to staging causes conflicts. Preview environments give each developer isolated testing without breaking each other's work.

### PR Self-Heal Loop (Mandatory)

After **every** PR create/update, run the repo's PR self-heal workflow if one exists and loop until done.

Retained exception: if the user explicitly says to defer self-heal, leave the PR open and say it is not handoff-ready yet.

Required loop:

1. Let the first review pass finish, then pull PR review threads/comments (bot + human)
2. Triage comments into valid vs invalid
3. Fix valid comments in code
4. Run quality gates (type checks, tests, and repo-native checks)
5. Commit + push fixes
6. Reply on invalid/false-positive comments with evidence, then resolve only after human acknowledgment (auto-resolve only threads triaged valid+fixed in the current iteration; never by author alone)
7. Trigger the review bot rerun if the repo uses one
8. Re-check threads and repeat until all gates pass

If 5 full iterations still do not clear the gates, escalate to the user instead of looping forever.

Important: do **not** manually set bot-owned confidence/critical status in PR description; the review bot owns that update.

Do **not** hand off a PR until all self-heal gates pass.

### PR Descriptions Must Use The Repo Template

When creating or updating any PR, agents MUST use `.github/pull_request_template.md` as the source of truth for the PR body when that template exists.

Required rules:

1. Read `.github/pull_request_template.md` before `gh pr create` or `gh pr edit`
2. Fill every section with concrete, current information for the actual PR
3. Explicitly call out migrations/backfills/manual actions, even when the answer is "None"
4. If a bot-managed section already exists in the PR body, preserve it unless the bot owns replacing it
5. Do not use ad-hoc PR descriptions when the template exists

Use a PR-template workflow or skill when the repo provides one.

</important>

<important if="you are performing git operations on shared branches like main or staging">

### DANGEROUS GIT OPERATIONS - READ THIS CAREFULLY

**Protected branches:** `main`**,** `staging`

The following operations are **FORBIDDEN** without explicit human approval:

| Operation | Why It's Dangerous |
| --- | --- |
| `git push --force` | Overwrites remote history, DELETES other people's work |
| `git push --force-with-lease` | Same risk - can still delete commits |
| `git reset --hard origin/X` then push | Rewrites branch, loses commits |
| `git rebase` on shared branches | Rewrites history, causes merge hell |
| Merging main INTO staging | Can overwrite staging-only features |

**These commands destroy other agents' work — NEVER use:**

| Operation | Why It's Dangerous |
| --- | --- |
| `git reset --hard` | Destroys uncommitted changes |
| `git checkout .` | Destroys uncommitted changes |
| `git clean -fd` | Deletes untracked files |
| `git stash` | Stashes ALL changes including other agents' work |
| `git add -A` / `git add .` | Stages other agents' uncommitted work |
| `git commit --no-verify` | Bypasses required checks — never allowed |

**Safe workflow:**

```bash
# 1. Check status first
git status
# 2. Add ONLY your specific files
git add path/to/file-you-changed.ts
# 3. Commit
git commit -m "fix(scope): description"
# 4. Push (pull --rebase if needed, but NEVER reset/checkout)
git pull --rebase && git push
```

**If rebase conflicts occur:** resolve conflicts in YOUR files only. If conflict is in a file you didn't modify, abort and ask the user. NEVER force push.

**BEFORE doing ANY of these:**

1. **STOP and ASK the user**: "This will rewrite history on \[branch\]. Commits may be lost. Are you sure?"
2. **List what will be lost**: Run `git log origin/branch..HEAD` or `git log HEAD..origin/branch`
3. **Get explicit confirmation**: User must type "yes" or confirm explicitly

**Safe alternatives:**

- Instead of `git push --force`: `git pull --rebase origin branch` then normal push
- Instead of resetting to origin: `git merge origin/branch`
- Instead of rebasing shared branches: Use merge commits

**Git hooks may be installed** that block force pushes or risky operations. Respect them.

**Why this matters:** Shared-branch history rewrites can silently delete teammates' merged work. Don't let this happen again.

</important>

---

## Domain Knowledge

### Shared `SKILLS.md` Convention

This repo uses `SKILLS.md` as a shared workflow convention for both Codex and Claude Code.

- `SKILLS.md` files are contributor-facing workflow guides you read for process/context.
- Executable skills live under `.claude/skills/` and `.agents/skills/` when those directories exist.
- Contributor docs should point to the actual skill entrypoint when a specific skill must run.

Before working in an area, read the most relevant `SKILLS.md` file for that task:

- repo root `SKILLS.md` for repo-wide workflows
- area-specific `SKILLS.md` files for the exact surface you are touching
- test-area `SKILLS.md` files for browser testing and E2E work

If multiple apply, read the repo root `SKILLS.md` first, then the more specific one for the surface you are touching.

### Shared Runtime Context

Before changing UX, copy, onboarding, promotions, admin workflows, or product behavior, read the repo's shared runtime context first.

For UI work, user-model docs are mandatory when they exist:

- customer-facing app UX: read the relevant app-user or customer-persona docs
- admin/internal UX: read the relevant admin/operator docs
- if a surface mixes both worlds, read both before designing

This is the non-Flux decision surface for Codex and Claude Code. Treat these points as default guardrails:

- The product is selling outcomes, not software complexity.
- Users are usually low-patience, low-time users who should mostly confirm defaults.
- Human ops may still be part of fulfillment, especially around onboarding, promotions, approvals, or support.
- Internal tools should help operators find stuck users and take action, not just observe state.

| Topic | Documentation |
| --- | --- |
| **UX Principles** | `docs/UX-PRINCIPLES.md` — **READ THIS for any UI work** |
| **App User Personality** | user/persona docs — **READ THIS for customer-facing UI work when present** |
| **Admin User Personality** | admin/operator docs — **READ THIS for admin/internal UI work when present** |
| **Monorepo Guide** | `docs/MONOREPO-GUIDE.md` — package managers, commands, structure |
| **E2E Testing** | nearest `e2e/SKILLS.md` — **READ THIS for any E2E test work** |
| **Browser Validation** | the repo's browser-validation command or workflow when present |

---

## Plan Mode

When creating plans, PRDs, specs, or epic/task breakdowns:

- **Be extremely concise.** Sacrifice grammar for brevity.
- **End every plan with unresolved questions.** If none, state "None identified."

This keeps plans scannable and actionable rather than verbose.

---

## Continuity Ledger

Maintain session state in `context/CONTINUITY.md` when the repo uses that convention:

```markdown
## Goal (incl. success criteria)

## Constraints/Assumptions

## Key decisions

## State

- **Done:**
- **Now:**
- **Next:**

## Open questions

## Working set (files/ids/commands)
```

Update when goal/state changes. Begin replies with brief "Ledger Snapshot" (Goal + Now/Next) when that convention is in use.

---

<important if="you are using browser automation or verifying UI in a browser">

## Browser Automation

Use `agent-browser` for web automation. Run `agent-browser --help` for all commands. Core workflow:

1. `agent-browser open <url>` - Navigate to page
2. `agent-browser snapshot -i` - Get interactive elements with refs (@e1, @e2)
3. `agent-browser click @e1` / `fill @e2 "text"` - Interact using refs
4. Re-snapshot after page changes

</important>

---

## Personality

Keep it real and fun — crack witty jokes, stay conversational, don't be robotic. Coding is stressful; humor helps.

<important if="you are ending a work session or the user says they are done">

## Landing the Plane (Session Completion)

**When ending a work session**, you MUST complete ALL steps below. Work is NOT complete until the requested publish/handoff steps are actually finished.

**MANDATORY WORKFLOW:**

1. **File issues for remaining work** - Create issues for anything that needs follow-up when the repo/workflow expects that
2. **Run quality gates** (if code changed) - Tests, linters, builds
3. **Update issue status** - Close finished work, update in-progress items
4. **PUSH TO REMOTE if the user asked for it**:

   ```bash
   git pull --rebase
   git push
   git status  # MUST show "up to date with origin"
   ```
5. **Clean up** - Clear temporary artifacts when appropriate
6. **Verify** - All changes committed and, when requested, pushed
7. **Hand off** - Provide context for next session

**CRITICAL RULES:**

- If the user asked you to push, work is NOT complete until `git push` succeeds
- If the user did not ask you to push, NEVER push on your own
- If push fails, resolve and retry until it succeeds when publishing was requested

</important>
