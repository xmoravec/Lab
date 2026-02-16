from __future__ import annotations

from datetime import datetime
from enum import Enum

from pydantic import Field

from app.schemas.base import CamelModel


class WordleDifficulty(str, Enum):
    COMMON = "common"
    EXTENDED = "extended"


class WordleGameStatus(str, Enum):
    IN_PROGRESS = "in-progress"
    WON = "won"
    LOST = "lost"


class TileState(str, Enum):
    ABSENT = "absent"
    PRESENT = "present"
    CORRECT = "correct"


class GuessEvaluation(CamelModel):
    letter: str = Field(min_length=1, max_length=1)
    state: TileState


class GuessRecord(CamelModel):
    guess: str = Field(min_length=5, max_length=5)
    evaluations: list[GuessEvaluation]
    submitted_at: datetime


class WordleGameState(CamelModel):
    game_id: str
    difficulty: WordleDifficulty
    status: WordleGameStatus
    max_attempts: int = Field(ge=1)
    attempts_used: int = Field(ge=0)
    word_length: int = Field(ge=1)
    board: list[GuessRecord]
    started_at: datetime
    completed_at: datetime | None = None
    answer: str | None = None


class WordleMenuResponse(CamelModel):
    available_difficulties: list[WordleDifficulty]
    active_game: WordleGameState | None = None
    previous_games: list[WordleGameState]


class StartWordleRequest(CamelModel):
    difficulty: WordleDifficulty = WordleDifficulty.COMMON
    force_new: bool = False


class StartWordleResponse(CamelModel):
    resumed_existing: bool
    game: WordleGameState


class GuessWordleRequest(CamelModel):
    game_id: str = Field(min_length=1)
    guess: str = Field(min_length=5, max_length=5)


class GuessWordleResponse(CamelModel):
    game: WordleGameState
    accepted: bool
    message: str
