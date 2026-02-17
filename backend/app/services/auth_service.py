from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Any
from uuid import uuid4

from motor.motor_asyncio import AsyncIOMotorCollection
from pymongo.errors import DuplicateKeyError

from app.core.database import mongo_manager
from app.core.security import hash_password, verify_password
from app.schemas.auth import AuthUserResponse

logger = logging.getLogger("uvicorn.error")

USERS_COLLECTION_NAME = "users"


class AuthServiceError(Exception):
    def __init__(self, status_code: int, message: str) -> None:
        self.status_code = status_code
        self.message = message
        super().__init__(message)


class AuthService:
    def __init__(self) -> None:
        self._indexes_ready = False

    def _collection(self) -> AsyncIOMotorCollection[dict[str, Any]]:
        if mongo_manager.db is None:
            raise RuntimeError("Mongo database is not initialized")

        return mongo_manager.db[USERS_COLLECTION_NAME]

    async def _ensure_indexes(self) -> None:
        if self._indexes_ready:
            return

        collection = self._collection()
        await collection.create_index("email", unique=True, name="users_email_unique")
        await collection.create_index("username", unique=True, name="users_username_unique")
        await collection.create_index("providerAccounts.google", unique=True, sparse=True)
        self._indexes_ready = True

    @staticmethod
    def _to_auth_user(document: dict[str, Any]) -> AuthUserResponse:
        return AuthUserResponse(
            user_id=document["user_id"],
            email=document["email"],
            username=document["username"],
            display_name=document["display_name"],
            avatar_url=document.get("avatar_url"),
            created_at=document["created_at"],
            is_admin=bool(document.get("is_admin", False)),
        )

    async def _ensure_unique_username(self, base_username: str) -> str:
        collection = self._collection()
        normalized = base_username.strip()
        if not normalized:
            normalized = "player"

        if await collection.find_one({"username": normalized}) is None:
            return normalized

        for index in range(1, 1000):
            candidate = f"{normalized}_{index}"
            if await collection.find_one({"username": candidate}) is None:
                return candidate

        raise AuthServiceError(status_code=500, message="Unable to allocate unique username")

    async def register_credentials_user(self, *, email: str, username: str, password: str) -> AuthUserResponse:
        await self._ensure_indexes()
        collection = self._collection()

        now = datetime.now(timezone.utc)
        document: dict[str, Any] = {
            "user_id": str(uuid4()),
            "email": email.strip().lower(),
            "username": username.strip(),
            "display_name": username.strip(),
            "avatar_url": None,
            "password_hash": hash_password(password),
            "providerAccounts": {},
            "created_at": now,
            "updated_at": now,
            "is_admin": False,
        }

        try:
            await collection.insert_one(document)
        except DuplicateKeyError as error:
            logger.warning("Duplicate account registration email=%s username=%s", email, username)
            raise AuthServiceError(status_code=409, message="Email or username already exists") from error

        return self._to_auth_user(document)

    async def verify_credentials(self, *, email: str, password: str) -> AuthUserResponse | None:
        await self._ensure_indexes()
        collection = self._collection()

        document = await collection.find_one({"email": email.strip().lower()})
        if document is None:
            return None

        password_hash = document.get("password_hash")
        if not isinstance(password_hash, str) or not verify_password(password, password_hash):
            return None

        return self._to_auth_user(document)

    async def upsert_google_user(
        self,
        *,
        provider_account_id: str,
        email: str,
        username: str,
        display_name: str,
        avatar_url: str | None,
    ) -> AuthUserResponse:
        await self._ensure_indexes()
        collection = self._collection()

        normalized_email = email.strip().lower()
        normalized_username = username.strip()
        now = datetime.now(timezone.utc)

        existing_by_provider = await collection.find_one({"providerAccounts.google": provider_account_id})
        if existing_by_provider is not None:
            await collection.update_one(
                {"_id": existing_by_provider["_id"]},
                {
                    "$set": {
                        "email": normalized_email,
                        "display_name": display_name.strip(),
                        "avatar_url": avatar_url,
                        "updated_at": now,
                    },
                },
            )
            refreshed = await collection.find_one({"_id": existing_by_provider["_id"]})
            if refreshed is None:
                raise AuthServiceError(status_code=500, message="Failed to refresh google account")
            return self._to_auth_user(refreshed)

        existing_by_email = await collection.find_one({"email": normalized_email})
        if existing_by_email is not None:
            await collection.update_one(
                {"_id": existing_by_email["_id"]},
                {
                    "$set": {
                        "providerAccounts.google": provider_account_id,
                        "display_name": display_name.strip(),
                        "avatar_url": avatar_url,
                        "updated_at": now,
                    },
                },
            )
            refreshed = await collection.find_one({"_id": existing_by_email["_id"]})
            if refreshed is None:
                raise AuthServiceError(status_code=500, message="Failed to refresh linked google account")
            return self._to_auth_user(refreshed)

        new_document: dict[str, Any] = {
            "user_id": str(uuid4()),
            "email": normalized_email,
            "username": await self._ensure_unique_username(normalized_username),
            "display_name": display_name.strip(),
            "avatar_url": avatar_url,
            "password_hash": None,
            "providerAccounts": {"google": provider_account_id},
            "created_at": now,
            "updated_at": now,
            "is_admin": False,
        }

        try:
            await collection.insert_one(new_document)
        except DuplicateKeyError as error:
            raise AuthServiceError(status_code=409, message="Account already exists") from error

        return self._to_auth_user(new_document)

    async def get_user_by_id(self, user_id: str) -> AuthUserResponse | None:
        await self._ensure_indexes()
        document = await self._collection().find_one({"user_id": user_id})
        if document is None:
            return None
        return self._to_auth_user(document)

    async def is_user_admin(self, user_id: str) -> bool:
        await self._ensure_indexes()
        document = await self._collection().find_one({"user_id": user_id, "is_admin": True})
        if document is None:
            return False
        return bool(document.get("is_admin", False))


auth_service = AuthService()
