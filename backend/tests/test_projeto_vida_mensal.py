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
