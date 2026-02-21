from __future__ import annotations

import logging

from fastapi import APIRouter, HTTPException

from app.api.error_utils import raise_internal_http_error
from app.tools.wordle_solver.schemas import WordleSolverRequest, WordleSolverResponse
from app.tools.wordle_solver.service import solve_wordle_constraints as solve_wordle_constraints_service

router = APIRouter(prefix="/tools/wordle_solver")
logger = logging.getLogger("uvicorn.error")


@router.post("/solve", response_model=WordleSolverResponse)
async def solve_wordle_constraints(payload: WordleSolverRequest) -> WordleSolverResponse:
    try:
        return await solve_wordle_constraints_service(payload)
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error
    except HTTPException:
        raise
    except Exception as error:  # noqa: BLE001
        raise_internal_http_error(
            logger=logger,
            log_message="Unhandled wordle solver error",
            detail="Failed to run Wordle solver",
            error=error,
        )
