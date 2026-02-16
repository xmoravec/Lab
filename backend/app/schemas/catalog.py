from __future__ import annotations

from pydantic import Field

from app.schemas.base import CamelModel


class GameCard(CamelModel):
    slug: str
    name: str
    summary: str
    status: str
    accent: str
    estimated_session_minutes: int = Field(ge=1)


class GamesCatalogResponse(CamelModel):
    items: list[GameCard]


class HomeContentResponse(CamelModel):
    hero_title: str
    hero_subtitle: str
    featured_games: list[GameCard]
    highlights: list[str]
