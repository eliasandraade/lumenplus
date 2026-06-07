"""
Testes de segurança — Upload de comprovante (H4A).

Cobre o único endpoint de upload de arquivo do backend:
POST /retreats/{id}/my-registration/payment

- limite de tamanho (8 MB) -> 413
- content_type não-imagem -> 400
- content_type de imagem mas magic bytes inválidos -> 400
- imagem válida pequena -> passa a validação (chega ao Cloudinary, sem credenciais -> 503)

Nota: estes testes usam um token de auth DEDICADO (não o fixture compartilhado
`auth_headers`) para cair num bucket de rate limit próprio. O bucket do token
`dev:test-user:...` é compartilhado por dezenas de testes da suíte e, somado ao
estado global do rate limiter dentro da janela de 60s, pode estourar 60/min.
Um token exclusivo isola estes testes desse efeito.
"""

from datetime import datetime, timedelta, timezone

import pytest

from app.api.retreat_routes import MAX_UPLOAD_BYTES, _looks_like_image

# Token de auth exclusivo destes testes (bucket de rate limit próprio).
_UPLOAD_HEADERS = {"Authorization": "Bearer dev:upload-tester:upload@example.com"}
_UPLOAD_UID = "upload-tester"

# Conteúdos mínimos com assinatura (magic bytes) válida.
_PNG = b"\x89PNG\r\n\x1a\n" + b"\x00" * 16
_JPEG = b"\xff\xd8\xff\xe0" + b"\x00" * 16
_WEBP = b"RIFF" + b"\x00\x00\x00\x00" + b"WEBP" + b"\x00" * 8


# ---------------------------------------------------------------------------
# Unit: validação de magic bytes (content_type é falsificável)
# ---------------------------------------------------------------------------
def test_looks_like_image_aceita_png_jpeg_webp():
    assert _looks_like_image(_PNG)
    assert _looks_like_image(_JPEG)
    assert _looks_like_image(_WEBP)


def test_looks_like_image_rejeita_nao_imagem():
    assert not _looks_like_image(b"<html>nao e imagem</html>")
    assert not _looks_like_image(b"%PDF-1.4 fake pdf")
    assert not _looks_like_image(b"")
    assert not _looks_like_image(b"RIFF1234XXXX")  # RIFF mas não WEBP


# ---------------------------------------------------------------------------
# Integração: endpoint de upload
# ---------------------------------------------------------------------------
@pytest.fixture
def payment_retreat_id(client, db_session) -> str:
    """Provisiona o usuário de upload e cria um retiro + inscrição PENDING_PAYMENT."""
    assert client.get("/auth/me", headers=_UPLOAD_HEADERS).status_code == 200

    from app.db.models import (
        Retreat,
        RetreatRegistration,
        RetreatStatus,
        RetreatType,
        RegistrationStatus,
        UserIdentity,
    )

    identity = (
        db_session.query(UserIdentity)
        .filter(UserIdentity.provider_uid == _UPLOAD_UID)
        .first()
    )
    assert identity is not None

    now = datetime.now(timezone.utc)
    retreat = Retreat(
        title="Retiro de Teste",
        retreat_type=RetreatType.WEEKEND,
        status=RetreatStatus.PUBLISHED,
        start_date=now + timedelta(days=30),
        end_date=now + timedelta(days=32),
    )
    db_session.add(retreat)
    db_session.flush()

    db_session.add(
        RetreatRegistration(
            retreat_id=retreat.id,
            user_id=identity.user_id,
            status=RegistrationStatus.PENDING_PAYMENT,
        )
    )
    db_session.commit()
    return str(retreat.id)


def _post_payment(client, retreat_id, *, filename, data, content_type):
    return client.post(
        f"/retreats/{retreat_id}/my-registration/payment",
        headers=_UPLOAD_HEADERS,
        files={"file": (filename, data, content_type)},
    )


def test_upload_acima_de_8mb_retorna_413(client, payment_retreat_id):
    big = _JPEG + b"0" * (MAX_UPLOAD_BYTES + 1)
    r = _post_payment(
        client, payment_retreat_id,
        filename="grande.jpg", data=big, content_type="image/jpeg",
    )
    assert r.status_code == 413
    assert r.json()["detail"]["error"] == "file_too_large"


def test_upload_content_type_nao_imagem_retorna_400(client, payment_retreat_id):
    r = _post_payment(
        client, payment_retreat_id,
        filename="doc.pdf", data=b"%PDF-1.4 conteudo", content_type="application/pdf",
    )
    assert r.status_code == 400


def test_upload_magic_bytes_invalidos_retorna_400(client, payment_retreat_id):
    # content_type alega imagem, mas o conteúdo real não é uma imagem.
    r = _post_payment(
        client, payment_retreat_id,
        filename="falsa.png", data=b"isto nao e uma imagem de verdade", content_type="image/png",
    )
    assert r.status_code == 400
    assert r.json()["detail"]["error"] == "invalid_file"


def test_upload_imagem_valida_passa_validacao(client, payment_retreat_id):
    # PNG válido pequeno: passa content_type + tamanho + magic bytes; chega ao Cloudinary,
    # que não tem credenciais em ambiente de teste -> 503 storage_not_configured.
    # O 503 prova que a validação de arquivo foi APROVADA.
    r = _post_payment(
        client, payment_retreat_id,
        filename="ok.png", data=_PNG, content_type="image/png",
    )
    assert r.status_code == 503
    assert r.json()["detail"]["error"] == "storage_not_configured"
