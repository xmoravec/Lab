from __future__ import annotations

import logging

from fastapi import APIRouter, HTTPException

from app.schemas.leaderboard import GameLeaderboardResponse
from app.services.leaderboard_service import LeaderboardServiceError, leaderboard_service

router = APIRouter(prefix="/leaderboards")
logger = logging.getLogger("uvicorn.error")


@router.get("/{game_slug}", response_model=GameLeaderboardResponse)
async def get_game_leaderboard(game_slug: str) -> GameLeaderboardResponse:
    try:
        return await leaderboard_service.get_game_leaderboard(game_slug=game_slug)
    except LeaderboardServiceError as error:
        raise HTTPException(status_code=error.status_code, detail=error.message) from error
    except Exception as error:  # noqa: BLE001
        logger.exception("Unhandled leaderboard error game_slug=%s", game_slug)
        raise HTTPException(status_code=500, detail="Failed to load leaderboard") from error
