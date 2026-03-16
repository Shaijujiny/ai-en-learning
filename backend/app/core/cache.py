import hashlib
import json
from typing import Any

from redis import Redis
from redis.exceptions import RedisError

from app.core.config import settings
from app.core.logging import error_logger


class CacheService:
    def __init__(self) -> None:
        self._client = Redis.from_url(settings.redis_url, decode_responses=True) if settings.redis_url else None

    @property
    def enabled(self) -> bool:
        return self._client is not None

    def make_key(self, prefix: str, value: str) -> str:
        digest = hashlib.sha256(value.encode("utf-8")).hexdigest()
        return f"{prefix}:{digest}"

    def get_json(self, key: str) -> dict[str, Any] | None:
        if self._client is None:
            return None
        try:
            value = self._client.get(key)
        except RedisError:
            error_logger.exception("redis_get_failed key=%s", key)
            return None
        if value is None:
            return None
        return json.loads(value)

    def set_json(self, key: str, value: dict[str, Any], ttl_seconds: int) -> None:
        if self._client is None:
            return
        try:
            self._client.setex(key, ttl_seconds, json.dumps(value))
        except RedisError:
            error_logger.exception("redis_set_failed key=%s", key)

    def get_string(self, key: str) -> str | None:
        if self._client is None:
            return None
        try:
            return self._client.get(key)
        except RedisError:
            error_logger.exception("redis_get_failed key=%s", key)
            return None

    def set_string(self, key: str, value: str, ttl_seconds: int) -> None:
        if self._client is None:
            return
        try:
            self._client.setex(key, ttl_seconds, value)
        except RedisError:
            error_logger.exception("redis_set_failed key=%s", key)


cache_service = CacheService()
