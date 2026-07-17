---
name: automate-me
description: Draft or update a personal mode skill from repeated working preferences, corrections, and current-workspace evidence. Use when the user says "automate me," wants agents to work in their style, or asks to create, refresh, or update a personal mode skill.
---

# Automate me

Turn the user's recurring working conventions into one concise `<handle>-mode` skill. Use `skill-creator` for authoring and `stop-slop` for prose. Capture durable preferences, not a biography or one conversation's mood.

## 1. Find an existing mode

Search the active project and normal personal skill locations for `<handle>-mode/SKILL.md`, including `.agents/skills/`, `.claude/skills/`, `.cursor/skills/`, and the configured Codex skills directory.

If one exists, update it unless the user explicitly asks to start over. Preserve rules not contradicted by stronger evidence. Use the file's last modification or commit time to focus on newer evidence.

## 2. Gather evidence safely

Use only evidence already in the current conversation or explicitly exposed for the active workspace:

- repeated response-format or tone corrections
- autonomy and clarification preferences
- delegation and parallelism habits
- verification and definition-of-done expectations
- code, prose, git, review, and release conventions
- recurring tool or skill choices

If the host exposes a workspace-scoped transcript directory, inspect only that directory. Never glob across unrelated projects or broad home-directory history. If transcripts are unavailable, use current conversation context, repo instructions, `.context/CONTINUITY.md`, handoff files, and durable project notes. Do not pretend one session proves a recurring preference.

For a large history, use parallel read-only subagents on non-overlapping time slices. Require evidence pointers. Treat patterns seen in multiple slices as strong; treat lone examples as weak.

## 3. Ask for missing intent

Mining shows behavior, not every preference. Ask at most two short structured questions about the areas that materially affect the skill, then one optional free-form question. Skip questions already answered by strong evidence.

Useful areas:

- response style
- autonomy and approval boundaries
- subagent use
- verification and review
- git and delivery process
- skill and tool preferences

## 4. Cluster the rules

Use only sections supported by evidence:

- Response style
- Autonomy
- Understand first
- Subagents
- Code and prose discipline
- Review and verification
- Process
- Skills and tools

Drop generic advice such as "communicate clearly." Keep specific rules that would change agent behavior. Do not force symmetrical sections.

## 5. Author with skill-creator

Invoke `skill-creator` and create or update `<handle>-mode` in the location the user selected. If they gave no preference, choose the project's normal local skill directory; use the personal Codex skills directory only for cross-project preferences.

Requirements:

- folder name and frontmatter `name` match `<handle>-mode`
- description triggers only on the handle, explicit mode name, or requests to work in that person's style
- only `name` and `description` in frontmatter unless the host requires more
- short imperative rules; reference other skills instead of copying them
- no secrets, private transcript excerpts, or identifying details beyond the chosen handle

Apply `stop-slop` to every line. Show the draft and incorporate feedback. A mode skill is subjective; user recognition matters more than a synthetic benchmark.

## 6. Validate and hand off

Run the available skill validator. Re-read the final skill cold and confirm each rule has evidence or explicit user approval. Report the path and key behaviors captured. Commit, push, or open a PR only when the user's requested workflow authorizes it.

## Guardrails

- Do not overfit one correction.
- Do not silently read unrelated chat history.
- Do not invent preferences to fill a section.
- Do not make the mode auto-apply to generic work unless the user explicitly asks.
- Use a normal task-specific skill when the request covers one narrow workflow rather than a whole working style.
