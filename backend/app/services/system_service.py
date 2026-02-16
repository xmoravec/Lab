from __future__ import annotations

from app.core.config import settings
from app.core.database import mongo_manager
from app.schemas.system import HealthResponse


def get_health_payload() -> HealthResponse:
    return HealthResponse(
        app_name=settings.app_name,
        status="ok",
        mongo_connected=mongo_manager.connected,
        mongo_database=settings.mongo_db_name,
    )
