from __future__ import annotations

import logging
from typing import TypeVar

from fastapi import APIRouter, Depends, HTTPException

from app.api.error_utils import raise_http_from_service_error, raise_internal_http_error
from app.core.rate_limit import build_rate_limiter
from app.core.security import PrincipalIdentity, require_internal_request, require_principal_identity
from app.games.chess.schemas import (
    ChessAction,
    ChessActionRequest,
    ChessActionResponse,
    StartBotMatchRequest,
    SubmitChessMoveRequest,
)
from app.games.chess.service import ChessServiceError, chess_service

router = APIRouter(prefix="/games/chess")
logger = logging.getLogger("uvicorn.error")
chess_action_rate_limit = build_rate_limiter(bucket="chess-action", limit=180, window_seconds=60)


_T = TypeVar("_T")


def _require_value(value: _T | None, *, field_name: str) -> _T:
    if value is None:
        raise HTTPException(status_code=400, detail=f"Missing required field: {field_name}")
    return value


async def _chess_identity_dependency(
    _: None = Depends(require_internal_request),
    identity: PrincipalIdentity = Depends(require_principal_identity),
) -> PrincipalIdentity:
    return identity


def _require_registered_identity(identity: PrincipalIdentity) -> None:
    if identity.is_guest:
        raise HTTPException(status_code=401, detail="Sign in required for multiplayer")


@router.post("", response_model=ChessActionResponse, dependencies=[Depends(chess_action_rate_limit)])
async def chess_action(
    payload: ChessActionRequest,
    identity: PrincipalIdentity = Depends(_chess_identity_dependency),
) -> ChessActionResponse:
    try:
        action = payload.action

        if action == ChessAction.BOOTSTRAP:
            menu = await chess_service.get_menu(user_id=identity.principal_id)
            return ChessActionResponse(action=action, menu=menu)

        if action == ChessAction.SEND_INVITATION:
            _require_registered_identity(identity)
            invitation = await chess_service.send_invitation(
                from_user_id=identity.principal_id,
                from_username=identity.username or "player",
                to_username=_require_value(payload.to_username, field_name="toUsername"),
                color_preference=payload.color_preference,
                time_control_seconds=payload.invitation_time_control_seconds,
            )
            return ChessActionResponse(action=action, invitation=invitation)

        if action == ChessAction.RESPOND_INVITATION:
            _require_registered_identity(identity)
            response = await chess_service.respond_to_invitation(
                user_id=identity.principal_id,
                invitation_id=_require_value(payload.invitation_id, field_name="invitationId"),
                action=_require_value(
                    payload.invitation_response_action,
                    field_name="invitationResponseAction",
                ),
            )
            match_state = None
            if response.match is not None:
                match_state = await chess_service.get_match_state(
                    user_id=identity.principal_id,
                    match_id=response.match.match_id,
                )
            return ChessActionResponse(
                action=action,
                invitation_response=response,
                match_state=match_state,
            )

        if action == ChessAction.START_SELF_PLAY:
            started = await chess_service.start_self_play(
                user_id=identity.principal_id,
                username=identity.username or "player",
                time_control_seconds=payload.time_control_seconds,
            )
            match_state = await chess_service.get_match_state(
                user_id=identity.principal_id,
                match_id=started.match.match_id,
            )
            return ChessActionResponse(
                action=action,
                started_match=started,
                match_state=match_state,
            )

        if action == ChessAction.START_BOT:
            started = await chess_service.start_bot_match(
                user_id=identity.principal_id,
                username=identity.username or "player",
                payload=StartBotMatchRequest(
                    play_as=payload.play_as,
                    bot_difficulty=payload.bot_difficulty,
                    time_control_seconds=payload.time_control_seconds,
                ),
            )
            match_state = await chess_service.get_match_state(
                user_id=identity.principal_id,
                match_id=started.match.match_id,
            )
            return ChessActionResponse(
                action=action,
                started_match=started,
                match_state=match_state,
            )

        if action == ChessAction.LOAD_MATCH:
            match_state = await chess_service.get_match_state(
                user_id=identity.principal_id,
                match_id=_require_value(payload.match_id, field_name="matchId"),
            )
            return ChessActionResponse(action=action, match_state=match_state)

        if action == ChessAction.SUBMIT_MOVE:
            move_result = await chess_service.submit_move(
                user_id=identity.principal_id,
                payload=SubmitChessMoveRequest(
                    match_id=_require_value(payload.match_id, field_name="matchId"),
                    from_square=_require_value(payload.from_square, field_name="fromSquare"),
                    to_square=_require_value(payload.to_square, field_name="toSquare"),
                    promotion=payload.promotion,
                ),
            )
            return ChessActionResponse(
                action=action,
                move_result=move_result,
                match_state=move_result.match,
            )

        raise HTTPException(status_code=400, detail="Unsupported chess action")
    except ChessServiceError as error:
        raise_http_from_service_error(status_code=error.status_code, message=error.message, error=error)
    except HTTPException:
        raise
    except Exception as error:  # noqa: BLE001
        raise_internal_http_error(
            logger=logger,
            log_message="Unhandled chess action error action=%s",
            detail="Failed to handle chess action",
            error=error,
            log_args=(payload.action,),
        )
