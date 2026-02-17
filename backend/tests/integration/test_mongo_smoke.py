# pyright: reportMissingImports=false

from __future__ import annotations

import os
from datetime import datetime, timezone
from typing import Any
from uuid import uuid4

import pytest  # type: ignore[import-not-found]
from motor.motor_asyncio import AsyncIOMotorClient

from app.core.config import settings  # type: ignore[import-not-found]


def _resolve_smoke_mongo_uri() -> str:
    explicit_uri = os.getenv("TEST_MONGO_URI")
    if explicit_uri:
        return explicit_uri

    configured_uri = settings.mongo_uri
    if "://mongo:" in configured_uri:
        return configured_uri.replace("://mongo:", "://localhost:")
    if "://mongo/" in configured_uri:
        return configured_uri.replace("://mongo/", "://localhost/")

    return configured_uri


@pytest.mark.integration
@pytest.mark.smoke
@pytest.mark.asyncio
async def test_users_collection_smoke_has_readable_data() -> None:
    client: AsyncIOMotorClient[Any] = AsyncIOMotorClient(
        _resolve_smoke_mongo_uri(),
        serverSelectionTimeoutMS=5000,
    )
    await client.admin.command("ping")

    users_collection = client[settings.mongo_db_name]["users"]

    seeded_user_id = f"test-smoke-{uuid4()}"
    await users_collection.insert_one(
        {
            "user_id": seeded_user_id,
            "email": f"{seeded_user_id}@example.com",
            "username": seeded_user_id,
            "display_name": seeded_user_id,
            "password_hash": None,
            "providerAccounts": {},
            "created_at": datetime.now(timezone.utc),
            "updated_at": datetime.now(timezone.utc),
            "is_admin": False,
        },
    )

    users = await users_collection.find({}, {"_id": 0, "user_id": 1, "email": 1, "username": 1}).to_list(length=50)

    assert len(users) > 0
    assert any(isinstance(user.get("username"), str) and user.get("username") for user in users)

    await users_collection.delete_one({"user_id": seeded_user_id})
    client.close()
