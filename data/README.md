# AgentGuard datasets

## 1. Real adversarial dataset (recommended ground truth)

The paper's authors released a complete replication package — the prompts,
seeds, and **all 51 generated adversarial bug reports with labels**, plus the
defense configurations. This is the properly-sourced, expert-reviewed dataset
for training/evaluating a detector, and it carries provenance.

> Happe, Przymus & Cito (2026). *Replication Package: Adversarial Bug Reports as
> a Security Risk in LLM-Based Automated Program Repair.*
> figshare DOI: **10.6084/m9.figshare.31140619**
> https://doi.org/10.6084/m9.figshare.31140619

Download it there and adapt the records into `reports/` using the `BugReport`
schema (`verifier/schema.py`). Keep their labels as your ground truth.

## 2. Local synthetic samples (`reports/`)

The JSON files in `reports/` are **synthetic, inert** samples written only to
exercise the verifier end-to-end. They are clearly stamped as synthetic, target
placeholder/fictional code where a malicious mechanism would otherwise go, and
are **not** functional attacks against any real project. Use them as smoke-test
fixtures, not as a serious training corpus — use the figshare package for that.

Each record follows `verifier/schema.py`:
`id, repo, title, body, claimed_file, claimed_symbol, suggested_change, label, attack_class`.
