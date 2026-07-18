# Repository-aware grilling

Use this mode when the subject lives in an existing repository or depends on its current behavior, domain language, architecture, or durable plans.

## Inspect before asking

Read the nearest project instructions first. Then inspect only the relevant:

- modules, routes, components, schemas, configuration, and tests
- plan, spec, PRD, issue, or decision map being sharpened
- root `CONTEXT.md`, or relevant contexts named by `CONTEXT-MAP.md`
- system-wide and context-specific ADRs

Confirm what the system does today. Answer repository-findable questions yourself. Ask the user only for real decisions or information the repository cannot supply.

Before the first round, summarize the most relevant current behavior, vocabulary, decision history, contradictions, and gaps. For a code-linked question, name the primary file and behavior in the native question dialog. Add at most two supporting paths and only the shortest useful snippet.

## Publish to one canonical home

Identify where each kind of settled information belongs:

- plan, feature, migration, or behavior decisions: the canonical plan, spec, PRD, issue, map, or other subject document
- domain terms and relationships: the relevant `CONTEXT.md`
- hard-to-reverse, surprising architectural tradeoffs: an ADR

If a decision has no durable home, add that destination to the frontier before finishing. Never copy the same decision prose into several files. The `.context` decision log stores pointers, frontier state, blockers, and evidence; it is not a shadow spec.

After every round, update canonical docs automatically for answers that settled. Do not ask for separate write approval. Change only settled sections and preserve unrelated content.

## Mark unfinished documents

While questions remain:

- Add a short document-level banner to each canonical Markdown plan, spec, PRD, map, or `CONTEXT.md` touched by the session: `> Status: In progress — Grill Me is resolving open decisions.` Preserve an equivalent existing convention instead of adding another.
- Give new or reopened ADRs `proposed` status using the repository's ADR convention. If none exists, use `status: proposed` in YAML frontmatter.

After the user confirms shared understanding, verify publication, remove the in-progress banners, and change accepted ADRs from `proposed` to `accepted`. Do not finalize a document that still contains unresolved or deferred decisions without labeling them clearly.

## Keep the domain model honest

When answers change domain terms, relationships, boundaries, or architecture, use `domain-modeling` when available; otherwise apply the rules below directly.

- Challenge conflicts with the existing glossary immediately.
- Replace vague or overloaded terms with one precise canonical term.
- Test relationships with concrete edge cases.
- Check user claims against code and surface contradictions.
- Create `CONTEXT.md`, context maps, and ADR directories lazily.
- Keep `CONTEXT.md` implementation-free: it is a glossary and relationship model, not a feature spec.
- Create an ADR only when the choice is hard to reverse, surprising without context, and based on a real tradeoff.

Repository inspection and decision-document updates are part of grilling. Product code, migrations, configuration changes, and other implementation wait for explicit user approval after shared understanding.
