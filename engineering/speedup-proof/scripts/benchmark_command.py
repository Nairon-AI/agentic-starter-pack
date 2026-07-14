#!/usr/bin/env python3
"""Benchmark a command repeatedly and save timing evidence as JSON."""

from __future__ import annotations

import argparse
import json
import math
import os
import statistics
import subprocess
import sys
import time
from datetime import datetime, timezone
from pathlib import Path


def percentile(values: list[float], fraction: float) -> float:
    ordered = sorted(values)
    if not ordered:
        return 0.0
    position = (len(ordered) - 1) * fraction
    lower = math.floor(position)
    upper = math.ceil(position)
    if lower == upper:
        return ordered[lower]
    return ordered[lower] + (ordered[upper] - ordered[lower]) * (position - lower)


def run_once(command: list[str], cwd: Path, timeout: float, env: dict[str, str]) -> float:
    started = time.perf_counter_ns()
    completed = subprocess.run(
        command,
        cwd=cwd,
        env=env,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.PIPE,
        timeout=timeout,
        check=False,
    )
    elapsed_ms = (time.perf_counter_ns() - started) / 1_000_000
    if completed.returncode != 0:
        stderr = completed.stderr.decode("utf-8", errors="replace")[-4000:]
        raise RuntimeError(
            f"Command exited with {completed.returncode}: {' '.join(command)}\n{stderr}"
        )
    return elapsed_ms


def summarize(samples: list[float]) -> dict[str, float | int | str]:
    median = statistics.median(samples)
    mean = statistics.fmean(samples)
    stdev = statistics.stdev(samples) if len(samples) > 1 else 0.0
    cv = stdev / mean if mean else 0.0
    return {
        "runs": len(samples),
        "median_ms": round(median, 3),
        "mean_ms": round(mean, 3),
        "p95_ms": round(percentile(samples, 0.95), 3),
        "min_ms": round(min(samples), 3),
        "max_ms": round(max(samples), 3),
        "stdev_ms": round(stdev, 3),
        "cv": round(cv, 5),
        "stability": "stable" if cv <= 0.15 else "noisy",
    }


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--label", default="benchmark")
    parser.add_argument("--cwd", type=Path, default=Path.cwd())
    parser.add_argument("--warmups", type=int, default=2)
    parser.add_argument("--runs", type=int, default=7)
    parser.add_argument("--timeout", type=float, default=120.0)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument(
        "command",
        nargs=argparse.REMAINDER,
        help="Command to run after --, for example: -- python3 bench.py",
    )
    args = parser.parse_args()

    command = args.command[1:] if args.command[:1] == ["--"] else args.command
    if not command:
        parser.error("Provide a command after --")
    if args.warmups < 0 or args.runs < 3:
        parser.error("warmups must be >= 0 and runs must be >= 3")
    cwd = args.cwd.expanduser().resolve()
    if not cwd.is_dir():
        parser.error(f"cwd is not a directory: {cwd}")

    env = os.environ.copy()
    for _ in range(args.warmups):
        run_once(command, cwd, args.timeout, env)

    samples = [run_once(command, cwd, args.timeout, env) for _ in range(args.runs)]
    result = {
        "schema_version": 1,
        "label": args.label,
        "measured_at": datetime.now(timezone.utc).isoformat(),
        "command": command,
        "cwd": str(cwd),
        "warmups": args.warmups,
        "timeout_seconds": args.timeout,
        "samples_ms": [round(sample, 3) for sample in samples],
        **summarize(samples),
    }
    output = args.output.expanduser().resolve()
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(result, indent=2) + "\n", encoding="utf-8")
    print(
        f"{args.label}: median {result['median_ms']} ms, "
        f"p95 {result['p95_ms']} ms, CV {result['cv'] * 100:.1f}% "
        f"({result['stability']}, {result['runs']} runs)"
    )


if __name__ == "__main__":
    try:
        main()
    except (RuntimeError, subprocess.TimeoutExpired) as error:
        print(f"Benchmark failed: {error}", file=sys.stderr)
        raise SystemExit(1)
