# The Playground (Lab)

The Playground is a full-stack experimental lab for browser games and interactive web ideas.

It is built as a Docker-first monorepo with:

- Next.js frontend (`frontend/`)
- FastAPI backend (`backend/`)
- MongoDB database (`mongo` container)

Current status: a runnable local baseline is implemented with secure account authentication (NextAuth + backend credential verification), personalized Mongo-backed Wordle history for authenticated users, guest Wordle gameplay with in-visit continuity only (non-persistent), Wordle hint support and admin-only answer reveal, global Wordle ELO leaderboards with guess-attempt-based scoring rules, a full Chess module with DB-backed account invitations and multiplayer matches plus self-play and basic bot mode, a Tools catalog page (`/tools`) with a dedicated Wordle Solver workflow at `/tools/wordle_solver`, typed API contracts, fail-fast Mongo startup checks, explicit Wordle dictionary-source signaling with limited-mode fallback notices, and refreshed Home/Games UX that features gameplay, rankings, and account onboarding.

## Quick start

1. Create `.env` from `.env.example`
2. Run `docker compose -f docker/docker-compose.yml up --build`
3. Open:
   - Frontend: `http://localhost:3000`
   - Backend docs: `http://localhost:8000/docs`

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
