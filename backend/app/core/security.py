from __future__ import annotations

import secrets
from dataclasses import dataclass

import bcrypt
from fastapi import Header, HTTPException, status

from app.core.config import settings


@dataclass(frozen=True)
class UserIdentity:
    user_id: str
    username: str
    email: str


@dataclass(frozen=True)
class PrincipalIdentity:
    principal_id: str
    is_guest: bool
    admin_mode_enabled: bool = False
    username: str | None = None
    email: str | None = None


def _normalized_non_empty(value: str | None) -> str | None:
    if value is None:
        return None

    normalized = value.strip()
    if not normalized:
        return None

    return normalized


def hash_password(password: str) -> str:
    hashed = bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt())
    return hashed.decode("utf-8")


def verify_password(password: str, password_hash: str) -> bool:
    try:
        is_valid = bcrypt.checkpw(password.encode("utf-8"), password_hash.encode("utf-8"))
        return is_valid
    except ValueError:
        return False


def require_internal_request(
    x_internal_auth: str | None = Header(default=None),
) -> None:
    if not x_internal_auth:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Missing internal auth")

    if not secrets.compare_digest(x_internal_auth, settings.internal_auth_secret):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Invalid internal auth")


def require_user_identity(
    x_user_id: str | None = Header(default=None),
    x_user_name: str | None = Header(default=None),
    x_user_email: str | None = Header(default=None),
) -> UserIdentity:
    normalized_user_id = _normalized_non_empty(x_user_id)
    normalized_user_name = _normalized_non_empty(x_user_name)
    normalized_user_email = _normalized_non_empty(x_user_email)

    if not normalized_user_id or not normalized_user_name or not normalized_user_email:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing authenticated user headers",
        )

    return UserIdentity(
        user_id=normalized_user_id,
        username=normalized_user_name,
        email=normalized_user_email.lower(),
    )


def require_principal_identity(
    x_user_id: str | None = Header(default=None),
    x_user_name: str | None = Header(default=None),
    x_user_email: str | None = Header(default=None),
    x_guest_id: str | None = Header(default=None),
    x_admin_mode: str | None = Header(default=None),
) -> PrincipalIdentity:
    normalized_user_id = _normalized_non_empty(x_user_id)
    normalized_user_name = _normalized_non_empty(x_user_name)
    normalized_user_email = _normalized_non_empty(x_user_email)

    if normalized_user_id and normalized_user_name and normalized_user_email:
        return PrincipalIdentity(
            principal_id=normalized_user_id,
            is_guest=False,
            admin_mode_enabled=bool(x_admin_mode and x_admin_mode.strip().lower() == "on"),
            username=normalized_user_name,
            email=normalized_user_email.lower(),
        )

    normalized_guest_id = _normalized_non_empty(x_guest_id)
    if normalized_guest_id:
        return PrincipalIdentity(
            principal_id=f"guest:{normalized_guest_id}",
            is_guest=True,
        )

    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Missing user or guest identity headers",
    )
