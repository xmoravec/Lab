from __future__ import annotations

from typing import Any

from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase

from app.core.config import settings


class MongoManager:
    def __init__(self) -> None:
        self.client: AsyncIOMotorClient[Any] | None = None
        self.db: AsyncIOMotorDatabase[Any] | None = None
        self.connected: bool = False
        self.last_error: str | None = None

    async def connect(self) -> None:
        self.client = AsyncIOMotorClient(settings.mongo_uri)
        self.db = self.client[settings.mongo_db_name]
        await self.ping()

    async def disconnect(self) -> None:
        if self.client is not None:
            self.client.close()
        self.client = None
        self.db = None
        self.connected = False

    async def ping(self) -> bool:
        if self.client is None:
            self.connected = False
            self.last_error = "Mongo client is not initialized"
            return False

        try:
            await self.client.admin.command("ping")
            self.connected = True
            self.last_error = None
            return True
        except Exception as error:  # noqa: BLE001
            self.connected = False
            self.last_error = str(error)
            return False


mongo_manager = MongoManager()
