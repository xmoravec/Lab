from __future__ import annotations

from datetime import datetime

from pydantic import Field

from app.schemas.base import CamelModel


class LeaderboardEntry(CamelModel):
    rank: int = Field(ge=1)
    user_id: str
    username: str
    games_played: int = Field(ge=0)
    wins: int = Field(ge=0)
    losses: int = Field(ge=0)
    win_rate: float = Field(ge=0, le=1)
    average_attempts: float = Field(ge=0)
    elo_score: int


class GameLeaderboardResponse(CamelModel):
    game_slug: str
    generated_at: datetime
    entries: list[LeaderboardEntry]
