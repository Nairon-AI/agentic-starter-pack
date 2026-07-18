# Teammate escalation

Use `ask <number>` for one frontier question or `ask all` for the whole frontier.

`ask` is not an answer. Keep copied questions and their downstream branches unresolved. Continue processing answered questions and other unblocked branches.

## Build the packet

1. Resolve the developer's name from the conversation, workspace identity, or `git config user.name`. If still unknown, ask once.
2. Infer the work type: Feature, Migration, Bug, Incident, Architecture decision, Plan, or another accurate label.
3. Rewrite the question so it stands alone and follows the main skill's writing and business-context rules.
4. Extract only the relevant Sideshow branch. Include portable Mermaid source and a short plain-text reading. Include a shareable HTTPS Sideshow URL when available; never rely on localhost or expose a token.
5. Remove secrets, private file contents, inaccessible internal links, and irrelevant implementation detail.

Use this Markdown packet:

```text
Context: <developer name> is working on <work type> — <current behavior, intended outcome, customer or business stakes, and constraints needed to answer confidently>.

Decision needed: <what this answer will determine>

Question: <standalone question>

Options:
A. <option>
B. <option>
C. <option, when useful>

Current recommendation: <option and concise rationale, including applicable customer/user outcome, business goal, revenue/cost/risk/operations impact, tradeoff, and timing; never invent context>

Diagram:
<focused Mermaid source and plain-text reading>

What I need from you: Choose an option or propose another. Briefly explain any missing constraint or risk.
```

## Copy it

Save beside the decision log as `.context/grill-me-<short-topic>-ask-r<round>-q<number-or-all>.md`. Set `packet_file` to that path, then use the first available clipboard command:

- macOS: `pbcopy < "$packet_file"`
- Linux Wayland: `wl-copy < "$packet_file"`
- Linux X11: `xclip -selection clipboard < "$packet_file"`
- Windows/WSL: `clip.exe < "$packet_file"` or PowerShell `Get-Content -Raw $packet_file | Set-Clipboard`

Verify success. If no clipboard tool exists, do not claim success: give the packet path and print it for manual copying.

After copying, name the copied question and say it remains unresolved. Log the escalation. When the user returns with a teammate's answer, treat it as input, ask the user to confirm adoption when needed, then resolve the decision and recompute the frontier.
