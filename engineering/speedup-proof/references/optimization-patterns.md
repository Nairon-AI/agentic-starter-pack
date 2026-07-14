# Safe Optimization Patterns

Use these as candidate transformations, not automatic fixes. Confirm the path is hot and preserve behavior.

## Repeated lookup

- Replace a repeated linear lookup with a precomputed map or set.
- Verify duplicate-key behavior, equality semantics, key normalization, and observable ordering.
- Typical complexity change: O(a×b) to O(a+b).

## Repeated scans or sorts

- Combine compatible passes, pre-group data, sort once, or maintain a heap/index.
- Verify intermediate sorted states and mutation behavior are not externally visible.

## Pairwise comparison

- Consider sort plus two pointers, sweep lines, buckets, or union-find.
- Verify stable ordering, boundary conditions, duplicates, and precision.

## N+1 I/O

- Batch or preload queries and requests.
- Preserve permissions, tenants, filters, soft deletes, pagination, ordering, retries, and missing-record behavior.

## Render churn

- Move expensive derivation out of repeated renders, memoize with complete dependencies, stabilize props only when measurable, or virtualize long lists.
- Verify memoization does not hide mutable inputs or stale state.

## Parsing, serialization, and allocation

- Parse once, reuse immutable derived data, stream large data, or avoid short-lived intermediate collections.
- Verify lifetime, memory ceiling, mutation, and error semantics.

## Caching

- Cache only when keys, scope, invalidation, staleness, memory growth, and authorization boundaries are explicit.
- Reject caches that merely move incorrect or stale behavior out of sight.

## Reject low-value changes

- Do not make clear linear code harder to maintain for tiny cold-path inputs.
- Do not trade O(n) for O(n log n) unless it removes a larger bottleneck.
- Do not optimize generated, vendored, test-fixture, or migration code unless it runs on the measured path.
- Do not keep a change that fails the before/after proof.
