---
name: recall
description: "Reconstruct your recent working context from your own chat history, live state, and the shared record (user reports, prior fixes, incidents), then hand back a tight current-state brief. Use for 'recall my work on X', 'catch me up', 'what have I been working on', 'where did I leave off', before starting or resuming work."
---

# Recall

**Before you start or resume work, you rebuild the user's recent working context and hand back a tight capsule of where things stand now and what to do next.** Use for "recall my work on X", "catch me up", "what have I been working on", or "where did I leave off".

Keep it tight and on-topic. Read only what the in-scope threads need, then stop. The heavy reading fans out to parallel subagents. The main thread keeps only their findings and the final brief.

Context lives in two records. Workspace conversation history holds what the agent and user did and decided. The shared record holds symptoms, prior fixes, incidents, tickets, and current production evidence. The `why` skill searches that second record. Do not reconstruct a long-lived feature from transcripts alone.

Use only the active workspace's transcript or conversation archive when the host explicitly exposes one. Never search broad home-directory or unrelated-project history. If transcripts are unavailable, use `.context/CONTINUITY.md`, handoff artifacts, current conversation context, git history, PRs, issues, and available connectors. State which sources were unavailable.

1. Classify, then route. One specific prior chat to resume is the `session-pickup` playbook, not this. Turning habits into a durable skill is `automate-me`. A human-readable summary of your work is a different task. Recall loads working context across recent chats before you act. If the user already gave you a full state capsule (paths, branch, the change), use it and skip the mining.
2. Lock the scope before searching. Pin the window ("recent" is a real range, default the last 7 days), the topic if named, and the workspace (default the active one; never read another project's transcripts without being asked). State the scope back. Never quietly turn "all" into "recent N".
3. Fan out across available workspace history. Give parallel read-only subagents non-overlapping time slices. Order candidates by real modification time, search the topic first, read only relevant regions, and skip the current chat plus obvious subagent/eval/test noise. Each returns the same schema, one block per source: topic, user goal, decisions, open threads, struggles and corrections, and artifacts such as PRs, tickets, or branches. Cite the transcript ID or artifact path. For one or two sources, search directly. Keep raw transcripts out of the main context.
4. Sweep the shared record whenever the topic names a feature, file, subsystem, area, or bug. Run `why` with the question reframed as: "what is the current state, what was tried and did not hold, and what are users still reporting?" Reuse its per-source playbooks, run available investigators in parallel with history mining, keep null results, and name unavailable sources. Skip only for pure activity recall with no named target.
5. Verify against live state. A transcript or a stale ticket is history, not current truth, so take the PRs, branches, and tickets that the mining and the sweep surfaced and check them with `git` and `gh`. When the answer hinges on what an agent actually did (the tools it ran, files it read, errors it hit), read the full transcript, not just a trimmed local copy.
6. Write the brief to the contract below. Group by thread. Stay on the named topic.

## Output contract

Lead with the capsule, then the thread status, then the problems, then the next move. Deeper detail goes below or gets cut.

- **Capsule.** At most 5 bullets. What this work is and where it stands overall.
- **Threads.** One line each, prefixed with exactly one status tag: `[merged #N]`, `[open PR #N]`, `[in flight <branch>]`, `[verified, uncommitted]`, `[reverted #N]`, or `[planned, not started]`. A thread with no tag is not done yet, so tag it.
- **Problems.** At most 5, the recurring ones. Include the symptoms users keep reporting and any fix that shipped and was reverted, so the next attempt starts where the last one failed.
- **Next move.** The single most useful next action, concrete.

An adjacent feature or ticket stays out unless it blocks this one. When the capsule and thread lines outgrow a screen, cut detail before threads. Apply `stop-slop`, cite workspace-history findings by their source ID and shared-record findings by PR, ticket, permalink, or incident ID, and sanitize private context before public output.

**Reply:** the brief, to the contract above.
