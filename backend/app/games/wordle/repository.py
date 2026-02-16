from __future__ import annotations

from datetime import datetime, timezone
from typing import Any
from uuid import uuid4

from motor.motor_asyncio import AsyncIOMotorCollection

from app.core.database import mongo_manager
from app.games.wordle.schemas import WordleDifficulty, WordleGameStatus

COLLECTION_NAME = "wordle_games"


class WordleRepository:
    def _collection(self) -> AsyncIOMotorCollection[dict[str, Any]]:
        if mongo_manager.db is None:
            raise RuntimeError("Mongo database is not initialized")

        return mongo_manager.db[COLLECTION_NAME]

    async def create_game(
        self,
        difficulty: WordleDifficulty,
        target_word: str,
        max_attempts: int,
        word_length: int,
    ) -> dict[str, Any]:
        now = datetime.now(timezone.utc)
        game_document: dict[str, Any] = {
            "game_id": str(uuid4()),
            "difficulty": difficulty.value,
            "target_word": target_word,
            "status": WordleGameStatus.IN_PROGRESS.value,
            "max_attempts": max_attempts,
            "attempts_used": 0,
            "word_length": word_length,
            "attempts": [],
            "started_at": now,
            "completed_at": None,
        }
        await self._collection().insert_one(game_document)
        return game_document

    async def get_game(self, game_id: str) -> dict[str, Any] | None:
        return await self._collection().find_one({"game_id": game_id})

    async def save_game(self, game_document: dict[str, Any]) -> None:
        await self._collection().replace_one(
            {"game_id": game_document["game_id"]},
            game_document,
            upsert=False,
        )

    async def get_latest_in_progress(self) -> dict[str, Any] | None:
        return await self._collection().find_one(
            {"status": WordleGameStatus.IN_PROGRESS.value},
            sort=[("started_at", -1)],
        )

    async def list_recent_games(self, limit: int = 40) -> list[dict[str, Any]]:
        return await self._collection().find({}).sort("started_at", -1).to_list(length=limit)


wordle_repository = WordleRepository()
