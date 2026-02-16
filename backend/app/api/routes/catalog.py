from __future__ import annotations

from fastapi import APIRouter

from app.schemas.catalog import GamesCatalogResponse, HomeContentResponse
from app.services.catalog_service import get_games_catalog, get_home_content

router = APIRouter()


@router.get("/games", response_model=GamesCatalogResponse)
async def games_catalog() -> GamesCatalogResponse:
    return await get_games_catalog()


@router.get("/home", response_model=HomeContentResponse)
async def home_content() -> HomeContentResponse:
    return await get_home_content()
