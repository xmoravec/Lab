from __future__ import annotations

from fastapi import APIRouter

from app.api.routes import auth
from app.api.routes import catalog
from app.api.routes import leaderboard
from app.api.routes import system
from app.api.routes import tools
from app.api.routes import wordle

api_router = APIRouter()
api_router.include_router(auth.router, prefix="", tags=["auth"])
api_router.include_router(catalog.router, prefix="", tags=["catalog"])
api_router.include_router(leaderboard.router, prefix="", tags=["leaderboard"])
api_router.include_router(system.router, prefix="", tags=["system"])
api_router.include_router(tools.router, prefix="", tags=["tools"])
api_router.include_router(wordle.router, prefix="", tags=["wordle"])
