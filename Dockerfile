FROM python:3.12-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
    git curl ca-certificates build-essential nodejs npm \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY agentguard ./agentguard

ENV PORT=8080 AGENTGUARD_MODE=cloud
CMD ["sh", "-c", "uvicorn agentguard.server:app --host 0.0.0.0 --port ${PORT}"]
