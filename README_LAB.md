# The Playground (Lab)

A technical sandbox for experimenting with browser games, real-time WebSocket features, LLM-based tools, and multi-user experiences.

## Tech Stack

- **Frontend**: Next.js (hosted on Vercel or on the VPS)
- **Backend**: FastAPI (Python) for async performance and clean API design
- **Database**: MongoDB Atlas (Free Tier)
- **Real-time**: WebSockets via native FastAPI support or Socket.io
- **Infrastructure**: Hetzner or DigitalOcean VPS (roughly $4–6/month) using Docker
- **Reverse Proxy**: Caddy for automatic HTTPS and simple configuration

## Architecture & Design

- **Decoupled frontend and backend**:
	- FastAPI handles all core logic and database access.
	- Next.js handles UI, routing, and client interactions.
- **Game and app state lives on the backend**:
	- Frontend sends user actions.
	- Backend computes state, validates input, and broadcasts updates.
- **WebSocket heartbeat mechanism** to detect dropped connections and clean up resources.

## Planned Experiments / Features

### Wordle-style game (Phase 1 – REST)
- Implement initial version using simple REST APIs.
- Persist scores and game results in MongoDB.

### Multiplayer Snake (Phase 2 – WebSockets)
- Move to real-time state sync using WebSockets.
- Keep the Python backend as the source of truth for all game logic.

### LLM "Buddy" (Commentator / Helper)
- Use the Groq API for fast, inexpensive inference instead of self-hosting models.
- Integrate as an in-game or in-app assistant with a sarcastic/commentator tone.

## React + Python Integration Plan

### Shared Types
- Define all request/response schemas with Pydantic on the FastAPI backend.
- Automatically generate TypeScript interfaces from these models so the frontend and backend share a single source of truth.

### WebSocket Flow
- React client opens a persistent WebSocket connection to a FastAPI endpoint.
- Backend manages game state, validates moves, and broadcasts updates (e.g. "letter correct" in a Wordle clone).
- Use heartbeats/timeouts to detect and close stale connections to prevent memory leaks.

### Authentication
- Use FastAPI Users (or similar) for backend user management.
- Use NextAuth.js (or standard JWT flows) on the frontend for session handling.
- Ensure tokens and session data are compatible between the two.

## Infrastructure & Deployment Plan

### Local / Cloud Dev
- Start using Railway.app for development and early experiments.
- Rationale: first-class support for Python + WebSockets, generous free tier, and no need to manage a full Linux server initially.

### VPS Setup (Scaling / Long-Term)
- When traffic or complexity justifies it, move to a VPS (Hetzner or DigitalOcean) for full control and better handling of many persistent WebSocket connections.
- Use Docker to containerize FastAPI, Caddy, and other services.
- Configure Caddy as the reverse proxy to terminate TLS and route traffic.

### docker-compose baseline
- Define a `docker-compose.yml` that at minimum includes:
	- A FastAPI service.
	- A Caddy service configured as a reverse proxy with automatic HTTPS.
- Verify the setup via SSH with a simple "Hello World" endpoint exposed over HTTPS.

## Critical Pitfalls to Avoid

### CORS issues
- The Portfolio and Playground will often live on different origins.
- Correctly configure `fastapi.middleware.cors` (allowed origins, methods, and headers) early.
- Misconfigured CORS will break login flows and API calls in subtle ways.

### Memory leaks and resource misuse
- Always close WebSocket connections when clients disconnect.
- Use heartbeats and timeouts to detect dropped clients.

### State synchronization problems
- Do not calculate complex game logic on the frontend.
- Keep the Python backend as the single source of truth for state; the frontend should only render and submit player actions.

## Content & Engagement Ideas

### Leaderboards
- Use MongoDB to store global high scores for games like the Wordle clone.
- Display leaderboards prominently to add a social/competitive element.

### LLM Chatbot "Buddy"
- Small in-game chat window where the LLM comments on gameplay or offers hints.
- Keep the tone playful/sarcastic to differentiate it from a generic chatbot.

### Dev Log
- A public or hidden "Dev Log" page that records technical hurdles, design decisions, and architecture changes.
- Useful both for personal reflection and for showing how I think through problems.

## Domain & Deployment

- **Domain**: `lab.yourname.com` (subdomain)
- **Platform**: Railway.app initially, then VPS for scale
- **Separation**: If the Playground or VPS goes down during heavy experiments, the Portfolio remains unaffected

## Observability & Quality

- Add basic **logging and metrics** for the FastAPI backend (request logs, error tracking, WebSocket connection counts).
- Consider integrating a lightweight error tracker (e.g. Sentry) once the Playground becomes more complex.
- Write focused tests for:
	- Core game logic (pure Python functions / services).
	- Critical API endpoints and auth flows.

## Developer Experience & Workflow

- Use separate **environments** (dev, staging, production) where possible, especially for DBs and API keys.
- Keep secrets (API keys, DB URIs) out of the repo using environment variables and a `.env` strategy.
- Decide early between a **monorepo** (Portfolio + Playground in one repo) or **separate repos**, and structure CI/CD accordingly.

## Data & Evolution

- Plan for **schema evolution** in MongoDB (version fields, migrations scripts where needed).
- Keep a simple **CHANGELOG or Dev Log** for major changes to APIs and game rules.

## Next Steps

1. Stand up a minimal FastAPI + Caddy stack via Railway or a VPS using `docker-compose`.
2. Implement the first Wordle-style game end-to-end (REST-based) with persistence.
3. Add WebSocket support and iterate toward real-time multiplayer features.

---

For the professional portfolio project, see [README.md](README.md).
