"""
Rate Limiting Middleware
========================
Controle de taxa de requisições via Redis (sliding window).
Funciona corretamente em ambientes com múltiplas instâncias.
"""

import time
from typing import Any, Callable, cast

import redis as redis_lib
import structlog
from fastapi import Request, Response, status
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware

from app.core.settings import settings

logger = structlog.get_logger()

# Cliente Redis — lazy init para evitar falha no import se Redis estiver indisponível
_redis_client: redis_lib.Redis | None = None


def _get_redis() -> redis_lib.Redis | None:
    global _redis_client
    if _redis_client is None:
        try:
            _redis_client = redis_lib.from_url(
                settings.redis_url,
                decode_responses=True,
                socket_connect_timeout=1,
                socket_timeout=1,
            )
            _redis_client.ping()
        except Exception as e:
            logger.warning("redis_unavailable", error=str(e), fallback="in-memory")
            _redis_client = None
    return _redis_client


# Fallback em memória quando Redis não está disponível
_fallback_cache: dict[str, list[float]] = {}


class RateLimitMiddleware(BaseHTTPMiddleware):
    """Middleware de rate limiting com backend Redis (fallback em memória)."""

    async def dispatch(self, request: Request, call_next: Callable[..., Any]) -> Response:
        if not settings.rate_limit_enabled:
            return cast(Response, await call_next(request))

        client_id = self._get_client_id(request)

        if self._is_rate_limited(client_id):
            logger.warning(
                "rate_limit_exceeded",
                client_id=client_id,
                path=request.url.path,
            )
            return JSONResponse(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                content={
                    "detail": {
                        "error": "rate_limit_exceeded",
                        "message": "Muitas requisições. Tente novamente em alguns minutos.",
                    }
                },
            )

        response: Response = await call_next(request)
        return response

    def _get_client_id(self, request: Request) -> str:
        auth = request.headers.get("authorization", "")
        if auth.startswith("Bearer "):
            token_part = auth[7:27] if len(auth) > 27 else auth[7:]
            return f"token:{hash(token_part)}"

        forwarded = request.headers.get("x-forwarded-for")
        if forwarded:
            return f"ip:{forwarded.split(',')[0].strip()}"

        if request.client:
            return f"ip:{request.client.host}"

        return "ip:unknown"

    def _is_rate_limited(self, client_id: str) -> bool:
        redis = _get_redis()
        if redis is not None:
            return self._redis_is_rate_limited(redis, client_id)
        return self._memory_is_rate_limited(client_id)

    def _redis_is_rate_limited(self, redis: redis_lib.Redis, client_id: str) -> bool:
        """Sliding window via Redis INCR + EXPIRE."""
        key = f"rl:{client_id}"
        try:
            pipe = redis.pipeline()
            pipe.incr(key)
            pipe.expire(key, 60)
            results = pipe.execute()
            count = results[0]
            return int(count) > settings.rate_limit_requests_per_minute
        except Exception as e:
            logger.warning("redis_rate_limit_error", error=str(e))
            # Fail-open: não bloquear se Redis cair
            return False

    def _memory_is_rate_limited(self, client_id: str) -> bool:
        """Fallback em memória (janela deslizante)."""
        now = time.time()
        window_start = now - 60

        if client_id not in _fallback_cache:
            _fallback_cache[client_id] = []

        recent = [t for t in _fallback_cache[client_id] if t > window_start]
        _fallback_cache[client_id] = recent
        recent.append(now)

        # Limpeza periódica
        if len(_fallback_cache) > 10000:
            cutoff = now - 120
            for k in list(_fallback_cache.keys()):
                _fallback_cache[k] = [t for t in _fallback_cache[k] if t > cutoff]
                if not _fallback_cache[k]:
                    del _fallback_cache[k]

        return len(recent) > settings.rate_limit_requests_per_minute
