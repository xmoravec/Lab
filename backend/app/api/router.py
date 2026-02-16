from __future__ import annotations

from fastapi import APIRouter

from app.api.routes import catalog
from app.api.routes import system

api_router = APIRouter()
api_router.include_router(catalog.router, prefix="", tags=["catalog"])
api_router.include_router(system.router, prefix="", tags=["system"])
