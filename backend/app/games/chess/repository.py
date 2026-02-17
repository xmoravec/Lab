from __future__ import annotations

from datetime import datetime, timezone
from typing import Any
from uuid import uuid4

from motor.motor_asyncio import AsyncIOMotorCollection

from app.core.database import mongo_manager
from app.games.chess.schemas import (
    ChessInvitationStatus,
    ChessMatchStatus,
    InvitationColorPreference,
)

INVITATIONS_COLLECTION = "chess_invitations"
MATCHES_COLLECTION = "chess_matches"


class ChessRepository:
    def __init__(self) -> None:
        self._indexes_ready = False

    def _invitations(self) -> AsyncIOMotorCollection[dict[str, Any]]:
        if mongo_manager.db is None:
            raise RuntimeError("Mongo database is not initialized")
        return mongo_manager.db[INVITATIONS_COLLECTION]

    def _matches(self) -> AsyncIOMotorCollection[dict[str, Any]]:
        if mongo_manager.db is None:
            raise RuntimeError("Mongo database is not initialized")
        return mongo_manager.db[MATCHES_COLLECTION]

    async def ensure_indexes(self) -> None:
        if self._indexes_ready:
            return

        await self._invitations().create_index("invitation_id", unique=True, name="chess_invitation_id_unique")
        await self._invitations().create_index(
            [("to_user_id", 1), ("status", 1), ("created_at", -1)],
            name="chess_invitation_incoming_status_created",
        )
        await self._invitations().create_index(
            [("from_user_id", 1), ("status", 1), ("created_at", -1)],
            name="chess_invitation_outgoing_status_created",
        )

        await self._matches().create_index("match_id", unique=True, name="chess_match_id_unique")
        await self._matches().create_index(
            [("participants", 1), ("status", 1), ("updated_at", -1)],
            name="chess_match_participants_status_updated",
        )
        self._indexes_ready = True

    async def create_invitation(
        self,
        *,
        from_user_id: str,
        from_username: str,
        to_user_id: str,
        to_username: str,
        color_preference: InvitationColorPreference,
    ) -> dict[str, Any]:
        now = datetime.now(timezone.utc)
        invitation: dict[str, Any] = {
            "invitation_id": str(uuid4()),
            "from_user_id": from_user_id,
            "from_username": from_username,
            "to_user_id": to_user_id,
            "to_username": to_username,
            "color_preference": color_preference.value,
            "status": ChessInvitationStatus.PENDING.value,
            "created_at": now,
            "responded_at": None,
            "match_id": None,
        }
        await self._invitations().insert_one(invitation)
        return invitation

    async def get_pending_between_users(self, *, user_a: str, user_b: str) -> dict[str, Any] | None:
        return await self._invitations().find_one(
            {
                "$or": [
                    {"from_user_id": user_a, "to_user_id": user_b},
                    {"from_user_id": user_b, "to_user_id": user_a},
                ],
                "status": ChessInvitationStatus.PENDING.value,
            },
            sort=[("created_at", -1)],
        )

    async def list_incoming_invitations(self, *, user_id: str, limit: int = 30) -> list[dict[str, Any]]:
        return await self._invitations().find(
            {
                "to_user_id": user_id,
                "status": ChessInvitationStatus.PENDING.value,
            },
        ).sort("created_at", -1).to_list(length=limit)

    async def list_outgoing_invitations(self, *, user_id: str, limit: int = 30) -> list[dict[str, Any]]:
        return await self._invitations().find(
            {
                "from_user_id": user_id,
                "status": ChessInvitationStatus.PENDING.value,
            },
        ).sort("created_at", -1).to_list(length=limit)

    async def get_invitation_for_user(self, *, invitation_id: str, user_id: str) -> dict[str, Any] | None:
        return await self._invitations().find_one(
            {
                "invitation_id": invitation_id,
                "$or": [{"to_user_id": user_id}, {"from_user_id": user_id}],
            },
        )

    async def respond_to_invitation(
        self,
        *,
        invitation_id: str,
        expected_user_id: str,
        accepted: bool,
        match_id: str | None,
    ) -> bool:
        now = datetime.now(timezone.utc)
        status = ChessInvitationStatus.ACCEPTED.value if accepted else ChessInvitationStatus.DECLINED.value
        result = await self._invitations().update_one(
            {
                "invitation_id": invitation_id,
                "to_user_id": expected_user_id,
                "status": ChessInvitationStatus.PENDING.value,
            },
            {
                "$set": {
                    "status": status,
                    "responded_at": now,
                    "match_id": match_id,
                },
            },
        )
        return result.modified_count == 1

    async def create_match(
        self,
        *,
        mode: str,
        white_user_id: str | None,
        white_username: str,
        black_user_id: str | None,
        black_username: str,
        fen: str,
    ) -> dict[str, Any]:
        now = datetime.now(timezone.utc)
        participants = [value for value in [white_user_id, black_user_id] if isinstance(value, str) and value]
        match: dict[str, Any] = {
            "match_id": str(uuid4()),
            "mode": mode,
            "status": ChessMatchStatus.ACTIVE.value,
            "white_user_id": white_user_id,
            "white_username": white_username,
            "black_user_id": black_user_id,
            "black_username": black_username,
            "turn_color": "white",
            "fen": fen,
            "history": [],
            "result": "*",
            "winner_user_id": None,
            "participants": participants,
            "created_at": now,
            "updated_at": now,
        }
        await self._matches().insert_one(match)
        return match

    async def get_match(self, *, match_id: str) -> dict[str, Any] | None:
        return await self._matches().find_one({"match_id": match_id})

    async def save_match(self, match: dict[str, Any]) -> None:
        await self._matches().replace_one({"match_id": match["match_id"]}, match, upsert=False)

    async def list_active_matches_for_user(self, *, user_id: str, limit: int = 30) -> list[dict[str, Any]]:
        return await self._matches().find(
            {
                "participants": user_id,
                "status": ChessMatchStatus.ACTIVE.value,
            },
        ).sort("updated_at", -1).to_list(length=limit)


chess_repository = ChessRepository()
