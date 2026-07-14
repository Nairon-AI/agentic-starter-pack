#!/usr/bin/env python3
"""Generate a native Markdown Speedup Proof report from comparison and context JSON."""

from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Any


ICONS = {
    "PROVEN": "✅",
    "INCONCLUSIVE": "⚠️",
    "REGRESSION": "❌",
    "UNMEASURED": "◻️",
}


def load_object(path: Path) -> dict[str, Any]:
    data = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(data, dict):
        raise ValueError(f"Expected an object in {path}")
    return data


def text(value: Any, fallback: str = "Not supplied") -> str:
    rendered = str(value if value not in (None, "") else fallback)
    return rendered.replace("\r", " ").replace("\n", " ").strip()


def cell(value: Any) -> str:
    return text(value).replace("|", "\\|").replace("`", "\\`")


def number(value: Any, digits: int = 3) -> str:
    try:
        raw = float(value)
    except (TypeError, ValueError):
        return "—"
    return f"{raw:,.{digits}f}".rstrip("0").rstrip(".")


def command_string(value: Any) -> str:
    if isinstance(value, list):
        return " ".join(str(part) for part in value)
    return text(value, "Command unavailable")


def file_link(item: dict[str, Any]) -> str:
    path = text(item.get("path"), "Unknown file")
    try:
        line = int(item.get("line", 1))
    except (TypeError, ValueError):
        line = 1
    target = f"{path}:{max(1, line)}"
    if " " in target:
        target = f"<{target}>"
    summary = text(item.get("summary"), "Changed")
    return f"- [{Path(path).name}]({target}) — {summary}"


def bullets(values: Any, fallback: str) -> list[str]:
    if not isinstance(values, list) or not values:
        return [f"- {fallback}"]
    return [f"- {text(value)}" for value in values]


def check_rows(values: Any) -> list[str]:
    if not isinstance(values, list) or not values:
        return ["| Checks | unknown | No checks supplied |"]
    rows = []
    for item in values:
        if not isinstance(item, dict):
            continue
        status = text(item.get("status"), "unknown").lower()
        icon = "✅" if status == "passed" else "❌" if status == "failed" else "⚠️"
        rows.append(
            f"| {cell(item.get('name'))} | {icon} {cell(status)} | {cell(item.get('detail'))} |"
        )
    return rows or ["| Checks | unknown | No checks supplied |"]


def build_report(comparison: dict[str, Any], context: dict[str, Any]) -> str:
    verdict = text(comparison.get("verdict"), "UNMEASURED").upper()
    before = comparison.get("before") if isinstance(comparison.get("before"), dict) else {}
    after = comparison.get("after") if isinstance(comparison.get("after"), dict) else {}
    improvement = float(comparison.get("improvement_pct", 0) or 0)
    headline = (
        f"{number(improvement, 2)}% faster"
        if verdict == "PROVEN"
        else f"{number(abs(improvement), 2)}% slower"
        if verdict == "REGRESSION" and improvement < 0
        else "Evidence did not clear the proof threshold"
    )
    files = context.get("files") if isinstance(context.get("files"), list) else []
    file_lines = [file_link(item) for item in files if isinstance(item, dict)]
    reproduce = context.get("reproduce") if isinstance(context.get("reproduce"), list) else []
    reproduce_blocks = [f"```bash\n{text(item)}\n```" for item in reproduce]
    if not reproduce_blocks:
        reproduce_blocks = [f"```bash\n{command_string(before.get('command'))}\n```"]

    lines = [
        "# Speedup Proof",
        "",
        f"## {ICONS.get(verdict, '◻️')} {verdict} — {headline}",
        "",
        f"> {text(comparison.get('reason'))}",
        "",
        f"**Project:** {text(context.get('project'))}  ",
        f"**Target:** {text(context.get('target'))}  ",
        f"**Preserved behavior:** {text(context.get('contract'))}  ",
        f"**Generated:** {text(context.get('generated_at'))}",
        "",
        "## Before vs after",
        "",
        "| Measurement | Before | After |",
        "|---|---:|---:|",
        f"| Median runtime | {number(before.get('median_ms'))} ms | {number(after.get('median_ms'))} ms |",
        f"| p95 runtime | {number(before.get('p95_ms'))} ms | {number(after.get('p95_ms'))} ms |",
        f"| Mean runtime | {number(before.get('mean_ms'))} ms | {number(after.get('mean_ms'))} ms |",
        f"| Range | {number(before.get('min_ms'))}–{number(before.get('max_ms'))} ms | {number(after.get('min_ms'))}–{number(after.get('max_ms'))} ms |",
        f"| Variability | {number(float(before.get('cv', 0) or 0) * 100, 2)}% CV | {number(float(after.get('cv', 0) or 0) * 100, 2)}% CV |",
        f"| Measured runs | {number(before.get('runs'), 0)} | {number(after.get('runs'), 0)} |",
        "",
        f"**Speedup ratio:** {number(comparison.get('speedup_ratio'))}×  ",
        f"**Proof threshold:** {number(comparison.get('noise_threshold_pct'), 2)}%  ",
        f"**Correctness:** {text(comparison.get('correctness')).upper()}",
        "",
        "## What changed",
        "",
        text(context.get("summary")),
        "",
        f"**Why behavior remains equivalent:** {text(context.get('why_equivalent'))}",
        "",
        "| Complexity | Before | After |",
        "|---|---:|---:|",
        f"| Estimate | {cell(context.get('complexity_before'))} | {cell(context.get('complexity_after'))} |",
        "",
        "### Changed files",
        "",
        *(file_lines or ["- No source files listed."]),
        "",
        "## Correctness checks",
        "",
        "| Check | Status | Evidence |",
        "|---|---|---|",
        *check_rows(context.get("checks")),
        "",
        "## Benchmark protocol",
        "",
        f"**Workload:** {text(context.get('workload'))}  ",
        f"**Command:** `{command_string(before.get('command')).replace('`', '')}`  ",
        f"**Warmups:** {number(before.get('warmups'), 0)}  ",
        f"**Measured runs:** {number(before.get('runs'), 0)} per version",
        "",
        "## Reproduce",
        "",
        *reproduce_blocks,
        "",
        "## Limitations",
        "",
        *bullets(context.get("limitations"), "No limitations supplied."),
        "",
        "## Residual risks",
        "",
        *bullets(context.get("residual_risks"), "No residual risks supplied."),
        "",
        "## Notes",
        "",
        *bullets(context.get("notes"), "No additional notes."),
        "",
        "---",
        "",
        "Generated by `$speedup-proof`. Runtime evidence and correctness checks determine the verdict.",
        "",
    ]
    return "\n".join(lines)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("comparison", type=Path)
    parser.add_argument("context", type=Path)
    parser.add_argument("output", type=Path)
    args = parser.parse_args()

    comparison = load_object(args.comparison)
    context = load_object(args.context)
    output = args.output.expanduser().resolve()
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(build_report(comparison, context), encoding="utf-8")
    print(f"Created report: {output}")


if __name__ == "__main__":
    main()
