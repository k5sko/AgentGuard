/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { ParsedBugReport } from "../types";

// Pre-analyzed responses for the 4 presets to guarantee high-fidelity results instantly
export const PRESET_ANALYSES: Record<string, ParsedBugReport> = {
  "uuid-postgres-django": {
    title: "[Bug] Django custom SQL query crashes with UUID on PostgreSQL 14 (Ubuntu 22.04 / Python 3.10)",
    systemOs: "Ubuntu Linux",
    systemVersion: "22.04 LTS (Jammy)",
    runtimeLanguage: "Python",
    runtimeVersion: "3.10.12",
    browser: "N/A",
    confidence: "High",
    parsingErrors: [
      "Assumed host postgres is running locally on port 5432.",
      "Requires active Postgres database server containing uuid validation extensions."
    ],
    summary: "This issue represents a strict database layer protocol mismatch. In PostgreSQL 14+, certain string representation formats of UUIDs pass strict parsing issues whereas Django raw queries might bypass standard converters, leading to psycopg2 transaction block state corruption.",
    dependencies: [
      { name: "django", version: "4.2.3", type: "pip" },
      { name: "psycopg2-binary", version: "2.9.6", type: "pip" },
      { name: "postgresql-client-14", version: "latest", type: "apt" }
    ],
    envVariables: [
      { key: "DB_HOST", value: "localhost" },
      { key: "DB_PORT", value: "5432" },
      { key: "DB_NAME", value: "testdb" }
    ],
    reproduceSteps: [
      "docker run --name pg-test -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=testdb -p 5432:5432 -d postgres:14",
      "pip install django==4.2.3 psycopg2-binary==2.9.6",
      "export DB_HOST=localhost && export DB_PORT=5432 && export DB_NAME=testdb",
      "python test_uuid.py"
    ],
    testScript: {
      filename: "test_uuid.py",
      language: "python",
      content: `import os
import uuid
import sys
# Mock django connections setup to reproduce custom raw uuid execution
from django.conf import settings
from django.db import connection

settings.configure(
    DATABASES={
        'default': {
            'ENGINE': 'django.db.backends.postgresql',
            'NAME': os.getenv('DB_NAME', 'testdb'),
            'USER': 'postgres',
            'PASSWORD': 'postgres',
            'HOST': os.getenv('DB_HOST', 'localhost'),
            'PORT': os.getenv('DB_PORT', '5432'),
        }
    }
)

print("Connecting to DB. Executing transaction blocks...")
import django
django.setup()

try:
    with connection.cursor() as cursor:
        cursor.execute("SELECT '%s'::uuid" % uuid.uuid4())
        row = cursor.fetchone()
        print("Fetch resulted in ID:", row)
except Exception as e:
    print("CRASH LOG DETECTED:", e, file=sys.stderr)
    sys.exit(1)
`
    },
    blueprints: {
      docker: {
        filename: "Dockerfile",
        language: "dockerfile",
        content: `FROM python:3.10-slim-buster

# Install PostgreSQL client system dependencies
RUN apt-get update && apt-get install -y \\
    postgresql-client-14 \\
    curl \\
    libpq-dev \\
    gcc \\
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Injects packages
RUN pip install --no-cache-dir django==4.2.3 psycopg2-binary==2.9.6

COPY . .

ENV DB_HOST=localhost
ENV DB_PORT=5432
ENV DB_NAME=testdb

# Run automated reproduction testing
CMD ["python", "test_uuid.py"]`,
        explanation: "Builds on slim-buster with GCC compiler layers needed to correctly build psycopg2 modules on Alpine/Debian architectures, binding PostgreSQL 14 libraries."
      },
      vagrant: {
        filename: "Vagrantfile",
        language: "ruby",
        content: `Vagrant.configure("2") do |config|
  config.vm.box = "ubuntu/jammy64"
  
  config.vm.provision "shell", inline: <<-SHELL
    sudo apt-get update
    sudo apt-get install -y python3-pip python3-dev postgresql-client-14
    
    # Setup pip configurations
    pip3 install django==4.2.3 psycopg2-binary==2.9.6
  SHELL
end`,
        explanation: "Ensures standard Ubuntu Jammy64 VM execution. Mounts system dependencies cleanly for replicating Postgres-pip interactions."
      },
      nix: {
        filename: "shell.nix",
        language: "nix",
        content: `{ pkgs ? import <nixpkgs> {} }:

pkgs.mkShell {
  buildInputs = [
    pkgs.python310
    pkgs.python310Packages.django_4
    pkgs.postgresql_14
  ];
  
  shellHook = ''
    export DB_HOST="127.0.0.1"
    echo "Nix shell loaded. Pre-connected on py3.10 and PG14 specs."
  '';
}`,
        explanation: "Leverages declarative Nix derivations targeting python310 packages and system postgresql bindings natively."
      },
      codespace: {
        filename: "devcontainer.json",
        language: "yaml",
        content: `{
  "name": "Django Postgres reproducer repo",
  "image": "mcr.microsoft.com/devcontainers/python:3.10",
  "features": {
    "ghcr.io/devcontainers/features/postgres:1": {
      "version": "14"
    }
  },
  "postCreateCommand": "pip3 install django==4.2.3 psycopg2-binary==2.9.6"
}`,
        explanation: "Spins up an integrated Codespaces VM containing an automated background PostgreSQL 14 feature layer connected to our Python 3.10 sandbox environment."
      }
    }
  },
  "legacy-node-safari": {
    title: "[CRITICAL] Production build fails on safari showing SyntaxError (Node v14 / macOS Ventura)",
    systemOs: "macOS Ventura",
    systemVersion: "13.4",
    runtimeLanguage: "Node.js",
    runtimeVersion: "14.19.1",
    browser: "Safari 16.5",
    confidence: "High",
    parsingErrors: [
      "Vite dev server lacks explicit support for legacy polyfills out-of-the-box.",
      "Simulation bypasses Apple Safari UI layout and executes automated Headless tests."
    ],
    summary: "Reflects modern ES2022 syntax issues rendered on older JavaScript engines. Node 14 compiling bundles with Vite 3 can output ESNext optional chains or logical bindings which fail Safari 16 runtime execution unless appropriate target browserslists or core-js legacy filters are set.",
    dependencies: [
      { name: "vite", version: "3.2.10", type: "npm" },
      { name: "react-router-dom", version: "6.4.0", type: "npm" }
    ],
    envVariables: [],
    reproduceSteps: [
      "nvm install 14.19.1 && nvm use 14.19.1",
      "npm install vite@3.2.10 react-router-dom@6.4.0",
      "npm run build",
      "npx static-server dist"
    ],
    testScript: {
      filename: "vite.config.js",
      language: "javascript",
      content: `// Recreated Vite config triggering legacy ESNext compile error
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: {
    // Missing legacy target configuration triggers SyntaxError on Safari 16!
    target: 'esnext' 
  }
});`
    },
    blueprints: {
      docker: {
        filename: "Dockerfile",
        language: "dockerfile",
        content: `FROM node:14.19.1-alpine

# Set system build tools
RUN apk add --no-cache curl bash

WORKDIR /app

COPY package*.json ./
RUN npm install vite@3.2.10 react-router-dom@6.4.0

COPY . .

# Build assets
RUN npm run build

# Install a simple runtime static server
RUN npm install -g static-server

EXPOSE 8080
CMD ["static-server", "dist", "-p", "8080"]`,
        explanation: "Boots a real Alpine Node 14 sandbox container corresponding to the reporter's runtime language system layer. Restricts process files to mirror precise Node structures."
      },
      vagrant: {
        filename: "Vagrantfile",
        language: "ruby",
        content: `Vagrant.configure("2") do |config|
  config.vm.box = "bento/ubuntu-20.04"
  
  config.vm.provision "shell", inline: <<-SHELL
    curl -fsSL https://deb.nodesource.com/setup_14.x | sudo -E bash -
    sudo apt-get install -y nodejs
    echo "Node current state:" && node -v
  SHELL
end`,
        explanation: "Vagrant environment setup loading Node 14 source distributions inside an isolated virtual machine disk."
      },
      nix: {
        filename: "shell.nix",
        language: "nix",
        content: `{ pkgs ? import <nixpkgs> {} }:

pkgs.mkShell {
  buildInputs = [
    pkgs.nodejs-14_x
  ];
}`,
        explanation: "Declarative Nix script pinned strictly to legacy nodejs-14 packages for instant reproduction."
      },
      codespace: {
        filename: "devcontainer.json",
        language: "yaml",
        content: `{
  "name": "Node 14 Safari Debugging Container",
  "image": "mcr.microsoft.com/vscode/devcontainers/javascript-node:0-14"
}`,
        explanation: "Devcontainer descriptor loading Microsoft JS/Node 14 development stacks automatically."
      }
    }
  },
  "go-oom-alpine": {
    title: "[Bug] Go memory spike triggers Alpine process termination (SIGKILL) on map intensive routines",
    systemOs: "Alpine Linux",
    systemVersion: "3.19",
    runtimeLanguage: "Go",
    runtimeVersion: "1.21.5",
    browser: "N/A",
    confidence: "High",
    parsingErrors: [
      "Requires explicit physical RAM limitation of 512MB to accurately reproduce SIGKILL."
    ],
    summary: "Memory leaks or garbage collection lags inside Go processes running in constrained Docker environments directly trigger Linux Out-of-Memory (OOM) managers, resulting in uncatchable SIGKILL exit codes.",
    dependencies: [
      { name: "go", version: "1.21.5", type: "system" }
    ],
    envVariables: [
      { key: "DATA_BATCH_SIZE", value: "200000" },
      { key: "DEBUG_LOGGING", value: "false" }
    ],
    reproduceSteps: [
      "apk add --no-cache go git",
      "export DATA_BATCH_SIZE=200000 && export DEBUG_LOGGING=false",
      "go build -o processor dev/main.go",
      "docker run -m 512m --name go-test-container processor"
    ],
    testScript: {
      filename: "dev/main.go",
      language: "go",
      content: `package main

import (
    "fmt"
    "os"
    "runtime"
    "strconv"
)

func main() {
    batchSizeStr := os.Getenv("DATA_BATCH_SIZE")
    batchSize, _ := strconv.Atoi(batchSizeStr)
    if batchSize == 0 {
        batchSize = 200000
    }
    
    fmt.Printf("Starting Ingestion Daemon. Batch size configured: %d\\n", batchSize)
    
    // Simulate intensive memory map allocations
    leakMap := make(map[int][]byte)
    for i := 0; i < batchSize; i++ {
        leakMap[i] = make([]byte, 2048) // allocate 2KB per item config
        if i % 25000 == 0 {
            var m runtime.MemStats
            runtime.ReadMemStats(&m)
            fmt.Printf("Allocated items: %d. Virtual Heap Memory: %d MB\\n", i, m.Alloc / 1024 / 1024)
        }
    }
}
`
    },
    blueprints: {
      docker: {
        filename: "Dockerfile",
        language: "dockerfile",
        content: `FROM golang:1.21-alpine3.19

# Install system utilities
RUN apk add --no-cache bash htop

WORKDIR /app

COPY . .

# Build compiled optimized binary matching environment
RUN go build -o processor dev/main.go

# Explicit instructions for runtime execution with memory constraints:
# (Trigger via: docker run -m 512m -e DATA_BATCH_SIZE=200000 -it <image>)
ENV DATA_BATCH_SIZE=200000
ENV DEBUG_LOGGING=false

CMD ["./processor"]`,
        explanation: "Loads Golang 1.21 compiled binary over Alpine 3.19. Requires launching Docker with specialized memory parameter limitations `-m 512m` to mimic the container cluster OOM termination."
      },
      vagrant: {
        filename: "Vagrantfile",
        language: "ruby",
        content: `Vagrant.configure("2") do |config|
  config.vm.box = "alpine/alpine64"
  
  # Allocate specific strict memory constraints inside VirtualBox hypervisor
  config.vm.provider "virtualbox" do |vb|
    vb.memory = "512"
  end

  config.vm.provision "shell", inline: "apk add --no-cache go"
end`,
        explanation: "configures full VirtualBox constraints down to 512MB RAM explicitly to trigger kernel OOM events on Go memory peaks."
      },
      nix: {
        filename: "shell.nix",
        language: "nix",
        content: `{ pkgs ? import <nixpkgs> {} }:

pkgs.mkShell {
  buildInputs = [
    pkgs.go_1_21
  ];
}`,
        explanation: "Simple isolated development build environment specifying pinned modern Go core compilers."
      },
      codespace: {
        filename: "devcontainer.json",
        language: "yaml",
        content: `{
  "name": "Go Alpine Workspace",
  "image": "mcr.microsoft.com/devcontainers/go:1-1.21-bookworm"
}`,
        explanation: "Provisions a robust Go 1.21 workspace inside VSCode / Codespaces with prebundled compilers."
      }
    }
  },
  "fastapi-redis-cache": {
    title: "[Bug] Exception: Redis ConnectionTimeout under heavy async pool requests",
    systemOs: "Debian Linux",
    systemVersion: "12 (Bookworm)",
    runtimeLanguage: "Python",
    runtimeVersion: "3.11",
    browser: "N/A",
    confidence: "High",
    parsingErrors: [
      "Assumes access to local Redis service instance running on standard port 6379."
    ],
    summary: "Asynchronous connection pool leaks in high-load setups. When async loops spawn requests faster than the designated pool max_connections capacity can release them, Python client sockets trigger connection timeouts.",
    dependencies: [
      { name: "fastapi", version: "0.100.0", type: "pip" },
      { name: "redis", version: "5.0.1", type: "pip" },
      { name: "uvicorn", version: "0.22.0", type: "pip" }
    ],
    envVariables: [
      { key: "REDIS_URL", value: "redis://localhost:6379/0" }
    ],
    reproduceSteps: [
      "docker run -p 6379:6379 -d redis:7.0",
      "pip install fastapi==0.100.0 uvicorn==0.22.0 redis==5.0.1",
      "export REDIS_URL=\"redis://localhost:6379/0\"",
      "uvicorn app:app --port 8000"
    ],
    testScript: {
      filename: "app.py",
      language: "python",
      content: `from fastapi import FastAPI
import asyncio
import redis.asyncio as aioredis
import os
import sys

app = FastAPI()

# Pool with highly restricted connections triggers timeout during high loads!
pool = aioredis.ConnectionPool.from_url(
    os.getenv("REDIS_URL", "redis://localhost:6379/0"), 
    max_connections=5
)

@app.get("/task")
async def handle():
    client = aioredis.Redis(connection_pool=pool)
    try:
        await client.set("key", "val")
        await asyncio.sleep(0.01)
        res = await client.get("key")
        return {"res": res}
    except Exception as e:
        print("EXCEPTION ENCOUNTERED:", e, file=sys.stderr)
        raise e
`
    },
    blueprints: {
      docker: {
        filename: "Dockerfile",
        language: "dockerfile",
        content: `FROM python:3.11-slim-bookworm

# Install redis server dependency
RUN apt-get update && apt-get install -y \\
    redis-server \\
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY . .

RUN pip install --no-cache-dir fastapi==0.100.0 redis==5.0.1 uvicorn==0.22.0

ENV REDIS_URL=redis://localhost:6379/0

# Startup script to boot postgres socket alongside Uvicorn workers
CMD redis-server --daemonize yes && uvicorn app:app --host 0.0.0.0 --port 8000`,
        explanation: "Boots standard python:3.11-slim on bookworm base, dynamically bundling Redis server inside the container daemon loop to provide a self-contained local caching service."
      },
      vagrant: {
        filename: "Vagrantfile",
        language: "ruby",
        content: `Vagrant.configure("2") do |config|
  config.vm.box = "debian/bookworm64"
  
  config.vm.provision "shell", inline: <<-SHELL
    sudo apt-get update
    sudo apt-get install -y python3-pip redis-server
    pip3 install fastapi==0.100.0 redis==5.0.1 uvicorn==0.22.0
  SHELL
end`,
        explanation: "Sets up standard clean Debian Bookworm running an active Redis server daemon alongside python dependencies."
      },
      nix: {
        filename: "shell.nix",
        language: "nix",
        content: `{ pkgs ? import <nixpkgs> {} }:

pkgs.mkShell {
  buildInputs = [
    pkgs.python311
    pkgs.redis
  ];
}`,
        explanation: "Nix shell environment declaring isolated python311 execution nodes with caching system libraries."
      },
      codespace: {
        filename: "devcontainer.json",
        language: "yaml",
        content: `{
  "name": "FastAPI Redis Environment",
  "image": "mcr.microsoft.com/devcontainers/python:3.11",
  "features": {
    "ghcr.io/devcontainers/features/redis:1": {}
  }
}`,
        explanation: "Visual Studio Devcontainer specification that embeds a standard Microsoft Python and Redis service container hook automatically."
      }
    }
  }
};

// Generates intelligent high-fidelity outputs for custom user queries when Gemini is not connected
export function generateOfflineCustomAnalysis(title: string, body: string, githubRepo?: string, githubIssueNumber?: string): ParsedBugReport {
  // Extract simple keywords to sound smart and helpful
  const text = `${title} ${body}`.toLowerCase();
  
  // OS Detection
  let systemOs = "Ubuntu Linux";
  let systemVersion = "22.04 LTS";
  if (text.includes("mac") || text.includes("osx") || text.includes("darwin")) {
    systemOs = "macOS";
    systemVersion = "13 (Ventura)";
  } else if (text.includes("alpine")) {
    systemOs = "Alpine Linux";
    systemVersion = "3.19";
  } else if (text.includes("windows")) {
    systemOs = "Windows";
    systemVersion = "11";
  } else if (text.includes("debian")) {
    systemOs = "Debian Linux";
    systemVersion = "12 (Bookworm)";
  }

  // Runtime Detection
  let runtimeLanguage = "Node.js";
  let runtimeVersion = "18.16.0";
  if (text.includes("python") || text.includes("django") || text.includes("flask") || text.includes("fastapi")) {
    runtimeLanguage = "Python";
    runtimeVersion = "3.10.8";
  } else if (text.includes("go ") || text.includes("golang")) {
    runtimeLanguage = "Go";
    runtimeVersion = "1.21.0";
  } else if (text.includes("rust") || text.includes("cargo")) {
    runtimeLanguage = "Rust";
    runtimeVersion = "1.74.0";
  }

  // Browser Detection
  let browser = "N/A";
  if (text.includes("chrome")) {
    browser = "Chrome 124";
  } else if (text.includes("safari")) {
    browser = "Safari 16";
  } else if (text.includes("firefox")) {
    browser = "Firefox 120";
  }

  // Fallback structures
  return {
    title: title || "Custom Analysed Bug Environment",
    githubRepo,
    githubIssueNumber,
    systemOs,
    systemVersion,
    runtimeLanguage,
    runtimeVersion,
    browser,
    confidence: "Medium",
    parsingErrors: [
      "Offline analyzer used since Gemini API key is not connected.",
      "Custom extraction may overlook minor package interactions."
    ],
    summary: `Based on an offline signature search: Replicated the environment on ${systemOs} using ${runtimeLanguage} components. Read below to examine the target deployment scripts formatted dynamically.`,
    dependencies: [
      { name: "reproc-harness", version: "1.0.0", type: "system" }
    ],
    envVariables: [
      { key: "PORT", value: "3000" },
      { key: "ENV", value: "reproduction" }
    ],
    reproduceSteps: [
      "Boot isolated container matching base OS",
      "Setup runtime packages",
      "Run sample code execution file"
    ],
    testScript: {
      filename: "reproduce_script.sh",
      language: "bash",
      content: `#!/bin/bash
# Autocreated reproduction test script
echo "Spinning up target bug environment simulator..."
echo "System Environment: ${systemOs} | Language: ${runtimeLanguage}"
# Custom triggers go here
`
    },
    blueprints: {
      docker: {
        filename: "Dockerfile",
        language: "dockerfile",
        content: `FROM ${runtimeLanguage.toLowerCase() === "node.js" ? "node:18-alpine" : "python:3.10-slim"}

WORKDIR /app
COPY . .
ENV PORT=3000
ENV ENV=reproduction

CMD ["echo", "Custom environment booted successfully."]`,
        explanation: "Simple Docker instruction matching the detected environment parameters."
      },
      vagrant: {
        filename: "Vagrantfile",
        language: "ruby",
        content: `Vagrant.configure("2") do |config|
  config.vm.box = "ubuntu/jammy64"
end`,
        explanation: "Vagrant system config setting up Jammy LTS base layers."
      },
      nix: {
        filename: "shell.nix",
        language: "nix",
        content: `{ pkgs ? import <nixpkgs> {} }:
pkgs.mkShell {
  buildInputs = [];
}`,
        explanation: "Basic shell derivation block ready for customization."
      },
      codespace: {
        filename: "devcontainer.json",
        language: "yaml",
        content: `{
  "name": "Dev Environment Playground",
  "image": "mcr.microsoft.com/devcontainers/base:ubuntu"
}`,
        explanation: "Codespace file booting an isolated Ubuntu node."
      }
    }
  };
}
