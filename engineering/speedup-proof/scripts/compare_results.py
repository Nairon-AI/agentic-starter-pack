#!/usr/bin/env python3
"""Compare Speedup Proof benchmark JSON files and classify the result."""

from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Any


def load(path: Path) -> dict[str, Any]:
    data = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(data, dict):
        raise ValueError(f"Expected an object in {path}")
    for field in ("median_ms", "p95_ms", "cv", "runs"):
        if field not in data:
            raise ValueError(f"Missing {field} in {path}")
    return data


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("before", type=Path)
    parser.add_argument("after", type=Path)
    parser.add_argument("output", type=Path)
    parser.add_argument(
        "--correctness",
        choices=["passed", "failed", "unknown"],
        default="unknown",
        help="Result of the relevant tests and behavioral checks.",
    )
    args = parser.parse_args()

    before = load(args.before)
    after = load(args.after)
    before_ms = float(before["median_ms"])
    after_ms = float(after["median_ms"])
    if before_ms <= 0 or after_ms <= 0:
        raise SystemExit("Median values must be greater than zero")

    improvement_pct = ((before_ms - after_ms) / before_ms) * 100
    speedup = before_ms / after_ms
    max_cv = max(float(before["cv"]), float(after["cv"]))
    threshold_pct = max(3.0, max_cv * 200)
    noisy = max_cv > 0.15

    if args.correctness == "failed":
        verdict = "REGRESSION"
        reason = "Correctness checks failed; the change cannot be accepted."
    elif noisy:
        verdict = "INCONCLUSIVE"
        reason = "Measurement variability is too high."
    elif abs(improvement_pct) < threshold_pct:
        verdict = "INCONCLUSIVE"
        reason = "The observed difference does not exceed the noise threshold."
    elif improvement_pct < 0:
        verdict = "REGRESSION"
        reason = "The after median is higher by more than the noise threshold."
    elif args.correctness != "passed":
        verdict = "INCONCLUSIVE"
        reason = "Performance improved, but correctness is not verified."
    else:
        verdict = "PROVEN"
        reason = "Correctness passed and the lower after median exceeds the noise threshold."

    result = {
        "schema_version": 1,
        "verdict": verdict,
        "reason": reason,
        "correctness": args.correctness,
        "before_median_ms": round(before_ms, 3),
        "after_median_ms": round(after_ms, 3),
        "change_ms": round(after_ms - before_ms, 3),
        "improvement_pct": round(improvement_pct, 2),
        "speedup_ratio": round(speedup, 3),
        "noise_threshold_pct": round(threshold_pct, 2),
        "max_cv": round(max_cv, 5),
        "before": before,
        "after": after,
    }
    output = args.output.expanduser().resolve()
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(result, indent=2) + "\n", encoding="utf-8")
    sign = "+" if improvement_pct >= 0 else ""
    print(
        f"{verdict}: {before_ms:.3f} ms -> {after_ms:.3f} ms "
        f"({sign}{improvement_pct:.2f}% improvement, {speedup:.3f}x)"
    )


if __name__ == "__main__":
    main()
