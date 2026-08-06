"""
Moderação de UGC — denúncia e bloqueio.

Gate das lojas: Apple Guideline 1.2 e política de UGC do Google Play exigem
denúncia e bloqueio em apps onde usuários publicam conteúdo visível a outros.
"""

from __future__ import annotations

from datetime import datetime, timezone

from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.models import (
    ChannelPost,
    ContentReport,
    ContentReportStatus,
    GlobalRole,
    MembershipStatus,
    OrgMembership,
    OrgRoleCode,
    OrgUnit,
    OrgUnitType,
    User,
    UserBlock,
    UserGlobalRole,
    UserIdentity,
    UserProfile,
)


def _hdr(uid: str) -> dict:
    return {"Authorization": f"Bearer dev:{uid}:{uid}@synthetic.invalid"}


def _mk_user(db: Session, uid: str, name: str, roles: tuple = ()) -> User:
    u = User(is_active=True)
    db.add(u)
    db.flush()
    db.add(UserIdentity(user_id=u.id, provider="firebase", provider_uid=uid,
                        email=f"{uid}@synthetic.invalid"))
    db.add(UserProfile(user_id=u.id, status="COMPLETE", full_name=name))
    for code in roles:
        role = db.execute(select(GlobalRole).where(GlobalRole.code == code)).scalar_one_or_none()
        if role is None:
            role = GlobalRole(code=code, name=code)
            db.add(role)
            db.flush()
        db.add(UserGlobalRole(user_id=u.id, global_role_id=role.id))
    db.flush()
    return u


def _mk_unit(db: Session, slug: str) -> OrgUnit:
    unit = OrgUnit(type=OrgUnitType.MINISTERIO, name=slug, slug=slug)
    db.add(unit)
    db.flush()
    return unit


def _mk_post(db: Session, unit: OrgUnit, author: User, title="Post", body="Corpo") -> ChannelPost:
    p = ChannelPost(org_unit_id=unit.id, author_user_id=author.id, title=title, body=body)
    db.add(p)
    db.flush()
    return p


# ---------------------------------------------------------------------------
# Denúncia
# ---------------------------------------------------------------------------
def test_denuncia_post_cria_registro(client: TestClient, db_session: Session):
    unit = _mk_unit(db_session, "min-a")
    autor = _mk_user(db_session, "autor1", "Autor")
    _mk_user(db_session, "denun1", "Denunciante")
    post = _mk_post(db_session, unit, autor)
    db_session.commit()

    r = client.post("/moderation/reports", headers=_hdr("denun1"), json={
        "target_type": "POST", "target_id": str(post.id),
        "reason": "SPAM", "details": "propaganda",
    })
    assert r.status_code == 201, r.text
    rep = db_session.execute(select(ContentReport)).scalars().all()
    assert len(rep) == 1
    # O snapshot preserva a evidência mesmo se o autor editar/apagar depois.
    assert rep[0].content_snapshot is not None
    assert rep[0].status == ContentReportStatus.OPEN


def test_denuncia_duplicada_e_idempotente(client: TestClient, db_session: Session):
    unit = _mk_unit(db_session, "min-b")
    autor = _mk_user(db_session, "autor2", "Autor")
    _mk_user(db_session, "denun2", "Denunciante")
    post = _mk_post(db_session, unit, autor)
    db_session.commit()

    payload = {"target_type": "POST", "target_id": str(post.id), "reason": "SPAM"}
    a = client.post("/moderation/reports", headers=_hdr("denun2"), json=payload)
    b = client.post("/moderation/reports", headers=_hdr("denun2"), json=payload)
    assert a.status_code == 201 and b.status_code == 201
    # Não pode criar duas — a constraint única protege a fila de flood.
    assert len(db_session.execute(select(ContentReport)).scalars().all()) == 1


def test_nao_pode_denunciar_o_proprio_conteudo(client: TestClient, db_session: Session):
    unit = _mk_unit(db_session, "min-c")
    autor = _mk_user(db_session, "autor3", "Autor")
    post = _mk_post(db_session, unit, autor)
    db_session.commit()

    r = client.post("/moderation/reports", headers=_hdr("autor3"), json={
        "target_type": "POST", "target_id": str(post.id), "reason": "SPAM",
    })
    assert r.status_code == 400


def test_denuncia_de_conteudo_inexistente_404(client: TestClient, db_session: Session):
    _mk_user(db_session, "denun4", "D")
    db_session.commit()
    r = client.post("/moderation/reports", headers=_hdr("denun4"), json={
        "target_type": "POST",
        "target_id": "11111111-2222-3333-4444-555555555555",
        "reason": "SPAM",
    })
    assert r.status_code == 404


def test_denuncia_exige_autenticacao(client: TestClient):
    r = client.post("/moderation/reports", json={
        "target_type": "POST",
        "target_id": "11111111-2222-3333-4444-555555555555",
        "reason": "SPAM",
    })
    assert r.status_code == 401


# ---------------------------------------------------------------------------
# Fila de moderação (autorização)
# ---------------------------------------------------------------------------
def test_membro_comum_nao_ve_a_fila(client: TestClient, db_session: Session):
    _mk_user(db_session, "comum1", "Comum")
    db_session.commit()
    r = client.get("/moderation/reports", headers=_hdr("comum1"))
    assert r.status_code == 403


def test_admin_ve_a_fila(client: TestClient, db_session: Session):
    unit = _mk_unit(db_session, "min-d")
    autor = _mk_user(db_session, "autor5", "Autor")
    _mk_user(db_session, "denun5", "D")
    _mk_user(db_session, "admin5", "Admin", roles=("ADMIN",))
    post = _mk_post(db_session, unit, autor)
    db_session.commit()

    client.post("/moderation/reports", headers=_hdr("denun5"), json={
        "target_type": "POST", "target_id": str(post.id), "reason": "HARASSMENT",
    })
    r = client.get("/moderation/reports", headers=_hdr("admin5"))
    assert r.status_code == 200
    assert r.json()["total"] == 1
    assert r.json()["reports"][0]["reason"] == "HARASSMENT"


def test_coordenador_ve_apenas_a_propria_unidade(client: TestClient, db_session: Session):
    unit_a = _mk_unit(db_session, "min-e")
    unit_b = _mk_unit(db_session, "min-f")
    autor = _mk_user(db_session, "autor6", "Autor")
    _mk_user(db_session, "denun6", "D")
    coord = _mk_user(db_session, "coord6", "Coord")
    db_session.add(OrgMembership(user_id=coord.id, org_unit_id=unit_a.id,
                                 role=OrgRoleCode.COORDINATOR, status=MembershipStatus.ACTIVE))
    post_a = _mk_post(db_session, unit_a, autor, title="na minha unidade")
    post_b = _mk_post(db_session, unit_b, autor, title="fora da minha unidade")
    db_session.commit()

    for p in (post_a, post_b):
        client.post("/moderation/reports", headers=_hdr("denun6"), json={
            "target_type": "POST", "target_id": str(p.id), "reason": "SPAM",
        })

    r = client.get("/moderation/reports", headers=_hdr("coord6"))
    assert r.status_code == 200
    # Só a denúncia da unidade que ele coordena.
    assert r.json()["total"] == 1
    assert "na minha unidade" in r.json()["reports"][0]["content_snapshot"]


def test_resolver_denuncia_remove_o_conteudo(client: TestClient, db_session: Session):
    unit = _mk_unit(db_session, "min-g")
    autor = _mk_user(db_session, "autor7", "Autor")
    _mk_user(db_session, "denun7", "D")
    _mk_user(db_session, "admin7", "Admin", roles=("ADMIN",))
    post = _mk_post(db_session, unit, autor)
    db_session.commit()

    rid = client.post("/moderation/reports", headers=_hdr("denun7"), json={
        "target_type": "POST", "target_id": str(post.id), "reason": "HATE_SPEECH",
    }).json()["id"]

    r = client.patch(f"/moderation/reports/{rid}", headers=_hdr("admin7"), json={
        "status": "RESOLVED_REMOVED", "remove_content": True,
        "resolution_note": "violou a política de conteúdo",
    })
    assert r.status_code == 200
    db_session.expire_all()
    removido = db_session.get(ChannelPost, post.id)
    assert removido.deleted_at is not None, "conteúdo denunciado deveria ter sido removido"


# ---------------------------------------------------------------------------
# Bloqueio
# ---------------------------------------------------------------------------
def test_bloquear_e_desbloquear(client: TestClient, db_session: Session):
    a = _mk_user(db_session, "userA", "A")
    b = _mk_user(db_session, "userB", "B")
    db_session.commit()

    r = client.post("/moderation/blocks", headers=_hdr("userA"), json={"user_id": str(b.id)})
    assert r.status_code == 201 and r.json()["blocked"] is True

    lst = client.get("/moderation/blocks", headers=_hdr("userA")).json()
    assert lst["total"] == 1 and lst["blocks"][0]["name"] == "B"

    d = client.delete(f"/moderation/blocks/{b.id}", headers=_hdr("userA"))
    assert d.status_code == 204
    assert client.get("/moderation/blocks", headers=_hdr("userA")).json()["total"] == 0
    assert a is not None


def test_bloqueio_e_idempotente(client: TestClient, db_session: Session):
    _mk_user(db_session, "userC", "C")
    d = _mk_user(db_session, "userD", "D")
    db_session.commit()

    p = {"user_id": str(d.id)}
    r1 = client.post("/moderation/blocks", headers=_hdr("userC"), json=p)
    r2 = client.post("/moderation/blocks", headers=_hdr("userC"), json=p)
    assert r1.status_code == 201 and r2.status_code == 201
    assert r2.json()["already"] is True
    assert len(db_session.execute(select(UserBlock)).scalars().all()) == 1


def test_nao_pode_bloquear_a_si_mesmo(client: TestClient, db_session: Session):
    e = _mk_user(db_session, "userE", "E")
    db_session.commit()
    r = client.post("/moderation/blocks", headers=_hdr("userE"), json={"user_id": str(e.id)})
    assert r.status_code == 400


def test_desbloquear_sem_bloqueio_e_idempotente(client: TestClient, db_session: Session):
    _mk_user(db_session, "userF", "F")
    g = _mk_user(db_session, "userG", "G")
    db_session.commit()
    r = client.delete(f"/moderation/blocks/{g.id}", headers=_hdr("userF"))
    assert r.status_code == 204


def test_lista_de_bloqueios_nao_expoe_quem_me_bloqueou(client: TestClient, db_session: Session):
    h = _mk_user(db_session, "userH", "H")
    _mk_user(db_session, "userI", "I")
    db_session.commit()
    # I bloqueia H
    client.post("/moderation/blocks", headers=_hdr("userI"), json={"user_id": str(h.id)})
    # H não deve ver que foi bloqueado
    assert client.get("/moderation/blocks", headers=_hdr("userH")).json()["total"] == 0


def test_helper_de_visibilidade_e_simetrico(client: TestClient, db_session: Session):
    """Bloqueio simétrico: quem bloqueia E quem foi bloqueado somem um do outro."""
    from app.api.moderation_routes import blocked_user_ids

    j = _mk_user(db_session, "userJ", "J")
    k = _mk_user(db_session, "userK", "K")
    db_session.commit()
    client.post("/moderation/blocks", headers=_hdr("userJ"), json={"user_id": str(k.id)})
    db_session.expire_all()

    assert k.id in blocked_user_ids(db_session, j.id), "J deve deixar de ver K"
    assert j.id in blocked_user_ids(db_session, k.id), "K também deve deixar de ver J"


def test_bloquear_usuario_inexistente_404(client: TestClient, db_session: Session):
    _mk_user(db_session, "userL", "L")
    db_session.commit()
    r = client.post("/moderation/blocks", headers=_hdr("userL"),
                    json={"user_id": "11111111-2222-3333-4444-555555555555"})
    assert r.status_code == 404


def test_bloqueio_exige_autenticacao(client: TestClient):
    r = client.post("/moderation/blocks",
                    json={"user_id": "11111111-2222-3333-4444-555555555555"})
    assert r.status_code == 401


def test_resolver_denuncia_de_outra_unidade_e_negado(client: TestClient, db_session: Session):
    """IDOR: coordenador de X não pode resolver denúncia da unidade Y."""
    unit_x = _mk_unit(db_session, "min-x")
    unit_y = _mk_unit(db_session, "min-y")
    autor = _mk_user(db_session, "autor8", "Autor")
    _mk_user(db_session, "denun8", "D")
    coord = _mk_user(db_session, "coord8", "Coord")
    db_session.add(OrgMembership(user_id=coord.id, org_unit_id=unit_x.id,
                                 role=OrgRoleCode.COORDINATOR, status=MembershipStatus.ACTIVE))
    post_y = _mk_post(db_session, unit_y, autor)
    db_session.commit()

    rid = client.post("/moderation/reports", headers=_hdr("denun8"), json={
        "target_type": "POST", "target_id": str(post_y.id), "reason": "SPAM",
    }).json()["id"]

    r = client.patch(f"/moderation/reports/{rid}", headers=_hdr("coord8"), json={
        "status": "RESOLVED_KEPT",
    })
    assert r.status_code == 403, "coordenador não pode moderar unidade alheia"
    assert datetime.now(timezone.utc) is not None


# ---------------------------------------------------------------------------
# Efeito REAL do bloqueio no feed (não basta o botão existir)
# ---------------------------------------------------------------------------
def test_bloqueio_esconde_conteudo_no_feed(client: TestClient, db_session: Session):
    """
    Requisito das lojas: bloquear precisa OCULTAR o conteúdo, não só registrar
    o bloqueio. E o efeito é simétrico nos dois sentidos.
    """
    unit = _mk_unit(db_session, "min-feed")
    alice = _mk_user(db_session, "alice", "Alice")
    bob = _mk_user(db_session, "bob", "Bob")
    for u in (alice, bob):
        db_session.add(OrgMembership(user_id=u.id, org_unit_id=unit.id,
                                     role=OrgRoleCode.MEMBER, status=MembershipStatus.ACTIVE))
    _mk_post(db_session, unit, alice, title="post da alice")
    _mk_post(db_session, unit, bob, title="post do bob")
    db_session.commit()

    # Antes do bloqueio: cada um vê os dois posts
    antes = client.get(f"/channel/{unit.id}/posts", headers=_hdr("alice"))
    assert antes.status_code == 200, antes.text
    assert antes.json()["total"] == 2

    # Alice bloqueia Bob
    assert client.post("/moderation/blocks", headers=_hdr("alice"),
                       json={"user_id": str(bob.id)}).status_code == 201

    # Alice não vê mais o post do Bob — e o total acompanha (sem "buraco")
    depois = client.get(f"/channel/{unit.id}/posts", headers=_hdr("alice")).json()
    titulos = [p["title"] for p in depois["posts"]]
    assert "post do bob" not in titulos, "conteúdo do bloqueado ainda aparece"
    assert "post da alice" in titulos
    assert depois["total"] == 1, "o total deve refletir o filtro"

    # SIMETRIA: Bob também deixa de ver a Alice
    bob_ve = client.get(f"/channel/{unit.id}/posts", headers=_hdr("bob")).json()
    assert "post da alice" not in [p["title"] for p in bob_ve["posts"]]
    assert bob_ve["total"] == 1


def test_desbloqueio_restaura_a_visibilidade(client: TestClient, db_session: Session):
    unit = _mk_unit(db_session, "min-feed2")
    c = _mk_user(db_session, "carla", "Carla")
    d = _mk_user(db_session, "diego", "Diego")
    for u in (c, d):
        db_session.add(OrgMembership(user_id=u.id, org_unit_id=unit.id,
                                     role=OrgRoleCode.MEMBER, status=MembershipStatus.ACTIVE))
    _mk_post(db_session, unit, d, title="post do diego")
    db_session.commit()

    client.post("/moderation/blocks", headers=_hdr("carla"), json={"user_id": str(d.id)})
    assert client.get(f"/channel/{unit.id}/posts", headers=_hdr("carla")).json()["total"] == 0

    client.delete(f"/moderation/blocks/{d.id}", headers=_hdr("carla"))
    assert client.get(f"/channel/{unit.id}/posts", headers=_hdr("carla")).json()["total"] == 1


# ---------------------------------------------------------------------------
# Filtro pré-publicação (Apple G1.2 — 1ª das 4 salvaguardas)
# ---------------------------------------------------------------------------
def test_filtro_bloqueia_conteudo_abusivo(client: TestClient, db_session: Session):
    unit = _mk_unit(db_session, "min-filtro")
    u = _mk_user(db_session, "filtro1", "Autor")
    db_session.add(OrgMembership(user_id=u.id, org_unit_id=unit.id,
                                 role=OrgRoleCode.COORDINATOR, status=MembershipStatus.ACTIVE))
    db_session.commit()

    r = client.post(f"/channel/{unit.id}/posts", headers=_hdr("filtro1"),
                    json={"title": "Aviso", "body": "vou te matar"})
    assert r.status_code == 422, r.text
    assert r.json()["detail"]["error"] == "content_blocked"
    assert db_session.execute(select(ChannelPost)).scalars().all() == []


def test_filtro_permite_conversa_pastoral_legitima(client: TestClient, db_session: Session):
    """Falso positivo é inaceitável: luto, vício e conflito são assunto natural aqui."""
    unit = _mk_unit(db_session, "min-filtro2")
    u = _mk_user(db_session, "filtro2", "Autor")
    db_session.add(OrgMembership(user_id=u.id, org_unit_id=unit.id,
                                 role=OrgRoleCode.COORDINATOR, status=MembershipStatus.ACTIVE))
    db_session.commit()

    r = client.post(f"/channel/{unit.id}/posts", headers=_hdr("filtro2"), json={
        "title": "Partilha do retiro",
        "body": "Falei sobre a morte do meu pai e sobre o vicio que enfrentei. "
                "Foi dificil, mas a comunidade me acolheu.",
    })
    assert r.status_code == 201, r.text


def test_filtro_sinaliza_sem_bloquear(client: TestClient, db_session: Session):
    """Conteúdo duvidoso é publicado, mas entra na fila de moderação."""
    unit = _mk_unit(db_session, "min-filtro3")
    u = _mk_user(db_session, "filtro3", "Autor")
    db_session.add(OrgMembership(user_id=u.id, org_unit_id=unit.id,
                                 role=OrgRoleCode.COORDINATOR, status=MembershipStatus.ACTIVE))
    db_session.commit()

    r = client.post(f"/channel/{unit.id}/posts", headers=_hdr("filtro3"),
                    json={"title": "Oferta", "body": "COMPRE AGORA COM DESCONTO NO WHATSAPP"})
    assert r.status_code == 201, "conteúdo duvidoso deve ser publicado, não bloqueado"
    reports = db_session.execute(select(ContentReport)).scalars().all()
    assert len(reports) == 1, "deveria ter aberto denúncia automática"
    assert "automaticamente" in (reports[0].details or "")
