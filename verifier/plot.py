"""Plot AgentGuard benchmark results from a benchmark JSON file.

Usage:
    python -m verifier.plot --json data/benchmark_synthetic.json --out data/benchmark.png
"""
from __future__ import annotations

import argparse
import json
from pathlib import Path

import matplotlib
matplotlib.use("Agg")  # headless: write a file, don't open a window
import matplotlib.pyplot as plt


def _pr_curve(scored: list[dict]):
    """Precision & recall at every score threshold, plus the prevalence floor."""
    pairs = sorted(((s["p_real"], bool(s["real"])) for s in scored), key=lambda x: -x[0])
    total_pos = sum(1 for _, r in pairs if r)
    points = []  # (recall, precision)
    tp = fp = 0
    for _, is_pos in pairs:
        if is_pos:
            tp += 1
        else:
            fp += 1
        precision = tp / (tp + fp)
        recall = tp / total_pos if total_pos else 0.0
        points.append((recall, precision))
    return points


def plot(res: dict, out: str) -> None:
    m = res["metrics"]
    cm = res["confusion_matrix"]
    per_class = res.get("per_attack_class", {})

    fig = plt.figure(figsize=(11, 12))
    gs = fig.add_gridspec(3, 2)
    axes = [[fig.add_subplot(gs[0, 0]), fig.add_subplot(gs[0, 1])],
            [fig.add_subplot(gs[1, 0]), fig.add_subplot(gs[1, 1])]]
    ax_pr = fig.add_subplot(gs[2, :])
    fig.suptitle(
        f"AgentGuard verifier benchmark  (n={res['n']}, "
        f"LLM filter {'on' if res.get('llm_filter') else 'off'})",
        fontsize=14, fontweight="bold",
    )

    # --- top-line metrics --------------------------------------------------
    ax = axes[0][0]
    names = ["Precision", "Recall", "F1", "AUC-PR"]
    vals = [m["precision"], m["recall"], m["f1"], m["auc_pr"]]
    bars = ax.bar(names, vals, color=["#3b5bdb", "#3b5bdb", "#3b5bdb", "#9c36b5"])
    ax.set_ylim(0, 1.05)
    ax.set_title("Top-line metrics")
    for b, v in zip(bars, vals):
        ax.text(b.get_x() + b.get_width() / 2, v + 0.02, f"{v:.2f}",
                ha="center", va="bottom", fontsize=9)

    # --- confusion matrix --------------------------------------------------
    ax = axes[0][1]
    grid = [[cm["tp"], cm["fp"]], [cm["fn"], cm["tn"]]]
    colors = [["#d3f9d8", "#ffe3e3"], ["#ffe3e3", "#d0ebff"]]
    ax.set_title("Confusion matrix  (positive = 'real bug believed')")
    ax.set_xticks([0, 1]); ax.set_yticks([0, 1])
    ax.set_xticklabels(["actually real", "actually fake"])
    ax.set_yticklabels(["predicted real", "predicted fake"])
    labels = [["TP", "FP (fake believed)"], ["FN (real missed)", "TN"]]
    for i in range(2):
        for j in range(2):
            ax.add_patch(plt.Rectangle((j - 0.5, i - 0.5), 1, 1, color=colors[i][j]))
            ax.text(j, i, f"{labels[i][j]}\n{grid[i][j]}",
                    ha="center", va="center", fontsize=11, fontweight="bold")
    ax.set_xlim(-0.5, 1.5); ax.set_ylim(1.5, -0.5)

    # --- per-attack-class detection rate -----------------------------------
    ax = axes[1][0]
    ax.set_title("Detection rate by attack class")
    if per_class:
        classes = list(per_class.keys())
        rates = [per_class[c]["detection_rate"] for c in classes]
        cols = ["#e03131" if r < 0.5 else "#2f9e44" for r in rates]
        bars = ax.barh(classes, rates, color=cols)
        ax.set_xlim(0, 1.05)
        ax.invert_yaxis()
        for b, c in zip(bars, classes):
            d = per_class[c]
            ax.text(d["detection_rate"] + 0.02, b.get_y() + b.get_height() / 2,
                    f"{d['caught']}/{d['n']}", va="center", fontsize=9)
    else:
        ax.text(0.5, 0.5, "no malicious reports", ha="center", va="center")
        ax.axis("off")

    # --- FP rate vs baselines ----------------------------------------------
    ax = axes[1][1]
    ax.set_title("False-positive rate  (fake bugs believed — lower better)")
    base = res.get("baselines", {})
    names = ["AgentGuard", "always-real\n(floor)", "always-fake\n(ceiling)"]
    fprs = [m["fp_rate"],
            base.get("always_real", {}).get("fp_rate", 1.0),
            base.get("always_fake", {}).get("fp_rate", 0.0)]
    bars = ax.bar(names, fprs, color=["#3b5bdb", "#adb5bd", "#adb5bd"])
    ax.set_ylim(0, 1.05)
    for b, v in zip(bars, fprs):
        ax.text(b.get_x() + b.get_width() / 2, v + 0.02, f"{v:.0%}",
                ha="center", va="bottom", fontsize=9)

    # --- precision-recall curve (spans bottom row) -------------------------
    ax_pr.set_title("Precision-recall curve")
    scored = res.get("scored", [])
    if scored:
        pts = _pr_curve(scored)
        xs = [r for r, _ in pts]
        ys = [p for _, p in pts]
        ax_pr.step(xs, ys, where="post", color="#3b5bdb", lw=2, label="AgentGuard")
        # operating point taken straight from the confusion matrix
        ax_pr.scatter([m["recall"]], [m["precision"]], color="#3b5bdb", s=80, zorder=5,
                      label=f"operating point (P={m['precision']:.2f}, R={m['recall']:.2f})")
        prev = res.get("prevalence")
        if prev is not None:
            ax_pr.axhline(prev, ls="--", color="#adb5bd",
                          label=f"prevalence floor ({prev:.2f})")
        ax_pr.text(0.02, 0.06, f"AUC-PR = {m['auc_pr']:.2f}", transform=ax_pr.transAxes,
                   fontsize=10, bbox=dict(boxstyle="round", fc="white", ec="#adb5bd"))
    else:
        ax_pr.text(0.5, 0.5, "no scored points in benchmark JSON", ha="center", va="center")
    ax_pr.set_xlabel("Recall"); ax_pr.set_ylabel("Precision")
    ax_pr.set_xlim(0, 1.02); ax_pr.set_ylim(0, 1.05)
    ax_pr.grid(True, ls=":", alpha=0.5)
    ax_pr.legend(loc="lower left", fontsize=9)

    fig.tight_layout(rect=[0, 0, 1, 0.97])
    fig.savefig(out, dpi=130)
    print(f"wrote {out}")


def main() -> int:
    ap = argparse.ArgumentParser(description="Plot benchmark results.")
    ap.add_argument("--json", default="data/benchmark_synthetic.json")
    ap.add_argument("--out", default="data/benchmark.png")
    args = ap.parse_args()
    res = json.loads(Path(args.json).read_text(encoding="utf-8"))
    if res.get("error"):
        print(f"cannot plot: {res['error']}")
        return 1
    plot(res, args.out)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
