#!/usr/bin/env bash
# Hackathon deploy: two Cloud Run services + a Cloud Tasks queue.
# Prereqs: gcloud authed, project set, billing enabled, Artifact Registry repo `agentguard`.
set -euo pipefail

: "${GCP_PROJECT:?set GCP_PROJECT}"
: "${GCP_LOCATION:=us-central1}"
REPO=us-docker.pkg.dev/${GCP_PROJECT}/agentguard
QUEUE=agentguard-repro

gcloud config set project "$GCP_PROJECT"
gcloud services enable run.googleapis.com cloudtasks.googleapis.com \
    artifactregistry.googleapis.com cloudbuild.googleapis.com

gcloud artifacts repositories create agentguard \
    --repository-format=docker --location=us 2>/dev/null || true

gcloud tasks queues create "$QUEUE" --location="$GCP_LOCATION" 2>/dev/null || true

gcloud builds submit handler --tag "$REPO/handler:latest"
gcloud builds submit worker  --tag "$REPO/worker:latest"

# Worker first (handler needs its URL).
gcloud run deploy agentguard-worker \
    --image "$REPO/worker:latest" --region "$GCP_LOCATION" \
    --no-allow-unauthenticated --memory 1Gi --cpu 1 --timeout 600 \
    --set-env-vars "GITHUB_APP_ID=${GITHUB_APP_ID},ANTHROPIC_API_KEY=${ANTHROPIC_API_KEY}" \
    --set-secrets "GITHUB_APP_PRIVATE_KEY=github-app-key:latest"

WORKER_URL=$(gcloud run services describe agentguard-worker \
    --region "$GCP_LOCATION" --format='value(status.url)')

gcloud run deploy agentguard-handler \
    --image "$REPO/handler:latest" --region "$GCP_LOCATION" \
    --allow-unauthenticated --memory 512Mi --cpu 1 --timeout 30 \
    --set-env-vars "GCP_PROJECT=${GCP_PROJECT},GCP_LOCATION=${GCP_LOCATION},TASKS_QUEUE=${QUEUE},WORKER_URL=${WORKER_URL},WORKER_INVOKER_SA=${WORKER_INVOKER_SA}" \
    --set-secrets "GITHUB_WEBHOOK_SECRET=github-webhook-secret:latest"

echo "Webhook URL:"
gcloud run services describe agentguard-handler \
    --region "$GCP_LOCATION" --format='value(status.url)'
