"""
H5B.3 — Regressões dos achados baixos de segurança (TestClient real, seed via db_session).

- H5A-05: endpoints /dev negam execução em produção (defesa em profundidade),
          mesmo com ENABLE_DEV_ENDPOINTS ligado.
- H5A-07: /push/subscribe não permite takeover de subscription de outro usuário
          pelo mesmo endpoint (409); o próprio dono atualiza normalmente.
"""
from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.models import PushSubscription, User, UserIdentity, UserProfile
from app.settings import settings


def _headers(uid: str, email: str) -> dict:
    return {"Authorization": f"Bearer dev:{uid}:{email}"}


def _mk_user(db: Session, uid: str, email: str) -> User:
    user = User(is_active=True)
    db.add(user)
    db.flush()
    db.add(UserIdentity(user_id=user.id, provider="firebase", provider_uid=uid, email=email))
    db.flush()
    return user


# ═══════════════════════════════════════════════════════════════════════════
# H5A-05 — /dev bloqueado em produção (defesa em profundidade)
# ═══════════════════════════════════════════════════════════════════════════


def test_h5a05_dev_endpoint_bloqueado_em_producao(client: TestClient, db_session: Session, monkeypatch):
    _mk_user(db_session, "dev05-uid", "dev05@test.com")
    db_session.commit()

    # Mesmo com ENABLE_DEV_ENDPOINTS ligado (router montado), produção bloqueia.
    monkeypatch.setattr(settings, "environment", "production")
    r = client.post("/dev/make-me-dev", headers=_headers("dev05-uid", "dev05@test.com"))
    assert r.status_code == 404, r.text


def test_h5a05_dev_endpoint_permitido_em_test_mode(client: TestClient, db_session: Session):
    _mk_user(db_session, "dev05b-uid", "dev05b@test.com")
    db_session.commit()

    # ENVIRONMENT=test → is_production False → o guard não bloqueia.
    r = client.post("/dev/make-me-dev", headers=_headers("dev05b-uid", "dev05b@test.com"))
    assert r.status_code == 200, r.text


# ═══════════════════════════════════════════════════════════════════════════
# H5A-07 — anti-takeover de push subscription
# ═══════════════════════════════════════════════════════════════════════════


def test_h5a07_outro_user_nao_toma_subscription(client: TestClient, db_session: Session):
    owner = _mk_user(db_session, "ownerA-uid", "ownerA@test.com")
    _mk_user(db_session, "attackerB-uid", "attackerB@test.com")
    db_session.add(
        PushSubscription(
            user_id=owner.id,
            endpoint="https://push.example.com/EP-A",
            p256dh="owner-p256dh",
            auth="owner-auth",
        )
    )
    owner_id = owner.id
    db_session.commit()

    r = client.post(
        "/push/subscribe",
        headers=_headers("attackerB-uid", "attackerB@test.com"),
        json={
            "endpoint": "https://push.example.com/EP-A",
            "p256dh": "attacker-key",
            "auth": "attacker-auth",
        },
    )
    assert r.status_code == 409, r.text

    sub = db_session.execute(
        select(PushSubscription).where(PushSubscription.endpoint == "https://push.example.com/EP-A")
    ).scalar_one()
    assert sub.user_id == owner_id  # dono inalterado
    assert sub.p256dh == "owner-p256dh"  # chaves não sobrescritas


def test_h5a07_dono_atualiza_propria_subscription(client: TestClient, db_session: Session):
    owner = _mk_user(db_session, "ownerC-uid", "ownerC@test.com")
    db_session.add(
        PushSubscription(
            user_id=owner.id,
            endpoint="https://push.example.com/EP-C",
            p256dh="old-key",
            auth="old-auth",
        )
    )
    owner_id = owner.id
    db_session.commit()

    r = client.post(
        "/push/subscribe",
        headers=_headers("ownerC-uid", "ownerC@test.com"),
        json={
            "endpoint": "https://push.example.com/EP-C",
            "p256dh": "new-key",
            "auth": "new-auth",
        },
    )
    assert r.status_code == 201, r.text

    sub = db_session.execute(
        select(PushSubscription).where(PushSubscription.endpoint == "https://push.example.com/EP-C")
    ).scalar_one()
    assert sub.user_id == owner_id
    assert sub.p256dh == "new-key"  # própria subscription atualizada


# ═══════════════════════════════════════════════════════════════════════════
# H5A-06 — não ecoar full_name de terceiro via vocational_accompanist_user_id
# ═══════════════════════════════════════════════════════════════════════════


def test_h5a06_nao_ecoa_full_name_de_terceiro(client: TestClient, db_session: Session):
    stranger = _mk_user(db_session, "strangerS-uid", "strangerS@test.com")
    db_session.add(
        UserProfile(user_id=stranger.id, full_name="Nome Secreto Terceiro", status="COMPLETE")
    )
    caller = _mk_user(db_session, "callerT-uid", "callerT@test.com")
    db_session.add(
        UserProfile(
            user_id=caller.id,
            full_name="Caller",
            status="COMPLETE",
            has_vocational_accompaniment=True,
            vocational_accompanist_user_id=stranger.id,
            vocational_accompanist_name=None,
        )
    )
    db_session.commit()

    r = client.get("/profile", headers=_headers("callerT-uid", "callerT@test.com"))
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["vocational_accompanist_display_name"] != "Nome Secreto Terceiro"
    assert body["vocational_accompanist_display_name"] is None


def test_h5a06_usa_texto_livre_do_proprio_usuario(client: TestClient, db_session: Session):
    stranger = _mk_user(db_session, "strangerS2-uid", "strangerS2@test.com")
    db_session.add(
        UserProfile(user_id=stranger.id, full_name="Nome Secreto 2", status="COMPLETE")
    )
    caller = _mk_user(db_session, "callerT2-uid", "callerT2@test.com")
    db_session.add(
        UserProfile(
            user_id=caller.id,
            full_name="Caller2",
            status="COMPLETE",
            has_vocational_accompaniment=True,
            vocational_accompanist_user_id=stranger.id,
            vocational_accompanist_name="Pe. João",
        )
    )
    db_session.commit()

    r = client.get("/profile", headers=_headers("callerT2-uid", "callerT2@test.com"))
    assert r.status_code == 200, r.text
    body = r.json()
    # Texto livre do próprio usuário é respeitado; nome do terceiro nunca aparece.
    assert body["vocational_accompanist_display_name"] == "Pe. João"
