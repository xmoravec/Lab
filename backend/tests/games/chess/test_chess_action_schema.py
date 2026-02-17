# pyright: reportMissingImports=false

from __future__ import annotations

import pytest  # type: ignore[import-not-found]

from app.games.chess.schemas import ChessActionRequest  # type: ignore[import-not-found]


@pytest.mark.games
def test_chess_action_schema_submit_move_payload_shape() -> None:
    payload = ChessActionRequest.model_validate(
        {
            "action": "submit-move",
            "matchId": "match-1",
            "fromSquare": "e2",
            "toSquare": "e4",
        },
    )

    assert payload.action.value == "submit-move"
    assert payload.match_id == "match-1"
    assert payload.from_square == "e2"
    assert payload.to_square == "e4"


@pytest.mark.games
def test_chess_action_schema_defaults() -> None:
    payload = ChessActionRequest.model_validate({"action": "start-bot"})

    assert payload.play_as == "random"
    assert payload.color_preference.value == "random"
