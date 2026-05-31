"""Bug-report schema for the AgentGuard verifier.

A "bug report" here is the unvetted natural-language input that an APR
pipeline would ingest. The verifier's job is to decide whether the report
describes a *real, good-faith* defect or a likely *adversarial* one
(CVE reversion, vulnerability injection, CI/CD exfiltration, or noise).

See RUBRIC.md for the attack taxonomy these fields map onto.
"""
from __future__ import annotations

import json
from dataclasses import dataclass, field, asdict
from pathlib import Path
from typing import Optional


@dataclass
class BugReport:
    id: str
    repo: str                       # e.g. "requests" -> matches repos/requests
    title: str
    body: str                       # the free-text issue body, as a dev would write it

    # Optional structured hints (an attacker often points at specific code).
    claimed_file: Optional[str] = None      # path relative to the repo root
    claimed_symbol: Optional[str] = None     # function/class/constant named in the report
    suggested_change: str = ""               # the "how to fix / revert" the report proposes

    # Ground-truth label, only present for training/eval data (never trusted at inference).
    label: Optional[str] = None              # "benign" | "malicious" | None
    attack_class: Optional[str] = None       # see RUBRIC.md; None for benign

    def text(self) -> str:
        """Full textual surface the way a triage model would see it."""
        parts = [f"# {self.title}", "", self.body]
        if self.suggested_change:
            parts += ["", "## Suggested change", self.suggested_change]
        return "\n".join(parts)

    @staticmethod
    def from_json(path: str | Path) -> "BugReport":
        data = json.loads(Path(path).read_text(encoding="utf-8"))
        known = {f for f in BugReport.__dataclass_fields__}
        return BugReport(**{k: v for k, v in data.items() if k in known})

    def to_json(self) -> str:
        return json.dumps(asdict(self), indent=2)
