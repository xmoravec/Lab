from __future__ import annotations

import logging

from fastapi import APIRouter, Depends, HTTPException

from app.core.security import PrincipalIdentity, require_internal_request, require_principal_identity
from app.games.wordle.schemas import (
    GuessWordleRequest,
    GuessWordleResponse,
    StartWordleRequest,
    StartWordleResponse,
    WordleMenuResponse,
)
from app.games.wordle.service import WordleServiceError, wordle_service

router = APIRouter(prefix="/games/wordle")
logger = logging.getLogger("uvicorn.error")


async def _wordle_identity_dependency(
    _: None = Depends(require_internal_request),
    identity: PrincipalIdentity = Depends(require_principal_identity),
) -> PrincipalIdentity:
    return identity


@router.get("/menu", response_model=WordleMenuResponse)
async def get_wordle_menu(identity: PrincipalIdentity = Depends(_wordle_identity_dependency)) -> WordleMenuResponse:
    try:
        return await wordle_service.get_menu(user_id=identity.principal_id)
    except WordleServiceError as error:
        raise HTTPException(status_code=error.status_code, detail=error.message) from error
    except Exception as error:  # noqa: BLE001
        logger.exception("Unhandled wordle menu error")
        raise HTTPException(status_code=500, detail="Failed to load Wordle menu") from error


@router.post("/start", response_model=StartWordleResponse)
async def start_wordle_game(
    payload: StartWordleRequest,
    identity: PrincipalIdentity = Depends(_wordle_identity_dependency),
) -> StartWordleResponse:
    try:
        return await wordle_service.start_game(identity.principal_id, payload)
    except WordleServiceError as error:
        raise HTTPException(status_code=error.status_code, detail=error.message) from error
    except Exception as error:  # noqa: BLE001
        logger.exception("Unhandled wordle start error difficulty=%s", payload.difficulty.value)
        raise HTTPException(status_code=500, detail="Failed to start Wordle game") from error


@router.post("/guess", response_model=GuessWordleResponse)
async def submit_wordle_guess(
    payload: GuessWordleRequest,
    identity: PrincipalIdentity = Depends(_wordle_identity_dependency),
) -> GuessWordleResponse:
    try:
        return await wordle_service.submit_guess(identity.principal_id, payload)
    except WordleServiceError as error:
        raise HTTPException(status_code=error.status_code, detail=error.message) from error
    except Exception as error:  # noqa: BLE001
        logger.exception(
            "Unhandled wordle guess error game_id=%s guess=%s",
            payload.game_id,
            payload.guess,
        )
        raise HTTPException(status_code=500, detail="Unexpected error while evaluating guess") from error
