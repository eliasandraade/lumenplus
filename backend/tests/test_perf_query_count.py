"""
Instrumentação de contagem de queries (perf sprint 1).

Conta as queries SQL emitidas por request usando eventos do SQLAlchemy.
A contagem é independente do dialeto (SQLite/Postgres emitem o mesmo nº de
statements pelo ORM), então é evidência válida de N+1 mesmo no banco de teste.

Rodar com saída:  pytest tests/test_perf_query_count.py -s -q
"""
from sqlalchemy import event


class QueryCounter:
    def __init__(self, engine):
        self.engine = engine
        self.statements: list[str] = []

    def _on_exec(self, conn, cursor, statement, parameters, context, executemany):
        self.statements.append(statement)

    def __enter__(self):
        event.listen(self.engine, "before_cursor_execute", self._on_exec)
        return self

    def __exit__(self, *exc):
        event.remove(self.engine, "before_cursor_execute", self._on_exec)

    @property
    def count(self) -> int:
        return len(self.statements)

    def summary(self) -> str:
        selects = sum(1 for s in self.statements if s.lstrip().upper().startswith("SELECT"))
        writes = self.count - selects
        return f"{self.count} queries ({selects} SELECT, {writes} write)"


def _measure(client, engine, method, path, headers=None, warm=True):
    if warm:
        getattr(client, method)(path, headers=headers or {})
    with QueryCounter(engine) as qc:
        resp = getattr(client, method)(path, headers=headers or {})
    return resp, qc


def test_measure_key_endpoints(client, db_engine, auth_headers):
    print("\n===== QUERY COUNT — endpoints-chave =====")
    results = []

    r, qc = _measure(client, db_engine, "get", "/health", warm=False)
    print(f"GET /health                  -> HTTP {r.status_code} | {qc.summary()}")
    results.append(("/health", r.status_code, qc.count))

    r, qc = _measure(client, db_engine, "get", "/push/vapid-public-key", warm=False)
    print(f"GET /push/vapid-public-key   -> HTTP {r.status_code} | {qc.summary()}")
    results.append(("/push/vapid-public-key", r.status_code, qc.count))

    r, qc = _measure(client, db_engine, "get", "/legal/latest", warm=True)
    print(f"GET /legal/latest            -> HTTP {r.status_code} | {qc.summary()}")
    results.append(("/legal/latest", r.status_code, qc.count))

    r, qc = _measure(client, db_engine, "get", "/auth/me", headers=auth_headers, warm=True)
    print(f"GET /auth/me                 -> HTTP {r.status_code} | {qc.summary()}")
    for s in qc.statements:
        print("      ", " ".join(s.split())[:110])
    results.append(("/auth/me", r.status_code, qc.count))

    def _count(path):
        return next(c for p, _, c in results if p == path)

    # Regressão de query count (baseline medido nesta sprint):
    #  - /health não toca o banco;
    #  - latest legal doc vem do cache em processo (warm) -> 0 queries;
    #  - /auth/me caiu de 10 para 8 queries (removidas 2 de documento legal).
    assert _count("/health") == 0, "/health não deve tocar o banco"
    assert _count("/legal/latest") <= 1, "latest legal doc deveria vir do cache (warm)"
    assert _count("/auth/me") <= 8, "GET /auth/me nao deve crescer acima do baseline pos-cache (8)"
