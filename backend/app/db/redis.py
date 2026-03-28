"""Shared async Redis connection pool for TenderGuard Pro."""
import logging

from redis.asyncio import ConnectionPool, Redis

from app.core.config import settings

logger = logging.getLogger("tenderguard.redis")

_pool: ConnectionPool | None = None


def get_pool() -> ConnectionPool:
    """Return (or lazily create) the shared Redis connection pool."""
    global _pool
    if _pool is None:
        _pool = ConnectionPool.from_url(
            settings.REDIS_URL,
            decode_responses=True,
            max_connections=20,
        )
        logger.info("redis_pool_created url=%s", settings.REDIS_URL)
    return _pool


def get_redis() -> Redis:
    """Return a Redis client backed by the shared pool (no I/O at call time)."""
    return Redis(connection_pool=get_pool())


async def close_pool() -> None:
    """Disconnect the pool gracefully on shutdown."""
    global _pool
    if _pool is not None:
        await _pool.disconnect()
        _pool = None
        logger.info("redis_pool_closed")
