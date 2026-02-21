from __future__ import annotations

import hashlib
import logging
import time
from collections import deque
from dataclasses import dataclass
from threading import Lock

from fastapi import HTTPException, Request, Response, status


@dataclass(frozen=True)
class _RateLimitConfig:
    bucket: str
    limit: int
    window_seconds: int


logger = logging.getLogger("uvicorn.error")


class InMemoryRateLimiter:
    def __init__(self) -> None:
        self._events: dict[str, deque[float]] = {}
        self._blocked_total = 0
        self._blocked_by_bucket: dict[str, int] = {}
        self._recent_blocks: deque[dict[str, str | int]] = deque(maxlen=200)
        self._lock = Lock()

    @staticmethod
    def _hash_identity(value: str) -> str:
        return hashlib.sha256(value.encode("utf-8")).hexdigest()[:12]

    @staticmethod
    def _extract_client_ip(request: Request) -> str:
        forwarded_for = request.headers.get("x-forwarded-for")
        if forwarded_for:
            first_hop = forwarded_for.split(",", 1)[0].strip()
            if first_hop:
                return first_hop

        real_ip = request.headers.get("x-real-ip", "").strip()
        if real_ip:
            return real_ip

        if request.client and request.client.host:
            return request.client.host

        return "unknown"

    def _resolve_identity_key(self, request: Request) -> tuple[str, str]:
        user_id = request.headers.get("x-user-id", "").strip()
        if user_id:
            return (f"user:{user_id}", "user")

        guest_id = request.headers.get("x-guest-id", "").strip()
        if guest_id:
            return (f"guest:{guest_id}", "guest")

        return (f"ip:{self._extract_client_ip(request)}", "ip")

    @staticmethod
    def _safe_reset_seconds(*, oldest_event: float, now: float, window_seconds: int) -> int:
        elapsed = max(0.0, now - oldest_event)
        remaining = max(1.0, float(window_seconds) - elapsed)
        return int(remaining)

    @staticmethod
    def _build_headers(*, config: _RateLimitConfig, remaining: int, reset_seconds: int) -> dict[str, str]:
        return {
            "x-rate-limit-bucket": config.bucket,
            "x-rate-limit-limit": str(config.limit),
            "x-rate-limit-remaining": str(max(0, remaining)),
            "x-rate-limit-reset-seconds": str(max(0, reset_seconds)),
        }

    def enforce(self, request: Request, response: Response, config: _RateLimitConfig) -> None:
        now = time.monotonic()
        window_start = now - float(config.window_seconds)
        identity_key, identity_type = self._resolve_identity_key(request)
        key = f"{config.bucket}:{identity_key}"
        identity_hash = self._hash_identity(identity_key)

        with self._lock:
            events = self._events.get(key)
            if events is None:
                events = deque()
                self._events[key] = events

            while events and events[0] < window_start:
                events.popleft()

            current_count = len(events)
            if current_count >= config.limit:
                oldest_event = events[0]
                retry_after = self._safe_reset_seconds(
                    oldest_event=oldest_event,
                    now=now,
                    window_seconds=config.window_seconds,
                )
                blocked_headers = self._build_headers(
                    config=config,
                    remaining=0,
                    reset_seconds=retry_after,
                )
                blocked_headers["retry-after"] = str(retry_after)

                self._blocked_total += 1
                self._blocked_by_bucket[config.bucket] = self._blocked_by_bucket.get(config.bucket, 0) + 1
                self._recent_blocks.append(
                    {
                        "bucket": config.bucket,
                        "identityType": identity_type,
                        "identityHash": identity_hash,
                        "path": request.url.path,
                        "method": request.method,
                        "retryAfterSeconds": retry_after,
                    }
                )
                logger.warning(
                    "Rate limit exceeded bucket=%s path=%s method=%s identity_type=%s identity_hash=%s limit=%s retry_after=%ss",
                    config.bucket,
                    request.url.path,
                    request.method,
                    identity_type,
                    identity_hash,
                    config.limit,
                    retry_after,
                )
                raise HTTPException(
                    status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                    detail="Too many requests",
                    headers=blocked_headers,
                )

            events.append(now)
            new_count = len(events)
            remaining = max(0, config.limit - new_count)
            reset_seconds = config.window_seconds
            if events:
                reset_seconds = self._safe_reset_seconds(
                    oldest_event=events[0],
                    now=now,
                    window_seconds=config.window_seconds,
                )

        success_headers = self._build_headers(
            config=config,
            remaining=remaining,
            reset_seconds=reset_seconds,
        )
        for header_key, header_value in success_headers.items():
            response.headers[header_key] = header_value

    def snapshot_stats(self) -> dict[str, object]:
        with self._lock:
            return {
                "blockedTotal": self._blocked_total,
                "blockedByBucket": dict(self._blocked_by_bucket),
                "recentBlocks": list(self._recent_blocks),
            }


rate_limiter = InMemoryRateLimiter()


def build_rate_limiter(*, bucket: str, limit: int, window_seconds: int):
    config = _RateLimitConfig(bucket=bucket, limit=limit, window_seconds=window_seconds)

    async def _dependency(request: Request, response: Response) -> None:
        rate_limiter.enforce(request, response, config)

    return _dependency
