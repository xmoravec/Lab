from __future__ import annotations

import json
from typing import Any

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "Lab API"
    api_prefix: str = "/api"

    mongo_uri: str = "mongodb://mongo:27017/lab"
    mongo_db_name: str = "lab"
    frontend_probe_url: str = "http://frontend:3000"
    frontend_probe_timeout_seconds: float = 1.5

    cors_origins: str = "http://localhost:3000,http://127.0.0.1:3000"

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    @field_validator("cors_origins", mode="before")
    @classmethod
    def parse_cors_origins(cls, value: Any) -> str:
        if isinstance(value, list):
            return ",".join(str(origin).strip() for origin in value if str(origin).strip())

        if isinstance(value, str):
            return value.strip()

        raise ValueError("CORS_ORIGINS must be a string or list")

    @property
    def cors_origins_list(self) -> list[str]:
        raw_value = self.cors_origins.strip()
        if not raw_value:
            return []

        if raw_value.startswith("["):
            try:
                parsed = json.loads(raw_value)
                if isinstance(parsed, list):
                    return [str(origin).strip() for origin in parsed if str(origin).strip()]
            except json.JSONDecodeError:
                pass

        return [origin.strip() for origin in raw_value.split(",") if origin.strip()]


settings = Settings()
