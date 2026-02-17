from __future__ import annotations

from datetime import datetime
from enum import Enum
from typing import Literal

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
    hint_used: bool = False
    hint_letter_index: int | None = Field(default=None, ge=0)
    hint_letter: str | None = Field(default=None, min_length=1, max_length=1)
    admin_answer_revealed: bool = False
    word_bank_source: Literal["wordfreq", "fallback"] = "wordfreq"
    limited_word_bank: bool = False
    word_bank_notice: str | None = None


class WordleMenuResponse(CamelModel):
    available_difficulties: list[WordleDifficulty]
    active_game: WordleGameState | None = None
    previous_games: list[WordleGameState]
    limited_word_bank: bool = False
    word_bank_notice: str | None = None


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


class WordleHintRequest(CamelModel):
    game_id: str = Field(min_length=1)


class WordleHintResponse(CamelModel):
    game: WordleGameState
    accepted: bool
    message: str


class WordleRevealAnswerRequest(CamelModel):
    game_id: str = Field(min_length=1)


class WordleRevealAnswerResponse(CamelModel):
    game: WordleGameState
    accepted: bool
    message: str
