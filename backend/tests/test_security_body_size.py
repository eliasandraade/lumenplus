"""
Testes de segurança — Limite global de tamanho de body (H4A).

Middleware limit_body_size (app/main.py): rejeita requisições NÃO-multipart com
Content-Length acima de 1 MB (HTTP 413). Multipart fica sob o limite próprio de
upload do endpoint (test_security_upload.py).
"""

import json

from app.main import MAX_JSON_BODY_BYTES


def test_json_acima_do_limite_retorna_413(client):
    payload = json.dumps({"data": "x" * (MAX_JSON_BODY_BYTES + 1024)})
    r = client.post(
        "/auth/register",
        content=payload,
        headers={"Content-Type": "application/json"},
    )
    assert r.status_code == 413
    assert r.json()["detail"]["error"] == "payload_too_large"


def test_json_pequeno_nao_e_bloqueado_pelo_limite(client):
    # Body pequeno não deve sofrer 413 do middleware (pode ser 400/401/422, nunca 413).
    r = client.post("/auth/register", json={"hello": "world"})
    assert r.status_code != 413


def test_multipart_grande_nao_e_bloqueado_pelo_middleware_de_json(client):
    # Multipart acima de 1 MB NÃO é barrado pelo middleware de JSON — o limite de
    # upload é responsabilidade do endpoint. Sem auth, o endpoint responde 401,
    # nunca 413 do middleware de JSON.
    big = b"0" * (MAX_JSON_BODY_BYTES + 1024)
    r = client.post(
        "/retreats/00000000-0000-0000-0000-000000000000/my-registration/payment",
        files={"file": ("x.bin", big, "application/octet-stream")},
    )
    assert r.status_code != 413
