import pytest
from fastapi.testclient import TestClient

HEADERS = {"Authorization": "Bearer dev:pvm-test-user:pvm@test.com"}

def test_models_importable():
    """Verifica que os 6 models foram adicionados sem erros de import."""
    from app.db.models import (
        ProjetoVidaComunidade,
        ProjetoVidaCuidado,
        ProjetoVidaCompromisso,
        ProjetoVidaMensal,
        ProjetoVidaPratica,
        ProjetoVidaRevisao,
    )
    assert ProjetoVidaMensal.__tablename__ == "projetos_vida_mensal"
    assert ProjetoVidaComunidade.__tablename__ == "projetos_vida_comunidade"
    assert ProjetoVidaCuidado.__tablename__ == "projetos_vida_cuidado"
    assert ProjetoVidaCompromisso.__tablename__ == "projetos_vida_compromissos"
    assert ProjetoVidaPratica.__tablename__ == "projetos_vida_praticas"
    assert ProjetoVidaRevisao.__tablename__ == "projetos_vida_revisoes"


def test_schemas_importable():
    from app.schemas.projeto_vida_mensal import (
        ProjetoVidaMensalCreate,
        ProjetoVidaMensalUpdate,
        ProjetoVidaMensalFull,
        ProjetoVidaMensalSummary,
        PinVerifyRequest,
        PinVerifyResponse,
        RevisaoUpsert,
    )
    create = ProjetoVidaMensalCreate(mes=4, ano=2026)
    assert create.mes == 4
    assert create.ano == 2026
    assert create.pin is None


def test_schema_pin_validation():
    import pytest
    from app.schemas.projeto_vida_mensal import ProjetoVidaMensalCreate
    from pydantic import ValidationError
    with pytest.raises(ValidationError):
        ProjetoVidaMensalCreate(mes=4, ano=2026, pin="abc")
    with pytest.raises(ValidationError):
        ProjetoVidaMensalCreate(mes=4, ano=2026, pin="123")
    ok = ProjetoVidaMensalCreate(mes=4, ano=2026, pin="1234")
    assert ok.pin == "1234"


def test_criar_projeto(client: TestClient):
    r = client.post(
        "/projeto-vida-mensal/",
        json={"mes": 4, "ano": 2026, "tema": "Fé e perseverança"},
        headers=HEADERS,
    )
    assert r.status_code == 201
    data = r.json()
    assert data["mes"] == 4
    assert data["ano"] == 2026
    assert data["tema"] == "Fé e perseverança"
    assert data["has_pin"] is False
    assert data["concluido"] is False


def test_criar_projeto_duplicado_retorna_409(client: TestClient):
    client.post("/projeto-vida-mensal/", json={"mes": 5, "ano": 2026}, headers=HEADERS)
    r = client.post("/projeto-vida-mensal/", json={"mes": 5, "ano": 2026}, headers=HEADERS)
    assert r.status_code == 409


def test_get_atual(client: TestClient):
    r = client.get("/projeto-vida-mensal/atual", headers=HEADERS)
    assert r.status_code == 200


def test_get_historico(client: TestClient):
    r = client.get("/projeto-vida-mensal/historico", headers=HEADERS)
    assert r.status_code == 200
    assert isinstance(r.json(), list)


def test_update_projeto(client: TestClient):
    r = client.post(
        "/projeto-vida-mensal/",
        json={"mes": 6, "ano": 2026},
        headers=HEADERS,
    )
    pid = r.json()["id"]
    r2 = client.put(
        f"/projeto-vida-mensal/{pid}",
        json={
            "tema": "Novo tema",
            "comunidade": {"partilha_acompanhador": "Com o Pe. João"},
            "compromissos": [
                {"semana": "s1", "titulo": "Missa diária", "dia": "Segunda", "horario": "07:00", "obs": "", "ordem": 0}
            ],
        },
        headers=HEADERS,
    )
    assert r2.status_code == 200
    data = r2.json()
    assert data["tema"] == "Novo tema"
    assert data["comunidade"]["partilha_acompanhador"] == "Com o Pe. João"
    assert len(data["compromissos"]) == 1


def test_pin_verificar(client: TestClient):
    r = client.post(
        "/projeto-vida-mensal/",
        json={"mes": 7, "ano": 2026, "pin": "4321"},
        headers=HEADERS,
    )
    pid = r.json()["id"]
    assert r.json()["has_pin"] is True
    r_ok = client.post(
        f"/projeto-vida-mensal/{pid}/pin/verificar",
        json={"pin": "4321"},
        headers=HEADERS,
    )
    assert r_ok.json()["valid"] is True
    r_fail = client.post(
        f"/projeto-vida-mensal/{pid}/pin/verificar",
        json={"pin": "0000"},
        headers=HEADERS,
    )
    assert r_fail.json()["valid"] is False


def test_upsert_revisao(client: TestClient):
    r = client.post(
        "/projeto-vida-mensal/",
        json={"mes": 8, "ano": 2026},
        headers=HEADERS,
    )
    pid = r.json()["id"]
    r2 = client.put(
        f"/projeto-vida-mensal/{pid}/revisao",
        json={"graca": "Vi a graça em...", "decisao": "Orar mais"},
        headers=HEADERS,
    )
    assert r2.status_code == 200
    assert r2.json()["revisao"]["graca"] == "Vi a graça em..."
