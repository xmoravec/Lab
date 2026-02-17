from __future__ import annotations

import logging
from typing import TypeVar

from fastapi import APIRouter, Depends, HTTPException

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


_T = TypeVar("_T")


def _require_value(value: _T | None, *, field_name: str) -> _T:
    if value is None:
        raise HTTPException(status_code=400, detail=f"Missing required field: {field_name}")
    return value


async def _chess_identity_dependency(
    _: None = Depends(require_internal_request),
    identity: PrincipalIdentity = Depends(require_principal_identity),
) -> PrincipalIdentity:
    if identity.is_guest:
        raise HTTPException(status_code=401, detail="Authentication required")
    return identity


@router.post("", response_model=ChessActionResponse)
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
            invitation = await chess_service.send_invitation(
                from_user_id=identity.principal_id,
                from_username=identity.username or "player",
                to_username=_require_value(payload.to_username, field_name="toUsername"),
                color_preference=payload.color_preference,
            )
            menu = await chess_service.get_menu(user_id=identity.principal_id)
            return ChessActionResponse(action=action, invitation=invitation, menu=menu)

        if action == ChessAction.RESPOND_INVITATION:
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
            menu = await chess_service.get_menu(user_id=identity.principal_id)
            return ChessActionResponse(
                action=action,
                invitation_response=response,
                match_state=match_state,
                menu=menu,
            )

        if action == ChessAction.START_SELF_PLAY:
            started = await chess_service.start_self_play(
                user_id=identity.principal_id,
                username=identity.username or "player",
            )
            match_state = await chess_service.get_match_state(
                user_id=identity.principal_id,
                match_id=started.match.match_id,
            )
            menu = await chess_service.get_menu(user_id=identity.principal_id)
            return ChessActionResponse(
                action=action,
                started_match=started,
                match_state=match_state,
                menu=menu,
            )

        if action == ChessAction.START_BOT:
            started = await chess_service.start_bot_match(
                user_id=identity.principal_id,
                username=identity.username or "player",
                payload=StartBotMatchRequest(play_as=payload.play_as),
            )
            match_state = await chess_service.get_match_state(
                user_id=identity.principal_id,
                match_id=started.match.match_id,
            )
            menu = await chess_service.get_menu(user_id=identity.principal_id)
            return ChessActionResponse(
                action=action,
                started_match=started,
                match_state=match_state,
                menu=menu,
            )

        if action == ChessAction.LOAD_MATCH:
            match_state = await chess_service.get_match_state(
                user_id=identity.principal_id,
                match_id=_require_value(payload.match_id, field_name="matchId"),
            )
            menu = await chess_service.get_menu(user_id=identity.principal_id)
            return ChessActionResponse(action=action, match_state=match_state, menu=menu)

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
            menu = await chess_service.get_menu(user_id=identity.principal_id)
            return ChessActionResponse(
                action=action,
                move_result=move_result,
                match_state=move_result.match,
                menu=menu,
            )

        raise HTTPException(status_code=400, detail="Unsupported chess action")
    except ChessServiceError as error:
        raise HTTPException(status_code=error.status_code, detail=error.message) from error
    except HTTPException:
        raise
    except Exception as error:  # noqa: BLE001
        logger.exception("Unhandled chess action error action=%s", payload.action)
        raise HTTPException(status_code=500, detail="Failed to handle chess action") from error
