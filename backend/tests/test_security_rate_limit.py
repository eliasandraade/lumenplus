"""
Testes de segurança — Rate limiting (H3).

Prova que o `client_id` é derivado do token COMPLETO (não do prefixo de 20 chars).
Para JWT Firebase RS256, o início do token é o header base64, idêntico entre todos
os usuários — derivar o bucket do prefixo colocava todo mundo no mesmo balde.
"""

import hashlib

from starlette.requests import Request

from app.middlewares.rate_limit import RateLimitMiddleware


async def _dummy_app(scope, receive, send):  # pragma: no cover - nunca chamado
    return None


def _make_request(headers: dict, client=("203.0.113.7", 12345)) -> Request:
    scope = {
        "type": "http",
        "method": "GET",
        "path": "/",
        "headers": [(k.lower().encode(), v.encode()) for k, v in headers.items()],
        "client": client,
    }
    return Request(scope)


# JWT Firebase RS256: os ~20 primeiros chars são o header base64, IDÊNTICO entre usuários.
_FIREBASE_HEADER_PREFIX = "eyJhbGciOiJSUzI1NiIsImtpZCI6"
_TOKEN_A = _FIREBASE_HEADER_PREFIX + "AAA.payload-do-usuario-a.assinatura-a"
_TOKEN_B = _FIREBASE_HEADER_PREFIX + "BBB.payload-do-usuario-b.assinatura-b"

_mw = RateLimitMiddleware(app=_dummy_app)


def test_tokens_diferentes_geram_buckets_diferentes():
    """Regressão H3: mesmo prefixo de header JWT, tokens diferentes -> buckets diferentes."""
    cid_a = _mw._get_client_id(_make_request({"authorization": f"Bearer {_TOKEN_A}"}))
    cid_b = _mw._get_client_id(_make_request({"authorization": f"Bearer {_TOKEN_B}"}))
    assert cid_a != cid_b
    assert cid_a.startswith("auth:")
    assert cid_b.startswith("auth:")


def test_mesmo_token_mesmo_bucket():
    cid_1 = _mw._get_client_id(_make_request({"authorization": f"Bearer {_TOKEN_A}"}))
    cid_2 = _mw._get_client_id(_make_request({"authorization": f"Bearer {_TOKEN_A}"}))
    assert cid_1 == cid_2
    # confirma que é o hash do token COMPLETO, não do prefixo
    esperado = "auth:" + hashlib.sha256(_TOKEN_A.encode()).hexdigest()[:16]
    assert cid_1 == esperado


def test_sem_token_usa_ip():
    cid = _mw._get_client_id(_make_request({}, client=("9.9.9.9", 0)))
    assert cid == "ip:9.9.9.9"


def test_x_forwarded_for_tem_prioridade_sobre_client():
    cid = _mw._get_client_id(
        _make_request({"x-forwarded-for": "198.51.100.5, 10.0.0.1"}, client=("9.9.9.9", 0))
    )
    assert cid == "ip:198.51.100.5"


def test_token_bruto_nunca_aparece_no_client_id():
    """Não vazar token: o client_id é só o hash truncado (16 hex)."""
    cid = _mw._get_client_id(_make_request({"authorization": f"Bearer {_TOKEN_A}"}))
    assert _TOKEN_A not in cid
    assert _FIREBASE_HEADER_PREFIX not in cid
    digest = cid.split(":", 1)[1]
    assert len(digest) == 16
    assert all(c in "0123456789abcdef" for c in digest)
