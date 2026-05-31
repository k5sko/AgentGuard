# AgentGuard

Auto-triage GitHub bug reports by trying to reproduce them. Real bugs
get a `verified-bug` label; prompt-injection attempts get
`suspected-injection`; vague reports get `needs-repro`.

## Local quickstart (no GCP needed)

```bash
python -m venv .venv && . .venv/bin/activate   # or .venv\Scripts\activate on Windows
pip install -r requirements.txt
cp .env.example .env
# fill in GEMINI_API_KEY from https://aistudio.google.com/api-keys
export $(grep -v '^#' .env | xargs)   # PowerShell: see below
```

### Try the pipeline against a public repo (no GitHub App)

```bash
python -m agentguard.cli \
  --repo psf/requests \
  --title "ImportError on import requests" \
  --body "Running 'python -c \"import requests\"' raises ModuleNotFoundError"
```

This prints the classification, the verdict, and the comment that
*would* have been posted. No GitHub credentials required.

### Run the webhook server

```bash
uvicorn agentguard.server:app --reload --port 8080
```

Then forward GitHub webhooks to it with [smee.io](https://smee.io):

```bash
npx smee -u https://smee.io/<your-channel> -t http://localhost:8080/webhook
```

Point a GitHub App's webhook URL at the smee channel, subscribe to
**Issues** events, install on a test repo, open an issue — watch the
triage comment appear.

### Windows PowerShell env loading

```powershell
Get-Content .env | ? { $_ -and -not $_.StartsWith('#') } | % {
  $k,$v = $_ -split '=',2; [Environment]::SetEnvironmentVariable($k,$v)
}
```

## Cloud Run deploy (hackathon production mode)

```bash
gcloud config set project $GCP_PROJECT
gcloud services enable run.googleapis.com cloudtasks.googleapis.com \
    artifactregistry.googleapis.com cloudbuild.googleapis.com
gcloud artifacts repositories create agentguard --repository-format=docker --location=us
gcloud tasks queues create agentguard-repro --location=us-central1

gcloud builds submit . --tag us-docker.pkg.dev/$GCP_PROJECT/agentguard/app:latest

# Worker (long-running, no public ingress)
gcloud run deploy agentguard-worker \
  --image us-docker.pkg.dev/$GCP_PROJECT/agentguard/app:latest \
  --region us-central1 --no-allow-unauthenticated \
  --memory 1Gi --cpu 1 --timeout 600 \
  --set-env-vars AGENTGUARD_MODE=cloud,GEMINI_API_KEY=$GEMINI_API_KEY,GITHUB_APP_ID=$GITHUB_APP_ID \
  --set-secrets GITHUB_APP_PRIVATE_KEY=github-app-key:latest

WORKER_URL=$(gcloud run services describe agentguard-worker --region us-central1 --format='value(status.url)')

# Handler (public, hits Cloud Tasks)
gcloud run deploy agentguard-handler \
  --image us-docker.pkg.dev/$GCP_PROJECT/agentguard/app:latest \
  --region us-central1 --allow-unauthenticated \
  --memory 512Mi --cpu 1 --timeout 30 \
  --set-env-vars AGENTGUARD_MODE=cloud,GCP_PROJECT=$GCP_PROJECT,GCP_LOCATION=us-central1,TASKS_QUEUE=agentguard-repro,WORKER_URL=$WORKER_URL,WORKER_INVOKER_SA=$WORKER_INVOKER_SA \
  --set-secrets GITHUB_WEBHOOK_SECRET=github-webhook-secret:latest
```

Set the GitHub App's webhook URL to `<handler-url>/webhook`.

## Hackathon account warning

Per the Google DeepMind hackathon docs: the GCP project gets nuked the
day after the hackathon. Don't hardcode the Gemini API key — keep it in
`.env` (gitignored) or in a Secret Manager secret. Pushing a hardcoded
key to GitHub will auto-revoke the whole project.

## Layout

See `Design.md`.
