# pyright: reportMissingImports=false

from __future__ import annotations

import pytest  # type: ignore[import-not-found]
from fastapi import HTTPException  # type: ignore[import-not-found]

from app.api.routes.chess import _require_registered_identity  # type: ignore[import-not-found]
from app.core.security import PrincipalIdentity  # type: ignore[import-not-found]


@pytest.mark.games
def test_require_registered_identity_rejects_guest() -> None:
    identity = PrincipalIdentity(principal_id="guest:test", is_guest=True)

    with pytest.raises(HTTPException) as error_info:
        _require_registered_identity(identity)

    assert error_info.value.status_code == 401
    assert error_info.value.detail == "Sign in required for multiplayer"


@pytest.mark.games
def test_require_registered_identity_allows_authenticated_user() -> None:
    identity = PrincipalIdentity(
        principal_id="user-1",
        is_guest=False,
        username="player",
        email="player@example.com",
    )

    _require_registered_identity(identity)
