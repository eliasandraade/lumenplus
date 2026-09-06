"""
Testes das rotas /push.
- GET /push/vapid-public-key: 503 quando não configurado, 200 + chave quando set
- POST /push/subscribe: cria / 409 outro usuário / dedup mesmo usuário
- DELETE /push/unsubscribe: remove a subscription
"""
from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api import push_routes
from app.db.models import PushSubscription

AUTH = {"Authorization": "Bearer dev:push-user:pushuser@example.com"}
OTHER = {"Authorization": "Bearer dev:other-user:other@example.com"}


# ── vapid-public-key ────────────────────────────────────────────────────────
def test_vapid_public_key_returns_503_when_unset(client: TestClient, monkeypatch) -> None:
    monkeypatch.setattr(push_routes.settings, "vapid_public_key", "")
    r = client.get("/push/vapid-public-key")
    assert r.status_code == 503
    assert r.json()["detail"]["error"] == "not_configured"


def test_vapid_public_key_returns_key_when_set(client: TestClient, monkeypatch) -> None:
    monkeypatch.setattr(push_routes.settings, "vapid_public_key", "BPUBLICKEY123")
    r = client.get("/push/vapid-public-key")
    assert r.status_code == 200
    assert r.json() == {"public_key": "BPUBLICKEY123"}


# ── subscribe ───────────────────────────────────────────────────────────────
def test_subscribe_creates_subscription(client: TestClient, db_session: Session) -> None:
    endpoint = "https://push.example.com/create-ep"
    r = client.post(
        "/push/subscribe",
        headers=AUTH,
        json={"endpoint": endpoint, "p256dh": "k1", "auth": "a1", "user_agent": "pytest-agent"},
    )
    assert r.status_code == 201
    assert r.json() == {"status": "subscribed"}

    subs = db_session.scalars(
        select(PushSubscription).where(PushSubscription.endpoint == endpoint)
    ).all()
    assert len(subs) == 1
    assert subs[0].p256dh == "k1"
    assert subs[0].user_agent == "pytest-agent"


def test_subscribe_same_endpoint_other_user_conflict(client: TestClient) -> None:
    endpoint = "https://push.example.com/shared-ep"
    body = {"endpoint": endpoint, "p256dh": "owner-k", "auth": "owner-a"}
    assert client.post("/push/subscribe", headers=AUTH, json=body).status_code == 201

    r = client.post(
        "/push/subscribe",
        headers=OTHER,
        json={"endpoint": endpoint, "p256dh": "attacker-k", "auth": "attacker-a"},
    )
    assert r.status_code == 409
    assert r.json()["detail"]["error"] == "endpoint_conflict"


def test_subscribe_same_user_updates_dedup(client: TestClient, db_session: Session) -> None:
    endpoint = "https://push.example.com/dedupe-ep"
    assert client.post(
        "/push/subscribe", headers=AUTH,
        json={"endpoint": endpoint, "p256dh": "k1", "auth": "a1"},
    ).status_code == 201
    assert client.post(
        "/push/subscribe", headers=AUTH,
        json={"endpoint": endpoint, "p256dh": "k2", "auth": "a2", "user_agent": "UA2"},
    ).status_code == 201

    subs = db_session.scalars(
        select(PushSubscription).where(PushSubscription.endpoint == endpoint)
    ).all()
    assert len(subs) == 1
    assert subs[0].p256dh == "k2"
    assert subs[0].auth == "a2"
    assert subs[0].user_agent == "UA2"


# ── unsubscribe ─────────────────────────────────────────────────────────────
def test_unsubscribe_removes_subscription(client: TestClient, db_session: Session) -> None:
    endpoint = "https://push.example.com/del-ep"
    assert client.post(
        "/push/subscribe", headers=AUTH,
        json={"endpoint": endpoint, "p256dh": "k", "auth": "a"},
    ).status_code == 201

    r = client.delete("/push/unsubscribe", headers=AUTH, params={"endpoint": endpoint})
    assert r.status_code == 200
    assert r.json() == {"status": "unsubscribed"}

    remaining = db_session.scalars(
        select(PushSubscription).where(PushSubscription.endpoint == endpoint)
    ).all()
    assert remaining == []
