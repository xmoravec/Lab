from __future__ import annotations

from typing import Literal

from pydantic import Field, model_validator

from app.games.wordle.schemas import WordleDifficulty
from app.schemas.base import CamelModel


class WordleSolverClueRow(CamelModel):
    green_pattern: str = Field(min_length=5, max_length=5, pattern=r"^[a-zA-Z_]{5}$")
    yellow_letters: str = Field(default="", max_length=26, pattern=r"^[a-zA-Z]*$")
    gray_letters: str = Field(default="", max_length=26, pattern=r"^[a-zA-Z]*$")

    @model_validator(mode="after")
    def validate_row_conflicts(self) -> "WordleSolverClueRow":
        greens = {letter for letter in self.green_pattern.lower() if letter != "_"}
        yellows = set(self.yellow_letters.lower())
        grays = set(self.gray_letters.lower())

        green_yellow_overlap = sorted(greens & yellows)
        if green_yellow_overlap:
            overlap_text = ", ".join(green_yellow_overlap)
            raise ValueError(f"Row has green/yellow conflicts for letters: {overlap_text}")

        yellow_gray_overlap = sorted(yellows & grays)
        if yellow_gray_overlap:
            overlap_text = ", ".join(yellow_gray_overlap)
            raise ValueError(f"Row has yellow/gray conflicts for letters: {overlap_text}")

        green_gray_overlap = sorted(greens & grays)
        if green_gray_overlap:
            overlap_text = ", ".join(green_gray_overlap)
            raise ValueError(f"Row has green/gray conflicts for letters: {overlap_text}")

        return self


class WordleSolverRequest(CamelModel):
    difficulty: WordleDifficulty = WordleDifficulty.COMMON
    clue_rows: list[WordleSolverClueRow] = Field(default_factory=list, max_length=6)
    max_suggestions: int = Field(default=12, ge=1, le=50)

    @model_validator(mode="after")
    def validate_global_conflicts(self) -> "WordleSolverRequest":
        green_or_yellow: set[str] = set()
        gray_letters: set[str] = set()

        for row in self.clue_rows:
            green_or_yellow.update(letter for letter in row.green_pattern.lower() if letter != "_")
            green_or_yellow.update(row.yellow_letters.lower())
            gray_letters.update(row.gray_letters.lower())

        overlap = sorted(green_or_yellow & gray_letters)
        if overlap:
            overlap_text = ", ".join(overlap)
            raise ValueError(f"Global clue conflict: letters cannot be both included and excluded ({overlap_text})")

        return self


class WordleSolverSuggestion(CamelModel):
    word: str
    score: float
    unique_letters: int = Field(ge=1, le=5)


class WordleSolverResponse(CamelModel):
    difficulty: WordleDifficulty
    candidate_count: int = Field(ge=0)
    suggestions: list[WordleSolverSuggestion]
    candidates_preview: list[str]
    word_bank_source: Literal["wordfreq", "fallback"] = "wordfreq"
    limited_word_bank: bool = False
    word_bank_notice: str | None = None
