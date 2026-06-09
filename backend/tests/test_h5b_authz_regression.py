"""
H5D — Regressões de autorização para os fixes do H5B.

Cobre exatamente as duas correções do H5B, batendo nos endpoints REAIS via
TestClient (sem logic-mirror). Dados criados direto no db_session, que
compartilha o mesmo engine SQLite do client (fixtures do conftest).

- H5A-01: GET /admin/users/{id}/profile só revela CPF/RG com bypass DEV ou
          SensitiveAccessRequest APROVADA e não expirada.
- H5A-02: PATCH/DELETE de replies do canal amarram a reply ao org_unit_id da
          rota (sem moderação cruzada entre unidades).
"""
from datetime import datetime, timedelta, timezone

from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.crypto.service import crypto_service
from app.db.models import (
    ChannelPost,
    ChannelReply,
    GlobalRole,
    MembershipStatus,
    OrgMembership,
    OrgRoleCode,
    OrgUnit,
    OrgUnitType,
    SensitiveAccessAudit,
    SensitiveAccessRequest,
    User,
    UserGlobalRole,
    UserIdentity,
    UserProfile,
)


# ── Helpers de seed (db_session) ──────────────────────────────────────────


def _headers(uid: str, email: str) -> dict:
    return {"Authorization": f"Bearer dev:{uid}:{email}"}


def _mk_user(db: Session, uid: str, email: str, roles: tuple = ()) -> User:
    """Cria User + UserIdentity(firebase, uid) + roles globais. Token: dev:uid:email."""
    user = User(is_active=True)
    db.add(user)
    db.flush()
    db.add(UserIdentity(user_id=user.id, provider="firebase", provider_uid=uid, email=email))
    for code in roles:
        role = db.execute(select(GlobalRole).where(GlobalRole.code == code)).scalar_one_or_none()
        if role is None:
            role = GlobalRole(code=code, name=code)
            db.add(role)
            db.flush()
        db.add(UserGlobalRole(user_id=user.id, global_role_id=role.id))
    db.flush()
    return user


def _mk_target_with_docs(db: Session, uid: str, email: str) -> User:
    """Cria um usuário-alvo com CPF/RG criptografados (mesma chave do crypto_service)."""
    target = _mk_user(db, uid, email)
    cpf_hash, cpf_enc = crypto_service.encrypt_cpf("11144477735")
    rg_enc = crypto_service.encrypt_rg("123456789")
    db.add(
        UserProfile(
            user_id=target.id,
            full_name="Alvo Teste",
            status="COMPLETE",
            cpf_hash=cpf_hash,
            cpf_encrypted=cpf_enc,
            rg_encrypted=rg_enc,
        )
    )
    db.flush()
    return target


def _mk_unit(db: Session, name: str, slug: str) -> OrgUnit:
    unit = OrgUnit(type=OrgUnitType.MINISTERIO, name=name, slug=slug)
    db.add(unit)
    db.flush()
    return unit


def _mk_membership(db: Session, user: User, unit: OrgUnit, role: OrgRoleCode) -> None:
    db.add(
        OrgMembership(
            user_id=user.id,
            org_unit_id=unit.id,
            role=role,
            status=MembershipStatus.ACTIVE,
        )
    )
    db.flush()


def _mk_post(db: Session, unit: OrgUnit, author: User) -> ChannelPost:
    post = ChannelPost(org_unit_id=unit.id, author_user_id=author.id, title="Post", body="corpo")
    db.add(post)
    db.flush()
    return post


def _mk_reply(db: Session, post: ChannelPost, author: User, body: str = "resposta") -> ChannelReply:
    reply = ChannelReply(post_id=post.id, author_user_id=author.id, body=body)
    db.add(reply)
    db.flush()
    return reply


# ═══════════════════════════════════════════════════════════════════════════
# H5A-01 — gate de CPF/RG em GET /admin/users/{id}/profile
# ═══════════════════════════════════════════════════════════════════════════


def test_h5a01_secretary_sem_request_nao_ve_cpf_rg(client: TestClient, db_session: Session):
    _mk_user(db_session, "sec-uid", "sec@test.com", roles=("SECRETARY",))
    target = _mk_target_with_docs(db_session, "target-sec", "alvo1@test.com")
    target_id = target.id
    db_session.commit()

    r = client.get(f"/admin/users/{target_id}/profile", headers=_headers("sec-uid", "sec@test.com"))
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["cpf"] is None
    assert body["rg"] is None


def test_h5a01_admin_sem_request_nao_ve_cpf_rg(client: TestClient, db_session: Session):
    _mk_user(db_session, "adm-uid", "adm@test.com", roles=("ADMIN",))
    target = _mk_target_with_docs(db_session, "target-adm", "alvo2@test.com")
    target_id = target.id
    db_session.commit()

    r = client.get(f"/admin/users/{target_id}/profile", headers=_headers("adm-uid", "adm@test.com"))
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["cpf"] is None
    assert body["rg"] is None


def test_h5a01_dev_bypass_ve_cpf_rg(client: TestClient, db_session: Session):
    _mk_user(db_session, "dev-uid", "dev@test.com", roles=("DEV",))
    target = _mk_target_with_docs(db_session, "target-dev", "alvo3@test.com")
    target_id = target.id
    db_session.commit()

    r = client.get(f"/admin/users/{target_id}/profile", headers=_headers("dev-uid", "dev@test.com"))
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["cpf"] == "11144477735"
    assert body["rg"] == "123456789"


def test_h5a01_admin_com_request_aprovada_ve_cpf_rg_e_gera_audit(
    client: TestClient, db_session: Session
):
    caller = _mk_user(db_session, "adm2-uid", "adm2@test.com", roles=("ADMIN",))
    target = _mk_target_with_docs(db_session, "target-adm2", "alvo4@test.com")
    caller_id = caller.id
    target_id = target.id
    db_session.add(
        SensitiveAccessRequest(
            requester_user_id=caller_id,
            target_user_id=target_id,
            scope="CPF_RG",
            reason="atendimento autorizado",
            status="APPROVED",
            approved_at=datetime.now(timezone.utc),
            expires_at=datetime.now(timezone.utc) + timedelta(minutes=30),
        )
    )
    db_session.commit()

    r = client.get(
        f"/admin/users/{target_id}/profile", headers=_headers("adm2-uid", "adm2@test.com")
    )
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["cpf"] == "11144477735"
    assert body["rg"] == "123456789"

    audit = db_session.execute(
        select(SensitiveAccessAudit).where(
            SensitiveAccessAudit.viewer_user_id == caller_id,
            SensitiveAccessAudit.target_user_id == target_id,
            SensitiveAccessAudit.action == "VIEW_CPF_RG",
        )
    ).scalar_one_or_none()
    assert audit is not None


def test_h5a01_request_aprovada_mas_expirada_nao_ve_cpf_rg(client: TestClient, db_session: Session):
    caller = _mk_user(db_session, "sec2-uid", "sec2@test.com", roles=("SECRETARY",))
    target = _mk_target_with_docs(db_session, "target-sec2", "alvo5@test.com")
    caller_id = caller.id
    target_id = target.id
    db_session.add(
        SensitiveAccessRequest(
            requester_user_id=caller_id,
            target_user_id=target_id,
            scope="CPF_RG",
            reason="atendimento expirado",
            status="APPROVED",
            approved_at=datetime.now(timezone.utc) - timedelta(hours=1),
            expires_at=datetime.now(timezone.utc) - timedelta(minutes=1),
        )
    )
    db_session.commit()

    r = client.get(
        f"/admin/users/{target_id}/profile", headers=_headers("sec2-uid", "sec2@test.com")
    )
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["cpf"] is None
    assert body["rg"] is None


# ═══════════════════════════════════════════════════════════════════════════
# H5A-02 — bind de reply ao org_unit em edit/delete de replies do canal
# ═══════════════════════════════════════════════════════════════════════════


def test_h5a02_coordenador_nao_edita_reply_de_outra_unidade(
    client: TestClient, db_session: Session
):
    coord_a = _mk_user(db_session, "coordA-uid", "coordA@test.com")
    unit_a = _mk_unit(db_session, "Unidade A", "unidade-a")
    _mk_membership(db_session, coord_a, unit_a, OrgRoleCode.COORDINATOR)

    author_b = _mk_user(db_session, "authorB-uid", "authorB@test.com")
    unit_b = _mk_unit(db_session, "Unidade B", "unidade-b")
    _mk_membership(db_session, author_b, unit_b, OrgRoleCode.MEMBER)
    post_b = _mk_post(db_session, unit_b, author_b)
    reply_b = _mk_reply(db_session, post_b, author_b)
    unit_a_id, post_b_id, reply_b_id = unit_a.id, post_b.id, reply_b.id
    db_session.commit()

    r = client.patch(
        f"/channel/{unit_a_id}/posts/{post_b_id}/replies/{reply_b_id}",
        headers=_headers("coordA-uid", "coordA@test.com"),
        json={"body": "tentativa de edicao cruzada"},
    )
    assert r.status_code in (403, 404), r.text

    fresh = db_session.execute(
        select(ChannelReply).where(ChannelReply.id == reply_b_id)
    ).scalar_one()
    assert fresh.body == "resposta"  # conteúdo intacto
    assert fresh.edited_at is None


def test_h5a02_coordenador_nao_deleta_reply_de_outra_unidade(
    client: TestClient, db_session: Session
):
    coord_a = _mk_user(db_session, "coordA2-uid", "coordA2@test.com")
    unit_a = _mk_unit(db_session, "Unidade A2", "unidade-a2")
    _mk_membership(db_session, coord_a, unit_a, OrgRoleCode.COORDINATOR)

    author_b = _mk_user(db_session, "authorB2-uid", "authorB2@test.com")
    unit_b = _mk_unit(db_session, "Unidade B2", "unidade-b2")
    _mk_membership(db_session, author_b, unit_b, OrgRoleCode.MEMBER)
    post_b = _mk_post(db_session, unit_b, author_b)
    reply_b = _mk_reply(db_session, post_b, author_b)
    unit_a_id, post_b_id, reply_b_id = unit_a.id, post_b.id, reply_b.id
    db_session.commit()

    r = client.request(
        "DELETE",
        f"/channel/{unit_a_id}/posts/{post_b_id}/replies/{reply_b_id}",
        headers=_headers("coordA2-uid", "coordA2@test.com"),
        json={"reason": "tentativa cruzada"},
    )
    assert r.status_code in (403, 404), r.text

    fresh = db_session.execute(
        select(ChannelReply).where(ChannelReply.id == reply_b_id)
    ).scalar_one()
    assert fresh.deleted_at is None  # não foi removida


def test_h5a02_autor_edita_propria_reply_na_unidade_correta(
    client: TestClient, db_session: Session
):
    author = _mk_user(db_session, "autor-uid", "autor@test.com")
    unit = _mk_unit(db_session, "Unidade C", "unidade-c")
    _mk_membership(db_session, author, unit, OrgRoleCode.MEMBER)
    post = _mk_post(db_session, unit, author)
    reply = _mk_reply(db_session, post, author)
    unit_id, post_id, reply_id = unit.id, post.id, reply.id
    db_session.commit()

    r = client.patch(
        f"/channel/{unit_id}/posts/{post_id}/replies/{reply_id}",
        headers=_headers("autor-uid", "autor@test.com"),
        json={"body": "texto editado"},
    )
    assert r.status_code == 200, r.text
    assert r.json()["body"] == "texto editado"


def test_h5a02_coordenador_deleta_reply_na_unidade_correta(
    client: TestClient, db_session: Session
):
    coord = _mk_user(db_session, "coordC-uid", "coordC@test.com")
    member = _mk_user(db_session, "membroC-uid", "membroC@test.com")
    unit = _mk_unit(db_session, "Unidade D", "unidade-d")
    _mk_membership(db_session, coord, unit, OrgRoleCode.COORDINATOR)
    _mk_membership(db_session, member, unit, OrgRoleCode.MEMBER)
    post = _mk_post(db_session, unit, coord)
    reply = _mk_reply(db_session, post, member)
    unit_id, post_id, reply_id = unit.id, post.id, reply.id
    db_session.commit()

    r = client.request(
        "DELETE",
        f"/channel/{unit_id}/posts/{post_id}/replies/{reply_id}",
        headers=_headers("coordC-uid", "coordC@test.com"),
        json={"reason": "moderacao legitima"},
    )
    assert r.status_code == 200, r.text

    fresh = db_session.execute(
        select(ChannelReply).where(ChannelReply.id == reply_id)
    ).scalar_one()
    assert fresh.deleted_at is not None  # soft-delete aplicado
