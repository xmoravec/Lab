# pyright: reportMissingImports=false

from __future__ import annotations

import pytest  # type: ignore[import-not-found]
from fastapi import HTTPException

from app.core.security import (  # type: ignore[import-not-found]
    hash_password,
    require_principal_identity,
    require_user_identity,
    verify_password,
)


@pytest.mark.core
def test_password_hash_round_trip() -> None:
    raw_password = "super-secret-pass"
    password_hash = hash_password(raw_password)

    assert password_hash != raw_password
    assert verify_password(raw_password, password_hash) is True
    assert verify_password("wrong-pass", password_hash) is False


@pytest.mark.core
def test_require_user_identity_rejects_blank_headers() -> None:
    with pytest.raises(HTTPException) as error:
        require_user_identity(x_user_id="  ", x_user_name="alice", x_user_email="alice@example.com")

    assert error.value.status_code == 401


@pytest.mark.core
def test_require_principal_identity_resolves_user_headers() -> None:
    identity = require_principal_identity(
        x_user_id="user-1",
        x_user_name="alice",
        x_user_email="alice@example.com",
        x_admin_mode="on",
    )

    assert identity.is_guest is False
    assert identity.principal_id == "user-1"
    assert identity.admin_mode_enabled is True


@pytest.mark.core
def test_require_principal_identity_resolves_guest_headers() -> None:
    identity = require_principal_identity(
        x_user_id=None,
        x_user_name=None,
        x_user_email=None,
        x_guest_id="guest-123",
    )

    assert identity.is_guest is True
    assert identity.principal_id == "guest:guest-123"
