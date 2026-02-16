# Architecture

## Overview

The Playground (Lab) is a Docker-first monorepo for browser game experiments with a decoupled web frontend and Python backend.

- Frontend: Next.js (App Router), React, Tailwind, TypeScript
- Backend: FastAPI, Pydantic, Motor (Mongo async driver)
- Database: MongoDB
- Orchestration: Docker Compose

Current implementation target is a stable local development baseline (phase 1).

## Repository layout

- `frontend/` — Next.js application and typed API client
- `backend/` — FastAPI app, service layer, schemas, infrastructure config
- `docker/` — all Docker orchestration/build files (`docker-compose.yml`, service Dockerfiles)
- `docs/` — architecture and engineering documentation

## Runtime architecture

### Containers

1. `frontend`
   - Runs `next dev` with host binding for Docker
   - Uses polling-friendly file watch env for reliable autoreload in mounted volumes
2. `backend`
   - Runs `uvicorn` with reload mode
   - Connects to Mongo during lifespan startup
   - Emits one startup-ready status report
3. `mongo`
   - Official MongoDB image
   - Persists data through named volume

### Compose entrypoint

- Compose file: `docker/docker-compose.yml`
- Standard command: `docker compose -f docker/docker-compose.yml up --build`

### Network model

- Docker internal DNS enables service-to-service access (`backend`, `frontend`, `mongo` hostnames).
- Browser reaches frontend via `localhost:3000`.
- Browser reaches backend via `localhost:8000`.
- Backend reaches Mongo via `mongodb://mongo:27017/lab`.
- Backend probes frontend readiness through internal URL (`http://frontend:3000`).

## Backend architecture

### Layers

- `app/main.py`
  - FastAPI app setup, middleware registration, router inclusion, lifespan management
- `app/api/`
  - HTTP routing and request/response mapping
- `app/services/`
  - Domain/application logic, reusable helpers
- `app/core/`
  - Configuration and infrastructure integrations (Mongo lifecycle)
- `app/schemas/`
  - Pydantic request/response models and conventions

### Configuration strategy

- Settings are centralized in `app/core/config.py` with `pydantic-settings`.
- CORS origins support both CSV and JSON-list env formats.
- Environment defaults favor local Docker development while remaining deployment-safe.

### Mongo lifecycle

- Startup: create client, select DB, ping
- Shutdown: close client cleanly
- Connection state is tracked and exposed through health/ping behavior

### Status reporting

- `report_status` in `app/services/status_reporter.py`
- Runs once on startup after Mongo connection attempt
- Logs structured payload with:
  - app identity and Python version
  - key module versions
  - Mongo connectivity details
  - frontend probe result
  - active CORS policy snapshot

This gives a deterministic “ready” signal and a reusable function for future diagnostics.

### Catalog data source

- Catalog data is sourced from MongoDB collection `games`.
- Phase-1 behavior ensures one minimal seed document exists for the Wordle prototype.
- API responses are validated through Pydantic schemas before returning to clients.

## Frontend architecture

- App Router structure under `frontend/app/`
- Typed API client under `frontend/lib/api.ts`
- Home page is a minimal phase-1 shell using backend-sourced content.

## API contract and Python-JS interoperability

### Contract approach

- Backend schemas are defined in Pydantic models.
- Base schema class emits camelCase JSON aliases for frontend ergonomics.
- Frontend client consumes explicit TypeScript types aligned with backend payloads.

### Why this prevents drift

- Validation remains backend-authoritative.
- Frontend only renders and submits validated inputs.
- Shared naming convention (`camelCase`) avoids ad hoc field mapping.

## CORS model

- CORS middleware is explicitly configured (not implicit wildcard defaults).
- Allowed origins are environment-driven.
- Current defaults support localhost browser origins.
- Production deployment should set explicit frontend domains per environment.

## Type checking strategy

### TypeScript

- Strict TypeScript configuration in frontend (`strict: true`).
- Typed request helpers and explicit event typing in UI handlers.

### Frontend linting

- ESLint via CLI (`npm run lint` in `frontend/`).
- Flat config in `frontend/eslint.config.mjs`.
- Ruleset baseline: `next/core-web-vitals` + `next/typescript`.

### Python / mypy

- Backend mypy config in `backend/pyproject.toml` with `strict = true`.
- External library stubs are handled pragmatically:
  - `motor` imports are allowed via `ignore_missing_imports` override.
- Standard backend type-check command:
  - `python -m mypy --config-file backend/pyproject.toml backend/app`

## Dependency/version strategy

- Docker images track current stable majors:
  - Python 3.13
  - Node 22
  - Mongo 8
- Docker assets are centralized under `docker/` for project-structure cleanliness.
- Python dependencies are intentionally centralized in a single file: `backend/requirements.txt`.
- JS dependencies use modern stable ranges to allow patch/minor updates.
- Python runtime deps are intentionally constrained to stable release lines.

## What is implemented now

- Dockerized monorepo baseline with hot reload
- FastAPI + Mongo startup/shutdown integration
- Mongo-backed game catalog (collection: `games`)
- Typed Next.js frontend and typed API client
- Startup-ready structured status reporting

## Near-term roadmap

1. Extend catalog beyond single seeded Wordle document
2. Add first complete REST Wordle game flow
3. Introduce tests and CI checks in later phases
4. Add auth/accounts/history/leaderboards
