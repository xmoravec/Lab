from __future__ import annotations

from fastapi import APIRouter

from app.core.database import mongo_manager
from app.schemas.system import (
    DatabasePingResponse,
    HelloRequest,
    HelloResponse,
    HealthResponse,
)
from app.services.system_service import get_health_payload

router = APIRouter()


@router.get("/health", response_model=HealthResponse)
def health() -> HealthResponse:
    return get_health_payload()


@router.get("/db/ping", response_model=DatabasePingResponse)
async def db_ping() -> DatabasePingResponse:
    is_connected = await mongo_manager.ping()
    return DatabasePingResponse(
        mongo_connected=is_connected,
        error=mongo_manager.last_error,
    )


@router.post("/hello", response_model=HelloResponse)
def hello(payload: HelloRequest) -> HelloResponse:
    normalized_name = payload.name.strip()
    return HelloResponse(
        message=f"Hello, {normalized_name}. Welcome to The Playground (Lab).",
        normalized_name=normalized_name,
    )
