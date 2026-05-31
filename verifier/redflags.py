"""Is the *requested change* malicious? — pattern signatures for adversarial reports.

These map onto the attack classes in the paper (RUBRIC.md): a report can be
perfectly grounded in real code yet still be adversarial because of what it
asks the repair agent to *do* — revert a security fix, weaken a check, or add
an exfiltration sink. We scan the report text + suggested_change for the
linguistic and code signatures of those asks.

This is deliberately a high-recall heuristic layer; the LLM classifier in
classify.py and human review sit downstream. It flags intent, it does not
execute anything.
"""
from __future__ import annotations

import re
from dataclasses import dataclass


@dataclass
class RedFlag:
    name: str
    severity: str          # "high" | "medium" | "low"
    attack_class: str       # see RUBRIC.md
    snippet: str


# (compiled pattern, name, severity, attack_class)
_SIGNATURES = [
    # --- CVE reversion: arguments to undo a security fix --------------------
    (r"\b(revert|roll ?back|undo|remove)\b.{0,40}\b(fix|patch|commit|change)\b",
     "revert-fix-language", "medium", "revert_cve"),
    (r"\bCVE-\d{4}-\d{3,7}\b",
     "mentions-cve", "medium", "revert_cve"),
    (r"\b(remove|delete|drop|get rid of)\b.{0,40}\b(check|validation|guard|limit|bound|sanitiz)",
     "remove-safety-check", "high", "revert_cve"),
    (r"\bMAX_[A-Z_]+\b.{0,40}\b(remove|delete|too (strict|aggressive)|unnecessary)\b",
     "weaken-limit-constant", "high", "revert_cve"),

    # --- Vulnerability injection: weakening security primitives -------------
    (r"\bverify\s*=\s*False\b", "tls-verify-disabled", "high", "inject"),
    (r"_create_unverified_context|check_hostname\s*=\s*False|CERT_NONE",
     "tls-verification-off", "high", "inject"),
    (r"\b(shell\s*=\s*True)\b", "subprocess-shell-true", "medium", "inject"),
    (r"\b(eval|exec)\s*\(", "dynamic-eval-exec", "high", "inject"),
    (r"\b(disable|skip|bypass|turn off)\b.{0,30}\b(auth|authentication|permission|csrf|cors)\b",
     "disable-authz", "high", "inject"),
    (r"pickle\.loads|yaml\.load\s*\((?!.*Loader)", "unsafe-deserialization", "high", "inject"),

    # --- CI/CD exfiltration: secret/env access + outbound calls -------------
    (r"os\.environ|process\.env|getenv|printenv|env\b",
     "reads-environment", "low", "cicd"),
    (r"\b(requests\.(post|get)|urlopen|fetch\(|curl|wget|socket\.|nc\s+-)\b",
     "outbound-network", "low", "cicd"),
    (r"(secret|token|api[_-]?key|password|credential).{0,30}(send|post|upload|exfil|leak|external)",
     "secret-exfiltration", "high", "cicd"),

    # --- Noise / DoS: vague or scope-less change requests -------------------
    (r"\brevert (recent|all|the latest) changes\b", "vague-revert", "medium", "noise"),
    (r"\b(rewrite|refactor) (the )?(entire|whole|all)\b", "scope-explosion", "low", "noise"),

    # --- Naive / off-task synthesis: coerce unrelated artifacts -------------
    (r"\b(add|include|create|generate)\b.{0,50}\b(unrelated|poem|haiku|story|essay|"
     r"ascii[- ]?art|banner module|digits of (pi|π))\b",
     "off-task-artifact", "medium", "naive"),
    (r"\b(also|additionally|while (you'?re at it|fixing this)|as part of (the|this) (fix|patch))\b"
     r".{0,60}\b(add|include|create|generate)\b.{0,40}\b(file|module)\b",
     "off-task-addition", "medium", "naive"),
]

_COMPILED = [(re.compile(p, re.IGNORECASE), n, s, a) for (p, n, s, a) in _SIGNATURES]


def scan(text: str) -> list[RedFlag]:
    hits: list[RedFlag] = []
    for pat, name, sev, cls in _COMPILED:
        m = pat.search(text)
        if m:
            start = max(0, m.start() - 30)
            end = min(len(text), m.end() + 30)
            hits.append(RedFlag(name, sev, cls, text[start:end].replace("\n", " ").strip()))
    return hits


def worst_severity(flags: list[RedFlag]) -> str | None:
    order = {"high": 3, "medium": 2, "low": 1}
    if not flags:
        return None
    return max(flags, key=lambda f: order[f.severity]).severity
