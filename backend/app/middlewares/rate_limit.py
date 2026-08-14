"""
Rate Limiting Middleware
========================
Controle de taxa de requisições via Redis (fixed window).
Funciona corretamente em ambientes com múltiplas instâncias.
"""

import hashlib
import ipaddress
import time
from typing import Any, Callable, cast

import redis.asyncio as redis_lib
import structlog
from fastapi import Request, Response, status
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware

from app.core.settings import settings

logger = structlog.get_logger()


def _is_valid_ip(value: str) -> bool:
    try:
        ipaddress.ip_address(value)
        return True
    except ValueError:
        return False


def _resolve_client_ip(request: Request) -> str | None:
    """Resolve o IP real do cliente de forma resistente a spoofing de X-Forwarded-For.

    Formato do XFF: "cliente, proxy1, proxy2" — cada proxy confiável APENDE o IP
    de quem se conectou a ele, à direita. O valor mais à esquerda é controlado
    pelo cliente (spoofável). Pegamos a entrada a ``trusted_proxy_hops`` posições
    a partir da direita (Railway = 1 hop) e validamos o formato; se inválida,
    caímos para o peer TCP direto.
    """
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        parts = [p.strip() for p in forwarded.split(",") if p.strip()]
        hops = settings.trusted_proxy_hops if settings.trusted_proxy_hops >= 1 else 1
        if len(parts) >= hops:
            candidate = parts[-hops]
            if _is_valid_ip(candidate):
                return candidate
    if request.client and _is_valid_ip(request.client.host):
        return request.client.host
    return None


_redis_client: redis_lib.Redis | None = None
_redis_last_failure: float = 0.0
_REDIS_RETRY_INTERVAL = 30.0


async def _get_redis() -> redis_lib.Redis | None:
    global _redis_client, _redis_last_failure
    if _redis_client is not None:
        return _redis_client
    if time.time() - _redis_last_failure < _REDIS_RETRY_INTERVAL:
        return None
    try:
        _redis_client = redis_lib.from_url(
            settings.redis_url,
            decode_responses=True,
            socket_connect_timeout=1,
            socket_timeout=1,
        )
        await _redis_client.ping()
    except Exception as e:
        logger.warning("redis_unavailable", error=str(e), fallback="in-memory")
        _redis_last_failure = time.time()
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

        if await self._is_rate_limited(client_id):
            logger.warning(
                "rate_limit_exceeded",
                client_id=client_id,
                path=request.url.path,
            )
            return JSONResponse(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                headers={"Retry-After": "60"},
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
            # Hash do token COMPLETO, não do prefixo: para JWT Firebase RS256 os ~20
            # primeiros caracteres são o header base64 ({"alg":"RS256",...}), idêntico
            # em todos os usuários — usar só o prefixo colocava todo mundo no mesmo bucket.
            # sha256 garante estabilidade entre processos/workers (hash() é não-determinístico).
            # Nunca logamos nem armazenamos o token bruto — apenas o hash truncado.
            token = auth[7:]
            token_hash = hashlib.sha256(token.encode()).hexdigest()[:16]
            return f"auth:{token_hash}"

        # IP real resolvido de forma resistente a spoofing (ver _resolve_client_ip).
        ip = _resolve_client_ip(request)
        return f"ip:{ip}" if ip else "ip:unknown"

    async def _is_rate_limited(self, client_id: str) -> bool:
        redis = await _get_redis()
        if redis is not None:
            return await self._redis_is_rate_limited(redis, client_id)
        return self._memory_is_rate_limited(client_id)

    async def _redis_is_rate_limited(self, redis: redis_lib.Redis, client_id: str) -> bool:
        """Fixed window via Redis INCR + EXPIRE (nx=True preserva a janela inicial)."""
        key = f"rl:{client_id}"
        try:
            pipe = redis.pipeline()
            pipe.incr(key)
            pipe.expire(key, 60, nx=True)  # nx=True: só define TTL na primeira requisição da janela
            results = await pipe.execute()
            count = results[0]
            return int(count) > settings.rate_limit_requests_per_minute
        except Exception as e:
            logger.warning("redis_rate_limit_error", error=str(e))
            # Fail-open: não bloquear se Redis cair
            return False

    def _memory_is_rate_limited(self, client_id: str) -> bool:
        """Fallback em memória (janela deslizante). O(K) no cleanup, raro em < 10000 clientes."""
        now = time.time()
        window_start = now - 60

        if client_id not in _fallback_cache:
            _fallback_cache[client_id] = []

        recent = [t for t in _fallback_cache[client_id] if t > window_start]
        _fallback_cache[client_id] = recent
        recent.append(now)

        if len(_fallback_cache) > 10000:
            cutoff = now - 120
            for k in list(_fallback_cache.keys()):
                _fallback_cache[k] = [t for t in _fallback_cache[k] if t > cutoff]
                if not _fallback_cache[k]:
                    del _fallback_cache[k]

        return len(recent) > settings.rate_limit_requests_per_minute
