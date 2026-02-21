from __future__ import annotations

import logging

from fastapi import APIRouter, Depends, HTTPException

from app.api.error_utils import raise_http_from_service_error, raise_internal_http_error
from app.core.security import PrincipalIdentity, require_internal_request, require_principal_identity
from app.games.wordle.schemas import (
    GuessWordleRequest,
    GuessWordleResponse,
    StartWordleRequest,
    StartWordleResponse,
    WordleHintRequest,
    WordleHintResponse,
    WordleMenuResponse,
    WordleRevealAnswerRequest,
    WordleRevealAnswerResponse,
)
from app.games.wordle.service import (
    WordleServiceError,
    request_wordle_hint,
    reveal_wordle_answer,
    wordle_service,
)
from app.services.auth_service import auth_service

router = APIRouter(prefix="/games/wordle")
logger = logging.getLogger("uvicorn.error")


async def _wordle_identity_dependency(
    _: None = Depends(require_internal_request),
    identity: PrincipalIdentity = Depends(require_principal_identity),
) -> PrincipalIdentity:
    return identity


async def _wordle_admin_identity_dependency(
    identity: PrincipalIdentity = Depends(_wordle_identity_dependency),
) -> PrincipalIdentity:
    if identity.is_guest:
        raise HTTPException(status_code=403, detail="Admin privileges required")

    is_admin = await auth_service.is_user_admin(identity.principal_id)
    if not is_admin:
        raise HTTPException(status_code=403, detail="Admin privileges required")

    if not identity.admin_mode_enabled:
        raise HTTPException(status_code=403, detail="Admin mode is disabled")

    return identity


@router.get("/menu", response_model=WordleMenuResponse)
async def get_wordle_menu(identity: PrincipalIdentity = Depends(_wordle_identity_dependency)) -> WordleMenuResponse:
    try:
        return await wordle_service.get_menu(user_id=identity.principal_id)
    except WordleServiceError as error:
        raise_http_from_service_error(status_code=error.status_code, message=error.message, error=error)
    except Exception as error:  # noqa: BLE001
        raise_internal_http_error(
            logger=logger,
            log_message="Unhandled wordle menu error",
            detail="Failed to load Wordle menu",
            error=error,
        )


@router.post("/start", response_model=StartWordleResponse)
async def start_wordle_game(
    payload: StartWordleRequest,
    identity: PrincipalIdentity = Depends(_wordle_identity_dependency),
) -> StartWordleResponse:
    try:
        return await wordle_service.start_game(identity.principal_id, payload)
    except WordleServiceError as error:
        raise_http_from_service_error(status_code=error.status_code, message=error.message, error=error)
    except Exception as error:  # noqa: BLE001
        raise_internal_http_error(
            logger=logger,
            log_message="Unhandled wordle start error difficulty=%s",
            detail="Failed to start Wordle game",
            error=error,
            log_args=(payload.difficulty.value,),
        )


@router.post("/guess", response_model=GuessWordleResponse)
async def submit_wordle_guess(
    payload: GuessWordleRequest,
    identity: PrincipalIdentity = Depends(_wordle_identity_dependency),
) -> GuessWordleResponse:
    try:
        return await wordle_service.submit_guess(identity.principal_id, payload)
    except WordleServiceError as error:
        raise_http_from_service_error(status_code=error.status_code, message=error.message, error=error)
    except Exception as error:  # noqa: BLE001
        raise_internal_http_error(
            logger=logger,
            log_message="Unhandled wordle guess error game_id=%s guess=%s",
            detail="Unexpected error while evaluating guess",
            error=error,
            log_args=(payload.game_id, payload.guess),
        )


@router.post("/hint", response_model=WordleHintResponse)
async def request_wordle_hint_endpoint(
    payload: WordleHintRequest,
    identity: PrincipalIdentity = Depends(_wordle_identity_dependency),
) -> WordleHintResponse:
    try:
        return await request_wordle_hint(identity.principal_id, payload)
    except WordleServiceError as error:
        raise_http_from_service_error(status_code=error.status_code, message=error.message, error=error)
    except Exception as error:  # noqa: BLE001
        raise_internal_http_error(
            logger=logger,
            log_message="Unhandled wordle hint error game_id=%s",
            detail="Failed to get Wordle hint",
            error=error,
            log_args=(payload.game_id,),
        )


@router.post("/reveal-answer", response_model=WordleRevealAnswerResponse)
async def reveal_wordle_answer_endpoint(
    payload: WordleRevealAnswerRequest,
    identity: PrincipalIdentity = Depends(_wordle_admin_identity_dependency),
) -> WordleRevealAnswerResponse:
    try:
        return await reveal_wordle_answer(identity.principal_id, payload)
    except WordleServiceError as error:
        raise_http_from_service_error(status_code=error.status_code, message=error.message, error=error)
    except Exception as error:  # noqa: BLE001
        raise_internal_http_error(
            logger=logger,
            log_message="Unhandled wordle reveal error game_id=%s",
            detail="Failed to reveal Wordle answer",
            error=error,
            log_args=(payload.game_id,),
        )
