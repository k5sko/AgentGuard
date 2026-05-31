#!/usr/bin/env python3
"""=== YOUR CUSTOM CODE ===

Runs inside GitHub Actions each time an issue is opened. Randomly either posts a
comment or applies one of three labels, using the automatic GITHUB_TOKEN the
workflow provides. Standard library only — no `pip install`, so the job starts
instantly. Edit LABELS / COMMENT_BODY / the logic in main() to change behavior.
"""

import json
import os
import random
import sys
import urllib.error
import urllib.request

API = "https://api.github.com"

# (name, color-hex without '#', description). Created automatically if missing.
LABELS = [
    ("agentguard:triage", "0e8a16", "Picked up by AgentGuard for triage"),
    ("agentguard:needs-info", "fbca04", "AgentGuard thinks this needs more info"),
    ("agentguard:reviewed", "5319e7", "AgentGuard has reviewed this issue"),
]

COMMENT_BODY = (
    "👋 Thanks for opening this issue! **AgentGuard** has received it "
    "and will take a look shortly."
)


def gh(method, path, token, payload=None):
    """Call the GitHub REST API. Returns (status_code, parsed_body_or_text)."""
    data = json.dumps(payload).encode() if payload is not None else None
    req = urllib.request.Request(f"{API}{path}", data=data, method=method)
    req.add_header("Authorization", f"Bearer {token}")
    req.add_header("Accept", "application/vnd.github+json")
    req.add_header("X-GitHub-Api-Version", "2022-11-28")
    if data is not None:
        req.add_header("Content-Type", "application/json")
    try:
        with urllib.request.urlopen(req) as resp:
            body = resp.read()
            return resp.status, (json.loads(body) if body else None)
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode()


def main():
    token = os.environ["GITHUB_TOKEN"]
    owner, name = os.environ["GITHUB_REPOSITORY"].split("/", 1)
    issue_number = os.environ["ISSUE_NUMBER"]

    if random.random() < 0.5:
        status, body = gh(
            "POST",
            f"/repos/{owner}/{name}/issues/{issue_number}/comments",
            token,
            {"body": COMMENT_BODY},
        )
        if status != 201:
            sys.exit(f"Failed to comment (HTTP {status}): {body}")
        print(f"Commented on issue #{issue_number}")
    else:
        label_name, color, description = random.choice(LABELS)
        # Ensure the label exists. 201 = created, 422 = already exists — both fine.
        ensure_status, _ = gh(
            "POST",
            f"/repos/{owner}/{name}/labels",
            token,
            {"name": label_name, "color": color, "description": description},
        )
        if ensure_status not in (201, 422):
            sys.exit(f"Failed to ensure label (HTTP {ensure_status})")
        status, body = gh(
            "POST",
            f"/repos/{owner}/{name}/issues/{issue_number}/labels",
            token,
            {"labels": [label_name]},
        )
        if status != 200:
            sys.exit(f"Failed to add label (HTTP {status}): {body}")
        print(f"Labeled issue #{issue_number} with {label_name}")


if __name__ == "__main__":
    main()
