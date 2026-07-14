# Report Context Schema

Create a JSON object with these fields before running `generate_report.py`:

```json
{
  "title": "Customer matching hot path",
  "project": "Example project",
  "generated_at": "2026-07-13",
  "target": "matchCustomers() with 20,000 customers and 4,000 IDs",
  "contract": "Same matches, ordering, duplicate behavior, and errors.",
  "summary": "Precomputed a lookup set instead of scanning all IDs per customer.",
  "why_equivalent": "Set membership preserves the original primitive-ID equality and output iteration order.",
  "complexity_before": "O(n×m)",
  "complexity_after": "O(n+m)",
  "files": [
    {"path": "/absolute/path/src/match.ts", "line": 18, "summary": "Replaced repeated includes() calls."}
  ],
  "checks": [
    {"name": "Unit tests", "status": "passed", "detail": "42 tests passed"}
  ],
  "workload": "20,000 customers, 4,000 IDs, deterministic seed 42",
  "reproduce": [
    "python3 benchmark_command.py --label before --output before.json -- node bench.mjs"
  ],
  "limitations": ["Production input distribution may differ."],
  "residual_risks": ["Memory grows linearly with the lookup set."],
  "notes": ["No public API changed."]
}
```

Use absolute paths for changed files so Codex can render clickable links. Keep evidence in the comparison JSON; do not copy or estimate benchmark values in the context file.
