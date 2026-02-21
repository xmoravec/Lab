from __future__ import annotations

import logging

from fastapi import APIRouter, Depends, HTTPException

from app.api.error_utils import raise_internal_http_error
from app.core.rate_limit import build_rate_limiter
from app.tools.wordle_solver.schemas import WordleSolverRequest, WordleSolverResponse
from app.tools.wordle_solver.service import solve_wordle_constraints as solve_wordle_constraints_service

router = APIRouter(prefix="/tools/wordle_solver")
logger = logging.getLogger("uvicorn.error")
solver_rate_limit = build_rate_limiter(bucket="wordle-solver", limit=60, window_seconds=60)


@router.post("/solve", response_model=WordleSolverResponse, dependencies=[Depends(solver_rate_limit)])
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
