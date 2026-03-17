from __future__ import annotations

import time

from app.core.cache import cache_service


class RateLimitService:
    """
    Best-effort rate limiting.

    Uses Redis when available; otherwise falls back to an in-process counter.
    """

    def __init__(self) -> None:
        self._local: dict[str, tuple[int, float]] = {}

    def hit(self, *, key: str, limit: int, window_seconds: int) -> tuple[bool, int]:
        if limit <= 0:
            return True, 0

        redis_value = cache_service.incr_with_ttl(key, ttl_seconds=window_seconds)
        if redis_value is not None:
            return redis_value <= limit, max(0, limit - redis_value)

        now = time.time()
        current, expires_at = self._local.get(key, (0, now + window_seconds))
        if now > expires_at:
            current, expires_at = 0, now + window_seconds
        current += 1
        self._local[key] = (current, expires_at)
        return current <= limit, max(0, limit - current)


rate_limit_service = RateLimitService()

