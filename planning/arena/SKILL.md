---
name: arena
description: "Spawn N parallel candidates at the same task, pick a base, graft the strongest parts of the losers into it. Use for /arena, 'arena this', 'throw it in the arena', or when one attempt at a non-trivial artifact would lock in the wrong shape."
---

# Arena

Fan out N parallel attempts at the same task. Read every candidate end to end. Pick the strongest as the base. Graft the best ideas from the others into it. Verify the synthesized result.

## Start

Use the environment's plan or task tracker with one entry per phase before launching anything. The arena runs autonomously and the tracker keeps phases from silently disappearing.

1. Frame
2. Fan out
3. Cross-judge
4. Pick
5. Graft
6. Verify

## Phase A: Frame

The N candidates will receive the same prompt, so the prompt is the contract. Get it right before spawning anything.

1. State the deliverable each candidate is producing. It may be a file-backed artifact or an answer returned inline.
2. Derive the rubric. State what success looks like for *this* task, then turn it into 3-6 concrete gradeable criteria. Concrete: `Adds a --dry-run flag that skips writes`. Vague: `code is correct`. The rubric is the picker's tool in Phase D; candidates only see the task.
3. Pick the runners. Use the available subagent pool. Prefer model-family diversity when the host lets you choose models; otherwise diversify the candidate constraints and keep prompts identical apart from those explicit constraints. Spawn more when the arena covers multiple design directions.
4. Isolate the outputs. For file-backed work, assign each candidate its own location (an isolated worktree when authorized and useful, otherwise a fresh OS temporary directory such as `arena-<slug>/candidate-<n>/`). Never let candidates write the same path. For answer-only work, require clearly labeled inline responses and prohibit workspace writes. Follow `brain/principles/serialize-shared-state-mutations.md`.

## Phase B: Fan out

Spawn all N subagents concurrently, each with the task, the shared grounding by path or inline context, its isolated file path or inline label, and instructions to produce both the deliverable and a short rationale. If subagents are unavailable, generate candidates sequentially and keep their contexts separate.

The rationale is mandatory. Without it, the parent cannot tell whether a candidate's structure is principled or accidental, which makes Phase E grafting unreliable. Each rationale names the alternatives the candidate considered and what it rejected.

If a candidate fails to produce output, proceed with N-1 and note the dropout in the synthesis record.

## Phase C: Cross-judge

After all Phase B candidates complete, spawn one fresh read-only judge subagent. Use a different model family when the host supports model choice. It sees the rubric and candidates by path or inline label, scores each criterion, and recommends a base with rationale. Run it in parallel with the parent's Phase D reading, never while candidates are still writing.

If a fresh judge is unavailable because the host lacks subagents or has exhausted its concurrency limit, the parent performs the same criterion-by-criterion scoring in a separate pass. Record that the cross-judge was unavailable; do not represent the fallback as independent judgment.

## Phase D: Pick a base

Read every candidate end to end before picking. Skimming N candidates surfaces only the candidate whose surface looks most familiar.

Score each candidate against the rubric criterion by criterion, not on holistic feel. Compare against the cross-judge when one was available. Agreement on the base confirms the pick. Disagreement means one of you is biased or the rubric was ambiguous. Read both rationales before deciding. Under the documented parent fallback, use the separate scoring pass directly and label its lack of independence.

Pick the base a future maintainer can extend most easily without breaking invariants. Prefer the cleaner boundary or smaller surface area when two feel tied.

Record the pick and the reason in a short synthesis note alongside a file-backed artifact or in the final response for answer-only work. Include the cross-judge's verdict or the documented fallback.

## Phase E: Graft

Walk each losing candidate once more and identify what is worth porting into the base. The signal is usually one or two things per candidate, not most of it.

Fold each graft in deliberately. Follow `brain/principles/redesign-from-first-principles.md`; do not paste mechanically. The result must remain coherent under one mental model.

Record what was grafted, from which candidate, and what was rejected and why. The rejection notes are the highest-signal part of the record. Future readers learn from what you considered and dropped, not just what you kept.

When N candidates converge on the same shape, that is a strong agreement signal. Note the convergence in the record and ship the consensus shape. No graft is needed. When N candidates wildly diverge, Phase A was under-specified. Reframe and re-run rather than averaging the divergence.

## Phase F: Verify

The synthesized artifact must hold up under the same scrutiny as any other output. Follow `brain/principles/prove-it-works.md`; the arena does not earn a pass.

If verification surfaces a problem the arena did not catch, either Phase A was wrong (re-frame and re-run) or one candidate caught it and you missed the graft (go back to Phase E). Don't paper over.

## Outputs

One synthesized deliverable. One short synthesis note alongside a file-backed artifact or inline for answer-only work, naming the base, the grafts (with source candidate), the rejections, the dropouts if any, the judge/fallback result, and the verification result.
