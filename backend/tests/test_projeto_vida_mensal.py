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


def test_criar_projeto_com_intencao(client: TestClient, auth_headers: dict):
    """Campo intencao é salvo e retornado."""
    resp = client.post(
        "/projeto-vida-mensal/",
        json={"mes": 9, "ano": 2026, "intencao": "Viver este mês com mais presença"},
        headers=auth_headers,
    )
    assert resp.status_code == 201
    assert resp.json()["intencao"] == "Viver este mês com mais presença"


def test_criar_projeto_sem_intencao(client: TestClient, auth_headers: dict):
    """intencao é opcional — None quando não enviado."""
    resp = client.post(
        "/projeto-vida-mensal/",
        json={"mes": 10, "ano": 2026},
        headers=auth_headers,
    )
    assert resp.status_code == 201
    assert resp.json()["intencao"] is None


def test_update_intencao(client: TestClient, auth_headers: dict):
    """intencao pode ser atualizado via PUT."""
    pid = client.post(
        "/projeto-vida-mensal/",
        json={"mes": 11, "ano": 2026},
        headers=auth_headers,
    ).json()["id"]
    resp = client.put(
        f"/projeto-vida-mensal/{pid}",
        json={"intencao": "Crescer na oração"},
        headers=auth_headers,
    )
    assert resp.status_code == 200
    assert resp.json()["intencao"] == "Crescer na oração"


def test_criar_ciclo_com_areas(client: TestClient, auth_headers: dict):
    """PUT com areas faz upsert e retorna has_new_structure=True."""
    pid = client.post(
        "/projeto-vida-mensal/",
        json={"mes": 1, "ano": 2027},
        headers=auth_headers,
    ).json()["id"]

    resp = client.put(
        f"/projeto-vida-mensal/{pid}",
        json={
            "areas": [
                {
                    "tipo_area": "FAMILIA_VOCACIONAL",
                    "objetivo": "Participar de todos os encontros",
                    "compromissos": [{"descricao": "Encontro da família", "data": "20/01"}],
                    "observacoes": None,
                }
            ]
        },
        headers=auth_headers,
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["has_new_structure"] is True
    assert len(data["areas"]) == 1
    assert data["areas"][0]["tipo_area"] == "FAMILIA_VOCACIONAL"
    assert data["areas"][0]["objetivo"] == "Participar de todos os encontros"


def test_upsert_area_existente_atualiza_sem_duplicar(client: TestClient, auth_headers: dict):
    """Segundo PUT com mesma tipo_area atualiza, não duplica."""
    pid = client.post(
        "/projeto-vida-mensal/",
        json={"mes": 2, "ano": 2027},
        headers=auth_headers,
    ).json()["id"]

    client.put(
        f"/projeto-vida-mensal/{pid}",
        json={"areas": [{"tipo_area": "GRUPO_FORMATIVO", "objetivo": "v1"}]},
        headers=auth_headers,
    )
    client.put(
        f"/projeto-vida-mensal/{pid}",
        json={"areas": [{"tipo_area": "GRUPO_FORMATIVO", "objetivo": "v2"}]},
        headers=auth_headers,
    )

    resp = client.get(f"/projeto-vida-mensal/{pid}", headers=auth_headers)
    areas = resp.json()["areas"]
    grupo_areas = [a for a in areas if a["tipo_area"] == "GRUPO_FORMATIVO"]
    assert len(grupo_areas) == 1, f"Esperado 1, encontrado {len(grupo_areas)}"
    assert grupo_areas[0]["objetivo"] == "v2"


def test_ciclo_sem_areas_retorna_has_new_structure_false(client: TestClient, auth_headers: dict):
    """Ciclo sem areas_mensais retorna has_new_structure=False."""
    pid = client.post(
        "/projeto-vida-mensal/",
        json={"mes": 3, "ano": 2027},
        headers=auth_headers,
    ).json()["id"]
    resp = client.get(f"/projeto-vida-mensal/{pid}", headers=auth_headers)
    assert resp.json()["has_new_structure"] is False


def test_reflexao_evangelizacao_salva_e_retornada(client: TestClient, auth_headers: dict):
    """reflexao_evangelizacao é aceita no POST e no PUT."""
    resp = client.post(
        "/projeto-vida-mensal/",
        json={"mes": 4, "ano": 2027, "reflexao_evangelizacao": "Estar mais presente"},
        headers=auth_headers,
    )
    assert resp.status_code == 201
    assert resp.json()["reflexao_evangelizacao"] == "Estar mais presente"


def test_exame_get_sem_exame_retorna_null(client: TestClient, auth_headers: dict):
    """GET /exame retorna null quando exame não existe (não 404)."""
    pid = client.post(
        "/projeto-vida-mensal/",
        json={"mes": 5, "ano": 2027},
        headers=auth_headers,
    ).json()["id"]
    resp = client.get(f"/projeto-vida-mensal/{pid}/exame", headers=auth_headers)
    assert resp.status_code == 200
    assert resp.json() is None


def test_exame_upsert_cria_e_recupera(client: TestClient, auth_headers: dict):
    """PUT cria exame; GET recupera os campos corretos."""
    pid = client.post(
        "/projeto-vida-mensal/",
        json={"mes": 6, "ano": 2027},
        headers=auth_headers,
    ).json()["id"]

    resp = client.put(
        f"/projeto-vida-mensal/{pid}/exame",
        json={
            "gracas_recebidas": "Muita paz neste mês",
            "proposito_conversao": "Ser mais paciente",
        },
        headers=auth_headers,
    )
    assert resp.status_code == 200
    assert resp.json()["gracas_recebidas"] == "Muita paz neste mês"
    assert resp.json()["proposito_conversao"] == "Ser mais paciente"
    assert resp.json()["infidelidades"] is None

    resp2 = client.get(f"/projeto-vida-mensal/{pid}/exame", headers=auth_headers)
    assert resp2.status_code == 200
    assert resp2.json()["gracas_recebidas"] == "Muita paz neste mês"


def test_exame_upsert_idempotente(client: TestClient, auth_headers: dict):
    """Dois PUTs consecutivos: segundo atualiza, não cria duplicata."""
    pid = client.post(
        "/projeto-vida-mensal/",
        json={"mes": 7, "ano": 2027},
        headers=auth_headers,
    ).json()["id"]

    client.put(
        f"/projeto-vida-mensal/{pid}/exame",
        json={"gracas_recebidas": "v1", "infidelidades": "falha inicial"},
        headers=auth_headers,
    )
    client.put(
        f"/projeto-vida-mensal/{pid}/exame",
        json={"gracas_recebidas": "v2"},
        headers=auth_headers,
    )

    resp = client.get(f"/projeto-vida-mensal/{pid}/exame", headers=auth_headers)
    assert resp.json()["gracas_recebidas"] == "v2"
    # infidelidades do primeiro PUT ainda deve existir (não foi sobrescrita)
    assert resp.json()["infidelidades"] == "falha inicial"


def test_exame_acesso_negado_para_outro_usuario(client: TestClient, auth_headers: dict):
    """Projeto de outro usuário retorna 404 ao tentar acessar o exame."""
    pid = client.post(
        "/projeto-vida-mensal/",
        json={"mes": 8, "ano": 2027},
        headers=auth_headers,
    ).json()["id"]

    headers_b = {"Authorization": "Bearer dev:outro-user:outro@test.com"}
    resp = client.get(f"/projeto-vida-mensal/{pid}/exame", headers=headers_b)
    assert resp.status_code == 404
