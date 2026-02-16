from __future__ import annotations

from app.schemas.catalog import GameCard, GamesCatalogResponse, HomeContentResponse


def _games_seed() -> list[GameCard]:
    return [
        GameCard(
            slug="wordle",
            name="Wordle Prototype",
            summary="Guess the hidden word with color feedback. REST-first implementation in progress.",
            status="coming-soon",
            accent="from-violet-500 to-fuchsia-500",
            estimated_session_minutes=5,
        ),
    ]


def get_games_catalog() -> GamesCatalogResponse:
    return GamesCatalogResponse(items=_games_seed())


def get_home_content() -> HomeContentResponse:
    games = _games_seed()
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
