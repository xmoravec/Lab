from __future__ import annotations

import logging
from typing import NoReturn

from fastapi import HTTPException


def raise_http_from_service_error(*, status_code: int, message: str, error: Exception) -> NoReturn:
    raise HTTPException(status_code=status_code, detail=message) from error


def raise_internal_http_error(
    *,
    logger: logging.Logger,
    log_message: str,
    detail: str,
    error: Exception,
    log_args: tuple[object, ...] = (),
) -> NoReturn:
    logger.exception(log_message, *log_args)
    raise HTTPException(status_code=500, detail=detail) from error