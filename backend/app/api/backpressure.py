"""
Backpressure a nível de aplicação.

Converte falhas de saturação/indisponibilidade de banco em respostas HTTP
CONTROLADAS (503 + Retry-After), em vez de 500 com stack trace. Nunca expõe
SQL, DSN, host, driver ou o texto da exceção ao cliente.

Casos cobertos:
- `sqlalchemy.exc.TimeoutError`  → pool esgotado (esperou `pool_timeout`).
  Código interno: DATABASE_BUSY.
- `sqlalchemy.exc.OperationalError` → banco indisponível OU `statement_timeout`
  disparado (query abortada pelo Postgres). Código interno: DATABASE_UNAVAILABLE.

Ambos são condições transitórias: 503 + Retry-After sinaliza ao cliente/loadbalancer
para tentar de novo, sem derrubar a percepção de "erro do servidor".
"""

from __future__ import annotations

import structlog
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from sqlalchemy.exc import OperationalError, TimeoutError as SATimeoutError

from app.settings import settings

logger = structlog.get_logger(__name__)

RETRY_AFTER_SECONDS = 3


def _cors_headers(request: Request, response: JSONResponse) -> JSONResponse:
    # Exception handlers podem bypassar o CORSMiddleware — replica o cabeçalho
    # para origens permitidas (mesmo tratamento do handler global).
    origin = request.headers.get("origin", "")
    if origin and (origin in settings.cors_origins_list or settings.cors_origins_list == ["*"]):
        response.headers["Access-Control-Allow-Origin"] = origin
        response.headers["Access-Control-Allow-Credentials"] = "true"
    return response


def _service_unavailable(request: Request, code: str) -> JSONResponse:
    response = JSONResponse(
        status_code=503,
        content={"detail": {"error": code, "message": "Serviço temporariamente indisponível. "
                                                      "Tente novamente em instantes."}},
    )
    response.headers["Retry-After"] = str(RETRY_AFTER_SECONDS)
    return _cors_headers(request, response)


async def pool_timeout_handler(request: Request, exc: SATimeoutError) -> JSONResponse:
    # Pool esgotado: log só do tipo (nunca str(exc), que pode citar a query).
    logger.warning("db_pool_timeout", path=request.url.path, method=request.method,
                   error_type=type(exc).__name__)
    return _service_unavailable(request, "DATABASE_BUSY")


async def operational_error_handler(request: Request, exc: OperationalError) -> JSONResponse:
    logger.warning("db_operational_error", path=request.url.path, method=request.method,
                   error_type=type(exc).__name__)
    return _service_unavailable(request, "DATABASE_UNAVAILABLE")


def register_backpressure_handlers(app: FastAPI) -> None:
    """Registra os handlers. Chamar ANTES do handler genérico de Exception não
    é necessário — o FastAPI despacha pelo tipo mais específico."""
    app.add_exception_handler(SATimeoutError, pool_timeout_handler)
    app.add_exception_handler(OperationalError, operational_error_handler)
