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

DEFAULT_CHESS_GAME: dict[str, str | int] = {
    "slug": "chess",
    "name": "Chess",
    "summary": "Play traditional chess with account invitations, self-play, and a configurable built-in bot.",
    "status": "playable",
    "accent": "from-amber-500 to-orange-500",
    "estimated_session_minutes": 20,
}


def _require_games_collection() -> AsyncIOMotorCollection[dict[str, Any]]:
    if mongo_manager.db is None:
        raise RuntimeError("Mongo database is not initialized")

    return mongo_manager.db["games"]


async def _ensure_seed_data() -> None:
    collection = _require_games_collection()
    await collection.create_index("slug", unique=True, name="games_slug_unique")

    defaults = [DEFAULT_WORDLE_GAME, DEFAULT_CHESS_GAME]
    for game_defaults in defaults:
        existing_game = await collection.find_one({"slug": game_defaults["slug"]}, {"_id": 0})
        if existing_game is None:
            await collection.insert_one(game_defaults)
            continue

        if existing_game != game_defaults:
            await collection.update_one(
                {"slug": game_defaults["slug"]},
                {"$set": game_defaults},
            )


async def ensure_catalog_seed_data() -> None:
    await _ensure_seed_data()


async def _get_game_cards() -> list[GameCard]:
    collection = _require_games_collection()
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
            "Personalized accounts, history, and Wordle progression",
            "Global leaderboards with cross-game expansion path",
        ],
    )
