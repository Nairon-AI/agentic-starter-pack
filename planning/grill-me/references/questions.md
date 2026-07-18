# Native question UI

Use the host's native structured user-question tool for every round:

- Claude Code, including Claude sessions in Conductor: `AskUserQuestion`.
- Codex, including Codex sessions in Conductor: `request_user_input`.
- Other hosts: inspect the available tools for their native ask-user or structured-question equivalent.

Attempt the native tool before falling back. Never print a questionnaire in prose when a callable native tool can render it. Put each question, concrete choices, recommendation, and applicable business context into the tool's fields.

Follow the tool's schema and per-call limit. A logical round may contain up to 10 questions; if the tool accepts fewer, split the round across consecutive tool calls without recomputing the frontier until every question in that round is answered.

## Enable editable Codex dialogs

If Codex rejects `request_user_input` in Default mode:

1. Run `codex features list` and find `default_mode_request_user_input`.
2. If the feature exists and is disabled, run `codex features enable default_mode_request_user_input`.
3. Save the frontier, decisions, and restart reason in the decision log.
4. Tell the user to restart the agent session in Default mode, then stop.

Do not switch to Plan Mode merely to unlock the question tool. Grill Me must remain able to update its decision log and, in repo-aware sessions, approved durable documentation.

If the runtime truly exposes no native structured-question tool and no supported feature can enable one, state that limitation once and use numbered plain text.
