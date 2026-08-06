"""
Resolução de IP resistente a spoofing de X-Forwarded-For (rate limiting).

Regra: o cliente controla o valor mais à ESQUERDA do XFF; o IP real é apendado
pelos proxies confiáveis à DIREITA. Pegamos a entrada a `trusted_proxy_hops`
posições da direita (Railway = 1 hop) e validamos o formato.
"""
from app.middlewares import rate_limit
from app.middlewares.rate_limit import _resolve_client_ip, _is_valid_ip


class _FakeClient:
    def __init__(self, host):
        self.host = host


class _FakeRequest:
    def __init__(self, xff=None, client_host="10.0.0.9"):
        self.headers = {"x-forwarded-for": xff} if xff is not None else {}
        self.client = _FakeClient(client_host) if client_host else None


def test_valid_ip_helper():
    assert _is_valid_ip("1.2.3.4") is True
    assert _is_valid_ip("::1") is True
    assert _is_valid_ip("2001:db8::1") is True
    assert _is_valid_ip("not-an-ip") is False
    assert _is_valid_ip("999.999.999.999") is False
    assert _is_valid_ip("") is False


def test_spoof_left_value_is_ignored(monkeypatch):
    # Cliente forja o primeiro valor; o real é apendado pelo proxy (direita).
    monkeypatch.setattr(rate_limit.settings, "trusted_proxy_hops", 1)
    req = _FakeRequest(xff="6.6.6.6, 203.0.113.5")
    assert _resolve_client_ip(req) == "203.0.113.5"


def test_single_forwarded_value(monkeypatch):
    monkeypatch.setattr(rate_limit.settings, "trusted_proxy_hops", 1)
    req = _FakeRequest(xff="198.51.100.7")
    assert _resolve_client_ip(req) == "198.51.100.7"


def test_malformed_forwarded_falls_back_to_peer(monkeypatch):
    monkeypatch.setattr(rate_limit.settings, "trusted_proxy_hops", 1)
    req = _FakeRequest(xff="garbage-value", client_host="192.0.2.10")
    assert _resolve_client_ip(req) == "192.0.2.10"


def test_no_forwarded_uses_peer(monkeypatch):
    monkeypatch.setattr(rate_limit.settings, "trusted_proxy_hops", 1)
    req = _FakeRequest(xff=None, client_host="192.0.2.20")
    assert _resolve_client_ip(req) == "192.0.2.20"


def test_ipv6_forwarded(monkeypatch):
    monkeypatch.setattr(rate_limit.settings, "trusted_proxy_hops", 1)
    req = _FakeRequest(xff="2001:db8::abcd")
    assert _resolve_client_ip(req) == "2001:db8::abcd"


def test_multiple_trusted_hops(monkeypatch):
    # 2 hops confiáveis: pega o 2º a partir da direita.
    monkeypatch.setattr(rate_limit.settings, "trusted_proxy_hops", 2)
    req = _FakeRequest(xff="6.6.6.6, 203.0.113.5, 10.0.0.1")
    assert _resolve_client_ip(req) == "203.0.113.5"


def test_no_client_and_bad_forwarded_returns_none(monkeypatch):
    monkeypatch.setattr(rate_limit.settings, "trusted_proxy_hops", 1)
    req = _FakeRequest(xff="bad", client_host=None)
    assert _resolve_client_ip(req) is None
