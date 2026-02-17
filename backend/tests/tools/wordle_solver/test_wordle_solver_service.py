# pyright: reportMissingImports=false

from __future__ import annotations

import pytest  # type: ignore[import-not-found]

from app.games.wordle.schemas import WordleDifficulty  # type: ignore[import-not-found]
from app.tools.wordle_solver.schemas import WordleSolverClueRow, WordleSolverRequest  # type: ignore[import-not-found]
from app.tools.wordle_solver.service import solve_wordle_constraints  # type: ignore[import-not-found]


@pytest.mark.tools
@pytest.mark.asyncio
async def test_solver_filters_candidates_and_returns_ranked_suggestions(monkeypatch: pytest.MonkeyPatch) -> None:
    def fake_get_words_for_difficulty(_: WordleDifficulty) -> list[str]:
        return ["crane", "slate", "trace", "cater", "react"]

    def fake_get_word_bank_context() -> dict[str, object]:
        return {
            "source": "wordfreq",
            "limited_word_bank": False,
            "notice": None,
        }

    monkeypatch.setattr("app.tools.wordle_solver.service.get_words_for_difficulty", fake_get_words_for_difficulty)
    monkeypatch.setattr("app.tools.wordle_solver.service.get_word_bank_context", fake_get_word_bank_context)

    request = WordleSolverRequest(
        difficulty=WordleDifficulty.COMMON,
        clue_rows=[
            WordleSolverClueRow(
                green_pattern="__a__",
                yellow_letters="r",
                gray_letters="l",
            ),
        ],
        max_suggestions=3,
    )

    response = await solve_wordle_constraints(request)

    assert response.candidate_count == 3
    assert len(response.suggestions) == 3
    assert all("l" not in suggestion.word for suggestion in response.suggestions)
    assert response.suggestions[0].score >= response.suggestions[-1].score


@pytest.mark.tools
@pytest.mark.asyncio
async def test_solver_returns_zero_candidates_for_impossible_constraints(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(
        "app.tools.wordle_solver.service.get_words_for_difficulty",
        lambda _: ["crane", "slate"],
    )
    monkeypatch.setattr(
        "app.tools.wordle_solver.service.get_word_bank_context",
        lambda: {"source": "fallback", "limited_word_bank": True, "notice": "limited"},
    )

    request = WordleSolverRequest(
        clue_rows=[WordleSolverClueRow(green_pattern="zzzzz", yellow_letters="", gray_letters="")],
    )

    response = await solve_wordle_constraints(request)

    assert response.candidate_count == 0
    assert response.suggestions == []
    assert response.word_bank_source == "fallback"
