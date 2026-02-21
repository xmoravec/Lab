from __future__ import annotations

from datetime import datetime, timezone
from typing import Any
from uuid import uuid4

from motor.motor_asyncio import AsyncIOMotorCollection

from app.core.database import mongo_manager
from app.games.wordle.schemas import WordleDifficulty, WordleGameStatus

COLLECTION_NAME = "wordle_games"


class WordleRepository:
    def __init__(self) -> None:
        self._guest_games_by_user: dict[str, dict[str, dict[str, Any]]] = {}
        self._indexes_ready = False

    @staticmethod
    def _is_guest_user(user_id: str) -> bool:
        return user_id.startswith("guest:")

    def _guest_bucket(self, user_id: str) -> dict[str, dict[str, Any]]:
        bucket = self._guest_games_by_user.get(user_id)
        if bucket is None:
            bucket = {}
            self._guest_games_by_user[user_id] = bucket
        return bucket

    def _collection(self) -> AsyncIOMotorCollection[dict[str, Any]]:
        if mongo_manager.db is None:
            raise RuntimeError("Mongo database is not initialized")

        return mongo_manager.db[COLLECTION_NAME]

    async def ensure_indexes(self) -> None:
        if self._indexes_ready:
            return

        collection = self._collection()
        await collection.create_index("game_id", unique=True, name="wordle_game_id_unique")
        await collection.create_index(
            [("user_id", 1), ("status", 1), ("started_at", -1)],
            name="wordle_user_status_started",
        )
        await collection.create_index(
            [("user_id", 1), ("started_at", -1)],
            name="wordle_user_started",
        )
        self._indexes_ready = True

    async def create_game(
        self,
        user_id: str,
        difficulty: WordleDifficulty,
        target_word: str,
        max_attempts: int,
        word_length: int,
    ) -> dict[str, Any]:
        now = datetime.now(timezone.utc)
        game_document: dict[str, Any] = {
            "game_id": str(uuid4()),
            "user_id": user_id,
            "difficulty": difficulty.value,
            "target_word": target_word,
            "status": WordleGameStatus.IN_PROGRESS.value,
            "max_attempts": max_attempts,
            "attempts_used": 0,
            "word_length": word_length,
            "attempts": [],
            "hint_used": False,
            "hint_letter_index": None,
            "hint_letter": None,
            "admin_answer_revealed": False,
            "started_at": now,
            "completed_at": None,
        }
        if self._is_guest_user(user_id):
            self._guest_bucket(user_id)[game_document["game_id"]] = game_document
            return game_document

        await self._collection().insert_one(game_document)
        return game_document

    async def get_game(self, game_id: str, user_id: str) -> dict[str, Any] | None:
        if self._is_guest_user(user_id):
            return self._guest_bucket(user_id).get(game_id)

        return await self._collection().find_one({"game_id": game_id, "user_id": user_id})

    async def get_game_for_admin(self, game_id: str) -> dict[str, Any] | None:
        for guest_bucket in self._guest_games_by_user.values():
            guest_game = guest_bucket.get(game_id)
            if guest_game is not None:
                return guest_game

        return await self._collection().find_one({"game_id": game_id})

    async def save_game(self, game_document: dict[str, Any]) -> None:
        user_id = str(game_document["user_id"])
        if self._is_guest_user(user_id):
            self._guest_bucket(user_id)[str(game_document["game_id"])] = game_document
            return

        await self._collection().replace_one(
            {"game_id": game_document["game_id"], "user_id": game_document["user_id"]},
            game_document,
            upsert=False,
        )

    async def get_latest_in_progress(self, user_id: str) -> dict[str, Any] | None:
        if self._is_guest_user(user_id):
            in_progress_games = [
                game
                for game in self._guest_bucket(user_id).values()
                if game["status"] == WordleGameStatus.IN_PROGRESS.value
            ]
            if not in_progress_games:
                return None
            return max(in_progress_games, key=lambda game: game["started_at"])

        return await self._collection().find_one(
            {"status": WordleGameStatus.IN_PROGRESS.value, "user_id": user_id},
            sort=[("started_at", -1)],
        )

    async def list_recent_games(self, limit: int = 40) -> list[dict[str, Any]]:
        return await self._collection().find({}).sort("started_at", -1).to_list(length=limit)

    async def list_recent_finished_games(self, user_id: str, limit: int = 40) -> list[dict[str, Any]]:
        if self._is_guest_user(user_id):
            finished_games = [
                game
                for game in self._guest_bucket(user_id).values()
                if game["status"] in {WordleGameStatus.WON.value, WordleGameStatus.LOST.value}
            ]
            return sorted(finished_games, key=lambda game: game["started_at"], reverse=True)[:limit]

        return await self._collection().find(
            {
                "user_id": user_id,
                "status": {"$in": [WordleGameStatus.WON.value, WordleGameStatus.LOST.value]},
            },
        ).sort("started_at", -1).to_list(length=limit)


wordle_repository = WordleRepository()
