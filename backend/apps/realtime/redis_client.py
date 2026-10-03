from __future__ import annotations

from functools import lru_cache

from django.conf import settings
from redis import Redis
from redis.asyncio import Redis as AsyncRedis


@lru_cache(maxsize=1)
def sync_redis_client() -> Redis:
    return Redis.from_url(
        settings.REALTIME_REDIS_URL,
        decode_responses=True,
        socket_connect_timeout=settings.REALTIME_REDIS_CONNECT_TIMEOUT,
        socket_timeout=settings.REALTIME_REDIS_SOCKET_TIMEOUT,
        health_check_interval=30,
    )


def async_redis_client() -> AsyncRedis:
    # Un client par consommation de ticket évite de partager un client async
    # entre plusieurs boucles d'événements de serveurs/tests.
    return AsyncRedis.from_url(
        settings.REALTIME_REDIS_URL,
        decode_responses=True,
        socket_connect_timeout=settings.REALTIME_REDIS_CONNECT_TIMEOUT,
        socket_timeout=settings.REALTIME_REDIS_SOCKET_TIMEOUT,
        health_check_interval=30,
    )
