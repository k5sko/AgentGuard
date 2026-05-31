"""AgentGuard verifier — combine reality checks, red-flag signatures, and the
optional LLM filter into a single verdict for a bug report.

Verdict scale (matching the paper's pre-APR classifier):
    OK          — grounded in real code, no malicious-change signature
    suspicious  — unverifiable claims, or weak adversarial signal
    problematic — strong signature of an adversarial / malicious request

Usage:
    python -m verifier.verify --report data/reports/0001-....json --repos-root repos
    python -m verifier.verify --reports-dir data/reports --repos-root repos
"""
from __future__ import annotations

import argparse
from dataclasses import dataclass, field
from pathlib import Path

from . import classify, redflags
from .reality_check import check as reality_check, RealityResult
from .redflags import RedFlag
from .schema import BugReport


@dataclass
class Verdict:
    report_id: str
    repo: str
    verdict: str                      # OK | suspicious | problematic
    risk: float = 0.0                 # 0.0 (clearly real) .. 1.0 (clearly adversarial)
    reasons: list[str] = field(default_factory=list)
    reality: RealityResult | None = None
    flags: list[RedFlag] = field(default_factory=list)
    llm: object | None = None

    @property
    def p_real(self) -> float:
        """Probability the report describes a real, good-faith bug."""
        return 1.0 - self.risk


_FLAG_WEIGHT = {"high": 0.5, "medium": 0.3, "low": 0.15}


def _risk_score(flags: list[RedFlag], grounded: bool) -> float:
    risk = sum(_FLAG_WEIGHT[f.severity] for f in flags)
    if not grounded:
        risk += 0.3
    return min(1.0, risk)


def evaluate(report: BugReport, repos_root: str | Path, use_llm: bool = True) -> Verdict:
    repo_root = Path(repos_root) / report.repo
    reality = reality_check(report, repo_root)
    flags = redflags.scan(report.text())
    worst = redflags.worst_severity(flags)

    reasons: list[str] = []
    reasons += reality.notes
    for f in flags:
        reasons.append(f"red flag [{f.severity}/{f.attack_class}] {f.name}: \"{f.snippet}\"")

    # Heuristic combination (the LLM verdict, if present, can escalate).
    if worst == "high":
        verdict = "problematic"
    elif worst == "medium" and not reality.grounded:
        verdict = "problematic"
    elif worst in ("medium", "low") or not reality.grounded:
        verdict = "suspicious"
    else:
        verdict = "OK"

    risk = _risk_score(flags, reality.grounded)

    llm = classify.classify(report) if use_llm else None
    if llm is not None:
        reasons.append(f"LLM filter ({llm.model}): {llm.verdict}")
        rank = {"OK": 0, "suspicious": 1, "problematic": 2}
        if rank[llm.verdict] > rank[verdict]:
            verdict = llm.verdict      # the LLM can only escalate, never downgrade
        risk = max(risk, {"OK": 0.0, "suspicious": 0.5, "problematic": 0.85}[llm.verdict])

    return Verdict(report.id, report.repo, verdict, risk, reasons, reality, flags, llm)


def _print(v: Verdict) -> None:
    icon = {"OK": "[OK]", "suspicious": "[??]", "problematic": "[XX]"}[v.verdict]
    print(f"{icon} {v.verdict:>11}  risk={v.risk:.2f}  {v.report_id}  (repo: {v.repo})")
    for r in v.reasons:
        print(f"      - {r}")


def main() -> int:
    ap = argparse.ArgumentParser(description="Verify bug reports against local repo clones.")
    ap.add_argument("--report", help="path to a single bug-report JSON")
    ap.add_argument("--reports-dir", help="directory of bug-report JSON files")
    ap.add_argument("--repos-root", default="repos", help="root holding the cloned repos")
    ap.add_argument("--no-llm", action="store_true", help="skip the optional LLM filter")
    args = ap.parse_args()

    paths: list[Path] = []
    if args.report:
        paths.append(Path(args.report))
    if args.reports_dir:
        paths += sorted(Path(args.reports_dir).glob("*.json"))
    if not paths:
        ap.error("provide --report or --reports-dir")

    correct = total = 0
    for p in paths:
        report = BugReport.from_json(p)
        v = evaluate(report, args.repos_root, use_llm=not args.no_llm)
        _print(v)
        if report.label is not None:           # eval mode: compare to ground truth
            total += 1
            predicted_malicious = v.verdict in ("suspicious", "problematic")
            is_malicious = report.label == "malicious"
            correct += int(predicted_malicious == is_malicious)

    if total:
        print(f"\nLabeled accuracy (malicious vs benign): {correct}/{total} = {correct/total:.0%}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
