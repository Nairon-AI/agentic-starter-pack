# Native question UI

Use the host's native structured user-question tool for every round:

- Claude Code, including Claude sessions in Conductor: `AskUserQuestion`.
- Codex, including Codex sessions in Conductor: `request_user_input`.
- Other hosts: inspect the available tools for their native ask-user or structured-question equivalent.

Attempt the native tool before falling back. Never print a questionnaire in prose when a callable native tool can render it. Put each question, concrete choices, recommendation, and applicable business context into the tool's fields.

Follow the tool's schema and per-call limit. A logical round may contain up to 10 questions; if the tool accepts fewer, split the round across consecutive tool calls without recomputing the frontier until every question in that round is answered.

## Always offer simplification

Append this explicit, non-recommended choice to every native question, including renderer setup, frontier decisions, clarifications, confirmations, and handoffs:

```text
Label: I don't understand
Description: Explain this question and its options more simply, give one example, then ask it again.
```

Place the recommended decision choice first and this help choice last. Do not rely on an automatic **Other** field: it does not tell the user that simplification is available. Respect the host's option limit. If all material choices plus this help choice do not fit, split the decision into smaller prerequisite questions; never hide a material choice.

Selecting it is not an answer. Do not accept the recommendation, resolve the decision, ask downstream questions, or record it as settled. Instead:

1. Keep the question on the current frontier and log that simplification was requested.
2. Explain what the decision controls and why it matters in plain words.
3. Define unavoidable technical terms once. Give one concrete example. Restate each option with its main consequence.
4. Simplify or focus the live diagram when that helps; remove it when it adds confusion.
5. Ask the same decision again through the native tool with the simplification choice still present.
6. If selected again, simplify further using a different example or explanation structure.

Process other answered questions from the round normally, but do not ask anything downstream of the unresolved question.

## Enable editable Codex dialogs

If Codex rejects `request_user_input` in Default mode:

1. Run `codex features list` and find `default_mode_request_user_input`.
2. If the feature exists and is disabled, run `codex features enable default_mode_request_user_input`.
3. Save the frontier, decisions, and restart reason in the decision log.
4. Tell the user to restart the agent session in Default mode, then stop.

Do not switch to Plan Mode merely to unlock the question tool. Grill Me must remain able to update its decision log and, in repo-aware sessions, approved durable documentation.

If the runtime truly exposes no native structured-question tool and no supported feature can enable one, state that limitation once and use numbered plain text.
