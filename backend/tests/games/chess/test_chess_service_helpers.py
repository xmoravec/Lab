# pyright: reportMissingImports=false

from __future__ import annotations

import pytest  # type: ignore[import-not-found]

from app.games.chess.service import ChessService  # type: ignore[import-not-found]

chess = pytest.importorskip("chess")


@pytest.mark.games
def test_best_bot_move_prefers_capture_when_available() -> None:
    board = chess.Board("8/8/8/8/8/8/4q3/4K3 w - - 0 1")

    move = ChessService._best_bot_move(board)

    assert move.uci() == "e1e2"


@pytest.mark.games
def test_apply_match_outcome_sets_checkmate_result() -> None:
    board = chess.Board("6k1/6Q1/6K1/8/8/8/8/8 b - - 0 1")
    match_document: dict[str, object] = {
        "status": "active",
        "result": "*",
        "winner_user_id": None,
        "white_user_id": "white-user",
        "black_user_id": "black-user",
    }

    ChessService._apply_match_outcome(board=board, match_document=match_document)

    assert match_document["status"] == "checkmate"
    assert match_document["result"] == "1-0"
    assert match_document["winner_user_id"] == "white-user"
