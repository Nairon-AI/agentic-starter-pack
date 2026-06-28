---
name: napkin-math
description: Estimate software performance, capacity, latency, throughput, and cloud cost from first-principles rough numbers. Use when the user says something is too slow, asks whether a design will scale, gives stack numbers, or wants early tradeoffs before benchmarking.
---

# Napkin Math

Use rough orders of magnitude to find the limiting resource before coding. Bias to useful bounds, not faux precision.

## Process

1. **Name the path** - turn the request into one concrete operation: request, job, sync, import, query, deploy, render, or checkout.
   Done when the hot path is a short ordered list.

2. **Attach units** - write input assumptions in visible units: RPS, rows, bytes, objects, users, fanout, regions, retries, retention, concurrency.
   Done when every variable has a unit and a rough value.

3. **Load current numbers** - when any estimate depends on hardware, network, storage, serialization, compression, or cloud cost, read [`sirupsen/napkin-math`](https://github.com/sirupsen/napkin-math), especially its README tables, unless repo-local production measurements are more relevant.
   Done when the numbers used are either copied from the repo-local system or traced to the napkin-math reference.

4. **Budget each step** - estimate latency, throughput, and cost for each step using the numbers below, napkin-math, or repo-local measurements.
   Done when each step has an optimistic and pessimistic bound.

5. **Find the wall** - compare required work against the slowest step or tightest quota.
   Done when one bottleneck is named with math, not vibes.

6. **Trade one constraint** - propose 2-4 changes that move the wall: batch, cache, parallelize, colocate, compress, denormalize, drop durability, precompute, or reduce fanout.
   Done when each tradeoff says what improves, what worsens, and what must be measured next.

## Working Numbers

Round these hard. Prefer powers of ten when unsure.

| Operation | Rough budget |
| --- | --- |
| CPU cache / sequential memory | ns to tens of ns |
| System call | hundreds of ns |
| SSD sequential read | ~GB/s |
| SSD random read | ~100 us |
| Context switch | ~10 us |
| Same-zone network | ~100 us, many GB/s |
| Same-region network | few hundred us |
| Cross-region network | tens to hundreds ms |
| Redis/MySQL/cache query | ~0.5 ms before app logic |
| Blob GET/PUT first byte | tens to hundreds ms |
| JSON-ish serialization | ~100 MB/s |
| Efficient binary serialization | ~1 GB/s |
| Compression/decompression | hundreds MB/s to ~1 GB/s |
| Internet egress | expensive enough to check |
| Logs/traces | often costlier than expected |

These are fallback memory anchors. For real estimates, use provider docs, production traces, or [`sirupsen/napkin-math`](https://github.com/sirupsen/napkin-math) when a row matters.

## Output Shape

Return:

```md
## Assumptions
- ...

## Back-of-envelope
| Step | Work | Budget | Result |
| --- | --- | --- | --- |

## Bottleneck
...

## Tradeoffs
- ...

## Measure Next
- ...
```

## Guardrails

- State uncertainty openly; use ranges when guesses drive the result.
- Do not block on missing inputs; make conservative assumptions and label them.
- Do not recommend micro-optimizations before the wall is identified.
- If the estimate is within 3x of a hard limit, ask for a real benchmark or trace.
