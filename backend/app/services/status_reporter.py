from __future__ import annotations

import json
import logging
import platform
from datetime import datetime, timezone
from importlib.metadata import PackageNotFoundError, version
from typing import Any

import httpx

from app.core.config import settings
from app.core.database import mongo_manager

logger = logging.getLogger("uvicorn.error")


def _package_version(package_name: str) -> str:
    try:
        return version(package_name)
    except PackageNotFoundError:
        return "unknown"


async def _probe_frontend(url: str, timeout_seconds: float) -> dict[str, Any]:
    try:
        async with httpx.AsyncClient(timeout=timeout_seconds) as client:
            response = await client.get(url)

        return {
            "reachable": response.is_success,
            "statusCode": response.status_code,
            "url": url,
        }
    except Exception as error:  # noqa: BLE001
        return {
            "reachable": False,
            "url": url,
            "error": str(error),
        }


async def report_status() -> dict[str, Any]:
    mongo_is_connected = await mongo_manager.ping()
    frontend_status = await _probe_frontend(
        settings.frontend_probe_url,
        settings.frontend_probe_timeout_seconds,
    )

    payload: dict[str, Any] = {
        "event": "application_ready",
        "timestampUtc": datetime.now(timezone.utc).isoformat(),
        "app": {
            "name": settings.app_name,
            "apiPrefix": settings.api_prefix,
            "pythonVersion": platform.python_version(),
        },
        "modules": {
            "fastapi": _package_version("fastapi"),
            "uvicorn": _package_version("uvicorn"),
            "pydanticSettings": _package_version("pydantic-settings"),
            "motor": _package_version("motor"),
            "httpx": _package_version("httpx"),
        },
        "connections": {
            "mongo": {
                "connected": mongo_is_connected,
                "database": settings.mongo_db_name,
                "uriConfigured": bool(settings.mongo_uri),
                "error": mongo_manager.last_error,
            },
            "frontend": frontend_status,
        },
        "cors": {
            "allowCredentials": True,
            "allowedOrigins": settings.cors_origins_list,
        },
    }

    pretty_payload = json.dumps(payload, indent=2, sort_keys=True, default=str)
    separator = "=" * 92
    logger.info(
        "\n%s\nAPP READY: %s\n%s\n%s\n%s",
        separator,
        settings.app_name,
        pretty_payload,
        separator,
        "",
    )
    return payload
