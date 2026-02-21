from __future__ import annotations

import logging

from fastapi import APIRouter, Depends, HTTPException

from app.api.error_utils import raise_http_from_service_error, raise_internal_http_error
from app.core.rate_limit import build_rate_limiter
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
register_rate_limit = build_rate_limiter(bucket="auth-register", limit=20, window_seconds=600)
credentials_verify_rate_limit = build_rate_limiter(bucket="auth-credentials-verify", limit=30, window_seconds=60)
google_upsert_rate_limit = build_rate_limiter(bucket="auth-google-upsert", limit=60, window_seconds=60)
me_rate_limit = build_rate_limiter(bucket="auth-me", limit=120, window_seconds=60)


@router.post("/register", response_model=RegisterAccountResponse, dependencies=[Depends(register_rate_limit)])
async def register_account(payload: RegisterAccountRequest) -> RegisterAccountResponse:
    try:
        account = await auth_service.register_credentials_user(
            email=str(payload.email),
            username=payload.username,
            password=payload.password,
        )
        return RegisterAccountResponse(account=account)
    except AuthServiceError as error:
        raise_http_from_service_error(status_code=error.status_code, message=error.message, error=error)
    except Exception as error:  # noqa: BLE001
        raise_internal_http_error(
            logger=logger,
            log_message="Unhandled account registration error email=%s",
            detail="Failed to create account",
            error=error,
            log_args=(payload.email,),
        )


@router.post(
    "/credentials/verify",
    response_model=CredentialsVerifyResponse,
    dependencies=[Depends(require_internal_request), Depends(credentials_verify_rate_limit)],
)
async def verify_credentials(payload: CredentialsVerifyRequest) -> CredentialsVerifyResponse:
    try:
        account = await auth_service.verify_credentials(email=str(payload.email), password=payload.password)
        if account is None:
            raise HTTPException(status_code=401, detail="Invalid email or password")

        return CredentialsVerifyResponse(account=account)
    except AuthServiceError as error:
        raise_http_from_service_error(status_code=error.status_code, message=error.message, error=error)
    except HTTPException:
        raise
    except Exception as error:  # noqa: BLE001
        raise_internal_http_error(
            logger=logger,
            log_message="Unhandled credentials verification error email=%s",
            detail="Failed to verify credentials",
            error=error,
            log_args=(payload.email,),
        )


@router.post(
    "/oauth/google/upsert",
    response_model=CredentialsVerifyResponse,
    dependencies=[Depends(require_internal_request), Depends(google_upsert_rate_limit)],
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
        raise_http_from_service_error(status_code=error.status_code, message=error.message, error=error)
    except Exception as error:  # noqa: BLE001
        raise_internal_http_error(
            logger=logger,
            log_message="Unhandled google account upsert error email=%s",
            detail="Failed to upsert google account",
            error=error,
            log_args=(payload.email,),
        )


@router.get(
    "/me",
    response_model=CredentialsVerifyResponse,
    dependencies=[Depends(require_internal_request), Depends(me_rate_limit)],
)
async def get_current_account(identity: UserIdentity = Depends(require_user_identity)) -> CredentialsVerifyResponse:
    try:
        account = await auth_service.get_user_by_id(identity.user_id)
        if account is None:
            raise HTTPException(status_code=404, detail="Account not found")
        return CredentialsVerifyResponse(account=account)
    except AuthServiceError as error:
        raise_http_from_service_error(status_code=error.status_code, message=error.message, error=error)
    except HTTPException:
        raise
    except Exception as error:  # noqa: BLE001
        raise_internal_http_error(
            logger=logger,
            log_message="Unhandled get account error user_id=%s",
            detail="Failed to load account",
            error=error,
            log_args=(identity.user_id,),
        )
