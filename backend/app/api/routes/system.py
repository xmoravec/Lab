from __future__ import annotations

from fastapi import APIRouter, Depends

from app.core.config import settings
from app.core.database import mongo_manager
from app.core.rate_limit import build_rate_limiter, rate_limiter
from app.core.security import require_internal_request
from app.schemas.system import (
    DatabasePingResponse,
    HelloRequest,
    HelloResponse,
    HealthResponse,
)
from app.services.system_service import get_health_payload

router = APIRouter()
health_rate_limit = build_rate_limiter(bucket="system-health", limit=300, window_seconds=60)
db_ping_rate_limit = build_rate_limiter(bucket="system-db-ping", limit=30, window_seconds=60)
hello_rate_limit = build_rate_limiter(bucket="system-hello", limit=60, window_seconds=60)
rate_limit_stats_rate_limit = build_rate_limiter(bucket="system-rate-limit-stats", limit=30, window_seconds=60)


@router.get("/health", response_model=HealthResponse, dependencies=[Depends(health_rate_limit)])
def health() -> HealthResponse:
    return get_health_payload()


@router.get("/db/ping", response_model=DatabasePingResponse, dependencies=[Depends(db_ping_rate_limit)])
async def db_ping() -> DatabasePingResponse:
    is_connected = await mongo_manager.ping()
    error_message = None if settings.is_production_like else mongo_manager.last_error
    return DatabasePingResponse(
        mongo_connected=is_connected,
        error=error_message,
    )


@router.post("/hello", response_model=HelloResponse, dependencies=[Depends(hello_rate_limit)])
def hello(payload: HelloRequest) -> HelloResponse:
    normalized_name = payload.name.strip()
    return HelloResponse(
        message=f"Hello, {normalized_name}. Welcome to The Playground (Lab).",
        normalized_name=normalized_name,
    )


@router.get(
    "/rate-limit/stats",
    dependencies=[Depends(require_internal_request), Depends(rate_limit_stats_rate_limit)],
)
def rate_limit_stats() -> dict[str, object]:
    return rate_limiter.snapshot_stats()
