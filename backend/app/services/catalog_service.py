from __future__ import annotations

from typing import Any

from motor.motor_asyncio import AsyncIOMotorCollection

from app.core.database import mongo_manager
from app.schemas.catalog import GameCard, GamesCatalogResponse, HomeContentResponse


DEFAULT_WORDLE_GAME: dict[str, str | int] = {
    "slug": "wordle",
    "name": "Wordle",
    "summary": "Guess the hidden five-letter word with color feedback and multiple difficulty pools.",
    "status": "playable",
    "accent": "from-violet-500 to-fuchsia-500",
    "estimated_session_minutes": 5,
}


def _require_games_collection() -> AsyncIOMotorCollection[dict[str, Any]]:
    if mongo_manager.db is None:
        raise RuntimeError("Mongo database is not initialized")

    return mongo_manager.db["games"]


async def _ensure_seed_data() -> None:
    collection = _require_games_collection()
    existing_wordle = await collection.find_one({"slug": DEFAULT_WORDLE_GAME["slug"]})
    if existing_wordle is None:
        await collection.insert_one(DEFAULT_WORDLE_GAME)
        return

    await collection.update_one(
        {"slug": DEFAULT_WORDLE_GAME["slug"]},
        {"$set": DEFAULT_WORDLE_GAME},
    )


async def _get_game_cards() -> list[GameCard]:
    collection = _require_games_collection()
    await _ensure_seed_data()
    game_documents = await collection.find({}, {"_id": 0}).to_list(length=100)
    return [GameCard.model_validate(document) for document in game_documents]


async def get_games_catalog() -> GamesCatalogResponse:
    return GamesCatalogResponse(items=await _get_game_cards())


async def get_home_content() -> HomeContentResponse:
    games = await _get_game_cards()
    return HomeContentResponse(
        hero_title="Build. Play. Break. Repeat.",
        hero_subtitle="A colorful experiment lab for browser games and weird interactive ideas.",
        featured_games=games,
        highlights=[
            "FastAPI backend as source of truth",
            "Next.js frontend with typed contracts",
            "Mongo-backed experiments and progression",
        ],
    )
