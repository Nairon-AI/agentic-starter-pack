Sacrifice grammar for concision in your final output.

Spin off multiple sub agents if it helps you complete any work asked of you, faster.

# Nairon Skills - Portable Agent Skills Catalog

A public repository of installable agent skills, a starter `AGENTS.md`, and a small installer CLI for bootstrapping the stack into new repos.

---

## Quick Start

| Surface | Toolchain | Command |
| --- | --- | --- |
| Catalog validation | **npm** | `npx -y skills@latest add . --list` |
| Installer CLI | **zig** | `cd cli && zig build && zig build run -- list` |
| Public install check | **npm** | `npx -y skills@latest add Nairon-AI/skills --list` |

**Most repo changes happen in the skill folders at the repo root.** For installer behavior, see `cli/` and `scripts/bootstrap.sh`. For catalog shape and positioning, see `README.md`.

---

## Critical Rules

### Validation Is Mandatory

```bash
# Before marking ANY task complete:
npx -y skills@latest add . --list
```

<important if="you are writing or modifying the installer CLI">

### Run CLI Validation

```bash
cd cli && zig build
cd cli && zig build run -- list
```

</important>

<important if="you are creating, renaming, or editing skills">

### Run Skill Validation

```bash
npx -y skills@latest add . --list
rg -n "(/Users/|/mnt/|~/.claude|\\.claude|CLAUDE_|your-org|your-repo|old-company|flow-next)" . --glob '!.git/**'
```

</important>

### Never Start/Kill Long-Running Processes

Don't start watchers, dev servers, background daemons, or kill processes **unless explicitly requested**. Default job is to edit files and run narrow validation only.

<important if="you are validating install flows or local repo behavior">

### Local Repo Phrase Map (Do Exactly This)

Always read `README.md` first before changing install flow, catalog messaging, or bootstrap commands.

- **"Validate the skills repo"** or **"Check the catalog"**
  - Run: `npx -y skills@latest add . --list`
- **"Test the installer"**
  - Run: `cd cli && zig build run -- list`
- **"Check the public install flow"**
  - Run: `npx -y skills@latest add Nairon-AI/skills --list`

</important>

### No AI Attribution

Don't include "Generated with Claude Code" or "Co-Authored-By: Claude" in commits or PRs.

### No Pushing Without Permission

**NEVER push to remote (**`git push`**) without explicit user confirmation.**

**Rules:**

- Commits are fine — commit freely to the local branch
- Don't push work-in-progress code to any remote branch
- Don't push just to "save progress" — that's what local commits are for
- If the user asked for a push, publish cleanly and verify the remote state afterward

### Committing

**ONLY commit files YOU changed in THIS session.**

- ALWAYS include `fixes #<number>` or `closes #<number>` in commit messages when a related issue/PR exists
- NEVER use `git add -A` or `git add .` — these sweep up changes from other agents
- ALWAYS use `git add <specific-file-paths>` listing only files you modified
- Before committing, run `git status` and verify you are only staging YOUR files
- Track which files you created/modified/deleted during the session

### User Override

If user instructions conflict with rules here, ask for confirmation before overriding. Only then execute.

<important if="you are performing git operations on shared branches like main">

### DANGEROUS GIT OPERATIONS - READ THIS CAREFULLY

**Protected branch:** `main`

The following operations are **FORBIDDEN** without explicit human approval:

| Operation | Why It's Dangerous |
| --- | --- |
| `git push --force` | Overwrites remote history, DELETES other people's work |
| `git push --force-with-lease` | Same risk - can still delete commits |
| `git reset --hard origin/X` then push | Rewrites branch, loses commits |
| `git rebase` on shared branches | Rewrites history, causes merge hell |

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
# 4. Push only if the user already approved it
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

</important>

---

## Repo Knowledge

### Shared `SKILL.md` Convention

This repo uses `SKILL.md` as the primary workflow convention.

Before working in an area, read the most relevant files for that task:

- repo root `README.md` for install flow, public messaging, and catalog structure
- repo root `AGENTS.md` for contributor workflow and guardrails
- `<skill>/SKILL.md` for the skill you are touching
- that skill's `reference/`, `references/`, `scripts/`, `assets/`, or `evals/` files when they exist
- `NOTICE.md` whenever you change or extend attributed content

If multiple apply, read `README.md` first, then the more specific files for the surface you are touching.

### Shared Runtime Context

Before changing install flow, public docs, starter instructions, routing descriptions, or skill behavior, read the relevant repo-local context first.

This is the non-Flux decision surface for Codex and Claude Code. Treat these points as default guardrails:

- This repo publishes skills that must work across arbitrary repos and coding agents, not just ours.
- Public portability beats private convenience.
- Frontmatter `description` is routing logic, not marketing copy.
- Folder name must match frontmatter `name`.
- Large detail belongs one hop away in `reference/`, `references/`, `scripts/`, `assets/`, or `evals/`.
- The installer CLI is convenience only; the standard `skills` ecosystem flow must still work.
- If a skill needs an external dependency, the installation path must be explicit in the skill itself.

| Topic | Documentation |
| --- | --- |
| **Repo Overview** | `README.md` — **READ THIS for install flow and catalog positioning** |
| **Contributor Rules** | `AGENTS.md` — **READ THIS before changing repo behavior** |
| **Attribution** | `NOTICE.md` — **READ THIS when touching derived frontend guidance** |
| **Installer CLI** | `cli/src/main.zig` — Launcher and `AGENTS.md` writing flow |
| **Bootstrap Script** | `scripts/bootstrap.sh` — Public one-liner entrypoint |
| **Skill Source** | `<skill>/SKILL.md` — Trigger description and workflow |

---

## Plan Mode

When creating plans, PRDs, specs, or epic/task breakdowns:

- **Be extremely concise.** Sacrifice grammar for brevity.
- **End every plan with unresolved questions.** If none, state "None identified."

This keeps plans scannable and actionable rather than verbose.

---

## Continuity Ledger

If a task spans multiple phases, maintain a lightweight continuity note in scratch space:

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

Do not commit scratch continuity notes unless the user explicitly asks for them to live in the repo.

---

<important if="you are using browser automation or verifying UI in a browser">

## Browser Automation

Use `browser-qa` / `agent-browser` for web automation. Run `agent-browser --help` for all commands. Core workflow:

1. `agent-browser open <url>` - Navigate to page
2. `agent-browser snapshot -i` - Get interactive elements with refs (`@e1`, `@e2`)
3. `agent-browser click @e1` / `fill @e2 "text"` - Interact using refs
4. Re-snapshot after page changes

</important>

---

## Personality

Keep it real and fun — crack witty jokes, stay conversational, don't be robotic. Coding is stressful; humor helps.

<important if="you are ending a work session or the user says they are done">

## Landing the Plane (Session Completion)

**When ending a work session**, complete the applicable steps below.

**MANDATORY WORKFLOW:**

1. **File follow-ups** - Note anything that still needs work
2. **Run quality gates** (if files changed) - Catalog validation, CLI build, and any touched-surface checks
3. **Update issue status** - Close finished work or note what remains
4. **PUSH TO REMOTE only if the user already approved it**:

   ```bash
   git pull --rebase
   git push
   git status
   ```
5. **Verify** - All intended changes are committed, and if publishing was requested, pushed
6. **Hand off** - Provide context for the next session

**CRITICAL RULES:**

- If the user asked you to publish changes, work is NOT complete until `git push` succeeds
- If the user did **not** ask you to publish changes, NEVER push on your own
- Never say "ready to push when you are" after the user explicitly asked for publishing — just do it and verify

</important>

<!-- BEGIN FLUX -->
## Flux

<important if="session start — run this check before anything else">
**Flux install check (every session):**
Run `test -x .flux/bin/fluxctl` at the start of every session.
If Flux is **not installed**, use the equivalent interactive prompt tool available in your environment to ask:

> **This repo works well with Flux — a self-improving Codex-first harness. It's not installed in this repo yet. Would you like to set it up?**

Options:
1. **"Yes, install Flux"** — Run `/flux:setup`, let it scaffold `.flux/bin/fluxctl`, then continue in the same repo.
   ```bash
   /flux:setup
   ```
2. **"No, skip for now"** — Respect the choice. Do not ask again in the same session.
3. **"What does Flux do?"** — Explain these benefits, then re-ask:
   - **Structured workflows** — Routes intent to the right workflow (scope, work, review, reflect) instead of freeform prompting
   - **Persistent memory** — Brain vault (`.flux/brain/`) remembers codebase context, conventions, decisions, and pitfalls across sessions
   - **Self-improvement** — Learns from every session and gets better at working with this specific project over time
   - **Automated multi-model code review** — Not just the same model reviewing its own code
   - **Security scanning** — Catches hardcoded secrets, SQL injection, XSS before they ship
   - **Tool discovery** — Recommends and installs MCP servers matched to your stack
   - **Epic planning** — Breaks large tasks into scoped epics with dependency tracking
   - **Codebase readiness audits** — 8-pillar, 48-criteria audit before you start building features
   - **Sycophancy guard** — Challenges bad ideas instead of blindly validating them

If Flux IS installed, skip this check and proceed normally.
</important>

This repo can use Flux for structured AI development. Use `.flux/bin/fluxctl` instead of markdown TODOs or TodoWrite when Flux is installed.

**Codex-specific note:** Codex may not show a Claude-style slash-command picker for custom Flux commands. Treat literal `/flux:*` text as an explicit prompt trigger. If Flux is installed and the session is fresh, `/flux:scope`, `/flux:work fn-1`, and similar prompts should still route correctly even without visible autocomplete.

**Mental model:**
- Users should be able to say what they want naturally: build a feature, fix a bug, refactor something, continue work, or hand work off.
- Flux should realign with `.flux/` state before acting.
- If there is an active scoped objective, resume it.
- If there is active implementation work, resume that.
- If there is no active objective, start `/flux:scope`.

**Turn policy (mandatory):**
- On any new work-like request, first run `.flux/bin/fluxctl session-state`.
- If `session-state` says `needs_prime`, run `/flux:prime` before scoping, coding, or review work.
- Treat these as work-like requests:
  - "build", "implement", "add", "create"
  - "fix", "debug", "resolve"
  - "refactor", "clean up", "rewrite"
  - "continue", "resume", "pick this up"
  - "hand this off", "what next", "where are we"
- Treat these as **tool/recommendation requests** — route directly to `/flux:improve` with the topic as `--user-context`:
  - "find me tools for...", "what can help with...", "any recommendations for..."
  - "help me with growth", "improve my testing", "optimize deployment"
  - "is there a tool for...", "what MCP should I use for..."
  - Any request asking about optimizations, tools, or recommendations for a specific area
  - Example: "find me tools for growth engineering" → `/flux:improve --user-context "growth engineering"`
- Treat these as **memory capture requests** — route directly to `/flux:remember`:
  - "remember ...", "don't forget ...", "keep in mind ...", "from now on ..."
  - "always ..." / "never ..." when the user is setting an ongoing rule, not asking a question
- Treat these as **task management requests** — route to the `flux` skill:
  - "what's the status", "show me my tasks", "list epics", "what's ready", "show fn-1"
- Treat these as **Flux config requests** — route to the `flux` skill:
  - "show my Flux config", "what did setup configure", "show Flux settings", "edit Flux settings"
  - When the user wants to inspect config, prefer `.flux/bin/fluxctl config list`
  - When the user wants to change several settings interactively, prefer `.flux/bin/fluxctl config edit`
- Treat these as **React visual-jank requests** — if `dejank` is installed in the repo, route directly to `/flux:dejank`:
  - "flicker", "flash", "blink", "layout shift", "jank", "stutter", "jump", "pop in", "scroll reset", "feels rebuilt"
  - especially when the user is talking about a React UI, first render, hydration, or visual instability
  - Check install by looking for `.secureskills/store/dejank/manifest.json` first, then legacy `.codex/skills/dejank/SKILL.md` or `.claude/skills/dejank/SKILL.md`
  - If the repo does not have Dejank installed, continue with the normal Flux routing path and mention `/flux:setup` if Dejank would help
- Treat these as **codebase understanding requests** — if `diffity-tour` is installed in the repo, route directly to `/diffity-tour`:
  - "how does this work", "walk me through auth", "help me understand the billing flow", "show me what touches checkout"
  - especially when the user wants a guided explanation of an existing feature, subsystem, codepath, or cross-cutting behavior
  - Do not use this route when the user is clearly asking you to change or build something rather than understand it
  - Check install by looking for `.secureskills/store/diffity-tour/manifest.json` first, then legacy `.codex/skills/diffity-tour/SKILL.md` or `.claude/skills/diffity-tour/SKILL.md`
  - If the repo does not have Diffity Tour installed, continue with the normal Flux routing path and mention `/flux:setup` if Diffity Tour would help
- Treat these as **specialist workflow requests** — route directly instead of making the user rephrase:
  - "grill me", "stress test the behavior", "verify behavior" → `/flux:grill`
  - "TDD", "test first", "red green refactor" → `/flux:tdd`
  - "design the interface", "design it twice", "compare interfaces" → `/flux:design-interface`
  - "ubiquitous language", "define terms", "domain glossary", "DDD" → `/flux:ubiquitous-language`
  - "export this for ChatGPT", "external LLM review", "review this with Claude web" → `/flux:export-context`
  - "watch this PR", "auto-fix", "babysit this PR", "fix CI after submit" → `/flux:autofix`
  - "cut a release", "publish Flux vX.Y.Z", "release this version" → `/flux:release`
  - "improve CLAUDE.md", "restructure AGENTS.md", "add important if blocks" → `/flux:improve-claude-md`
  - "share my Flux setup", "export a profile", "import a profile" → `/flux:profile`
  - "build me a skill", "create a skill for...", "scaffold a skill" → `/flux:skill-builder`
  - "upgrade Flux", "update the plugin" → `/flux:upgrade`
  - "report a Flux bug", "contribute a fix to Flux" → `/flux:contribute`
- Before scoping or coding, reconcile the user's message with Flux state.
- Do not silently ignore active Flux state just because the user phrased the request casually.

<important if="you are routing a request using Flux session state">
**Routing rules:**
- If `session-state` says `needs_prime`: run `/flux:prime` first. Do not start scope or implementation before prime completes.
- If the user is explicitly trying to remember a repo rule or durable fact, prefer `/flux:remember` over scoping.
- If `session-state` says `resume_scope`: continue the current scoped objective unless the user clearly wants a new one.
- If `session-state` says `resume_work`: resume the active task/objective unless the user clearly wants a new one.
- If `session-state` says `needs_completion_review`: route to review before claiming the work is fully done.
- If the message is a React visual-jank complaint and Dejank is installed, prefer `/flux:dejank` over generic scope/RCA routing.
- If the user asks how an existing feature or subsystem works and Diffity Tour is installed, prefer `/diffity-tour` over generic scoping as long as they are not asking for code changes yet.
- If `session-state` says `fresh_session_no_objective`: start `/flux:scope`.
- If the user clearly starts a new objective while another is active, ask whether to switch objectives, then use `.flux/bin/fluxctl objective switch <epic-id>` when needed.
</important>

<important if="you are starting a new scope or scoping a feature, bug, upgrade, or refactor">
**Scoping rules:**
- `/flux:scope` is the full scoping workflow: Start -> Discover -> Define -> Develop -> Deliver -> Handoff.
- Prime is the first workflow step in a repository. If the repo is not primed yet, do that automatically before starting scope.
- At the start of a new scope, ask:
  - is this a feature, bug, upgrade, or refactor?
  - is the user technical or non-technical?
  - should we go shallow or deep?
  - are they implementing it with AI or handing it to an engineer?
 - If the user is non-technical, route to `/flux:propose`.
- During scoping, show progress with `.flux/bin/fluxctl scope-status`.
- Persist phase changes and artifacts through `fluxctl` instead of relying on chat memory alone.
- Treat `.flux/brain/codebase/architecture.md` as the canonical whole-product architecture note.
- If architecture changes, update it through `.flux/bin/fluxctl architecture write`.
</important>

<important if="you are building, redesigning, or restyling a user-facing frontend">
**Frontend rules:**
- If project-local frontend skills exist, you MUST load and follow them before making UI changes. Check `.secureskills/store/<skill>/manifest.json` first, then `.codex/skills/`, then `.claude/skills/` mirrors.
- For ANY frontend design work, the mandatory base stack is:
  - `ui-skills`
  - `frontend-design`
  - `1+` specialist skills: `adapt`, `animate`, `arrange`, `audit`, `bolder`, `clarify`, `colorize`, `critique`, `delight`, `distill`, `extract`, `harden`, `normalize`, `onboard`, `optimize`, `overdrive`, `polish`, `quieter`, `teach-impeccable`, `typeset`
- Do not start UI implementation until you have explicitly chosen which specialist skill(s) apply. Pick the smallest set that matches the task, but pick at least one.
- Treat `ui-skills` as the repo-specific frontend orchestration layer. Treat `frontend-design` as the aesthetic and implementation baseline. Treat the selected specialist skill(s) as required specialists, not optional polish.
- Treat `design-taste-frontend` as mandatory for frontend generation when present.
- Treat installed UI skills as mandatory guardrails when present. At minimum, load `baseline-ui`; also load `fixing-accessibility`, `fixing-motion-performance`, and `fixing-metadata` when the task touches those concerns.
- Before designing the UI itself, read the relevant local context in this order:
  - `project-context/design-context.md` if present
  - `AGENTS.md`
  - `README.md`
  - the nearest relevant docs or package README
- If the repo has substantive frontend work to do and these skills are missing, strongly recommend installing the frontend stack before large UI changes.
- Define the design system and constraints before coding: typography, color roles/tokens, spacing rhythm, image treatment, and the primary CTA.
- Treat the first viewport as one composition, not a pile of cards.
- On landing or promo pages, default to one H1, one short supporting sentence, one CTA group, and one dominant visual. Prefer a full-bleed hero image/background over inset media cards unless the existing design system clearly says otherwise.
- Avoid generic UI patterns by default: weak visual hierarchy, flat single-color backgrounds, hero cards, floating badges on hero media, and card-heavy layouts where borders/backgrounds are not doing real interaction work.
- Use real visual anchors and 2-3 intentional motions. Motion should create hierarchy or presence, not noise.
- Preserve the existing design system when the repo already has one. Only push for bolder visual direction when the surface is actually being designed or refreshed.
- UI clarity beats capability density. If a screen feels mentally wide for the documented user or design context, reduce choices, split steps, or rename actions before polishing visuals.
- Default to compact UI. Do not add generous white space, oversized paddings, tall empty bands, or verbose helper copy unless the product surface explicitly needs it.
- Modals, sheets, and dialogs must stay comfortably inside the viewport on common laptop heights. If actions fall below the fold, reduce copy and spacing first; split the flow second.
- Verify user-facing frontend work in a browser before calling it done. Check desktop and mobile layouts, ensure fixed/floating elements do not cover primary content, and confirm the final UI matches the scoped design intent.
</important>

**Quick commands:**
```bash
.flux/bin/fluxctl list                # List all epics + tasks
.flux/bin/fluxctl epics               # List all epics
.flux/bin/fluxctl objective current   # Show active objective
.flux/bin/fluxctl session-state       # Show routing state
.flux/bin/fluxctl prime-status        # Show whether prime is still required
.flux/bin/fluxctl architecture status # Show architecture diagram freshness
.flux/bin/fluxctl scope-status        # Show scoping phase/progress
.flux/bin/fluxctl tasks --epic fn-N   # List tasks for epic
.flux/bin/fluxctl ready --epic fn-N   # What's ready
.flux/bin/fluxctl show fn-N.M         # View task
.flux/bin/fluxctl start fn-N.M        # Claim task
.flux/bin/fluxctl done fn-N.M --summary-file s.md --evidence-json e.json
```

**Rules:**
- Use `.flux/bin/fluxctl` for ALL task tracking
- Do NOT create markdown TODOs or use TodoWrite
- Re-anchor (re-read spec + status) before every task
- If `.flux/context/agentmap.yaml` exists, use it as a fast structural overview of the repo before broad file exploration
- Treat the agentmap as navigation aid only. Still read the actual files before making changes
- If the `fff` MCP is available, prefer its tools for file search operations instead of default Glob/find — it's faster, supports fuzzy matching, and ranks by access frecency
- Prefer installed specialist MCPs over generic/default harness tools when both can solve the task
- If the `context7` MCP is available, use it for package, framework, SDK, and API documentation lookups. Resolve the library ID first, then query Context7. Do not use the default harness `web_search` tool or other generic web search for documentation fetching when Context7 can answer.
- If the `exa` MCP is available, use it for broad web research, current-information lookup, and generic internet discovery instead of the default harness `web_search` tool
- If the `firecrawl` MCP is available, use it for page extraction, crawling, and PDF/article retrieval when you need the actual page contents instead of search-result snippets
- In Flux quality/review passes for React repos, run `react-doctor` on the current diff when available. Prefer an installed `react-doctor` binary; otherwise use `npx -y react-doctor@latest . --diff HEAD --fail-on error`. This complements `/flux:dejank`; it does not replace the jank-specific workflow.

<important if="you are troubleshooting Flux commands or encountering errors">
**Troubleshooting:**
- If Flux commands fail or return "Unknown skill", consult the official README: https://github.com/Nairon-AI/flux#troubleshooting
- In Codex, do not treat a missing slash-command picker as proof Flux is broken. Restart the session and try an exact `/flux:*` prompt first.
- Follow the troubleshooting steps exactly — do not guess or improvise fixes
- If the documented fixes don't work, the user should create a GitHub issue: https://github.com/Nairon-AI/flux/issues
</important>

**More info:** `.flux/bin/fluxctl --help` or read `.flux/usage.md`
<!-- END FLUX -->
