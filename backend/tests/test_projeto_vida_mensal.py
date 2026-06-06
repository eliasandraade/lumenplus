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
    # "tema" não é exposto na API (campo interno), enviá-lo no body é ignorado
    r = client.post(
        "/projeto-vida-mensal/",
        json={"mes": 4, "ano": 2026},
        headers=HEADERS,
    )
    assert r.status_code == 201
    data = r.json()
    assert data["mes"] == 4
    assert data["ano"] == 2026
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
    # comunidade.partilha_acompanhador é agora JSONB (lista de EventoItem)
    r2 = client.put(
        f"/projeto-vida-mensal/{pid}",
        json={
            "comunidade": {
                "partilha_acompanhador": [{"data": "10/06", "horario": "19:00", "local": "Sede", "observacoes": ""}],
                "encontro_familia": [],
                "dias_grupo": [],
                "outros": [],
            },
            "compromissos": [
                {"semana": "s1", "titulo": "Missa diária", "dia": "Segunda", "horario": "07:00", "obs": "", "ordem": 0}
            ],
        },
        headers=HEADERS,
    )
    assert r2.status_code == 200
    data = r2.json()
    assert len(data["comunidade"]["partilha_acompanhador"]) == 1
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
    # Revisão usa campos v2 (migration 034): pratica_melhorar, taticas_vigilancia,
    # rotina_evangelizacao, outra_area_atencao. Campos antigos (graca, decisao) foram removidos.
    r = client.post(
        "/projeto-vida-mensal/",
        json={"mes": 8, "ano": 2026},
        headers=HEADERS,
    )
    pid = r.json()["id"]
    r2 = client.put(
        f"/projeto-vida-mensal/{pid}/revisao",
        json={"pratica_melhorar": "Oração diária", "rotina_evangelizacao": "30 min por dia"},
        headers=HEADERS,
    )
    assert r2.status_code == 200
    assert r2.json()["revisao"]["pratica_melhorar"] == "Oração diária"


def test_contexto_vocacional_usuario_sem_perfil(client: TestClient, auth_headers: dict):
    """Usuário sem perfil retorna 200 com perfil_incompleto=True e campos null."""
    resp = client.get("/projeto-vida-mensal/contexto-vocacional", headers=auth_headers)
    assert resp.status_code == 200
    data = resp.json()
    assert "vocational_reality_code" in data
    assert "life_state_code" in data
    assert "perfil_incompleto" in data
    assert "nome" in data
    assert data["perfil_incompleto"] is True
    assert data["vocational_reality_code"] is None
    assert data["life_state_code"] is None


def test_contexto_vocacional_retorna_nome(client: TestClient, auth_headers: dict):
    """O nome retornado nunca é None — usa email como fallback."""
    resp = client.get("/projeto-vida-mensal/contexto-vocacional", headers=auth_headers)
    assert resp.status_code == 200
    assert resp.json()["nome"] is not None
    assert len(resp.json()["nome"]) > 0
