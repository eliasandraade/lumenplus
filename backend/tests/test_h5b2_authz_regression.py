"""
H5B.2 — Regressões de autorização para os dois achados médios.

Testes de integração reais (TestClient, endpoints reais). Seed via db_session.

- H5A-03: GET /org/units/{id} só revela unidade RESTRICTED para membro/admin
          (PUBLIC ∨ membro ∨ DEV/ADMIN, via get_user_permissions.can_view).
- H5A-04: POST /admin/export/{id}/approve bloqueia auto-aprovação (quem solicitou
          não pode aprovar a própria exportação).

Nota: DataExportRequest.fields_requested é postgresql.ARRAY, que não binda no
SQLite dos testes (lista → 'type not supported'). Por isso a linha de export é
semeada via SQL bruto (a coluna ARRAY vira texto inofensivo, não usado pelo
approve_export). O endpoint testado continua sendo o real.
"""
import uuid

from fastapi.testclient import TestClient
from sqlalchemy import select, text
from sqlalchemy.orm import Session

from app.db.models import (
    DataExportRequest,
    GlobalRole,
    MembershipStatus,
    OrgMembership,
    OrgRoleCode,
    OrgUnit,
    OrgUnitType,
    User,
    UserGlobalRole,
    UserIdentity,
    Visibility,
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


def _mk_unit(db: Session, name: str, slug: str, visibility: Visibility) -> OrgUnit:
    unit = OrgUnit(type=OrgUnitType.MINISTERIO, name=name, slug=slug, visibility=visibility)
    db.add(unit)
    db.flush()
    return unit


def _mk_membership(db: Session, user: User, unit: OrgUnit, role: OrgRoleCode) -> None:
    db.add(
        OrgMembership(
            user_id=user.id, org_unit_id=unit.id, role=role, status=MembershipStatus.ACTIVE
        )
    )
    db.flush()


def _seed_export_request(db: Session, requester: User, status: str = "PENDING") -> uuid.UUID:
    """Semeia DataExportRequest via SQL bruto (driblando o ARRAY no SQLite)."""
    eid = uuid.uuid4()
    db.execute(
        text(
            "INSERT INTO data_export_requests "
            "(id, requested_by, status, fields_requested, has_sensitive) "
            "VALUES (:id, :rb, :st, :f, 1)"
        ),
        {"id": eid.hex, "rb": requester.id.hex, "st": status, "f": "{cpf}"},
    )
    db.flush()
    return eid


# ═══════════════════════════════════════════════════════════════════════════
# H5A-03 — visibilidade de GET /org/units/{id}
# ═══════════════════════════════════════════════════════════════════════════


def test_h5a03_nao_membro_nao_le_unidade_restrita(client: TestClient, db_session: Session):
    _mk_user(db_session, "outsider-uid", "outsider@test.com")
    unit = _mk_unit(db_session, "Grupo Reservado", "grupo-reservado", Visibility.RESTRICTED)
    unit_id = unit.id
    db_session.commit()

    r = client.get(f"/org/units/{unit_id}", headers=_headers("outsider-uid", "outsider@test.com"))
    assert r.status_code in (403, 404), r.text


def test_h5a03_membro_le_unidade_restrita(client: TestClient, db_session: Session):
    member = _mk_user(db_session, "member-uid", "member@test.com")
    unit = _mk_unit(db_session, "Grupo Reservado 2", "grupo-reservado-2", Visibility.RESTRICTED)
    _mk_membership(db_session, member, unit, OrgRoleCode.MEMBER)
    unit_id = unit.id
    db_session.commit()

    r = client.get(f"/org/units/{unit_id}", headers=_headers("member-uid", "member@test.com"))
    assert r.status_code == 200, r.text
    assert r.json()["visibility"] == "RESTRICTED"


def test_h5a03_unidade_publica_acessivel_a_autenticado(client: TestClient, db_session: Session):
    _mk_user(db_session, "anyauth-uid", "anyauth@test.com")
    unit = _mk_unit(db_session, "Grupo Aberto", "grupo-aberto", Visibility.PUBLIC)
    unit_id = unit.id
    db_session.commit()

    r = client.get(f"/org/units/{unit_id}", headers=_headers("anyauth-uid", "anyauth@test.com"))
    assert r.status_code == 200, r.text
    assert r.json()["visibility"] == "PUBLIC"


def test_h5a03_admin_le_unidade_restrita(client: TestClient, db_session: Session):
    _mk_user(db_session, "admin-uid", "admin@test.com", roles=("ADMIN",))
    unit = _mk_unit(db_session, "Grupo Reservado 3", "grupo-reservado-3", Visibility.RESTRICTED)
    unit_id = unit.id
    db_session.commit()

    r = client.get(f"/org/units/{unit_id}", headers=_headers("admin-uid", "admin@test.com"))
    assert r.status_code == 200, r.text


# ═══════════════════════════════════════════════════════════════════════════
# H5A-04 — anti auto-aprovação em POST /admin/export/{id}/approve
# ═══════════════════════════════════════════════════════════════════════════


def test_h5a04_requester_nao_aprova_a_propria_exportacao(client: TestClient, db_session: Session):
    # ADMIN tem permissão de aprovação E de exportação; ainda assim não pode
    # aprovar a própria solicitação.
    requester = _mk_user(db_session, "adm-self-uid", "admself@test.com", roles=("ADMIN",))
    eid = _seed_export_request(db_session, requester)
    db_session.commit()

    r = client.post(f"/admin/export/{eid}/approve", headers=_headers("adm-self-uid", "admself@test.com"))
    assert r.status_code == 403, r.text
    assert r.json()["detail"]["error"] == "self_approval_denied"

    status = db_session.execute(
        select(DataExportRequest.status).where(DataExportRequest.id == eid)
    ).scalar_one()
    assert status == "PENDING"  # não mudou


def test_h5a04_outro_aprovador_aprova(client: TestClient, db_session: Session):
    requester = _mk_user(db_session, "req-uid", "req@test.com", roles=("SECRETARY",))
    _mk_user(db_session, "council-uid", "council@test.com", roles=("COUNCIL_GENERAL",))
    eid = _seed_export_request(db_session, requester)
    db_session.commit()

    r = client.post(f"/admin/export/{eid}/approve", headers=_headers("council-uid", "council@test.com"))
    assert r.status_code == 200, r.text
    assert r.json()["status"] == "GENERATED"

    status = db_session.execute(
        select(DataExportRequest.status).where(DataExportRequest.id == eid)
    ).scalar_one()
    assert status == "GENERATED"


def test_h5a04_sem_role_de_aprovacao_bloqueado(client: TestClient, db_session: Session):
    requester = _mk_user(db_session, "req2-uid", "req2@test.com")
    _mk_user(db_session, "sec-only-uid", "seconly@test.com", roles=("SECRETARY",))
    eid = _seed_export_request(db_session, requester)
    db_session.commit()

    # SECRETARY pode solicitar, mas não aprovar (não é DEV/ADMIN/COUNCIL_GENERAL).
    r = client.post(f"/admin/export/{eid}/approve", headers=_headers("sec-only-uid", "seconly@test.com"))
    assert r.status_code == 403, r.text

    status = db_session.execute(
        select(DataExportRequest.status).where(DataExportRequest.id == eid)
    ).scalar_one()
    assert status == "PENDING"


def test_h5a04_reject_por_outro_aprovador_nao_regrediu(client: TestClient, db_session: Session):
    requester = _mk_user(db_session, "req3-uid", "req3@test.com", roles=("SECRETARY",))
    _mk_user(db_session, "council2-uid", "council2@test.com", roles=("COUNCIL_GENERAL",))
    eid = _seed_export_request(db_session, requester)
    db_session.commit()

    r = client.post(f"/admin/export/{eid}/reject", headers=_headers("council2-uid", "council2@test.com"))
    assert r.status_code == 200, r.text

    status = db_session.execute(
        select(DataExportRequest.status).where(DataExportRequest.id == eid)
    ).scalar_one()
    assert status == "REJECTED"
