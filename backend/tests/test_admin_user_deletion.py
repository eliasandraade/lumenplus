"""
Exclusão (anonimização) de conta pelo painel admin — DELETE /admin/users/{id} (#8).

Testes de integração reais (TestClient, endpoints reais). Seed via db_session
(commit antes da chamada para liberar o lock do SQLite em arquivo).

Matriz de autorização:
- DEV exclui qualquer conta, exceto a si mesmo e outras contas DEV.
- ADMIN exclui apenas contas que não sejam DEV nem ADMIN.
- Ninguém exclui a própria conta por aqui (usar DELETE /auth/me).

Estratégia: anonimização compartilhada com o self-delete
(app.services.account_deletion.anonymize_user) — perfil/CPF removidos, identidade
anonimizada, vínculos removidos, User retido (is_active=False) + audit log.
"""
import uuid

from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.models import (
    AuditLog,
    GlobalRole,
    User,
    UserGlobalRole,
    UserIdentity,
    UserProfile,
)


# ── Helpers ────────────────────────────────────────────────────────────────


def _headers(uid: str, email: str) -> dict:
    return {"Authorization": f"Bearer dev:{uid}:{email}"}


def _mk_user(db: Session, uid: str, email: str, roles: tuple = ()) -> User:
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


def _mk_profile(db: Session, user: User, name: str = "Alvo Teste") -> None:
    db.add(UserProfile(user_id=user.id, status="COMPLETE", full_name=name))
    db.flush()


def _delete(client: TestClient, actor: tuple, target_id, reason: str | None = None):
    url = f"/admin/users/{target_id}"
    if reason is not None:
        url += f"?reason={reason}"
    return client.delete(url, headers=_headers(*actor))


# ── Happy path + anonimização ────────────────────────────────────────────────


def test_admin_deletes_member_anonymizes_and_audits(client: TestClient, db_session: Session):
    admin = _mk_user(db_session, "adm", "adm@x.com", roles=("ADMIN",))
    target = _mk_user(db_session, "mem", "mem@x.com")
    _mk_profile(db_session, target, "Membro Alvo")
    db_session.commit()

    resp = _delete(client, ("adm", "adm@x.com"), target.id, reason="conta_duplicada")
    assert resp.status_code == 204

    db_session.expire_all()
    t = db_session.get(User, target.id)
    assert t is not None and t.is_active is False
    # Perfil removido
    prof = db_session.execute(
        select(UserProfile).where(UserProfile.user_id == target.id)
    ).scalar_one_or_none()
    assert prof is None
    # Identidade anonimizada
    ident = db_session.execute(
        select(UserIdentity).where(UserIdentity.user_id == target.id)
    ).scalar_one()
    assert ident.email.startswith("deleted+")
    assert ident.email_verified is False
    # Audit com actor = admin e motivo
    log = (
        db_session.execute(
            select(AuditLog)
            .where(AuditLog.action == "account_deleted")
            .where(AuditLog.entity_id == str(target.id))
        )
        .scalars()
        .first()
    )
    assert log is not None
    assert log.actor_user_id == admin.id
    assert log.extra_data.get("reason") == "admin_action"
    assert log.extra_data.get("admin_reason") == "conta_duplicada"


# ── Matriz de autorização ────────────────────────────────────────────────────


def test_admin_cannot_delete_admin(client: TestClient, db_session: Session):
    _mk_user(db_session, "adm", "adm@x.com", roles=("ADMIN",))
    target = _mk_user(db_session, "adm2", "adm2@x.com", roles=("ADMIN",))
    db_session.commit()
    resp = _delete(client, ("adm", "adm@x.com"), target.id)
    assert resp.status_code == 403


def test_admin_cannot_delete_dev(client: TestClient, db_session: Session):
    _mk_user(db_session, "adm", "adm@x.com", roles=("ADMIN",))
    target = _mk_user(db_session, "dev2", "dev2@x.com", roles=("DEV",))
    db_session.commit()
    resp = _delete(client, ("adm", "adm@x.com"), target.id)
    assert resp.status_code == 403


def test_dev_can_delete_admin(client: TestClient, db_session: Session):
    _mk_user(db_session, "dev", "dev@x.com", roles=("DEV",))
    target = _mk_user(db_session, "adm2", "adm2@x.com", roles=("ADMIN",))
    db_session.commit()
    resp = _delete(client, ("dev", "dev@x.com"), target.id)
    assert resp.status_code == 204
    db_session.expire_all()
    assert db_session.get(User, target.id).is_active is False


def test_nobody_deletes_dev_even_dev(client: TestClient, db_session: Session):
    _mk_user(db_session, "dev", "dev@x.com", roles=("DEV",))
    target = _mk_user(db_session, "dev2", "dev2@x.com", roles=("DEV",))
    db_session.commit()
    resp = _delete(client, ("dev", "dev@x.com"), target.id)
    assert resp.status_code == 403


def test_cannot_delete_self_via_admin(client: TestClient, db_session: Session):
    admin = _mk_user(db_session, "adm", "adm@x.com", roles=("ADMIN",))
    db_session.commit()
    resp = _delete(client, ("adm", "adm@x.com"), admin.id)
    assert resp.status_code == 400
    db_session.expire_all()
    assert db_session.get(User, admin.id).is_active is True


def test_secretary_cannot_delete(client: TestClient, db_session: Session):
    _mk_user(db_session, "sec", "sec@x.com", roles=("SECRETARY",))
    target = _mk_user(db_session, "mem", "mem@x.com")
    db_session.commit()
    resp = _delete(client, ("sec", "sec@x.com"), target.id)
    assert resp.status_code == 403


def test_member_cannot_delete(client: TestClient, db_session: Session):
    _mk_user(db_session, "mem1", "mem1@x.com")
    target = _mk_user(db_session, "mem2", "mem2@x.com")
    db_session.commit()
    resp = _delete(client, ("mem1", "mem1@x.com"), target.id)
    assert resp.status_code == 403


def test_delete_nonexistent_target_404(client: TestClient, db_session: Session):
    _mk_user(db_session, "adm", "adm@x.com", roles=("ADMIN",))
    db_session.commit()
    resp = _delete(client, ("adm", "adm@x.com"), uuid.uuid4())
    assert resp.status_code == 404


def test_delete_already_inactive_is_idempotent(client: TestClient, db_session: Session):
    _mk_user(db_session, "adm", "adm@x.com", roles=("ADMIN",))
    target = _mk_user(db_session, "mem", "mem@x.com")
    db_session.commit()
    # Primeira exclusão anonimiza (is_active=False)
    assert _delete(client, ("adm", "adm@x.com"), target.id).status_code == 204
    # Re-exclusão de conta já inativa -> sucesso idempotente, nao 404
    assert _delete(client, ("adm", "adm@x.com"), target.id).status_code == 204


# ── Regressão do self-delete ─────────────────────────────────────────────────


def test_self_delete_me_still_anonymizes(client: TestClient, db_session: Session):
    user = _mk_user(db_session, "self", "self@x.com")
    _mk_profile(db_session, user, "Eu Mesmo")
    db_session.commit()

    resp = client.delete("/auth/me", headers=_headers("self", "self@x.com"))
    assert resp.status_code == 204

    db_session.expire_all()
    u = db_session.get(User, user.id)
    assert u.is_active is False
    prof = db_session.execute(
        select(UserProfile).where(UserProfile.user_id == user.id)
    ).scalar_one_or_none()
    assert prof is None
    log = (
        db_session.execute(
            select(AuditLog)
            .where(AuditLog.action == "account_deleted")
            .where(AuditLog.entity_id == str(user.id))
        )
        .scalars()
        .first()
    )
    assert log is not None
    assert log.extra_data.get("reason") == "user_request"
