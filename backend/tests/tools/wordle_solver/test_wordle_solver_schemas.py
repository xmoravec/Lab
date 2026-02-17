# pyright: reportMissingImports=false

from __future__ import annotations

import pytest  # type: ignore[import-not-found]
from pydantic import ValidationError

from app.tools.wordle_solver.schemas import WordleSolverClueRow, WordleSolverRequest  # type: ignore[import-not-found]


@pytest.mark.tools
def test_wordle_solver_row_rejects_green_yellow_overlap() -> None:
    with pytest.raises(ValidationError):
        WordleSolverClueRow(green_pattern="a____", yellow_letters="a", gray_letters="")


@pytest.mark.tools
def test_wordle_solver_row_rejects_yellow_gray_overlap() -> None:
    with pytest.raises(ValidationError):
        WordleSolverClueRow(green_pattern="_____", yellow_letters="s", gray_letters="s")


@pytest.mark.tools
def test_wordle_solver_request_rejects_global_include_exclude_conflict() -> None:
    with pytest.raises(ValidationError):
        WordleSolverRequest(
            clue_rows=[
                WordleSolverClueRow(green_pattern="a____", yellow_letters="", gray_letters=""),
                WordleSolverClueRow(green_pattern="_____", yellow_letters="", gray_letters="a"),
            ],
        )
