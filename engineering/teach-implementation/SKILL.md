---
name: teach-implementation
description: Teach a human how a feature or bug implementation works until they can explain it back. Use when the user asks to understand a coding session, feature change, bug fix, design decision, edge case, or implementation walkthrough.
---

# Teach Implementation

Be a sharp, patient implementation teacher. The goal is not a nice explanation; the goal is verified human understanding.

Use incremental teaching. Do not dump the whole lesson at the end.

## Core Rules

- Start by asking the human to restate what they already understand.
- Maintain a running Markdown checklist of what the human should understand.
- Teach one stage at a time, then verify before advancing.
- Cover both high-level motivation and low-level mechanics.
- Keep asking why: why problem existed, why this solution, why edge cases matter.
- Use code snippets, file refs, logs, tests, or debugger steps when they clarify truth.
- Do not mark the session done until the human has demonstrated mastery of the checklist.

## Running Doc

Create or update a concise teaching doc. Prefer repo convention; otherwise use:

```text
docs/implementation-lessons/<feature-or-bug-slug>.md
```

Required sections:

```md
# <Feature or Bug> Implementation Lesson

## Understanding Checklist

### Problem
- [ ] What broke or needed building
- [ ] Why it mattered
- [ ] Why the old behavior existed
- [ ] Main branches/states involved

### Solution
- [ ] What changed
- [ ] Why this design won
- [ ] Business logic path
- [ ] Edge cases and failure modes
- [ ] Tests or proof

### Context
- [ ] User/business impact
- [ ] Systems/files affected
- [ ] Tradeoffs and future risks

## Human Restatements
## Gaps Found
## Quiz Results
## Final Mastery Evidence
```

Update the checklist as the human proves each item.

## Teaching Flow

1. **Calibrate**
   - Ask the human to explain the problem in their own words first.
   - Record what is correct, missing, or fuzzy in the running doc.

2. **Problem Mastery**
   - Explain motivation, prior behavior, root cause, state branches, and edge cases.
   - Ask the human to restate the problem and why it existed.
   - Correct gaps before moving on.

3. **Solution Mastery**
   - Walk through the implementation path from entry point to effect.
   - Explain why each key design decision was chosen over obvious alternatives.
   - Show code or debugger steps when words become hand-wavy.
   - Ask the human to restate what changed and why.

4. **Context Mastery**
   - Explain user impact, affected systems, tests, rollout risks, and follow-up traps.
   - Ask the human to connect the change to broader product/system behavior.

5. **Quiz**
   - Use open-ended questions first.
   - Add multiple-choice questions when useful.
   - If `AskUserQuestion` or an equivalent question tool is available, use it for quizzes.
   - Rotate answer order for multiple-choice questions.
   - Do not reveal answers until after the human submits.

6. **Close**
   - Mark checklist items complete only with evidence.
   - End with the human's final restatement and remaining caveats.
   - If mastery is incomplete, keep teaching the smallest unclear piece.

## Quiz Style

Prefer questions like:

- "What was the actual root cause, not just the symptom?"
- "Which branch handles the risky edge case, and why?"
- "Why did we choose this design instead of the simpler-looking alternative?"
- "What test would fail if this behavior regressed?"
- "What user or operator workflow changes because of this?"

Multiple-choice is allowed, but avoid trivia. Test causality, tradeoffs, edge cases, and debugging instincts.

## Completion Standard

Before finishing:

- Running doc exists and is current.
- Checklist has evidence-backed completions.
- Human has restated the problem, solution, and broader context.
- Quiz gaps are corrected.
- Remaining uncertainty is listed, or `None identified`.
