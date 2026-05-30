"""
AgentGuard webhook handler.

Receives GitHub `issues.opened` webhooks, verifies the HMAC signature,
and enqueues a repro job on Cloud Tasks. Must return < 10s so the heavy
work happens in the worker service.
"""
import hashlib
import hmac
import json
import os

from fastapi import FastAPI, HTTPException, Request
from google.cloud import tasks_v2

GITHUB_WEBHOOK_SECRET = os.environ["GITHUB_WEBHOOK_SECRET"]
GCP_PROJECT = os.environ["GCP_PROJECT"]
GCP_LOCATION = os.environ["GCP_LOCATION"]
TASKS_QUEUE = os.environ["TASKS_QUEUE"]
WORKER_URL = os.environ["WORKER_URL"]
WORKER_INVOKER_SA = os.environ["WORKER_INVOKER_SA"]

app = FastAPI()
tasks_client = tasks_v2.CloudTasksClient()


def verify_signature(body: bytes, signature: str | None) -> bool:
    if not signature or not signature.startswith("sha256="):
        return False
    expected = "sha256=" + hmac.new(
        GITHUB_WEBHOOK_SECRET.encode(), body, hashlib.sha256
    ).hexdigest()
    return hmac.compare_digest(expected, signature)


def enqueue_repro(payload: dict) -> None:
    parent = tasks_client.queue_path(GCP_PROJECT, GCP_LOCATION, TASKS_QUEUE)
    task = {
        "http_request": {
            "http_method": tasks_v2.HttpMethod.POST,
            "url": WORKER_URL,
            "headers": {"Content-Type": "application/json"},
            "body": json.dumps(payload).encode(),
            "oidc_token": {"service_account_email": WORKER_INVOKER_SA},
        }
    }
    tasks_client.create_task(parent=parent, task=task)


@app.post("/webhook")
async def webhook(request: Request):
    body = await request.body()
    if not verify_signature(body, request.headers.get("X-Hub-Signature-256")):
        raise HTTPException(status_code=401, detail="bad signature")

    event = request.headers.get("X-GitHub-Event")
    payload = json.loads(body)

    if event != "issues" or payload.get("action") != "opened":
        return {"skipped": True}

    issue = payload["issue"]
    repo = payload["repository"]
    installation = payload.get("installation", {})

    enqueue_repro({
        "installation_id": installation.get("id"),
        "repo_full_name": repo["full_name"],
        "default_branch": repo["default_branch"],
        "clone_url": repo["clone_url"],
        "issue_number": issue["number"],
        "issue_title": issue["title"],
        "issue_body": issue.get("body") or "",
    })
    return {"queued": True}


@app.get("/healthz")
def health():
    return {"ok": True}
