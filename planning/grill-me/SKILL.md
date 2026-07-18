---
name: grill-me
description: Relentlessly interview the user in dependency-aware batches to sharpen a plan, decision, design, or idea. Use when the user wants to stress-test their thinking, get grilled, or mentions "grill me". Ask every currently unblocked decision in each round, then recompute the decision frontier from the answers.
---

Interview the user until the subject is clear enough to act on. Map it as a design tree: every decision branches into decisions that depend on it.

## Conditional workflows

Read the relevant reference completely before using that capability:

- **Native question UI:** Read [references/questions.md](references/questions.md) before the first round. Use the host's structured ask-user tool instead of printing a questionnaire.
- **Visual explanation:** Read [references/sideshow.md](references/sideshow.md) before the first Sideshow visual. Use Sideshow for meaningful branches, flows, comparisons, timelines, or spatial choices; skip it for trivial choices.
- **Current third-party documentation:** Read [references/context7.md](references/context7.md) before looking up versioned or current documentation for a third-party library, framework, SDK, API, or platform. Try Context7 before general web search.
- **Other online research:** Read [references/exa.md](references/exa.md) before broader current or external research, or when Context7 cannot answer a documentation question.
- **Teammate escalation:** Read [references/ask.md](references/ask.md) when the user sends `ask <number>` or `ask all`.

## Start the session

Before the first round:

1. Inspect the relevant conversation, files, repository, and tools.
2. Create the decision log described below.
3. Map the initial design tree and frontier.
4. Summarize known facts and assumptions in one or two sentences.
5. Estimate total decisions, rounds, and time. Update estimates as the tree changes.

Finding facts is the agent's job. Retrieve facts instead of asking the user. When independent fact-finding would help and sub-agents are available, dispatch it with only the needed context. Do not block the whole frontier: defer only questions downstream of unfinished research and ask the rest now.

Ask the user only about decisions or information only they can know. Every consequential decision belongs to the user. Recommend, but wait for their answer.

## Work in rounds

The **frontier** is every unresolved decision whose prerequisites are settled.

For each round:

1. Compute the whole frontier.
2. Select up to 10 frontier questions. Keep any overflow on the frontier for the next round.
3. Ask the selected questions through the host's native structured user-question tool as described below.
4. Give concrete options and a concise recommendation for each.
5. Wait for answers to the whole logical round before starting the next round.
6. Update the log, reshape the tree, and recompute the frontier.

Never ask a question that depends on another question still open in the same round. Put it in a later round. Remove branches eliminated by earlier answers and update the estimate.

Support these replies:

- `rec all`: accept every recommendation in the round.
- `rec`: when only one frontier question remains, accept its recommendation; otherwise ask for the question number.
- `<number> rec`: accept one recommendation.
- `idu <number>`: explain that question with a dumb-simple example, then wait for its answer.
- `ask <number>` or `ask all`: run the teammate-escalation workflow. This does not answer the question; keep it and its downstream branches unresolved.

For the plain-text fallback only, end each round with:

```text
Reply by number. Use `rec all`, `1 rec`, `idu 2`, or `ask 2`.
```

## Write for humans

Apply a practical version of [Orwell's six writing rules](https://www.orwellfoundation.com/the-orwell-foundation/orwell/essays-and-other-%20works/politics-and-the-english-language/) to every question, option, recommendation, context packet, and summary:

1. Remove stale metaphors, clichés, and stock AI phrases.
2. Prefer short, familiar words.
3. Cut words that add no meaning.
4. Prefer active voice and name the actor.
5. Prefer plain English; define necessary technical terms once.
6. Break a rule when obeying it would make the writing ugly, inaccurate, or less clear.

Before sending, ensure a smart teammate outside the conversation can understand the text on the first read. Name the actor, action, affected thing, and consequence. Make options concrete, distinct, and comparable. Replace vague references. Include enough context to answer confidently, but no irrelevant detail. Rewrite anything that fails.

## Make recommendations decision-ready

Explain why each recommendation is best. When business context applies, cover the relevant customer, user, or operator outcome; business goal or constraint; revenue, cost, risk, speed, support, or operational effect; main tradeoff; and timing.

Use known facts and label inferences. Never invent business context. Research missing retrievable context or leave it as an unresolved prerequisite.

Keep recommendations concise:

```text
Recommendation: B — <direct reason>. Business context: <relevant impact, tradeoff, and why it matters>.
```

## Keep a decision log

Create `.context/grill-me-<short-topic>.md` before or alongside the first round. Keep it concise and update it after every answer.

Track:

- retrieved facts, assumptions, and uncertainty
- online sources and relevant publication dates
- resolved decisions and user answers
- current frontier and blocked questions
- running research
- eliminated, deferred, or escalated branches

This is a decision record, not a transcript.

## Round format

```text
Round 2
Resolved: 4 | Frontier: 2 | Estimated remaining: ~6 decisions

1. Should saves happen automatically when everyone leaves?
   A. Always
   B. Only when a transcript exists
   C. Ask first
   Recommendation: B — avoids empty sessions. Business context: lowers storage and support noise without removing useful customer history.

2. How long should saved sessions be retained?
   A. 30 days
   B. 90 days
   C. Forever
   Recommendation: B — preserves useful history. Business context: balances customer continuity with storage cost and privacy risk.

Reply by number. Use `rec all`, `1 rec`, `idu 2`, or `ask 2`.
```

## Finish the session

Finish only when the frontier is empty: every relevant branch was visited, eliminated, or explicitly deferred; fact-finding finished; nothing remains silently assumed.

Summarize decisions, facts, assumptions, constraints, deferred items, risks, and the agreed next action. Ask the user to confirm shared understanding and record confirmation. Do not implement or take the next action unless the user explicitly asks.
