"""
Testes de métricas (item 7.4): status codes, rota normalizada (baixa cardinalidade),
ausência de PII, contagem de queries, gauges.
"""

from __future__ import annotations


def test_metrics_endpoint_expoe_formato_prometheus(client):
    # gera tráfego
    client.get("/health/live")
    client.get("/legal/latest")
    r = client.get("/metrics")
    assert r.status_code == 200
    body = r.text
    assert "lumen_requests_total" in body
    assert "lumen_request_duration_seconds_bucket" in body
    assert "lumen_requests_in_flight" in body


def test_rota_normalizada_nao_vaza_id_nem_querystring(client):
    # Bate num path com id inexistente (404) — o label NÃO pode conter o id bruto.
    client.get("/retreats/11111111-2222-3333-4444-555555555555")
    client.get("/legal/latest?secret=abc123")
    body = client.get("/metrics").text
    # o id específico e a querystring não podem aparecer como label
    assert "11111111-2222-3333-4444-555555555555" not in body
    assert "secret=abc123" not in body and "abc123" not in body
    # rota fixa aparece como template
    assert 'route="/legal/latest"' in body


def test_status_class_registrado(client):
    client.get("/legal/latest")            # 2xx
    client.get("/nao-existe-rota-xyz")      # 4xx
    body = client.get("/metrics").text
    assert 'status="2xx"' in body
    assert 'status="4xx"' in body


def test_query_count_mecanismo():
    """
    O contador de queries vive num holder no ContextVar e é incrementado pelo
    listener do engine. Aqui provamos o mecanismo com um engine próprio (no
    client do conftest o engine é trocado, então o listener do engine real da app
    não dispara — em produção dispara, pois é o mesmo engine).
    """
    from sqlalchemy import create_engine, text

    from app.observability import metrics as mx

    engine = create_engine("sqlite://")
    mx.register_query_counter(engine)

    mx.reset_query_count()
    assert mx.get_query_count() == 0
    with engine.connect() as c:
        c.execute(text("SELECT 1"))
        c.execute(text("SELECT 2"))
    assert mx.get_query_count() == 2, "listener não contou as queries no holder"


def test_sem_pii_nos_labels(client):
    # exercita uma rota autenticada (token com e-mail) e confirma que o e-mail do
    # token NÃO aparece nas métricas.
    client.get("/auth/me", headers={"Authorization": "Bearer dev:muser:muser@example.com"})
    body = client.get("/metrics").text
    assert "muser@example.com" not in body
    assert "Bearer" not in body and "Authorization" not in body


def test_pool_gauges_renderizam_quando_pool_suporta():
    """
    Os gauges de pool são best-effort: emitidos quando o pool expõe size/
    checkedout/etc. Em produção (QueuePool) aparecem; alguns pools de SQLite não
    expõem tudo. Provamos o render diretamente com um QueuePool.
    """
    from sqlalchemy import create_engine
    from sqlalchemy.pool import QueuePool

    from app.observability.metrics import METRICS

    engine = create_engine("sqlite://", poolclass=QueuePool)
    pool = engine.pool
    gauges = {}
    for name in ("size", "checkedout", "overflow"):
        fn = getattr(pool, name, None)
        if callable(fn):
            try:
                gauges[name] = float(fn())
            except Exception:
                pass
    METRICS.set_pool_gauges(gauges)
    body = METRICS.render()
    assert "lumen_db_pool_" in body, f"nenhum gauge de pool renderizado: {list(gauges)}"
