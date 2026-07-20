# Proof plan: {{goal_title}}

- **Goal contract:** [`../GOAL.md`](../GOAL.md)
- **Readiness source:** [`../verification-readiness.yaml`](../verification-readiness.yaml)
- **Goal:** <observable outcome>
- **Work type:** <feature | migration | bugfix | other>
- **Environment/base URL:** <safe environment and URL or N/A>
- **Build/commit:** <immutable version or planned source>
- **Browser mode:** headless only
- **Video applicability:** <yes | no — reason>
- **Recording duration:** <target seconds, at most 300, or N/A>
- **Planned by/date:** <identity alias and timestamp>

## Proof contract

- **Acceptance criterion IDs:** `SC-01`
- **Claim IDs:** `CL-01`
- **Regression guarded:** <original failure or N/A>
- **Out of scope:** <boundaries>
- **Required nonvideo evidence:** <automated/API/data/log evidence>
- **Execution order:** automated assertions → reset → clean scenario replay

## Identities and fixtures

Never store secrets here. Name only the approved vault mechanism and safe reference names.

| Alias | Role/state | Vault/auth mechanism | Fixture/reset method |
| --- | --- | --- | --- |
| `user-1` | <role and starting state> | <approved vault or safe test login, no value> | <setup/reset> |

## Risk coverage

List every identified material role, state, transition, failure, regression, and release risk. Cover it with scenarios or give a concrete exclusion reason. Do not cap the number of failure scenarios and do not enumerate meaningless combinations.

| Risk ID | Class | Material risk | Disposition | Scenario IDs | Exclusion reason |
| --- | --- | --- | --- | --- | --- |
| `RISK-01` | <role | state | transition | failure | regression | release | other> | <risk> | <covered | excluded> | `S-01` | <N/A or exact reason> |

## Scenario matrix

| ID | Risk class | Risk IDs | Criteria | Claims | Artifacts | Record? | Status |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `S-01` | <happy_path | regression | highest_risk_failure> | `RISK-01` | `SC-01` | `CL-01` | `AR-01` | <yes/no> | planned |

## Scenario S-01: <descriptive name>

- **Purpose:** <what this independently proves>
- **Criterion IDs:** `SC-01`
- **Claim IDs:** `CL-01`
- **Artifact IDs:** `AR-01`
- **Risk IDs:** `RISK-01`
- **Identity:** `user-1`
- **Preconditions:** <exact starting state>
- **Recording:** <proof/recordings/01-descriptive-scenario.mp4 or N/A — reason>
- **Other evidence:** <planned artifact paths>

| Step | Actor | Exact user-visible action | Expected visible result | Underlying assertion/evidence |
| --- | --- | --- | --- | --- |
| 1 | `user-1` | <exact action> | <observable result> | <assertion and artifact ID> |

- **Cleanup/reset:** <exact reset steps>
- **Pass condition:** <unambiguous finish condition>

## Motion and emphasis plan

Delete the table only when video applicability is `no — reason`.

| Scenario | Step | Motion | Target/emphasis | Zoom | Planned window ID |
| --- | --- | --- | --- | --- | --- |
| `S-01` | 1 | <cursor | scroll | zoom | transition> | <control/result> | <1.00 or 1.15–1.30> | `MW-01` |

Execution writes exact measured times to `proof/motion-windows.json`. Analyze only active motion windows; static holds do not fail smoothness.

## Release and transition proof

- **Strategy:** <match verification-readiness.yaml>
- **Old/off path:** <scenario/assertion or N/A>
- **New/on path:** <scenario/assertion>
- **Transition:** <scenario/assertion or N/A>
- **Fallback/rollback:** <scenario/assertion or N/A>
- **Telemetry and stop threshold:** <signal/threshold>
- **Cleanup/removal:** <criterion>

## Privacy preflight

- **Sensitive surfaces:** <fields, logs, URLs, identities, or None identified>
- **Mask/fixture strategy:** <exact controls>
- **Privacy scan:** automated DOM/URL/log/generated-text rules plus agent-vision review of screenshots, scene changes, action boundaries, dense moving-section samples, and the full video
- **Final reviewer:** agent; escalate ambiguous or sensitive findings

## Execution order and stop conditions

1. <preflight tools, environment, identity, writability, privacy, and disk>
2. <run automated assertions>
3. <reset state>
4. <run clean scenarios in order>

Stop immediately for destructive behavior, wrong environment, unavailable approved identity, secret exposure, corrupted fixtures, failed prerequisite, privacy finding, or source/readiness drift. Record the stop in `proof-results.md`.
