"""
Admin 2.0 — Fase 1: regressões do GET /admin/dashboard (B1–B8).

Bate no endpoint REAL via TestClient (sem logic-mirror), seed direto no
db_session (mesmo engine SQLite do client — fixtures do conftest).

Cobertura (spec docs/superpowers/specs/2026-06-10-admin-2.0-fase-1-correcoes.md):
- B1: convites com expired/cancelled; acceptance_rate sobre RESOLVIDOS.
- B2: top_ministries agrupado por id (homônimos não fundem) + sector_name +
      member_count = pessoas distintas.
- B3: memberships.people_active (pessoas) ≠ total_active (vínculos).
- B4: idade por aniversário (não //365).
- B5: geografia normalizada (caixa/espaço), vazios excluídos, supressão k-anon.
- B6: complete_profiles só conta usuários ativos.
- B7: incomplete_profiles fora do payload.
- Authz intocada: ANALISTA 200, sem papel 403.
"""
from datetime import date, timedelta

from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.models import (
    GlobalRole,
    InviteStatus,
    MembershipStatus,
    OrgInvite,
    OrgMembership,
    OrgRoleCode,
    OrgUnit,
    OrgUnitType,
    User,
    UserGlobalRole,
    UserIdentity,
    UserProfile,
)


# ── Helpers de seed ────────────────────────────────────────────────────────


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


def _mk_membership(
    db: Session,
    user: User,
    unit: OrgUnit,
    status: MembershipStatus = MembershipStatus.ACTIVE,
) -> None:
    db.add(
        OrgMembership(
            user_id=user.id, org_unit_id=unit.id, role=OrgRoleCode.MEMBER, status=status
        )
    )
    db.flush()


def _mk_invite(db: Session, unit: OrgUnit, invited: User, inviter: User, status: InviteStatus) -> None:
    db.add(
        OrgInvite(
            org_unit_id=unit.id,
            invited_user_id=invited.id,
            invited_by_user_id=inviter.id,
            status=status,
        )
    )
    db.flush()


def _get_dashboard(client: TestClient, db: Session) -> dict:
    """Cria (ou reusa) um admin e busca o dashboard."""
    if not db.execute(
        select(UserIdentity).where(UserIdentity.provider_uid == "dash-admin")
    ).scalar_one_or_none():
        _mk_user(db, "dash-admin", "dash-admin@test.com", roles=("ADMIN",))
    db.commit()
    resp = client.get("/admin/dashboard", headers=_headers("dash-admin", "dash-admin@test.com"))
    assert resp.status_code == 200, resp.text
    return resp.json()


# ═══════════════════════════════════════════════════════════════════════════
# B1 — Convites: todos os status + taxa sobre resolvidos
# ═══════════════════════════════════════════════════════════════════════════


def test_b1_convites_reconciliam_e_taxa_sobre_resolvidos(client: TestClient, db_session: Session):
    inviter = _mk_user(db_session, "inviter", "inviter@test.com")
    unit = _mk_unit(db_session, "Música", "musica")
    statuses = [
        InviteStatus.ACCEPTED,
        InviteStatus.ACCEPTED,
        InviteStatus.ACCEPTED,
        InviteStatus.REJECTED,
        InviteStatus.PENDING,
        InviteStatus.PENDING,
        InviteStatus.EXPIRED,
        InviteStatus.CANCELLED,
    ]
    for i, st in enumerate(statuses):
        invited = _mk_user(db_session, f"inv-{i}", f"inv{i}@test.com")
        _mk_invite(db_session, unit, invited, inviter, st)

    data = _get_dashboard(client, db_session)
    inv = data["invites"]

    assert inv["accepted"] == 3
    assert inv["declined"] == 1
    assert inv["pending"] == 2
    assert inv["expired"] == 1
    assert inv["cancelled"] == 1
    assert inv["total"] == 8
    # Reconciliação: os 5 status fecham com o total
    assert (
        inv["accepted"] + inv["declined"] + inv["pending"] + inv["expired"] + inv["cancelled"]
        == inv["total"]
    )
    # Taxa sobre resolvidos: 3/(3+1) = 75.0 (não 3/8 = 37.5)
    assert inv["acceptance_rate"] == 75.0


def test_b1_taxa_zero_quando_nao_ha_resolvidos(client: TestClient, db_session: Session):
    inviter = _mk_user(db_session, "inviter2", "inviter2@test.com")
    unit = _mk_unit(db_session, "Teatro", "teatro")
    invited = _mk_user(db_session, "inv-p", "invp@test.com")
    _mk_invite(db_session, unit, invited, inviter, InviteStatus.PENDING)

    data = _get_dashboard(client, db_session)
    assert data["invites"]["acceptance_rate"] == 0.0


# ═══════════════════════════════════════════════════════════════════════════
# B2 — Top ministérios: por id, com setor, pessoas distintas
# ═══════════════════════════════════════════════════════════════════════════


def test_b2_ministerios_homonimos_nao_fundem(client: TestClient, db_session: Session):
    setor_a = _mk_unit(db_session, "Setor Norte", "setor-norte", OrgUnitType.SETOR)
    setor_b = _mk_unit(db_session, "Setor Sul", "setor-sul", OrgUnitType.SETOR)
    min_a = _mk_unit(db_session, "Música", "musica-norte", parent=setor_a)
    min_b = _mk_unit(db_session, "Música", "musica-sul", parent=setor_b)

    u1 = _mk_user(db_session, "m1", "m1@test.com")
    u2 = _mk_user(db_session, "m2", "m2@test.com")
    u3 = _mk_user(db_session, "m3", "m3@test.com")
    _mk_membership(db_session, u1, min_a)
    _mk_membership(db_session, u2, min_a)
    _mk_membership(db_session, u3, min_b)

    data = _get_dashboard(client, db_session)
    tops = data["top_ministries"]

    musicas = [t for t in tops if t["name"] == "Música"]
    assert len(musicas) == 2, f"homônimos fundiram: {tops}"
    assert {t["sector_name"] for t in musicas} == {"Setor Norte", "Setor Sul"}
    assert {t["id"] for t in musicas} == {str(min_a.id), str(min_b.id)}
    by_sector = {t["sector_name"]: t["member_count"] for t in musicas}
    assert by_sector["Setor Norte"] == 2
    assert by_sector["Setor Sul"] == 1


def test_b2_member_count_conta_pessoas_nao_vinculos(client: TestClient, db_session: Session):
    ministerio = _mk_unit(db_session, "Acolhida", "acolhida-min")
    u = _mk_user(db_session, "p1", "p1@test.com")
    _mk_membership(db_session, u, ministerio)
    # Vínculo REMOVED não conta
    u2 = _mk_user(db_session, "p2", "p2@test.com")
    _mk_membership(db_session, u2, ministerio, status=MembershipStatus.REMOVED)

    data = _get_dashboard(client, db_session)
    entry = next(t for t in data["top_ministries"] if t["id"] == str(ministerio.id))
    assert entry["member_count"] == 1
    assert entry["sector_name"] is None  # sem pai → None, não quebra


# ═══════════════════════════════════════════════════════════════════════════
# B3 — Pessoas distintas vs vínculos
# ═══════════════════════════════════════════════════════════════════════════


def test_b3_pessoas_distintas_vs_vinculos(client: TestClient, db_session: Session):
    u = _mk_user(db_session, "multi", "multi@test.com")
    for i in range(3):
        unit = _mk_unit(db_session, f"Unidade {i}", f"unidade-{i}")
        _mk_membership(db_session, u, unit)

    data = _get_dashboard(client, db_session)
    ms = data["memberships"]
    assert ms["total_active"] == 3
    assert ms["people_active"] == 1
    assert ms["people_active"] <= ms["total_active"]


# ═══════════════════════════════════════════════════════════════════════════
# B4 — Idade por aniversário
# ═══════════════════════════════════════════════════════════════════════════


def _age_bucket_counts(data: dict) -> dict:
    return {r["range"]: r["count"] for r in data["age_ranges"]}


def test_b4_aniversario_hoje_faz_18_cair_em_18_25(client: TestClient, db_session: Session):
    today = date.today()
    # Nascido há exatos 18 anos: o antigo //365 dava 17 (4-5 bissextos no caminho)
    birth = date(today.year - 18, today.month, today.day if not (today.month == 2 and today.day == 29) else 28)
    u = _mk_user(db_session, "b18", "b18@test.com")
    _mk_profile(db_session, u, birth_date=birth)

    buckets = _age_bucket_counts(_get_dashboard(client, db_session))
    assert buckets["18-25"] == 1
    assert buckets["< 18"] == 0


def test_b4_vespera_do_aniversario_ainda_nao_completa(client: TestClient, db_session: Session):
    today = date.today()
    tomorrow = today + timedelta(days=1)
    # Faz 18 amanhã → hoje ainda tem 17
    try:
        birth = date(tomorrow.year - 18, tomorrow.month, tomorrow.day)
    except ValueError:  # 29/02 em ano não bissexto
        birth = date(tomorrow.year - 18, 3, 1)
    u = _mk_user(db_session, "b17", "b17@test.com")
    _mk_profile(db_session, u, birth_date=birth)

    buckets = _age_bucket_counts(_get_dashboard(client, db_session))
    assert buckets["< 18"] == 1, buckets


def test_b4_nao_informado_separado(client: TestClient, db_session: Session):
    u = _mk_user(db_session, "noage", "noage@test.com")
    _mk_profile(db_session, u, birth_date=None)

    buckets = _age_bucket_counts(_get_dashboard(client, db_session))
    assert buckets["Não informado"] == 1


# ═══════════════════════════════════════════════════════════════════════════
# B5 — Geografia: normalização + supressão
# ═══════════════════════════════════════════════════════════════════════════


def test_b5_variantes_de_caixa_e_espaco_agregam(client: TestClient, db_session: Session):
    variants = [" Fortaleza ", "fortaleza", "FORTALEZA"]
    for i, city in enumerate(variants):
        u = _mk_user(db_session, f"city-{i}", f"city{i}@test.com")
        _mk_profile(db_session, u, city=city, state="ce")

    data = _get_dashboard(client, db_session)
    cities = {c["city"]: c["count"] for c in data["geography"]["by_city"]}
    assert cities.get("Fortaleza") == 3, cities  # agregou e exibe capitalizado
    # UF normalizada para maiúsculas
    states = {s["state"]: s["count"] for s in data["geography"]["by_state"]}
    assert states.get("CE") == 3, states


def test_b5_vazios_excluidos_e_pequenos_suprimidos(client: TestClient, db_session: Session):
    # 3 em Fortaleza (>= K_MIN=3, visível) + 1 em Sobral (< K_MIN, suprimida) + 1 vazio
    for i in range(3):
        u = _mk_user(db_session, f"fort-{i}", f"fort{i}@test.com")
        _mk_profile(db_session, u, city="Fortaleza")
    u_small = _mk_user(db_session, "sobral", "sobral@test.com")
    _mk_profile(db_session, u_small, city="Sobral")
    u_empty = _mk_user(db_session, "empty", "empty@test.com")
    _mk_profile(db_session, u_empty, city="   ")

    data = _get_dashboard(client, db_session)
    by_city = data["geography"]["by_city"]
    names = [c["city"] for c in by_city]

    assert "Fortaleza" in names
    assert "Sobral" not in names, "cidade com count < K_MIN deveria estar suprimida"
    assert not any(n.strip() == "" for n in names), "linha vazia não pode aparecer"
    outras = [c for c in by_city if c["city"].startswith("Outras")]
    assert len(outras) == 1 and outras[0]["count"] == 1, by_city


# ═══════════════════════════════════════════════════════════════════════════
# B6/B7 — Perfis: base ativa; payload sem incomplete_profiles
# ═══════════════════════════════════════════════════════════════════════════


def test_b6_perfil_de_usuario_inativo_nao_conta(client: TestClient, db_session: Session):
    active = _mk_user(db_session, "act", "act@test.com")
    _mk_profile(db_session, active, status="COMPLETE")
    inactive = _mk_user(db_session, "inact", "inact@test.com", active=False)
    _mk_profile(db_session, inactive, status="COMPLETE")

    data = _get_dashboard(client, db_session)
    # admin do _get_dashboard não tem profile → só o 'active' conta
    assert data["users"]["complete_profiles"] == 1


def test_b7_shape_do_payload(client: TestClient, db_session: Session):
    data = _get_dashboard(client, db_session)

    assert "incomplete_profiles" not in data["users"], "B7: campo morto deve sair do payload"
    assert "people_active" in data["memberships"]
    assert "expired" in data["invites"]
    assert "cancelled" in data["invites"]
    # without_vocational_accompaniment permanece (vira denominador na UI)
    assert "without_vocational_accompaniment" in data["profile_breakdown"]


# ═══════════════════════════════════════════════════════════════════════════
# Authz intocada
# ═══════════════════════════════════════════════════════════════════════════


def test_authz_analista_acessa_dashboard(client: TestClient, db_session: Session):
    _mk_user(db_session, "ana", "ana@test.com", roles=("ANALISTA",))
    db_session.commit()
    resp = client.get("/admin/dashboard", headers=_headers("ana", "ana@test.com"))
    assert resp.status_code == 200


def test_authz_sem_papel_recebe_403(client: TestClient, db_session: Session):
    _mk_user(db_session, "zero", "zero@test.com")
    db_session.commit()
    resp = client.get("/admin/dashboard", headers=_headers("zero", "zero@test.com"))
    assert resp.status_code == 403
