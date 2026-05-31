"""Does the bug actually exist? — static reality checks against a local clone.

This is the "is the bug real" half of AgentGuard. A good-faith report points
at code that exists and behaves as claimed. Fabricated/noise reports often
reference files or symbols that don't exist, or describe code paths that
aren't there. We can't *run* every repo here, but we can cheaply check that
the report's concrete claims are grounded in the actual source tree.
"""
from __future__ import annotations

import re
from dataclasses import dataclass
from pathlib import Path
from typing import Optional

from .schema import BugReport


@dataclass
class RealityResult:
    file_exists: Optional[bool] = None      # None == report made no file claim
    symbol_found: Optional[bool] = None     # None == report made no symbol claim
    notes: list[str] = None

    def __post_init__(self):
        if self.notes is None:
            self.notes = []

    @property
    def grounded(self) -> bool:
        """True if every concrete claim the report made checks out."""
        for v in (self.file_exists, self.symbol_found):
            if v is False:
                return False
        return True


def check(report: BugReport, repo_root: str | Path) -> RealityResult:
    repo_root = Path(repo_root)
    res = RealityResult()

    if not repo_root.is_dir():
        res.notes.append(f"repo path not found: {repo_root}")
        return res

    target: Optional[Path] = None
    if report.claimed_file:
        target = repo_root / report.claimed_file
        res.file_exists = target.is_file()
        if not res.file_exists:
            res.notes.append(f"claimed_file does not exist: {report.claimed_file}")

    if report.claimed_symbol:
        # If a file was named and exists, search there; otherwise sweep the tree.
        haystack_files = (
            [target] if (target and target.is_file())
            else _source_files(repo_root)
        )
        pat = re.compile(rf"\b{re.escape(report.claimed_symbol)}\b")
        res.symbol_found = any(_grep(f, pat) for f in haystack_files)
        if not res.symbol_found:
            res.notes.append(
                f"claimed_symbol '{report.claimed_symbol}' not found in "
                + (report.claimed_file or "repo")
            )

    return res


def _source_files(root: Path, cap: int = 4000):
    exts = {".py", ".js", ".ts", ".jsx", ".tsx", ".go", ".rs", ".c", ".h", ".cc", ".cpp", ".hpp"}
    count = 0
    for p in root.rglob("*"):
        if count >= cap:
            return
        if p.suffix in exts and ".git" not in p.parts:
            count += 1
            yield p


def _grep(path: Path, pat: re.Pattern) -> bool:
    try:
        with path.open("r", encoding="utf-8", errors="ignore") as fh:
            return any(pat.search(line) for line in fh)
    except OSError:
        return False
