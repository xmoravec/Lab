from __future__ import annotations

from datetime import datetime, timezone

from pydantic import Field

from app.schemas.base import CamelModel


class HealthResponse(CamelModel):
    app_name: str
    status: str
    mongo_connected: bool
    mongo_database: str
    timestamp_utc: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class DatabasePingResponse(CamelModel):
    mongo_connected: bool
    error: str | None = None


class HelloRequest(CamelModel):
    name: str = Field(min_length=1, max_length=40)


class HelloResponse(CamelModel):
    message: str
    normalized_name: str
