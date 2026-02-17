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
    username: str | None = None
    email: str | None = None


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
    if not x_user_id or not x_user_name or not x_user_email:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing authenticated user headers",
        )

    return UserIdentity(
        user_id=x_user_id.strip(),
        username=x_user_name.strip(),
        email=x_user_email.strip().lower(),
    )


def require_principal_identity(
    x_user_id: str | None = Header(default=None),
    x_user_name: str | None = Header(default=None),
    x_user_email: str | None = Header(default=None),
    x_guest_id: str | None = Header(default=None),
) -> PrincipalIdentity:
    if x_user_id and x_user_name and x_user_email:
        return PrincipalIdentity(
            principal_id=x_user_id.strip(),
            is_guest=False,
            username=x_user_name.strip(),
            email=x_user_email.strip().lower(),
        )

    if x_guest_id and x_guest_id.strip():
        normalized_guest_id = x_guest_id.strip()
        return PrincipalIdentity(
            principal_id=f"guest:{normalized_guest_id}",
            is_guest=True,
        )

    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Missing user or guest identity headers",
    )
