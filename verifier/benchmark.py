"""Benchmark harness for the AgentGuard verifier.

Computes the metrics shown on the project dashboard, using its conventions:

    POSITIVE class = "real bug that the system believes" (lets through to APR).
      predicted_real := verdict == "OK"
      actual_real    := label  == "benign"

    TP = real bug correctly verified      (predicted_real & actual_real)
    FP = fake bug believed   [DANGEROUS]  (predicted_real & ~actual_real)
    FN = real bug missed / false alarm    (~predicted_real & actual_real)
    TN = fake bug correctly rejected      (~predicted_real & ~actual_real)

    Precision = TP/(TP+FP)   "of predicted real, actually real"
    Recall    = TP/(TP+FN)   "of real bugs, how many caught"
    FP rate   = FP/(FP+TN)   "fake bugs believed"  (lower is better)
    F1        = harmonic mean of precision & recall
    AUC-PR    = area under precision-recall curve over the p_real score

Run:
    python -m verifier.benchmark --reports-dir data/reports --repos-root repos [--no-llm] [--json out.json]
"""
from __future__ import annotations

import argparse
import json
from collections import defaultdict
from pathlib import Path

from .schema import BugReport
from .verify import evaluate, Verdict


def _confusion(predicted_real: list[bool], actual_real: list[bool]) -> dict:
    tp = fp = fn = tn = 0
    for pr, ar in zip(predicted_real, actual_real):
        if pr and ar:
            tp += 1
        elif pr and not ar:
            fp += 1
        elif not pr and ar:
            fn += 1
        else:
            tn += 1
    return {"tp": tp, "fp": fp, "fn": fn, "tn": tn}


def _metrics(cm: dict) -> dict:
    tp, fp, fn, tn = cm["tp"], cm["fp"], cm["fn"], cm["tn"]
    prec = tp / (tp + fp) if (tp + fp) else 0.0
    rec = tp / (tp + fn) if (tp + fn) else 0.0
    f1 = 2 * prec * rec / (prec + rec) if (prec + rec) else 0.0
    fpr = fp / (fp + tn) if (fp + tn) else 0.0
    return {"precision": prec, "recall": rec, "f1": f1, "fp_rate": fpr}


def _auc_pr(p_real: list[float], actual_real: list[bool]) -> float:
    """Average precision over all score thresholds (PR-curve area)."""
    pairs = sorted(zip(p_real, actual_real), key=lambda x: -x[0])
    total_pos = sum(actual_real)
    if total_pos == 0:
        return 0.0
    tp = fp = 0
    prev_recall = 0.0
    area = 0.0
    for score, is_pos in pairs:
        if is_pos:
            tp += 1
        else:
            fp += 1
        precision = tp / (tp + fp)
        recall = tp / total_pos
        area += precision * (recall - prev_recall)
        prev_recall = recall
    return area


def run(reports_dir: str, repos_root: str, use_llm: bool) -> dict:
    paths = sorted(Path(reports_dir).glob("*.json"))
    labeled: list[tuple[BugReport, Verdict]] = []
    for p in paths:
        r = BugReport.from_json(p)
        if r.label is None:
            continue
        labeled.append((r, evaluate(r, repos_root, use_llm=use_llm)))

    if not labeled:
        return {"error": "no labeled reports found", "n": 0}

    actual_real = [r.label == "benign" for r, _ in labeled]
    predicted_real = [v.verdict == "OK" for _, v in labeled]
    p_real = [v.p_real for _, v in labeled]

    cm = _confusion(predicted_real, actual_real)
    metrics = _metrics(cm)
    metrics["auc_pr"] = _auc_pr(p_real, actual_real)

    # Per-attack-class recall of the DEFENDER (how often we catch each class).
    by_class: dict[str, dict] = defaultdict(lambda: {"n": 0, "caught": 0})
    for r, v in labeled:
        if r.label == "malicious":
            cls = r.attack_class or "unknown"
            by_class[cls]["n"] += 1
            by_class[cls]["caught"] += int(v.verdict != "OK")
    per_class = {
        cls: {"n": d["n"], "caught": d["caught"],
              "detection_rate": d["caught"] / d["n"] if d["n"] else 0.0}
        for cls, d in sorted(by_class.items())
    }

    # Baselines for comparison (the dashboard's floor/ceiling rows).
    n = len(labeled)
    prevalence = sum(actual_real) / n
    baselines = {
        "always_real": {"precision": prevalence, "recall": 1.0, "fp_rate": 1.0},
        "always_fake": {"precision": 0.0, "recall": 0.0, "fp_rate": 0.0},
    }

    # Raw scored points so a PR curve can be drawn downstream.
    scored = [
        {"id": r.id, "p_real": v.p_real, "real": (r.label == "benign")}
        for r, v in labeled
    ]

    return {
        "n": n,
        "llm_filter": use_llm,
        "prevalence": prevalence,
        "confusion_matrix": cm,
        "metrics": metrics,
        "per_attack_class": per_class,
        "baselines": baselines,
        "scored": scored,
    }


def _pct(x: float) -> str:
    return f"{x * 100:.0f}%"


def _report(res: dict) -> None:
    if res.get("error"):
        print(f"benchmark: {res['error']}")
        return
    m, cm = res["metrics"], res["confusion_matrix"]
    print(f"AgentGuard benchmark  (n={res['n']}, LLM filter={'on' if res['llm_filter'] else 'off'})")
    if res["n"] < 20:
        print("  !! WARNING: tiny dataset -- these numbers are NOT statistically")
        print("     meaningful. Load the figshare set (data/README.md) for a real run.")
    print()
    print(f"  Precision : {_pct(m['precision'])}   (of predicted real, actually real)")
    print(f"  Recall    : {_pct(m['recall'])}   (of real bugs, how many caught)")
    print(f"  F1 score  : {m['f1']:.2f}")
    print(f"  FP rate   : {_pct(m['fp_rate'])}   (fake bugs believed -- lower is better)")
    print(f"  AUC-PR    : {m['auc_pr']:.2f}")
    print()
    print("  Confusion matrix:")
    print(f"    TP {cm['tp']:>3}  (real verified)   FP {cm['fp']:>3}  (fake believed)")
    print(f"    FN {cm['fn']:>3}  (real missed)     TN {cm['tn']:>3}  (fake rejected)")
    if res["per_attack_class"]:
        print()
        print("  Detection rate by attack class:")
        for cls, d in res["per_attack_class"].items():
            print(f"    {cls:<14} {d['caught']}/{d['n']} = {_pct(d['detection_rate'])}")


def main() -> int:
    ap = argparse.ArgumentParser(description="Benchmark the verifier on a labeled dataset.")
    ap.add_argument("--reports-dir", default="data/reports")
    ap.add_argument("--repos-root", default="repos")
    ap.add_argument("--no-llm", action="store_true")
    ap.add_argument("--json", help="also write the full results to this JSON file")
    args = ap.parse_args()

    res = run(args.reports_dir, args.repos_root, use_llm=not args.no_llm)
    _report(res)
    if args.json:
        Path(args.json).write_text(json.dumps(res, indent=2), encoding="utf-8")
        print(f"\nwrote {args.json}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
