from __future__ import annotations

from datetime import datetime

from pydantic import EmailStr, Field

from app.schemas.base import CamelModel


class RegisterAccountRequest(CamelModel):
    email: EmailStr
    username: str = Field(min_length=3, max_length=24, pattern=r"^[a-zA-Z0-9_]+$")
    password: str = Field(min_length=10, max_length=128)


class CredentialsVerifyRequest(CamelModel):
    email: EmailStr
    password: str = Field(min_length=1, max_length=128)


class GoogleUpsertRequest(CamelModel):
    provider_account_id: str = Field(min_length=1, max_length=128)
    email: EmailStr
    username: str = Field(min_length=3, max_length=24, pattern=r"^[a-zA-Z0-9_]+$")
    display_name: str = Field(min_length=1, max_length=120)
    avatar_url: str | None = None


class AuthUserResponse(CamelModel):
    user_id: str
    email: EmailStr
    username: str
    display_name: str
    avatar_url: str | None = None
    created_at: datetime


class RegisterAccountResponse(CamelModel):
    account: AuthUserResponse


class CredentialsVerifyResponse(CamelModel):
    account: AuthUserResponse
