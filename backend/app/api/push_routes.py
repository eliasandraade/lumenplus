"""
Push Subscription Endpoints
============================
GET  /push/vapid-public-key  → chave pública VAPID (sem autenticação)
POST /push/subscribe         → salva/atualiza subscription
DELETE /push/unsubscribe     → remove subscription do usuário atual
"""

from fastapi import HTTPException
from fastapi.routing import APIRouter
from pydantic import BaseModel
from sqlalchemy import select

from app.api.deps import CurrentUser, DBSession
from app.db.models import PushSubscription
from app.settings import settings

router = APIRouter(prefix="/push", tags=["push"])


class SubscribeRequest(BaseModel):
    endpoint: str
    p256dh: str
    auth: str
    user_agent: str | None = None


class VapidKeyResponse(BaseModel):
    public_key: str


@router.get("/vapid-public-key", response_model=VapidKeyResponse)
def get_vapid_public_key() -> VapidKeyResponse:
    """Rota pública — sem autenticação necessária."""
    if not settings.vapid_public_key:
        raise HTTPException(
            status_code=503,
            detail={"error": "not_configured", "message": "Web Push não configurado"},
        )
    return VapidKeyResponse(public_key=settings.vapid_public_key)


@router.post("/subscribe", status_code=201)
def subscribe(body: SubscribeRequest, db: DBSession, current_user: CurrentUser) -> dict:
    existing = db.scalars(
        select(PushSubscription).where(PushSubscription.endpoint == body.endpoint)
    ).first()

    # SEGURANÇA (H5A-07): não permitir takeover de uma subscription de outro
    # usuário só por conhecer o endpoint. Se o endpoint já pertence a outro dono,
    # recusa (409) em vez de reatribuir o user_id.
    if existing and existing.user_id != current_user.id:
        raise HTTPException(
            status_code=409,
            detail={
                "error": "endpoint_conflict",
                "message": "Este endpoint já está registrado para outro usuário.",
            },
        )

    if existing:
        # Atualiza a própria subscription (renovação de chaves/user agent).
        existing.p256dh = body.p256dh
        existing.auth = body.auth
        if body.user_agent:
            existing.user_agent = body.user_agent
    else:
        sub = PushSubscription(
            user_id=current_user.id,
            endpoint=body.endpoint,
            p256dh=body.p256dh,
            auth=body.auth,
            user_agent=body.user_agent,
        )
        db.add(sub)

    db.commit()
    return {"status": "subscribed"}


@router.delete("/unsubscribe")
def unsubscribe(db: DBSession, current_user: CurrentUser, endpoint: str) -> dict:
    sub = db.scalars(
        select(PushSubscription).where(
            PushSubscription.user_id == current_user.id,
            PushSubscription.endpoint == endpoint,
        )
    ).first()
    if sub:
        db.delete(sub)
        db.commit()
    return {"status": "unsubscribed"}
