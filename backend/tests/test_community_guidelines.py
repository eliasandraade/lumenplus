"""
Aceite versionado das Diretrizes da Comunidade.

Gate das lojas: App Store Review Guideline 1.2 exige que o usuário concorde
com termos de tolerância zero a conteúdo censurável e a usuários abusivos
ANTES de publicar. O aceite precisa ser versionado — republicar o texto tem
de exigir novo aceite, senão o consentimento não corresponde ao que está
valendo.
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone

from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.models import (
    ChannelPost,
    ChannelPostMode,
    LegalDocument,
    MembershipStatus,
    OrgMembership,
    OrgRoleCode,
    OrgUnit,
    OrgUnitType,
    User,
    UserConsent,
    UserIdentity,
    UserProfile,
)
from app.services.community_guidelines import LEGAL_TYPE


def _hdr(uid: str) -> dict:
    return {"Authorization": f"Bearer dev:{uid}:{uid}@synthetic.invalid"}


def _mk_user(db: Session, uid: str, name: str) -> User:
    u = User(is_active=True)
    db.add(u)
    db.flush()
    db.add(UserIdentity(user_id=u.id, provider="firebase", provider_uid=uid,
                        email=f"{uid}@synthetic.invalid"))
    db.add(UserProfile(user_id=u.id, status="COMPLETE", full_name=name))
    db.flush()
    return u


def _mk_unit_with_member(db: Session, slug: str, user: User) -> OrgUnit:
    """Unidade onde QUALQUER membro pode postar — isola o teste do gate de papel."""
    unit = OrgUnit(type=OrgUnitType.MINISTERIO, name=slug, slug=slug,
                   channel_post_mode=ChannelPostMode.ALL_MEMBERS)
    db.add(unit)
    db.flush()
    db.add(OrgMembership(user_id=user.id, org_unit_id=unit.id,
                         role=OrgRoleCode.MEMBER, status=MembershipStatus.ACTIVE))
    db.flush()
    return unit


def _publish(db: Session, version: str, minutes_ago: int = 0) -> LegalDocument:
    """
    Publica uma versão das diretrizes.

    `minutes_ago` controla published_at porque a versão vigente é escolhida
    por data — em SQLite o server_default de duas inserções na mesma
    transação pode colidir no mesmo instante e tornar a ordem indefinida.
    """
    doc = LegalDocument(
        type=LEGAL_TYPE,
        version=version,
        content=f"Diretrizes da Comunidade {version}. Tolerância zero.",
        published_at=datetime.now(timezone.utc) - timedelta(minutes=minutes_ago),
    )
    db.add(doc)
    db.flush()
    return doc


def _post(client: TestClient, unit: OrgUnit, uid: str):
    return client.post(
        f"/channel/{unit.id}/posts",
        json={"title": "Aviso", "body": "Reunião no sábado."},
        headers=_hdr(uid),
    )


# ---------------------------------------------------------------------------
# Enforcement na publicação
# ---------------------------------------------------------------------------
def test_publicar_sem_aceitar_diretrizes_e_bloqueado(client: TestClient, db_session: Session):
    user = _mk_user(db_session, "cg-nao-aceitou", "Sem Aceite")
    unit = _mk_unit_with_member(db_session, "cg-unit-1", user)
    _publish(db_session, "1.0")
    db_session.commit()

    r = _post(client, unit, "cg-nao-aceitou")

    # 428 Precondition Required: o usuário TEM permissão, falta uma condição.
    # Se fosse 403 o app não saberia distinguir "sem permissão" de "aceite
    # pendente" e abriria a tela errada.
    assert r.status_code == 428, r.text
    detail = r.json()["detail"]
    assert detail["error"] == "community_guidelines_not_accepted"
    assert detail["required_version"] == "1.0"

    # E nada foi gravado.
    assert db_session.execute(select(ChannelPost)).first() is None


def test_publicar_depois_de_aceitar_funciona(client: TestClient, db_session: Session):
    user = _mk_user(db_session, "cg-aceitou", "Com Aceite")
    unit = _mk_unit_with_member(db_session, "cg-unit-2", user)
    _publish(db_session, "1.0")
    db_session.commit()

    aceite = client.post("/legal/community-guidelines/accept",
                         json={"version": "1.0"}, headers=_hdr("cg-aceitou"))
    assert aceite.status_code == 200, aceite.text
    assert aceite.json()["accepted_version"] == "1.0"

    r = _post(client, unit, "cg-aceitou")
    assert r.status_code == 201, r.text


def test_nova_versao_invalida_o_aceite_anterior(client: TestClient, db_session: Session):
    """
    O ponto central do versionamento: aceitar a v1.0 não pode valer como
    aceite da v2.0. Sem isto o requisito da Apple é só decorativo — o texto
    mudaria e ninguém precisaria concordar com o novo.
    """
    user = _mk_user(db_session, "cg-versao", "Versao")
    unit = _mk_unit_with_member(db_session, "cg-unit-3", user)
    _publish(db_session, "1.0", minutes_ago=10)
    db_session.commit()

    client.post("/legal/community-guidelines/accept",
                json={"version": "1.0"}, headers=_hdr("cg-versao"))
    assert _post(client, unit, "cg-versao").status_code == 201

    # Republicação do texto.
    _publish(db_session, "2.0", minutes_ago=0)
    db_session.commit()

    r = _post(client, unit, "cg-versao")
    assert r.status_code == 428, "aceite da v1.0 nao pode valer para a v2.0"
    assert r.json()["detail"]["required_version"] == "2.0"

    # O aceite antigo continua registrado — é trilha de auditoria, não some.
    assert db_session.execute(select(UserConsent)).first() is not None

    client.post("/legal/community-guidelines/accept",
                json={"version": "2.0"}, headers=_hdr("cg-versao"))
    assert _post(client, unit, "cg-versao").status_code == 201


def test_respostas_tambem_exigem_aceite(client: TestClient, db_session: Session):
    """Resposta é UGC igual a post — a salvaguarda não pode valer só para posts."""
    autor = _mk_user(db_session, "cg-autor", "Autor")
    unit = _mk_unit_with_member(db_session, "cg-unit-4", autor)
    _publish(db_session, "1.0")
    db_session.commit()

    client.post("/legal/community-guidelines/accept",
                json={"version": "1.0"}, headers=_hdr("cg-autor"))
    post_id = _post(client, unit, "cg-autor").json()["id"]

    outro = _mk_user(db_session, "cg-respondente", "Respondente")
    db_session.add(OrgMembership(user_id=outro.id, org_unit_id=unit.id,
                         role=OrgRoleCode.MEMBER, status=MembershipStatus.ACTIVE))
    db_session.commit()

    r = client.post(f"/channel/{unit.id}/posts/{post_id}/replies",
                    json={"body": "Estarei presente."}, headers=_hdr("cg-respondente"))
    assert r.status_code == 428, r.text

    client.post("/legal/community-guidelines/accept",
                json={"version": "1.0"}, headers=_hdr("cg-respondente"))
    r = client.post(f"/channel/{unit.id}/posts/{post_id}/replies",
                    json={"body": "Estarei presente."}, headers=_hdr("cg-respondente"))
    assert r.status_code == 201, r.text


def test_sem_documento_publicado_nao_trava_o_produto(client: TestClient, db_session: Session):
    """
    Falha de seed não pode derrubar toda a publicação do app. Sem documento
    vigente não há o que aceitar — o gate fica aberto e a ausência é tratada
    como problema operacional, não como bloqueio de produto.
    """
    user = _mk_user(db_session, "cg-sem-doc", "Sem Doc")
    unit = _mk_unit_with_member(db_session, "cg-unit-5", user)
    db_session.commit()

    assert _post(client, unit, "cg-sem-doc").status_code == 201


# ---------------------------------------------------------------------------
# Endpoint de consulta
# ---------------------------------------------------------------------------
def test_consulta_informa_versao_e_estado_do_aceite(client: TestClient, db_session: Session):
    user = _mk_user(db_session, "cg-consulta", "Consulta")
    _mk_unit_with_member(db_session, "cg-unit-6", user)
    _publish(db_session, "1.0")
    db_session.commit()

    r = client.get("/legal/community-guidelines", headers=_hdr("cg-consulta"))
    assert r.status_code == 200
    assert r.json()["accepted"] is False
    assert r.json()["document"]["version"] == "1.0"
    assert "Tolerância zero" in r.json()["document"]["content"]

    client.post("/legal/community-guidelines/accept",
                json={"version": "1.0"}, headers=_hdr("cg-consulta"))

    r = client.get("/legal/community-guidelines", headers=_hdr("cg-consulta"))
    assert r.json()["accepted"] is True


def test_aceite_de_versao_inexistente_e_rejeitado(client: TestClient, db_session: Session):
    """Impede o app de registrar aceite de um texto que nunca foi publicado."""
    _mk_user(db_session, "cg-fantasma", "Fantasma")
    _publish(db_session, "1.0")
    db_session.commit()

    r = client.post("/legal/community-guidelines/accept",
                    json={"version": "9.9"}, headers=_hdr("cg-fantasma"))
    assert r.status_code == 400
    assert db_session.execute(select(UserConsent)).first() is None


def test_aceite_repetido_e_idempotente(client: TestClient, db_session: Session):
    """Retry de rede não pode gerar consentimento duplicado na trilha."""
    _mk_user(db_session, "cg-idem", "Idempotente")
    _publish(db_session, "1.0")
    db_session.commit()

    for _ in range(3):
        r = client.post("/legal/community-guidelines/accept",
                        json={"version": "1.0"}, headers=_hdr("cg-idem"))
        assert r.status_code == 200

    consents = db_session.execute(select(UserConsent)).scalars().all()
    assert len(consents) == 1
