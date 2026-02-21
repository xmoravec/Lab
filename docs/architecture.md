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
- Session role fields (including admin state) are periodically refreshed from backend account data (`/api/auth/me`) to avoid stale JWT-only role snapshots after DB role changes.

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

### Abuse controls and rate-limit telemetry

- App-level rate limiting is enabled for sensitive/public endpoints (auth, gameplay mutations, tools, and system probes).
- Rate-limit responses expose transparent headers (`x-rate-limit-*`, and `retry-after` on `429`) so clients can back off gracefully.
- Rate-limit incidents are logged with privacy-safe identity hashing for operational visibility.
- Internal observability endpoint `GET /api/rate-limit/stats` is available behind internal auth for quick incident review.

### Catalog data source

- Catalog data is sourced from MongoDB collection `games`.
- Phase-1 behavior seeds/synchronizes one canonical Wordle document once during backend startup (not on catalog reads), reducing write traffic for deployed environments.
- API responses are validated through Pydantic schemas before returning to clients.

### Wordle module

- Backend Wordle implementation is encapsulated under `backend/app/games/wordle/`.
- Main responsibilities are split into:
  - `service.py` for gameplay orchestration, word-bank sourcing/validation, and tile evaluation logic
  - `word_bank.py` for cached dictionary loading, difficulty pools, and allowed-guess policy
  - `repository.py` for MongoDB persistence
- Mongo collection `wordle_games` stores all rounds, guesses, and outcomes.
- Each game document is scoped to a `user_id`; menu/history/start/guess are fully personalized.
- Guest play is supported through internal guest identities; guest sessions are stored in-memory only (no Mongo persistence) and are intended for single browser-visit continuity.
- Supports two difficulties:
  - `common`: top ~2k five-letter words
  - `extended`: top ~8k five-letter words
- Primary dictionary source is `wordfreq` (`top_n_list`) via direct top-level import.
- If dictionary sourcing fails, the backend uses a vetted fallback list and surfaces explicit limited-mode metadata (`limitedWordBank`, `wordBankNotice`) to frontend menu and gameplay responses.
- Active games support one optional hint action (`/api/games/wordle/hint`) that reveals one target-letter position and marks the game as `hintUsed`.
- Admin users (`users.is_admin = true`) can reveal the answer without ending the game via `/api/games/wordle/reveal-answer`.
- Admin reveal now resolves by `gameId` across users (including guest in-memory rounds) and requires both admin role and admin-mode toggle.
- Admin-only actions also require explicit admin mode enablement from the frontend header toggle. The toggle state is held in an HttpOnly cookie and forwarded as trusted internal header `x-admin-mode: on`.

### Chess module

- Backend Chess implementation is encapsulated under `backend/app/games/chess/`.
- `python-chess` is used as authoritative game-rules engine for legal moves, game-state transitions, check/checkmate/stalemate detection, and FEN continuity.
- Chess bot move-search and static board-evaluation heuristics are isolated in `bot_engine.py`, while `service.py` remains responsible for orchestration, turn flow, and persistence boundaries.
- If `python-chess` is temporarily unavailable in runtime (e.g., stale container image), Chess actions return a clear `503` service error while core app routes (including homepage/catalog) remain available.
- Mongo collections:
  - `chess_invitations` for account-to-account invitation workflow
  - `chess_matches` for persisted match state, move history, and outcome metadata
- Multiplayer is implemented as async turn-based flow (DB-backed state; no WebSocket requirement in phase 1).
- Invitation policy allows self-invitations only for admin accounts.
- Match modes currently supported:
  - `multiplayer` (invitation-based account matches)
  - `self-play` (same account controls both colors)
  - `bot` (single-player against a basic built-in heuristic bot)
- Guest identities can access Chess `self-play` and `bot` modes; invitation-driven multiplayer remains sign-in required.
- Bot difficulty is selectable from UI as `easy`, `medium` (default), or `hard` and is persisted per bot match.
- Current bot move policy combines tactical checks (mate-in-1 detection) with depth-based search:
  - `easy`: depth-1 capture-priority heuristic with random tie-break
  - `medium`: depth-2 minimax with alpha-beta pruning
  - `hard`: depth-3 minimax with alpha-beta pruning
- Bot replies are decoupled from player submit requests: user moves are persisted and returned immediately, while bot turns are scheduled asynchronously with a minimum 5-second think window and applied on subsequent match-state fetches.
- Match clock is server-authoritative real-time and persists in DB state (`clock_started_at` + remaining seconds). Active games can end by timeout even when players are off-page.
- Supported time controls are intentionally constrained to menu presets: 1m, 5m, 10m (default), 25m, and 60m.

### Leaderboards module

- Public leaderboard endpoint is exposed under `/api/leaderboards/{gameSlug}`.
- Current implementation supports `wordle` with rules-based per-game Elo deltas:
  - win on guess 1: +5
  - win on guess 2: +3
  - win on guess 3: +1
  - win on guess 4: +0
  - win on guess 5: -1
  - win on guess 6: -2
  - loss: -3
  - any game with `hintUsed=true`: +0 (no Elo change)
- Designed for extension to future game modules through service-level game-specific ranking strategies.

## Frontend architecture

- App Router structure under `frontend/app/`
- Typed API clients under `frontend/lib/`
- Shared frontend auth contract types are centralized in `frontend/lib/contracts/auth.ts` to reduce duplicated account payload definitions across auth/session and account onboarding flows.
- Home page features a hero, spotlight game, and scalable experiment sections using backend-sourced content.
- Home page spotlight is presented as a horizontal carousel that rotates through available playable games and live tools with screenshot-led cards.
- A global footer is rendered from root layout across the app, with prominent author attribution (`xmoravec`), personal website reference (`www.xmoravec.com`), and planned deployment domain (`lab.xmoravec.com`).
- Footer includes a persistent Privacy Policy link.
- Games page provides a richer catalog view with playable-first grouping and summary stats.
- Shared game cards expose clickable game titles and a prominent playable CTA for fast entry into active games.
- Game and tool catalog cards now use curated screenshots from `frontend/public/assets/screenshots/` (`chess.png`, `wordle.png`, `wordle_solver.png`) to improve visual presentation across Home, Games, and Tools pages.
- Account pages (`/account/sign-in`, `/account/sign-up`) provide credentials onboarding and Google auth handoff.
- Account sign-in/sign-up pages include direct privacy-policy acknowledgment links.
- Leaderboards page (`/leaderboards`) features podium and full ranking table.
- Tools index page (`/tools`) provides a catalog of utility experiences.
- Wordle Solver tool UI is served at `/tools/wordle_solver` with multi-row green/yellow/gray clue inputs, ranked suggestions, and candidate previews.
- Privacy Policy page is available at `/privacy` and documents account data, cookies, analytics, processors, retention, and user choices.
- Cookie consent banner is shown from root layout and supports a low-friction choice between required-only cookies and optional analytics.
- Vercel Analytics is client-gated by explicit consent and does not initialize before consent is accepted.
- Dev Log page has been removed from the product navigation and route surface.
- Wordle UI is encapsulated under `frontend/app/games/wordle/` and now consumes authenticated Next.js proxy routes.
- Wordle gameplay now includes lightweight synthesized audio cues (Web Audio API) for keypress, submit, invalid input, hint, and win/loss outcomes, with a per-game menu toggle persisted in localStorage.
- Wordle now opens in a menu-first flow (including when an active game exists) and requires explicit Resume/Play action before entering the board view.
- Admin reveal controls in Wordle are visible only while admin mode is currently enabled (live-synced from server cookie state), preventing stale visibility after admin mode is switched off.
- Chess UI is encapsulated under `frontend/app/games/chess/` and consumes one Next.js proxy route at `frontend/app/api/chess/route.ts` with optional auth (guest-enabled self-play/bot, account-required multiplayer).
- Chess gameplay now includes subtle event SFX with small local WAV assets under `frontend/public/assets/sounds/chess/` (select, move, capture, check, castle, illegal, game-end), plus a per-game menu toggle persisted in localStorage.
- Chess page now opens to a menu-first flow (mode/time-control selection and invitations) and transitions to a dominant board view after explicit Play/open-match action.
- Chess board rendering uses generated SVG piece assets under `frontend/public/assets/chess/pieces/` for higher-fidelity visuals.
- Player bars display captured-piece icons per color and show a material-lead `+N` indicator on the side currently ahead in material.
- In-game board view defaults to an extra-large layout and provides a compact size toggle in the game header.
- Piece-selection UX supports direct own-piece reselection: clicking another of your pieces while one is selected switches selection instead of surfacing an illegal-move warning.
- Castling keeps standard king-to-target-square movement and also supports a king-to-rook shortcut gesture (drop/click king onto own rook square) that resolves to legal castling squares.
- Board squares subtly indicate the previous move (source and destination) for quick turn-context awareness.
- Wordle pre-game menu exposes a subtle board-width mode control (`Classic (5)` default, `Auto` lab mode) while keeping 5-letter gameplay as the primary experience.

### Authenticated proxy routing

- Frontend route handlers under `frontend/app/api/wordle/*` proxy to backend.
- Frontend Chess proxy route (`frontend/app/api/chess/route.ts`) also supports guest identity forwarding for guest-eligible actions.
- Proxy layer injects internal shared-secret and authenticated user headers from server-side session.
- For guest gameplay, proxy routes inject a generated guest session header (`x-guest-id`) bound to a browser-session cookie.
- Backend identity dependencies normalize and reject blank/whitespace-only identity headers to avoid ambiguous principal resolution.
- This prevents browser-side header spoofing for personalized game endpoints.

## Wordle API

- `GET /api/games/wordle/menu`
  - Returns available difficulties, latest active game (auto-resume), and previous games list for the authenticated user.
- `POST /api/games/wordle/start`
  - Starts a new game or resumes an existing in-progress game for the authenticated user.
- `POST /api/games/wordle/guess`
  - Validates and evaluates a guess, persists attempt, and returns updated personalized game state.
- `POST /api/games/wordle/hint`
  - Reveals one target letter-position for an active game and marks the game as hint-used.
- `POST /api/games/wordle/reveal-answer`
  - Admin-only action to reveal answer by `gameId` (cross-user scope) without mutating win/loss state.
- `POST /api/tools/wordle_solver/solve`
  - Public tools endpoint under dedicated backend module `app/tools/wordle_solver/`.
  - Applies provided green/yellow/gray clue-row constraints, rejects contradictory clues, and returns matching candidate count, ranked next-word suggestions, and a candidate preview list.

## Chess API

- `POST /api/games/chess`
  - Single action endpoint for all Chess page state transitions and mutations.
  - Action payload (`action`) supports:
    - `bootstrap` (menu context)
    - `send-invitation`
    - `respond-invitation`
    - `start-self-play`
    - `start-bot`
    - `load-match`
    - `submit-move`
  - Response bundles user-context state (`menu`) and action-specific results (`matchState`, `moveResult`, etc.) so the page can stay synchronized from one route.

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

### Backend test strategy

- Lean pytest layer lives under `backend/tests/` and is grouped by domain area (`core`, `games`, `tools`, `integration`).
- Current strategy prioritizes high-value business logic and validation tests over exhaustive route mocking.
- Live DB coverage is intentionally minimal and includes a smoke test for Mongo user collection read/write sanity.
- Pytest configuration in `backend/pyproject.toml` enables strict markers and log CLI output for clearer run reporting.

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
- Chess gameplay with invitation-driven multiplayer, self-play mode, and basic bot matches
- Public Wordle ELO leaderboard and dedicated frontend leaderboard page
- Playable Wordle is fully featured in Home and Games surfaces with account/leaderboard CTAs
- Typed Next.js frontend and typed API client
- Startup-ready structured status reporting

## Near-term roadmap

1. Extend catalog beyond single seeded Wordle document
2. Add tests and CI checks for API + frontend contracts
3. Expand multi-game frontend modules and shared game shell patterns
4. Add richer account profile settings, avatar management, and friend systems

## Planned deployment

### Target stack (current plan)

- Frontend: Vercel (Next.js production hosting)
- Backend: Railway (Dockerized FastAPI service)
- Database: MongoDB Atlas M0 (free/shared cluster tier)
- Edge/DNS: Cloudflare (DNS, TLS proxying, and edge security controls)

This stack keeps operational complexity low for a personal project while remaining suitable for low-to-medium early traffic.

### Technology fit summary

- Vercel
  - Natural fit for App Router + NextAuth workflows.
  - Minimal ops burden for frontend deployments and environment management.
  - Vercel Analytics is integrated in consent-gated mode (optional analytics only after opt-in).
- Railway
  - Supports long-running containerized Python services and straightforward Docker deploys.
  - Good balance of simplicity and capability without self-managing a VM.
- Atlas M0
  - Viable launch-tier option for early usage and cost minimization.
  - Should be treated as an entry tier with eventual upgrade path if usage grows.
- Cloudflare
  - Complements Vercel/Railway with domain management and protective edge controls.
  - Useful location for coarse traffic filtering before requests reach app infrastructure.

### Pre/post-deployment considerations (in scope)

- WebSocket pathing and proxy behavior
  - Near-future real-time features should reserve a stable API pathing strategy (for example, dedicated realtime endpoint/subpath) and verify proxy compatibility end-to-end (Cloudflare edge, domain routing, Railway ingress, backend ASGI handling).
  - Validate idle timeout behavior and reconnect strategy before enabling production realtime flows.
- Rate limiting (required before public rollout)
  - Add app-level rate limiting for auth and gameplay mutation endpoints to reduce abuse risk and protect free-tier resources.
  - Keep edge-level controls in Cloudflare as a first layer, with backend enforcement as source of truth.
- Cost guardrails (required)
  - Enable provider budget alerts and spending notifications across Vercel, Railway, and Atlas.
  - Define explicit upgrade triggers (for example, sustained latency, memory pressure, connection saturation) so scaling decisions are deliberate.
  - Prefer conservative defaults (single backend service, right-sized resources) and revisit only when real usage data supports expansion.
