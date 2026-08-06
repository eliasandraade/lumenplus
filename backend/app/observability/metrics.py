"""
Métricas in-process, formato Prometheus — SEM dependência externa.

Emitimos o texto de exposição do Prometheus à mão (é um formato simples), para
não instalar uma plataforma inteira. Cobre o essencial: contagem/duração de
requests, in-flight, contagem de queries e estado do pool.

REGRA DE CARDINALIDADE (crítica): labels só podem ser de baixa cardinalidade.
A rota é a **template** (`/retreats/{retreat_id}`), NUNCA o path real com id.
PROIBIDO em label: user_id, e-mail, CPF, token, UUID, querystring, mensagem de
exceção. Ver _safe_route().
"""

from __future__ import annotations

import contextvars
import threading
from collections import defaultdict

# Contagem de queries do request corrente. Guardamos um HOLDER MUTÁVEL ([count])
# no ContextVar — o threadpool do FastAPI (rotas `def`) copia o contexto POR
# REFERÊNCIA, então incrementar holder[0] na thread reflete no request pai (mesmo
# objeto). Uma contagem inteira simples não propagaria de volta do threadpool.
_query_holder: contextvars.ContextVar[list] = contextvars.ContextVar("_query_holder")


def reset_query_count() -> list:
    holder = [0]
    _query_holder.set(holder)
    return holder


def get_query_count() -> int:
    try:
        return _query_holder.get()[0]
    except LookupError:
        return 0


def _bump_query_count() -> None:
    try:
        _query_holder.get()[0] += 1
    except LookupError:
        pass  # fora de um request (job/boot) — não contamos


def register_query_counter(engine) -> None:  # noqa: ANN001
    """Liga um listener que conta cada query no ContextVar do request corrente."""
    from sqlalchemy import event

    @event.listens_for(engine, "before_cursor_execute")
    def _count(conn, cursor, statement, params, context, executemany):  # noqa: ANN001
        _bump_query_count()

# Buckets de latência em segundos (histograma cumulativo estilo Prometheus).
_BUCKETS = (0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1.0, 2.5, 5.0, 10.0)


class _Metrics:
    def __init__(self) -> None:
        self._lock = threading.Lock()
        # counters por (method, route, status_class)
        self.req_total: dict[tuple, int] = defaultdict(int)
        # histograma de duração por (method, route): [contagem por bucket], soma, count
        self.dur_buckets: dict[tuple, list[int]] = defaultdict(lambda: [0] * len(_BUCKETS))
        self.dur_sum: dict[tuple, float] = defaultdict(float)
        self.dur_count: dict[tuple, int] = defaultdict(int)
        self.in_flight: int = 0
        # queries por request (soma/contagem) por route
        self.query_sum: dict[tuple, int] = defaultdict(int)
        # gauges de pool (setados sob demanda no render)
        self.pool_gauges: dict[str, float] = {}

    def observe_request(self, method: str, route: str, status: int, duration_s: float,
                        queries: int) -> None:
        status_class = f"{status // 100}xx"
        key = (method, route)
        with self._lock:
            self.req_total[(method, route, status_class)] += 1
            b = self.dur_buckets[key]
            for i, edge in enumerate(_BUCKETS):
                if duration_s <= edge:
                    b[i] += 1
            self.dur_sum[key] += duration_s
            self.dur_count[key] += 1
            self.query_sum[key] += queries

    def inc_in_flight(self) -> None:
        with self._lock:
            self.in_flight += 1

    def dec_in_flight(self) -> None:
        with self._lock:
            self.in_flight = max(0, self.in_flight - 1)

    def set_pool_gauges(self, gauges: dict[str, float]) -> None:
        with self._lock:
            self.pool_gauges = dict(gauges)

    def render(self) -> str:
        """Texto de exposição Prometheus."""
        lines: list[str] = []
        with self._lock:
            lines.append("# TYPE lumen_requests_total counter")
            for (method, route, sclass), v in sorted(self.req_total.items()):
                lines.append(
                    f'lumen_requests_total{{method="{method}",route="{route}",'
                    f'status="{sclass}"}} {v}'
                )

            lines.append("# TYPE lumen_request_duration_seconds histogram")
            for (method, route), buckets in sorted(self.dur_buckets.items()):
                cum = 0
                for i, edge in enumerate(_BUCKETS):
                    cum += buckets[i]
                    lines.append(
                        f'lumen_request_duration_seconds_bucket{{method="{method}",'
                        f'route="{route}",le="{edge}"}} {cum}'
                    )
                total = self.dur_count[(method, route)]
                lines.append(
                    f'lumen_request_duration_seconds_bucket{{method="{method}",'
                    f'route="{route}",le="+Inf"}} {total}'
                )
                lines.append(
                    f'lumen_request_duration_seconds_sum{{method="{method}",'
                    f'route="{route}"}} {self.dur_sum[(method, route)]:.6f}'
                )
                lines.append(
                    f'lumen_request_duration_seconds_count{{method="{method}",'
                    f'route="{route}"}} {total}'
                )

            lines.append("# TYPE lumen_queries_per_request_sum counter")
            for (method, route), v in sorted(self.query_sum.items()):
                lines.append(
                    f'lumen_queries_per_request_sum{{method="{method}",route="{route}"}} {v}'
                )

            lines.append("# TYPE lumen_requests_in_flight gauge")
            lines.append(f"lumen_requests_in_flight {self.in_flight}")

            for name, val in sorted(self.pool_gauges.items()):
                lines.append(f"# TYPE lumen_db_pool_{name} gauge")
                lines.append(f"lumen_db_pool_{name} {val}")
        return "\n".join(lines) + "\n"


METRICS = _Metrics()


def safe_route(request) -> str:  # noqa: ANN001
    """
    Rota NORMALIZADA (template), nunca o path real com ids — baixa cardinalidade.
    Ex.: GET /retreats/abc-123 → "/retreats/{retreat_id}".
    Se a rota não foi resolvida (404), devolve "unmatched" (não o path bruto, que
    poderia conter ids/querystring).
    """
    route = request.scope.get("route")
    path = getattr(route, "path", None)
    if path:
        return str(path)
    return "unmatched"
