"""
Testes das decisões de roteamento de notificação (push/e-mail) por prioridade.

Funções puras de `notification_service` — sem DB, sem rede — cobrindo a matriz
de entrega documentada:
  LOW      -> só Inbox (sem push, sem e-mail)
  NORMAL   -> push se opt-in; e-mail só se push falhou
  HIGH     -> push se opt-in; e-mail sempre
  CRITICAL -> push (ignora opt-in); e-mail sempre
"""

from app.notifications.notification_service import (
    _should_send_push,
    _should_send_email,
    NotificationPriority as P,
)


class TestShouldSendPush:
    def test_critical_bypassa_opt_in(self):
        assert _should_send_push(P.CRITICAL, push_opted_in=False) is True
        assert _should_send_push(P.CRITICAL, push_opted_in=True) is True

    def test_low_nunca_envia_push(self):
        assert _should_send_push(P.LOW, push_opted_in=True) is False
        assert _should_send_push(P.LOW, push_opted_in=False) is False

    def test_normal_segue_opt_in(self):
        assert _should_send_push(P.NORMAL, push_opted_in=True) is True
        assert _should_send_push(P.NORMAL, push_opted_in=False) is False

    def test_high_segue_opt_in(self):
        assert _should_send_push(P.HIGH, push_opted_in=True) is True
        assert _should_send_push(P.HIGH, push_opted_in=False) is False


class TestShouldSendEmail:
    def test_low_nunca_envia_email(self):
        assert _should_send_email(P.LOW, push_delivered=False) is False
        assert _should_send_email(P.LOW, push_delivered=True) is False

    def test_high_sempre_envia_email(self):
        assert _should_send_email(P.HIGH, push_delivered=True) is True
        assert _should_send_email(P.HIGH, push_delivered=False) is True

    def test_critical_sempre_envia_email(self):
        assert _should_send_email(P.CRITICAL, push_delivered=True) is True
        assert _should_send_email(P.CRITICAL, push_delivered=False) is True

    def test_normal_envia_email_so_se_push_falhou(self):
        assert _should_send_email(P.NORMAL, push_delivered=False) is True
        assert _should_send_email(P.NORMAL, push_delivered=True) is False


class TestVapidPublicKeyEndpoint:
    """Contrato do endpoint público (200 com chave, ou 503 se não configurado)."""

    def test_endpoint_retorna_200_ou_503_configurado(self, client):
        res = client.get("/push/vapid-public-key")
        assert res.status_code in (200, 503)
        if res.status_code == 200:
            assert res.json()["public_key"]
        else:
            assert res.json()["detail"]["error"] == "not_configured"
