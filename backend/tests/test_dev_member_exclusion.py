"""
Admin 2.0 — Fase 1.1 (Partes B + C): DEV excluído de membros e do dashboard.

DEV é conta técnica/infra → não é membro real nem entra nas métricas do
dashboard (decisão de 2026-06-10). Permanece apenas em /admin/users.

Cobre (spec docs/superpowers/specs/2026-06-10-admin-2.0-fase-1.1-...):
- B1: /org/units/{id}/members não lista DEV.
- B2: member_count da árvore (/org/tree) não conta DEV.
- B3–B5: dashboard total_active / people_active / by_unit_type / top_ministries.
- C1–C7: dashboard total / complete / novos / faixas / geografia / perfil.
- ADMIN (não-DEV) continua contando.
- Sanidade: remover o papel DEV faz a pessoa voltar a contar.
- Convites inalterados.

Padrão: TestClient real + seed no db_session (mesmo engine do client).
"""
from datetime import date

from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.models import (
    GlobalRole,
    MembershipStatus,
    OrgMembership,
    OrgRoleCode,
    OrgUnit,
    OrgUnitType,
    ProfileCatalog,
    ProfileCatalogItem,
    User,
    UserGlobalRole,
    UserIdentity,
    UserProfile,
)


# ── Helpers ─────────────────────────────────────────────────────────────────


def _headers(uid: str, email: str) -> dict:
    return {"Authorization": f"Bearer dev:{uid}:{email}"}


def _mk_user(db: Session, uid: str, email: str, roles: tuple = (), active: bool = True) -> User:
    user = User(is_active=active)
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


def _mk_profile(db: Session, user: User, **kwargs) -> UserProfile:
    profile = UserProfile(user_id=user.id, status=kwargs.pop("status", "COMPLETE"), **kwargs)
    db.add(profile)
    db.flush()
    return profile


def _mk_unit(
    db: Session,
    name: str,
    slug: str,
    unit_type: OrgUnitType = OrgUnitType.MINISTERIO,
    parent: OrgUnit | None = None,
) -> OrgUnit:
    unit = OrgUnit(type=unit_type, name=name, slug=slug, parent_id=parent.id if parent else None)
    db.add(unit)
    db.flush()
    return unit


def _mk_membership(db: Session, user: User, unit: OrgUnit, role: OrgRoleCode = OrgRoleCode.MEMBER) -> None:
    db.add(
        OrgMembership(
            user_id=user.id, org_unit_id=unit.id, role=role, status=MembershipStatus.ACTIVE
        )
    )
    db.flush()


def _admin_caller(db: Session, uid: str = "qa-admin", email: str = "qa-admin@test.com") -> dict:
    """ADMIN sem perfil e sem vínculo (não polui métricas de perfil/membership)."""
    if not db.execute(
        select(UserIdentity).where(UserIdentity.provider_uid == uid)
    ).scalar_one_or_none():
        _mk_user(db, uid, email, roles=("ADMIN",))
    db.commit()
    return _headers(uid, email)


# ═══════════════════════════════════════════════════════════════════════════
# B1 — lista de membros não inclui DEV
# ═══════════════════════════════════════════════════════════════════════════


def test_b1_members_list_exclui_dev(client: TestClient, db_session: Session):
    unit = _mk_unit(db_session, "Música", "musica")
    common = _mk_user(db_session, "c1", "c1@test.com")
    admin_m = _mk_user(db_session, "am", "am@test.com", roles=("ADMIN",))
    dev = _mk_user(db_session, "dv", "dv@test.com", roles=("DEV",))
    _mk_profile(db_session, common, full_name="Comum")
    _mk_profile(db_session, admin_m, full_name="AdminMembro")
    _mk_profile(db_session, dev, full_name="DevMembro")
    for u in (common, admin_m, dev):
        _mk_membership(db_session, u, unit)

    headers = _admin_caller(db_session)
    resp = client.get(f"/org/units/{unit.id}/members", headers=headers)
    assert resp.status_code == 200, resp.text
    members = resp.json()["members"]

    assert len(members) == 2, members  # common + admin, sem o DEV
    assert "DevMembro" not in resp.text  # DEV não vaza nem no payload
    assert str(dev.id) not in resp.text


# ═══════════════════════════════════════════════════════════════════════════
# B2 — member_count da árvore não conta DEV
# ═══════════════════════════════════════════════════════════════════════════


def test_b2_tree_member_count_exclui_dev(client: TestClient, db_session: Session):
    root = _mk_unit(db_session, "Conselho Geral", "cg", OrgUnitType.CONSELHO_GERAL)
    common = _mk_user(db_session, "c1", "c1@test.com")
    admin_m = _mk_user(db_session, "am", "am@test.com", roles=("ADMIN",))
    dev = _mk_user(db_session, "dv", "dv@test.com", roles=("DEV",))
    for u in (common, admin_m, dev):
        _mk_membership(db_session, u, root)

    headers = _admin_caller(db_session)
    resp = client.get("/org/tree", headers=headers)
    assert resp.status_code == 200, resp.text
    tree_root = resp.json()["root"]
    assert tree_root is not None
    assert tree_root["member_count"] == 2  # common + admin, sem DEV


# ═══════════════════════════════════════════════════════════════════════════
# B3–B5 — dashboard: vínculos, pessoas, por tipo, top ministérios
# ═══════════════════════════════════════════════════════════════════════════


def test_b3_b5_dashboard_membership_exclui_dev(client: TestClient, db_session: Session):
    setor = _mk_unit(db_session, "Setor Norte", "setor-norte", OrgUnitType.SETOR)
    ministerio = _mk_unit(db_session, "Acolhida", "acolhida", parent=setor)
    common = _mk_user(db_session, "c1", "c1@test.com")
    admin_m = _mk_user(db_session, "am", "am@test.com", roles=("ADMIN",))
    dev = _mk_user(db_session, "dv", "dv@test.com", roles=("DEV",))
    for u in (common, admin_m, dev):
        _mk_membership(db_session, u, ministerio)

    headers = _admin_caller(db_session)
    data = client.get("/admin/dashboard", headers=headers).json()

    assert data["memberships"]["total_active"] == 2  # vínculos sem DEV
    assert data["memberships"]["people_active"] == 2  # pessoas sem DEV

    by_type = {b["type"]: b["count"] for b in data["memberships"]["by_unit_type"]}
    assert by_type.get("MINISTERIO") == 2

    top = next(t for t in data["top_ministries"] if t["id"] == str(ministerio.id))
    assert top["member_count"] == 2  # pessoas distintas, DEV fora
    assert top["sector_name"] == "Setor Norte"


def test_dev_em_duas_unidades_nao_aparece_em_nenhuma(client: TestClient, db_session: Session):
    u_a = _mk_unit(db_session, "Min A", "min-a")
    u_b = _mk_unit(db_session, "Min B", "min-b")
    common = _mk_user(db_session, "c1", "c1@test.com")
    dev = _mk_user(db_session, "dv", "dv@test.com", roles=("DEV",))
    _mk_membership(db_session, common, u_a)
    _mk_membership(db_session, dev, u_a)
    _mk_membership(db_session, dev, u_b)

    headers = _admin_caller(db_session)
    # nas duas listas só o comum aparece (em u_b, nenhum não-DEV)
    ma = client.get(f"/org/units/{u_a.id}/members", headers=headers).json()["members"]
    mb = client.get(f"/org/units/{u_b.id}/members", headers=headers).json()["members"]
    assert len(ma) == 1
    assert len(mb) == 0

    data = client.get("/admin/dashboard", headers=headers).json()
    assert data["memberships"]["total_active"] == 1  # só o vínculo do comum
    assert data["memberships"]["people_active"] == 1


# ═══════════════════════════════════════════════════════════════════════════
# C1–C7 — dashboard: métricas globais de usuário/perfil excluem DEV
# ═══════════════════════════════════════════════════════════════════════════


def test_partC_metricas_globais_excluem_dev(client: TestClient, db_session: Session):
    # Catálogo VOCATIONAL_REALITY com 1 item (para o breakdown C6)
    catalog = ProfileCatalog(code="VOCATIONAL_REALITY", name="Realidade Vocacional")
    db_session.add(catalog)
    db_session.flush()
    item = ProfileCatalogItem(catalog_id=catalog.id, code="VOCACIONAL", label="Vocacional", sort_order=1)
    db_session.add(item)
    db_session.flush()

    # 3 comuns (≥ K_MIN p/ cidade aparecer) + 1 DEV, todos COMPLETE em Fortaleza, 1990
    commons = []
    for i in range(3):
        u = _mk_user(db_session, f"c{i}", f"c{i}@test.com")
        _mk_profile(
            db_session, u, status="COMPLETE", city="Fortaleza", state="CE",
            birth_date=date(1990, 1, 1), vocational_reality_item_id=item.id,
            is_from_mission=False,
        )
        commons.append(u)
    dev = _mk_user(db_session, "dv", "dv@test.com", roles=("DEV",))
    _mk_profile(
        db_session, dev, status="COMPLETE", city="Fortaleza", state="CE",
        birth_date=date(1990, 1, 1), vocational_reality_item_id=item.id,
        is_from_mission=True,
    )

    headers = _admin_caller(db_session)  # ADMIN sem perfil → conta só em total
    data = client.get("/admin/dashboard", headers=headers).json()

    # C1 total: 3 comuns + caller(admin, ativo, sem perfil) = 4; DEV fora
    assert "incomplete_profiles" not in data["users"]
    assert data["users"]["total"] == 4
    # C3 cadastros completos: só os 3 comuns (caller sem perfil; DEV fora)
    assert data["users"]["complete_profiles"] == 3

    # C5 geografia: Fortaleza = 3 (DEV fora); sem suprimir (>= K_MIN=3)
    by_city = {c["city"]: c["count"] for c in data["geography"]["by_city"]}
    assert by_city.get("Fortaleza") == 3, data["geography"]["by_city"]
    by_state = {s["state"]: s["count"] for s in data["geography"]["by_state"]}
    assert by_state.get("CE") == 3

    # C4 faixas etárias: 1990 → "36-45" em 2026; 3 (DEV fora)
    ages = {r["range"]: r["count"] for r in data["age_ranges"]}
    assert ages.get("36-45") == 3, ages

    # C6 breakdown vocacional: 3 (DEV fora)
    voc = {r["label"]: r["count"] for r in data["profile_breakdown"]["by_vocational_reality"]}
    assert voc.get("Vocacional") == 3, voc

    # C7 "vieram de missão": só o DEV tinha a flag → 0 após exclusão
    assert data["profile_breakdown"]["from_mission"] == 0


def test_partC_admin_membro_conta_dev_nao(client: TestClient, db_session: Session):
    """ADMIN (não-DEV) entra nas métricas globais; DEV não."""
    admin_u = _mk_user(db_session, "a1", "a1@test.com", roles=("ADMIN",))
    _mk_profile(db_session, admin_u, status="COMPLETE")
    dev = _mk_user(db_session, "dv", "dv@test.com", roles=("DEV",))
    _mk_profile(db_session, dev, status="COMPLETE")

    headers = _admin_caller(db_session)
    data = client.get("/admin/dashboard", headers=headers).json()
    # caller(admin sem perfil) + admin_u + (dev fora) = 2 ativos; admin_u completo = 1
    assert data["users"]["total"] == 2
    assert data["users"]["complete_profiles"] == 1


# ═══════════════════════════════════════════════════════════════════════════
# Sanidade — remover o papel DEV faz a pessoa voltar a contar
# ═══════════════════════════════════════════════════════════════════════════


def test_remover_papel_dev_faz_voltar_a_contar(client: TestClient, db_session: Session):
    unit = _mk_unit(db_session, "Min", "min")
    dev = _mk_user(db_session, "dv", "dv@test.com", roles=("DEV",))
    _mk_profile(db_session, dev, full_name="ExDev")
    _mk_membership(db_session, dev, unit)

    headers = _admin_caller(db_session)
    d1 = client.get("/admin/dashboard", headers=headers).json()
    assert d1["memberships"]["people_active"] == 0  # DEV excluído

    # Remove o papel DEV
    role = db_session.execute(select(GlobalRole).where(GlobalRole.code == "DEV")).scalar_one()
    ugr = db_session.execute(
        select(UserGlobalRole).where(
            UserGlobalRole.user_id == dev.id,
            UserGlobalRole.global_role_id == role.id,
        )
    ).scalar_one()
    db_session.delete(ugr)
    db_session.commit()

    d2 = client.get("/admin/dashboard", headers=headers).json()
    assert d2["memberships"]["people_active"] == 1  # agora conta


# ═══════════════════════════════════════════════════════════════════════════
# Convites inalterados pela exclusão de DEV
# ═══════════════════════════════════════════════════════════════════════════


def test_convites_inalterados(client: TestClient, db_session: Session):
    from app.db.models import InviteStatus, OrgInvite

    unit = _mk_unit(db_session, "Min", "min")
    inviter = _mk_user(db_session, "inv", "inv@test.com")
    dev = _mk_user(db_session, "dv", "dv@test.com", roles=("DEV",))
    # convite ACEITO endereçado ao DEV — deve seguir contando (convites não filtram DEV)
    db_session.add(
        OrgInvite(
            org_unit_id=unit.id, invited_user_id=dev.id,
            invited_by_user_id=inviter.id, status=InviteStatus.ACCEPTED,
        )
    )
    db_session.flush()

    headers = _admin_caller(db_session)
    data = client.get("/admin/dashboard", headers=headers).json()
    assert data["invites"]["total"] == 1
    assert data["invites"]["accepted"] == 1
