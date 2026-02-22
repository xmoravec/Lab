# The Playground (Lab)

The Playground is a full-stack experimental lab for browser games and interactive web ideas.

It is built as a Docker-first monorepo with:

- Next.js frontend (`frontend/`)
- FastAPI backend (`backend/`)
- MongoDB database (`mongo` container)

Current status: v1.0.0 is live with secure account authentication (NextAuth + backend credential verification), personalized Mongo-backed Wordle history for authenticated users, guest Wordle gameplay with in-visit continuity only (non-persistent), menu-first Wordle session flow with explicit resume/start entry, Wordle hint support and admin-only answer reveal gated by active admin mode, global Wordle ELO leaderboards with guess-attempt-based scoring rules, a full Chess module with DB-backed account invitations and multiplayer matches plus self-play and configurable bot difficulty (easy/medium/hard), guest-access Chess support for self-play and bot modes (with sign-in required for multiplayer invitations), first-version game audio support (Wordle synthesized tones + Chess subtle local WAV SFX with per-game menu toggles), upgraded SVG chess piece art, in-game captured-piece tracking, material-lead indicator in player bars, screenshot-enhanced game/tool card presentation across Home, Games, and Tools pages, a Home horizontal spotlight carousel featuring available games and tools, a Tools catalog page (`/tools`) with a dedicated Wordle Solver workflow at `/tools/wordle_solver`, a global site footer with author attribution and domain references (`www.xmoravec.com`, `lab.xmoravec.com`), typed API contracts, fail-fast Mongo startup checks, explicit Wordle dictionary-source signaling with limited-mode fallback notices, and refreshed Home/Games UX that features gameplay, rankings, and account onboarding.

Production URL: `https://lab.xmoravec.com/`

## Quick start

1. Create env files:
   - repo root `.env` from `.env.example` (if used by your workflow)
   - `docker/.env` from `docker/.env.example` for `docker compose` commands run in `docker/`
2. Set required secrets in `.env` (`INTERNAL_AUTH_SECRET`, `AUTH_SECRET`)
3. Run production-like stack: `docker compose -f docker/docker-compose.yml up --build`
4. For development hot-reload mode, use override: `docker compose -f docker/docker-compose.yml -f docker/docker-compose.dev.yml up --build`
5. Open:
   - Frontend: `http://localhost:3000`
   - Backend docs: `http://localhost:8000/docs`
   - Backend health: `http://localhost:8000/health`

Dockerfile locations:

- `backend/Dockerfile` for backend image builds
- `frontend/Dockerfile` for frontend image builds
- Local Docker auth uses explicit canonical host via `AUTH_URL` (for example `http://localhost:3000`)

Deployment stack:

- Frontend: Vercel
- Backend: Railway
- Database: MongoDB Atlas
- Edge/DNS: Cloudflare

Local Docker auth envs (required for frontend service):

- `AUTH_URL` (use `http://localhost:3000` for local compose)
- `AUTH_SECRET` (long random secret)

## Documentation

Detailed architecture and implementation notes are in [docs/architecture.md](docs/architecture.md).

## Backend tests (lean layer)

From repository root:

- Run all backend tests: `python -m pytest backend/tests -vv`
- Run only fast unit tests: `python -m pytest backend/tests -m "not integration" -vv`
- Run only smoke integration checks: `python -m pytest backend/tests -m "integration and smoke" -vv`

Test groups are organized for readable output by module area:

- `backend/tests/core/`
- `backend/tests/games/`
- `backend/tests/tools/`
- `backend/tests/integration/`
