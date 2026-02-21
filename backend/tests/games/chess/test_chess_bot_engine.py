# pyright: reportMissingImports=false

from __future__ import annotations

import pytest  # type: ignore[import-not-found]

from app.games.chess import bot_engine  # type: ignore[import-not-found]

chess = pytest.importorskip("chess")


@pytest.mark.games
def test_bot_engine_best_move_prefers_capture_when_available() -> None:
    board = chess.Board("8/8/8/8/8/8/4q3/4K3 w - - 0 1")

    move = bot_engine.best_bot_move(board)

    assert move.uci() == "e1e2"
