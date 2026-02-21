from __future__ import annotations

import logging
from collections import Counter

from app.games.wordle.word_bank import get_word_bank_context, get_words_for_difficulty
from app.tools.wordle_solver.schemas import (
    WordleSolverRequest,
    WordleSolverResponse,
    WordleSolverSuggestion,
)

logger = logging.getLogger("uvicorn.error")


def _matches_clue_row(
    candidate: str,
    *,
    green_pattern: str,
    yellow_letters: str,
    gray_letters: str,
) -> bool:
    normalized_pattern = green_pattern.strip().lower()
    normalized_yellow = yellow_letters.strip().lower()
    normalized_gray = gray_letters.strip().lower()

    for index, mark in enumerate(normalized_pattern):
        if mark == "_":
            continue
        if candidate[index] != mark:
            return False

    for letter in set(normalized_yellow):
        if letter not in candidate:
            return False

    protected_letters = {mark for mark in normalized_pattern if mark != "_"} | set(normalized_yellow)
    for letter in set(normalized_gray):
        if letter in protected_letters:
            continue
        if letter in candidate:
            return False

    return True


def _letter_probability_scores(candidates: list[str]) -> dict[str, float]:
    if not candidates:
        return {}

    letter_document_frequency: Counter[str] = Counter()
    for candidate in candidates:
        for letter in set(candidate):
            letter_document_frequency[letter] += 1

    total_candidates = float(len(candidates))
    return {letter: count / total_candidates for letter, count in letter_document_frequency.items()}


def _score_candidate(word: str, letter_scores: dict[str, float]) -> float:
    seen_letters: set[str] = set()
    score = 0.0

    for letter in word:
        if letter in seen_letters:
            score += 0.02
            continue

        score += letter_scores.get(letter, 0.0)
        seen_letters.add(letter)

    score += len(seen_letters) * 0.03
    return round(score, 5)


async def solve_wordle_constraints(request: WordleSolverRequest) -> WordleSolverResponse:
    try:
        base_pool = get_words_for_difficulty(request.difficulty)
        filtered_candidates = base_pool

        for clue_row in request.clue_rows:
            filtered_candidates = [
                candidate
                for candidate in filtered_candidates
                if _matches_clue_row(
                    candidate,
                    green_pattern=clue_row.green_pattern,
                    yellow_letters=clue_row.yellow_letters,
                    gray_letters=clue_row.gray_letters,
                )
            ]

        letter_scores = _letter_probability_scores(filtered_candidates)
        ranked = sorted(
            filtered_candidates,
            key=lambda word: (
                _score_candidate(word, letter_scores),
                len(set(word)),
                word,
            ),
            reverse=True,
        )

        suggestions = [
            WordleSolverSuggestion(
                word=word,
                score=_score_candidate(word, letter_scores),
                unique_letters=len(set(word)),
            )
            for word in ranked[: request.max_suggestions]
        ]

        context = get_word_bank_context()
        return WordleSolverResponse(
            difficulty=request.difficulty,
            candidate_count=len(filtered_candidates),
            suggestions=suggestions,
            candidates_preview=sorted(filtered_candidates)[:50],
            word_bank_source=context["source"],
            limited_word_bank=context["limited_word_bank"],
            word_bank_notice=context["notice"],
        )
    except Exception:  # noqa: BLE001
        logger.exception(
            "Wordle solver failed difficulty=%s clue_rows=%s",
            request.difficulty.value,
            len(request.clue_rows),
        )
        raise
