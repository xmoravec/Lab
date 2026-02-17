from __future__ import annotations

import logging

from fastapi import APIRouter, Depends, HTTPException

from app.core.security import UserIdentity, require_internal_request, require_user_identity
from app.schemas.auth import (
    CredentialsVerifyRequest,
    CredentialsVerifyResponse,
    GoogleUpsertRequest,
    RegisterAccountRequest,
    RegisterAccountResponse,
)
from app.services.auth_service import AuthServiceError, auth_service

router = APIRouter(prefix="/auth")
logger = logging.getLogger("uvicorn.error")


@router.post("/register", response_model=RegisterAccountResponse)
async def register_account(payload: RegisterAccountRequest) -> RegisterAccountResponse:
    try:
        account = await auth_service.register_credentials_user(
            email=str(payload.email),
            username=payload.username,
            password=payload.password,
        )
        return RegisterAccountResponse(account=account)
    except AuthServiceError as error:
        raise HTTPException(status_code=error.status_code, detail=error.message) from error
    except Exception as error:  # noqa: BLE001
        logger.exception("Unhandled account registration error email=%s", payload.email)
        raise HTTPException(status_code=500, detail="Failed to create account") from error


@router.post(
    "/credentials/verify",
    response_model=CredentialsVerifyResponse,
    dependencies=[Depends(require_internal_request)],
)
async def verify_credentials(payload: CredentialsVerifyRequest) -> CredentialsVerifyResponse:
    try:
        account = await auth_service.verify_credentials(email=str(payload.email), password=payload.password)
        if account is None:
            raise HTTPException(status_code=401, detail="Invalid email or password")

        return CredentialsVerifyResponse(account=account)
    except AuthServiceError as error:
        raise HTTPException(status_code=error.status_code, detail=error.message) from error
    except HTTPException:
        raise
    except Exception as error:  # noqa: BLE001
        logger.exception("Unhandled credentials verification error email=%s", payload.email)
        raise HTTPException(status_code=500, detail="Failed to verify credentials") from error


@router.post(
    "/oauth/google/upsert",
    response_model=CredentialsVerifyResponse,
    dependencies=[Depends(require_internal_request)],
)
async def upsert_google_account(payload: GoogleUpsertRequest) -> CredentialsVerifyResponse:
    try:
        account = await auth_service.upsert_google_user(
            provider_account_id=payload.provider_account_id,
            email=str(payload.email),
            username=payload.username,
            display_name=payload.display_name,
            avatar_url=payload.avatar_url,
        )
        return CredentialsVerifyResponse(account=account)
    except AuthServiceError as error:
        raise HTTPException(status_code=error.status_code, detail=error.message) from error
    except Exception as error:  # noqa: BLE001
        logger.exception("Unhandled google account upsert error email=%s", payload.email)
        raise HTTPException(status_code=500, detail="Failed to upsert google account") from error


@router.get(
    "/me",
    response_model=CredentialsVerifyResponse,
    dependencies=[Depends(require_internal_request)],
)
async def get_current_account(identity: UserIdentity = Depends(require_user_identity)) -> CredentialsVerifyResponse:
    try:
        account = await auth_service.get_user_by_id(identity.user_id)
        if account is None:
            raise HTTPException(status_code=404, detail="Account not found")
        return CredentialsVerifyResponse(account=account)
    except AuthServiceError as error:
        raise HTTPException(status_code=error.status_code, detail=error.message) from error
    except HTTPException:
        raise
    except Exception as error:  # noqa: BLE001
        logger.exception("Unhandled get account error user_id=%s", identity.user_id)
        raise HTTPException(status_code=500, detail="Failed to load account") from error
