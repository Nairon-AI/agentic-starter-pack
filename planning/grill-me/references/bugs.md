# Bug grilling

Use this workflow when the subject is a bug, regression, incident, or incorrect behavior. A developer may provide a Linear ticket, screenshots, logs, user reports, or only a symptom.

## Investigate before asking fix questions

1. Read the supplied ticket, attachments, screenshots, comments, logs, and relevant repository history.
2. Invoke the `rca` skill. Reproduce when safe, trace backward from symptom to source, test realistic production conditions, state confidence, and challenge the diagnosis.
3. If protected-system evidence is needed, follow the main skill's protected-access workflow. Ask for a precise permission only after repository docs fail to provide access.
4. Invoke `blast-radius` to find non-obvious breakage and prove the cheapest safety-critical fact. Use read-only checks, existing tests, or temporary proof during grilling; do not edit product files yet.
5. Recommend the smallest safe source fix, regression coverage, and any defense in depth. Stop before implementation until the user confirms shared understanding and explicitly approves the fix.

Do not call a guess a root cause. If reproduction or production evidence is missing, lower confidence and keep the missing fact on the frontier.

## Explain it simply

Give the user a brief, well-spaced summary before fix decisions:

```text
Symptom
<what the user sees>

Cause
<why it happens, in plain words>

Cure
<smallest safe fix>

Fix type
<manual DB fix | code change | both | user behavior | bad UX>

Blast radius
<who or what is affected; Low | Medium | High | Urgent>

Confidence
<High | Medium | Low, plus the missing proof if not High>
```

Use short sentences and familiar words. Explain technical details only when they change the decision. If the user followed a reasonable path and the product misled them, classify it as bad UX rather than blaming the user.

## Use Linear as the canonical bug record

Resolve the current developer from Linear identity, the supplied ticket, or the conversation; ask once if ambiguous. If the user supplied a Linear ticket, use it; do not create a duplicate. Once the issue is confirmed, append the RCA, evidence, fix type, recommendation, blast radius, and verification plan, then set it to the workspace's started/In Progress state, assign it to the current developer, and set priority.

If no ticket was supplied:

1. Search Linear for a duplicate by symptom, affected workflow, and root-cause area.
2. Create a ticket only when reproduction or strong evidence confirms a real product, operations, data, security, or UX issue.
3. Set it to In Progress, assign it to the current developer, and include links to relevant PRs, evidence, and canonical docs.

Choose priority from confirmed blast radius:

- **Urgent** — active outage, security incident, data loss/corruption, money movement, or operations blocked.
- **High** — core workflow or many users affected, serious harm, and no safe workaround.
- **Medium** — bounded impact with a usable workaround or non-critical operational cost.
- **Low** — rare, cosmetic, or low-harm issue.

Do not inflate priority from uncertainty alone.

Prefer Linear's official OAuth MCP at `https://mcp.linear.app/mcp`. Before adding it, use the main skill's current third-party documentation workflow to verify the official setup. If Linear tools are missing, add it at user scope with the client's native command (`codex mcp add linear --url https://mcp.linear.app/mcp` or `claude mcp add --transport http linear-server https://mcp.linear.app/mcp`), complete authentication, save the session state, and tell the user to restart. Never put a Linear token in project files. If setup is unavailable, prepare the exact ticket body and report the blocker instead of claiming creation.

Linear record creation and updates are part of bug grilling, not product implementation.
