from __future__ import annotations

from contextlib import asynccontextmanager
from collections.abc import AsyncIterator
import logging

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.api.router import api_router
from app.core.config import settings
from app.core.database import mongo_manager
from app.games.chess.service import chess_service
from app.services.catalog_service import ensure_catalog_seed_data
from app.services.status_reporter import report_status

logger = logging.getLogger("uvicorn.error")


@asynccontextmanager
async def lifespan(_: FastAPI) -> AsyncIterator[None]:
    await mongo_manager.connect()
    await chess_service.ensure_indexes()
    await ensure_catalog_seed_data()
    await report_status()
    try:
        yield
    finally:
        await mongo_manager.disconnect()


app = FastAPI(title=settings.app_name, lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router, prefix=settings.api_prefix)


@app.exception_handler(Exception)
async def unhandled_exception_handler(_: Request, error: Exception) -> JSONResponse:
    logger.exception("Unhandled backend exception", exc_info=error)
    return JSONResponse(
        status_code=500,
        content={"detail": "Internal server error"},
    )


@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, error: HTTPException) -> JSONResponse:
    if error.status_code >= 500:
        logger.error(
            "HTTP error status=%s method=%s path=%s detail=%s",
            error.status_code,
            request.method,
            request.url.path,
            error.detail,
        )
    else:
        logger.warning(
            "HTTP rejection status=%s method=%s path=%s detail=%s",
            error.status_code,
            request.method,
            request.url.path,
            error.detail,
        )

    return JSONResponse(
        status_code=error.status_code,
        content={"detail": error.detail},
    )


@app.get("/")
def root() -> dict[str, str]:
    return {"message": "Lab backend is running"}
