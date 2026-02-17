# Architecture

## Overview

The Playground (Lab) is a Docker-first monorepo for browser game experiments with a decoupled web frontend and Python backend.

- Frontend: Next.js (App Router), React, Tailwind, TypeScript
- Backend: FastAPI, Pydantic, Motor (Mongo async driver)
- Database: MongoDB
- Authentication: NextAuth (credentials + Google OAuth) with backend account source of truth
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
- Frontend server routes proxy authenticated game actions to backend with internal shared-secret headers.

## Backend architecture

### Layers

- `app/main.py`
  - FastAPI app setup, middleware registration, router inclusion, lifespan management
- `app/api/`
  - HTTP routing and request/response mapping
- `app/services/`
  - Domain/application logic, reusable helpers (catalog, auth, wordle, leaderboards)
- `app/core/`
  - Configuration and infrastructure integrations (Mongo lifecycle)
- `app/schemas/`
  - Pydantic request/response models and conventions

### Configuration strategy

- Settings are centralized in `app/core/config.py` with `pydantic-settings`.
- CORS origins support both CSV and JSON-list env formats.
- Environment defaults favor local Docker development while remaining deployment-safe.
- Internal service-to-service requests are guarded by `INTERNAL_AUTH_SECRET` for authenticated game/account endpoints.

### Auth model

- Account records are stored in Mongo collection `users`.
- Credentials login uses hashed password verification (`bcrypt`) in backend service layer.
- OAuth login (Google) is handled by NextAuth and linked/upserted to backend user documents.
- Frontend session uses NextAuth JWT strategy; backend remains authoritative for account persistence.

### Mongo lifecycle

- Startup: create client, select DB, ping
- Startup is fail-fast: if ping fails, API startup exits with an explicit error
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
- Phase-1 behavior ensures one canonical Wordle seed document exists and stays synchronized with current metadata.
- API responses are validated through Pydantic schemas before returning to clients.

### Wordle module

- Backend Wordle implementation is encapsulated under `backend/app/games/wordle/`.
- Main responsibilities are split into:
  - `word_bank.py` for frequency-based candidate pools and difficulty selection
  - `evaluator.py` for Wordle letter-state evaluation logic
  - `repository.py` for MongoDB persistence
  - `service.py` for gameplay orchestration and validation
- Mongo collection `wordle_games` stores all rounds, guesses, and outcomes.
- Each game document is scoped to a `user_id`; menu/history/start/guess are fully personalized.
- Guest play is supported through internal guest identities; guest sessions are stored in-memory only (no Mongo persistence) and are intended for single browser-visit continuity.
- Supports two difficulties:
  - `common`: top ~2k five-letter words
  - `extended`: top ~8k five-letter words

### Leaderboards module

- Public leaderboard endpoint is exposed under `/api/leaderboards/{gameSlug}`.
- Current implementation supports `wordle` with ELO-style ranking from wins, losses, attempts, and play volume.
- Designed for extension to future game modules through service-level game-specific ranking strategies.

## Frontend architecture

- App Router structure under `frontend/app/`
- Typed API clients under `frontend/lib/`
- Home page features a hero, spotlight game, and scalable experiment sections using backend-sourced content.
- Games page provides a richer catalog view with playable-first grouping and summary stats.
- Shared game cards expose clickable game titles and a prominent playable CTA for fast entry into active games.
- Account pages (`/account/sign-in`, `/account/sign-up`) provide credentials onboarding and Google auth handoff.
- Leaderboards page (`/leaderboards`) features podium and full ranking table.
- Wordle UI is encapsulated under `frontend/app/games/wordle/` and now consumes authenticated Next.js proxy routes.

### Authenticated proxy routing

- Frontend route handlers under `frontend/app/api/wordle/*` proxy to backend.
- Proxy layer injects internal shared-secret and authenticated user headers from server-side session.
- For guest gameplay, proxy routes inject a generated guest session header (`x-guest-id`) bound to a browser-session cookie.
- This prevents browser-side header spoofing for personalized game endpoints.

## Wordle API

- `GET /api/games/wordle/menu`
  - Returns available difficulties, latest active game (auto-resume), and previous games list for the authenticated user.
- `POST /api/games/wordle/start`
  - Starts a new game or resumes an existing in-progress game for the authenticated user.
- `POST /api/games/wordle/guess`
  - Validates and evaluates a guess, persists attempt, and returns updated personalized game state.

## Auth and leaderboard APIs

- `POST /api/auth/register`
  - Public account registration for email/password users.
- `POST /api/auth/credentials/verify`
  - Internal endpoint for NextAuth credentials provider.
- `POST /api/auth/oauth/google/upsert`
  - Internal endpoint for Google account linking/upsert.
- `GET /api/leaderboards/wordle`
  - Public Wordle leaderboard with ELO-style ranks and stats.

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
- FastAPI + Mongo startup/shutdown integration with fail-fast DB startup
- Mongo-backed game catalog (collection: `games`)
- NextAuth accounts (credentials + Google OAuth wiring) with backend user persistence
- Personalized Wordle history/state per authenticated user
- Public Wordle ELO leaderboard and dedicated frontend leaderboard page
- Playable Wordle is fully featured in Home and Games surfaces with account/leaderboard CTAs
- Typed Next.js frontend and typed API client
- Startup-ready structured status reporting

## Near-term roadmap

1. Extend catalog beyond single seeded Wordle document
2. Add tests and CI checks for API + frontend contracts
3. Expand multi-game frontend modules and shared game shell patterns
4. Add richer account profile settings, avatar management, and friend systems
