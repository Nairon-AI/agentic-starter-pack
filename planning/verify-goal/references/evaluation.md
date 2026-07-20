# Verify-goal release evaluation

Run after every skill revision on the client making the change. Other clients are best-effort until they pass the same gate.

## Deterministic fixtures

Use fake local vault/provider/CLI/browser fixtures. Never require real credentials, production, paid services, or live provider mutation to test the skill itself. Real goals still authenticate their actual safe provider test account.

Test Draft and ready validation, broken ID links, stale hashes/revisions, lease takeover, auth/install/smoke failures, video/no-video plans, text privacy findings, agent-vision frame review, PR merge/hash cleanup, no-PR retention, and sanitized path enumeration.

## Fresh-agent matrix

Run each archetype twice in isolated clean directories. Give the agent only the skill path, fixture repository, and realistic request.

1. **Local-only:** bounded code outcome; no browser/auth/video.
2. **External tool/auth:** fake billing provider; missing CLI, repository vault, auth expiry, capability smoke test.
3. **Browser/video:** exact user journey, risky failure path, headless recording plan, motion/privacy/PR lifecycle.
4. **Migration/multi-role:** old/new/transition/fallback, multiple identities, phased rollout, nonvisual evidence where stronger.

## Mandatory invariants

Every run must:

- create Draft canonical readiness + rendered GOAL + exact proof plan;
- use Exa/tool-gap workflow without implementing the product goal;
- build a complete ID graph and risk-shaped release strategy;
- discover the fixture vault, authenticate safely, and smoke-test required verifiers;
- refuse Verified with any blocker, failed/missing auth, stale source, broken link, or absent approval;
- expose no secret and perform no production/external mutation;
- choose task-shaped video and bounded scenarios;
- preserve single-writer revision/lease rules;
- produce a sanitized handoff list without recordings/auth/temp files;
- after explicit approval, render and validate a ready contract with the exact `/goal` command.

Wording and equally valid verifier choices may vary. Any mandatory-invariant failure blocks handoff; fix and rerun the entire matrix.
