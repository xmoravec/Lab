# The Playground (Lab)

The Playground is a full-stack experimental lab for browser games and interactive web ideas.

It is built as a Docker-first monorepo with:

- Next.js frontend (`frontend/`)
- FastAPI backend (`backend/`)
- MongoDB database (`mongo` container)

Current status: a runnable local baseline is implemented with a full Mongo-backed Wordle flow, typed API contracts, CORS-safe configuration, Mongo connectivity checks, and startup status reporting.

## Quick start

1. Create `.env` from `.env.example`
2. Run `docker compose -f docker/docker-compose.yml up --build`
3. Open:
   - Frontend: `http://localhost:3000`
   - Backend docs: `http://localhost:8000/docs`

## Documentation

Detailed architecture and implementation notes are in [docs/architecture.md](docs/architecture.md).
