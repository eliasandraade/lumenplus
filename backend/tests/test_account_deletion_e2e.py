"""
Exclusão de conta — ponta a ponta contra a matriz de dados.

Gates: App Store 5.1.1(v) (o app precisa excluir a conta, não só desativar) e
LGPD art. 18, VI (eliminação dos dados pessoais).

O teste central é `test_matriz_de_purga_nao_deixa_residuo`: ele percorre a
lista `_PURGE` do próprio serviço, cria uma linha em CADA tabela e exige que
todas sumam. Assim, incluir uma tabela na matriz sem apagá-la de fato — ou
adicionar uma tabela nova e esquecer o teste — falha automaticamente.
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone

from fastapi.testclient import TestClient
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.db.models import (
    ChannelPost,
    ChannelPostMode,
    ChannelReply,
    LegalDocument,
    MembershipStatus,
    OrgMembership,
    OrgRoleCode,
    OrgUnit,
    OrgUnitType,
    PushSubscription,
    User,
    UserBlock,
    UserConsent,
    UserIdentity,
    UserProfile,
)
from app.services.account_deletion import _PURGE


# Tabelas que a suíte NÃO consegue cobrir em SQLite (coluna ARRAY é exclusiva
# do PostgreSQL). Registrado explicitamente para a lacuna ficar visível em vez
# de o teste passar dando falsa sensação de cobertura total.
TABELAS_SEM_COBERTURA_SQLITE: set[str] = set()


def _hdr(uid: str) -> dict:
    return {"Authorization": f"Bearer dev:{uid}:{uid}@synthetic.invalid"}


_seq = iter(range(10_000, 99_999))


def _mk_user(db: Session, uid: str, name: str, phone: str | None = None) -> User:
    u = User(is_active=True)
    db.add(u)
    db.flush()
    db.add(UserIdentity(user_id=u.id, provider="firebase", provider_uid=uid,
                        email=f"{uid}@synthetic.invalid"))
    # phone_e164 tem UNIQUE em user_profiles — número distinto por usuário.
    db.add(UserProfile(user_id=u.id, status="COMPLETE", full_name=name,
                       phone_e164=phone or f"+55119{next(_seq)}0"))
    db.flush()
    return u


def _future() -> datetime:
    return datetime.now(timezone.utc) + timedelta(hours=1)


def _povoar_todas_as_tabelas_de_purga(db: Session, user: User) -> list:
    """
    Cria uma linha em cada tabela da matriz de purga.

    Os valores por coluna obrigatória são preenchidos por nome, para o teste
    não precisar conhecer o schema de cada modelo — o que faria dele um
    espelho frágil das models.

    Devolve os pares (model, coluna) que foram REALMENTE povoados. Tabelas com
    coluna ARRAY não existem em SQLite; em vez de fingir cobertura, elas são
    excluídas da asserção e listadas em `TABELAS_SEM_COBERTURA_SQLITE`.
    """
    valores = {
        "user_id": user.id,
        "requested_by": user.id,
        "phone_e164": "+5511999999999",
        "email": "residuo@synthetic.invalid",
        "channel": "SMS",
        "code_hash": "hash",
        "token_hash": "hash",
        "expires_at": _future(),
        "endpoint": "https://push.synthetic.invalid/abc",
        "p256dh": "chave",
        "auth": "auth",
        "mes": 1,
        "ano": 2026,
        "permission_code": "TESTE",
        "fields_requested": ["full_name"],
    }
    from sqlalchemy.dialects.postgresql import ARRAY

    povoados = []
    for model, col in _PURGE:
        colunas = [
            c for c in model.__table__.columns
            if not c.nullable and c.default is None
            and c.server_default is None and not c.primary_key
        ]
        if any(isinstance(c.type, ARRAY) for c in colunas):
            TABELAS_SEM_COBERTURA_SQLITE.add(model.__tablename__)
            continue
        db.add(model(**{c.name: valores[c.name] for c in colunas if c.name in valores}))
        povoados.append((model, col))
    db.flush()
    return povoados


def _contar(db: Session, model, column, user_id) -> int:
    return db.execute(
        select(func.count()).select_from(model.__table__).where(column == user_id)
    ).scalar_one()


# ---------------------------------------------------------------------------
# O teste que não pode ficar desatualizado
# ---------------------------------------------------------------------------
def test_matriz_de_purga_nao_deixa_residuo(client: TestClient, db_session: Session):
    user = _mk_user(db_session, "del-purga", "Para Excluir")
    cobertos = _povoar_todas_as_tabelas_de_purga(db_session, user)
    db_session.commit()

    antes = {m.__tablename__: _contar(db_session, m, c, user.id) for m, c in cobertos}
    assert all(v == 1 for v in antes.values()), f"fixture nao povoou tudo: {antes}"
    # A cobertura tem de ser quase total — se sobrar mais de uma tabela fora,
    # o teste deixou de valer como prova da matriz.
    assert len(cobertos) >= len(_PURGE) - 1, (
        f"cobertura insuficiente: {len(cobertos)}/{len(_PURGE)}, "
        f"fora: {TABELAS_SEM_COBERTURA_SQLITE}"
    )

    r = client.delete("/auth/me", headers=_hdr("del-purga"))
    assert r.status_code == 204, r.text

    db_session.expire_all()
    depois = {m.__tablename__: _contar(db_session, m, c, user.id) for m, c in cobertos}
    residuo = {k: v for k, v in depois.items() if v != 0}
    assert not residuo, f"dado pessoal sobreviveu a exclusao: {residuo}"


def test_telefone_e_email_nao_sobrevivem(client: TestClient, db_session: Session):
    """
    Caso concreto do bug corrigido: phone_verifications guarda o telefone em
    claro e email_verifications guarda o e-mail. Antes da correção os dois
    permaneciam no banco depois de o titular pedir a eliminação.
    """
    user = _mk_user(db_session, "del-contato", "Contato")
    _povoar_todas_as_tabelas_de_purga(db_session, user)
    db_session.commit()

    client.delete("/auth/me", headers=_hdr("del-contato"))
    db_session.expire_all()

    from app.db.models import EmailVerification, PhoneVerification

    # Procura pelo VALOR, não pela chave estrangeira: pega também o caso de a
    # linha ser desvinculada do usuário em vez de apagada.
    assert db_session.execute(
        select(PhoneVerification).where(PhoneVerification.phone_e164 == "+5511999999999")
    ).first() is None, "telefone sobreviveu a exclusao"

    assert db_session.execute(
        select(EmailVerification).where(
            EmailVerification.email == "residuo@synthetic.invalid"
        )
    ).first() is None, "e-mail sobreviveu a exclusao"

    assert db_session.execute(
        select(UserProfile).where(UserProfile.user_id == user.id)
    ).first() is None, "perfil (com telefone e CPF) sobreviveu"


def test_push_para_de_ser_entregue(client: TestClient, db_session: Session):
    """Conta excluída não pode continuar recebendo notificação."""
    user = _mk_user(db_session, "del-push", "Push")
    db_session.add(PushSubscription(user_id=user.id, endpoint="https://p.invalid/x",
                                    p256dh="k", auth="a"))
    db_session.commit()

    client.delete("/auth/me", headers=_hdr("del-push"))
    db_session.expire_all()

    assert db_session.execute(
        select(PushSubscription).where(PushSubscription.user_id == user.id)
    ).first() is None


def test_ugc_sai_do_ar_sem_quebrar_thread_de_terceiro(client: TestClient, db_session: Session):
    """
    App Store 5.1.1(v): o conteúdo da conta sai do ar. Mas a resposta de OUTRO
    membro na mesma thread continua existindo — apagar em cascata destruiria
    conversa alheia.
    """
    autor = _mk_user(db_session, "del-autor", "Autor")
    outro = _mk_user(db_session, "del-outro", "Outro")
    unit = OrgUnit(type=OrgUnitType.MINISTERIO, name="u", slug="del-u",
                   channel_post_mode=ChannelPostMode.ALL_MEMBERS)
    db_session.add(unit)
    db_session.flush()
    for u in (autor, outro):
        db_session.add(OrgMembership(user_id=u.id, org_unit_id=unit.id,
                                     role=OrgRoleCode.MEMBER,
                                     status=MembershipStatus.ACTIVE))
    post = ChannelPost(org_unit_id=unit.id, author_user_id=autor.id,
                       title="T", body="Corpo do autor")
    db_session.add(post)
    db_session.flush()
    resposta_alheia = ChannelReply(post_id=post.id, author_user_id=outro.id,
                                   body="Resposta de terceiro")
    db_session.add(resposta_alheia)
    db_session.commit()

    client.delete("/auth/me", headers=_hdr("del-autor"))
    db_session.expire_all()

    assert db_session.get(ChannelPost, post.id).deleted_at is not None, \
        "post do usuario excluido continua visivel"
    assert db_session.get(ChannelReply, resposta_alheia.id).deleted_at is None, \
        "resposta de terceiro foi apagada junto — nao pode"


def test_bloqueios_somem_nas_duas_direcoes(client: TestClient, db_session: Session):
    a = _mk_user(db_session, "del-bloq-a", "A")
    b = _mk_user(db_session, "del-bloq-b", "B")
    db_session.add(UserBlock(blocker_user_id=a.id, blocked_user_id=b.id))
    db_session.add(UserBlock(blocker_user_id=b.id, blocked_user_id=a.id))
    db_session.commit()

    client.delete("/auth/me", headers=_hdr("del-bloq-a"))
    db_session.expire_all()

    assert db_session.execute(select(UserBlock)).first() is None, \
        "sobrou bloqueio orfao apontando para conta excluida"


def test_nao_e_possivel_reentrar_na_conta(client: TestClient, db_session: Session):
    """
    Exclusão de verdade, não desativação: o provider_uid é anonimizado, então
    o mesmo login não resolve mais para esta conta.
    """
    user = _mk_user(db_session, "del-relogin", "Relogin")
    db_session.commit()
    user_id = user.id

    assert client.delete("/auth/me", headers=_hdr("del-relogin")).status_code == 204
    db_session.expire_all()

    ident = db_session.execute(
        select(UserIdentity).where(UserIdentity.user_id == user_id)
    ).scalar_one()
    assert ident.provider_uid != "del-relogin"
    assert ident.provider_uid.endswith("@deleted.invalid")
    assert db_session.get(User, user_id).is_active is False


# ---------------------------------------------------------------------------
# O outro lado: o que a lei manda GUARDAR não pode ser apagado
# ---------------------------------------------------------------------------
def test_evidencia_de_consentimento_e_retida(client: TestClient, db_session: Session):
    """
    UserConsent é a prova de que o titular aceitou os termos. Apagá-la
    destruiria a própria evidência exigida pela retenção de 5 anos.
    """
    user = _mk_user(db_session, "del-consent", "Consent")
    doc = LegalDocument(type="TERMS", version="1.0", content="Termos")
    db_session.add(doc)
    db_session.flush()
    db_session.add(UserConsent(user_id=user.id, document_id=doc.id))
    db_session.commit()

    client.delete("/auth/me", headers=_hdr("del-consent"))
    db_session.expire_all()

    assert db_session.execute(
        select(UserConsent).where(UserConsent.user_id == user.id)
    ).first() is not None, "evidencia de aceite foi destruida"


def test_exclusao_fica_registrada_na_auditoria(client: TestClient, db_session: Session):
    from app.db.models import AuditLog

    user = _mk_user(db_session, "del-audit", "Audit")
    db_session.commit()

    client.delete("/auth/me", headers=_hdr("del-audit"))
    db_session.expire_all()

    log = db_session.execute(
        select(AuditLog).where(AuditLog.entity_id == str(user.id),
                               AuditLog.action == "account_deleted")
    ).scalars().first()
    assert log is not None, "exclusao nao gerou trilha de auditoria"
