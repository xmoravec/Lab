from __future__ import annotations

import logging

from fastapi import APIRouter, HTTPException

from app.api.error_utils import raise_http_from_service_error, raise_internal_http_error
from app.schemas.leaderboard import GameLeaderboardResponse
from app.services.leaderboard_service import LeaderboardServiceError, leaderboard_service

router = APIRouter(prefix="/leaderboards")
logger = logging.getLogger("uvicorn.error")


@router.get("/{game_slug}", response_model=GameLeaderboardResponse)
async def get_game_leaderboard(game_slug: str) -> GameLeaderboardResponse:
    try:
        return await leaderboard_service.get_game_leaderboard(game_slug=game_slug)
    except LeaderboardServiceError as error:
        raise_http_from_service_error(status_code=error.status_code, message=error.message, error=error)
    except HTTPException:
        raise
    except Exception as error:  # noqa: BLE001
        raise_internal_http_error(
            logger=logger,
            log_message="Unhandled leaderboard error game_slug=%s",
            detail="Failed to load leaderboard",
            error=error,
            log_args=(game_slug,),
        )
