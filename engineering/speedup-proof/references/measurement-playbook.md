# Measurement Playbook

Read this before designing a benchmark or judging a speedup.

## Choose the workload

### Function or algorithm

- Import real production code rather than copying the implementation into the harness.
- Use deterministic fixtures with realistic sizes and distributions.
- Separate fixture generation from the timed region.
- Consume the result so the runtime cannot discard the work.

### CLI, build, or batch job

- Measure the complete command when startup and I/O are user-visible.
- Use disposable input when the command mutates files.
- Separate cold-cache and warm-cache measurements; never mix them in one sample set.

### HTTP or database path

- Prefer a local or isolated environment with fixed seeded data.
- Preserve authorization, tenancy, filtering, pagination, and indexes.
- Record query count along with duration when eliminating N+1 behavior.
- Do not present public-network latency as application speed.

### Frontend or render path

- Prefer framework profilers and reproducible interaction traces.
- Record render count, committed duration, or long-task time when relevant.
- Keep browser version, viewport, data, and throttling identical.
- Do not treat bundle size as a substitute for interaction performance.

### Memory or allocation work

- Record peak memory or allocation count with a platform-appropriate profiler.
- Warm garbage-collected runtimes before comparing.
- Report a memory win separately from a runtime tradeoff.

## Use a repeatable protocol

1. Pin the command, runtime, fixture, scale, and relevant environment variables.
2. Run baseline correctness checks.
3. Run at least 2 warmups.
4. Collect at least 7 measured samples; use 15 or more for short workloads.
5. Inspect median, p95, range, and coefficient of variation.
6. Apply one logical change.
7. Run correctness checks again.
8. Collect the same number of after samples with the same protocol.
9. Classify the result relative to observed noise.

Alternate before and after runs when thermal throttling or background load may create drift. For expensive workloads, document why fewer runs are representative.

## Interpret evidence conservatively

The bundled comparison script:

- Marks either side noisy when coefficient of variation exceeds 15%.
- Requires an effect larger than both 3% and twice the larger coefficient of variation.
- Returns `INCONCLUSIVE` when noisy, below threshold, or correctness is unverified.
- Returns `PROVEN` only for a stable improvement beyond the threshold with passing checks.
- Returns `REGRESSION` for a stable slowdown or failed correctness.

This is a practical guardrail, not a scientific significance test. Use stronger experimental design for high-stakes or highly variable systems.

## Avoid misleading results

- Do not time fixture generation unless it belongs to the real workload.
- Do not compare different dependency states, build modes, or data sets.
- Do not report the fastest single run.
- Do not benchmark mocked code when the proposed win concerns real I/O.
- Do not extrapolate from tiny inputs when asymptotic behavior is the claim.
- Do not round an inconclusive result into a marketing percentage.

Prefer language such as `41.8% lower median runtime across 11 measured runs`. State `INCONCLUSIVE: 2.1% difference with 4.8% variability` when the evidence does not support a win.
