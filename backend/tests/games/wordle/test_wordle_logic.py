# pyright: reportMissingImports=false

from __future__ import annotations

import pytest  # type: ignore[import-not-found]

from app.games.wordle.schemas import TileState  # type: ignore[import-not-found]
from app.games.wordle.service import evaluate_guess  # type: ignore[import-not-found]


@pytest.mark.games
def test_evaluate_guess_exact_match_is_all_correct() -> None:
    evaluation = evaluate_guess("crane", "crane")

    assert evaluation == [TileState.CORRECT] * 5


@pytest.mark.games
def test_evaluate_guess_handles_repeated_letters_correctly() -> None:
    evaluation = evaluate_guess("array", "cigar")

    assert evaluation == [
        TileState.ABSENT,
        TileState.PRESENT,
        TileState.ABSENT,
        TileState.CORRECT,
        TileState.ABSENT,
    ]


@pytest.mark.games
def test_evaluate_guess_mixed_states() -> None:
    evaluation = evaluate_guess("alert", "later")

    assert evaluation == [
        TileState.PRESENT,
        TileState.PRESENT,
        TileState.PRESENT,
        TileState.PRESENT,
        TileState.PRESENT,
    ]
