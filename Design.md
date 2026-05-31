# AgentGuard

Triage GitHub bug reports by reproducing them. If we can run the user's
described failure against a fresh clone of the repo, it's a real bug; if
the issue is fishing for prompt injection or has no runnable steps, it
gets flagged.

## Pipeline

`agentguard.pipeline.triage(IssueEvent) -> TriageResult`

1. **Classify (Gemini)** — issue title + body in, JSON out:
   `injection_likelihood`, `has_repro_steps`, `repro_script`,
   `repro_script_kind`, `expected_failure_signal`. Issue body is wrapped
   in `<untrusted_external_data>` tags; the system prompt forbids
   following instructions inside.
2. **Early exits** — high injection likelihood → `suspected-injection`,
   no script → `needs-repro`.
3. **Clone** — shallow clone of the default branch into a tempdir. In
   cloud mode the GitHub App installation token is injected via
   `x-access-token:<token>@…`.
4. **Run** — write the script to disk, exec `bash` or `python3` with a
   hard wall-clock timeout (`REPRO_TIMEOUT_SECONDS`, default 180s),
   capture the last 4KB of stdout/stderr.
5. **Judge (Gemini)** — expected signal + actual output in, JSON out:
   `reproduced` / `not_reproduced` / `inconclusive`. Output is again
   wrapped in untrusted-data tags.
6. **Post** — comment with the verdict + apply one label
   (`verified-bug`, `cannot-reproduce`, `inconclusive`,
   `suspected-injection`, `needs-repro`). Skipped under `DRY_RUN`.

## Modes

- **local** (default): single FastAPI process. `/webhook` validates the
  HMAC and runs `triage` as a FastAPI `BackgroundTask`. Demoable through
  smee.io forwarded to `localhost:8080`.
- **cloud**: `/webhook` enqueues on Cloud Tasks; a second Cloud Run
  service (same image, same code) handles the long-running `/run`
  request out of band. Keeps the webhook under GitHub's 10s budget.

## Files

- `agentguard/config.py` — every env var, single source of truth.
- `agentguard/gemini_client.py` — `classify_and_script`, `judge`.
- `agentguard/sandbox.py` — clone + run with timeout, output truncation.
- `agentguard/github_client.py` — App JWT, installation token, comment + label.
- `agentguard/pipeline.py` — `IssueEvent`, `TriageResult`, `triage`, `post_result`.
- `agentguard/server.py` — FastAPI app, `/webhook`, `/run`, `/healthz`.
- `agentguard/cli.py` — local demo runner against any public repo with no GitHub App.

## Security posture

- Issue bodies and run output are treated as untrusted data by every LLM call.
- The repro script runs in a fresh tempdir under a hard timeout. Real
  isolation comes from the container (Cloud Run, or `docker run` locally).
- Webhook is HMAC-verified when `GITHUB_WEBHOOK_SECRET` is set.
- API keys live in env vars only; `.env` is gitignored, `.env.example`
  documents the schema.

## Known gaps (post-MVP)

- No iterative tool use: the classifier only gets one shot at a repro
  script. Migrate to Vertex AI Agent Engine when issues need exploration.
- No language-specific install bootstrap; assumes the script handles its
  own deps (`pip install`, `npm ci`, etc).
- No cost / rate cap per repo.
