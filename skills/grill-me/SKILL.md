---
name: grill-me
description: Interview the user relentlessly about a plan or design until reaching shared understanding, resolving each branch of the decision tree. Use when user wants to stress-test a plan, get grilled on their design, or mentions "grill me".
---

Interview me relentlessly about every aspect of this plan until we reach a shared understanding. Walk down each branch of the design tree, resolving dependencies between decisions one-by-one. For each question, provide your recommended answer.

Ask the questions one at a time.

Before the first real question, estimate:
- total questions currently expected
- estimated time to finish the grilling

When you start asking questions, every question must include progress in this format:

```text
Question: 12 / 23
Estimated time left: ~6 minutes
```

If the decision tree expands and the total question count changes, say so explicitly and update the progress numbers rather than pretending the original estimate was fixed.

If a question can be answered by exploring the codebase, explore the codebase instead.
