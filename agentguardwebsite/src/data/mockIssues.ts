/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface PresetIssue {
  id: string;
  title: string;
  repo: string;
  author: string;
  createdAt: string;
  description: string;
}

export const PRESET_ISSUES: PresetIssue[] = [
  {
    id: "uuid-postgres-django",
    title: "[Bug] Django custom SQL query crashes with UUID on PostgreSQL 14 (Ubuntu 22.04 / Python 3.10)",
    repo: "django-api/core-service",
    author: "backend_dev_maria",
    createdAt: "2 days ago",
    description: `### Environment / Context
- OS: Ubuntu 22.04 LTS (Jammy Jellyfish)
- Python Version: 3.10.12
- DB: PostgreSQL 14.5
- Django Version: 4.2.3
- psycopg2-binary: 2.9.6

### What happened?
We recently upgraded our database from Postgres 12 to Postgres 14. When executing raw SQL query with UUID fields, we started getting are 'InterfaceError: bad transaction block'.

### Steps to reproduce the bug:
1. Ensure running on postgres:14
2. Install pip dependencies:
   \`\`\`bash
   pip install django==4.2.3 psycopg2-binary==2.9.6
   \`\`\`
3. Set database variables:
   \`\`\`bash
   export DB_HOST=localhost
   export DB_PORT=5432
   export DB_NAME=testdb
   \`\`\`
4. Run standard migrator or custom uuid fetcher:
   \`\`\`python
   # test_uuid.py
   import uuid
   from django.db import connection
   # This causes interface error on UUID fields
   with connection.cursor() as cursor:
       cursor.execute("SELECT '%s'::uuid" % uuid.uuid4())
       row = cursor.fetchone()
       print("Fetch resulted in ID:", row)
   \`\`\`
Any suggestions on why PG14 strict protocol breaks psycopg2 UUID parsing?`
  },
  {
    id: "legacy-node-safari",
    title: "[CRITICAL] Production build fails on safari showing SyntaxError (Node v14 / macOS Ventura)",
    repo: "frontend/modern-admin-dashboard",
    author: "frontend_fella",
    createdAt: "1 week ago",
    description: `Some users on older iOS of Safari 16 (specifically on macOS Ventura 13.4 and IOS 16) are reporting blank white screens.
I think it is because our modern build utilizes ES2022 features that fail compilation because of node version compiling inconsistencies.

Here is the environment we are in:
- OS: macOS Ventura 13.4
- Node.js: v14.19.1
- Bundler: Vite 3.2.10
- Router: react-router-dom 6.4.0
- Device/Browser: Safari 16.5

Reproduction:
Make sure you are on Node 14. Check with \`node -v\`.
You will need to install specific old tools and run the production builder:
\`\`\`bash
npm install vite@3.2.10 react-router-dom@6.4.0
npm run build
\`\`\`
Then spin up a local preview using \`npx static-server dist\` and visit it from a Safari browser. The console immediately prints:
\`TypeError: Cannot use 'in' operator to search for 'module' in undefined\`
This is due to Vite 3 failing to polyfill correctly on node 14! If I build on Node 18 it is perfectly fine.`
  },
  {
    id: "go-oom-alpine",
    title: "[Bug] Go memory spike triggers Alpine process termination (SIGKILL) on map intensive routines",
    repo: "gophers/heavy-processor",
    author: "cloud_infra_jane",
    createdAt: "3 days ago",
    description: `We are running a microservice worker inside an Alpine Linux container in Kubernetes. After about 10 minutes of intense ingestion processing, the kernel sends SIGKILL (OOM Killer) to the process.

Specs / Env:
- Base Image: alpine:3.19 (running inside Docker on Linux Kernal 6.1)
- Go compiler: 1.21.5
- Mem limit: 512MB
- Environment Variables:
  - DATA_BATCH_SIZE=200000
  - DEBUG_LOGGING=false

To reproduce:
Build the heavy processor binary on alpine system:
\`\`\`bash
apk add --no-cache go git
go build -o processor dev/main.go
\`\`\`
Start script with high batches:
\`\`\`bash
export DATA_BATCH_SIZE=200000
export DEBUG_LOGGING=false
./processor --mode=ingest
\`\`\`
The application memory scales exponentially to 534MB and is immediately terminated by Linux OOM manager. It seems the slice caches aren't being garbage collected.`
  },
  {
    id: "fastapi-redis-cache",
    title: "[Bug] Exception: Redis ConnectionTimeout under heavy async pool requests",
    repo: "web/fastapi-gateway",
    author: "pythonic_power",
    createdAt: "5 days ago",
    description: `Hi folks, our FastAPI app is periodically timing out on external Redis requests during peak loads.

Our setup:
- OS: Debian 12 (Bookworm)
- Python model: 3.11-slim
- Frameworks: FastAPI 0.100.0, redis-py 5.0.1
- Cache: Redis server 7.0

Reproduction script:
\`\`\`bash
pip install fastapi==0.100.0 uvicorn==0.22.0 redis==5.0.1
export REDIS_URL="redis://localhost:6379/0"
\`\`\`

Here is a simple app trigger to reproduce:
\`\`\`python
# app.py
from fastapi import FastAPI
import asyncio
import redis.asyncio as aioredis
import os

app = FastAPI()
pool = aioredis.ConnectionPool.from_url(os.getenv("REDIS_URL"), max_connections=5)

@app.get("/task")
async def handle():
    client = aioredis.Redis(connection_pool=pool)
    # Simulate 50 parallel requests
    await client.set("key", "val")
    await asyncio.sleep(0.01)
    res = await client.get("key")
    return {"res": res}
\`\`\`

Run via \`uvicorn app:app --port 8000\`. If we fire ~1000 concurrent requests, the pool crashes with ConnectionTimeout!`
  }
];
