"""E-mail transacional via SendGrid.
POLÍTICA: e-mails contêm apenas título + resumo (200 chars) + CTA.
Conteúdo completo permanece dentro do Lumen+.
"""

import structlog
from sendgrid import SendGridAPIClient
from sendgrid.helpers.mail import Mail
from app.settings import settings

logger = structlog.get_logger()

APP_URL = "https://lumenmobile.vercel.app"


def send_email(to_email: str, subject: str, html_content: str) -> tuple[bool, str | None]:
    """
    Envia e-mail via SendGrid.
    Retorna (True, None) em sucesso; (False, error_detail) em falha.
    Se SENDGRID_API_KEY vazio, retorna (False, 'not_configured').
    """
    if not settings.sendgrid_api_key:
        logger.warning("email_skipped", reason="SENDGRID_API_KEY not configured")
        return False, "not_configured"

    message = Mail(
        from_email=(settings.sendgrid_from_email, settings.sendgrid_from_name),
        to_emails=to_email,
        subject=subject,
        html_content=html_content,
    )
    try:
        sg = SendGridAPIClient(settings.sendgrid_api_key)
        response = sg.send(message)
        ok = response.status_code in (200, 202)
        if not ok:
            return False, f"sendgrid_status={response.status_code}"
        return True, None
    except Exception as exc:
        logger.exception("email_send_error", error_type=type(exc).__name__)
        return False, type(exc).__name__


def _base_template(header_color: str, icon: str, header_text: str, body_html: str,
                   cta_url: str, cta_text: str) -> str:
    return f"""
<html>
<body style="margin:0;padding:0;background:#F3F4F6;font-family:sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0">
    <tr><td align="center" style="padding:32px 16px;">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">
        <tr><td style="background:{header_color};padding:20px 24px;border-radius:12px 12px 0 0;">
          <p style="margin:0;color:#fff;font-size:18px;font-weight:700;">{icon} {header_text}</p>
        </td></tr>
        <tr><td style="background:#fff;padding:24px;border-radius:0 0 12px 12px;">
          {body_html}
          <p style="margin:24px 0 0;">
            <a href="{cta_url}" style="display:inline-block;background:{header_color};color:#fff;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:600;">{cta_text}</a>
          </p>
          <hr style="border:none;border-top:1px solid #E5E7EB;margin:24px 0 16px;">
          <p style="color:#9CA3AF;font-size:11px;margin:0;">
            Você recebe este e-mail porque é membro da Obra Lumen de Evangelização.<br>
            Para cancelar notificações, acesse suas preferências no aplicativo.
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>"""


def build_inbox_email(
    title: str,
    message: str,
    deep_link: str | None = None,
    cta_text: str = "Ver mais",
) -> str:
    summary = message[:200] + ("..." if len(message) > 200 else "")
    cta_url = (APP_URL + deep_link) if deep_link else APP_URL
    body = f"""
      <p style="color:#374151;font-size:16px;font-weight:700;margin:0 0 8px;">{title}</p>
      <p style="color:#6B7280;font-size:14px;line-height:1.6;margin:0 0 16px;">{summary}</p>
      <p style="color:#9CA3AF;font-size:12px;margin:0;">
        Acesse o aplicativo para ler o aviso completo.
      </p>"""
    return _base_template("#7C3AED", "📢", "Novo aviso — Lumen+", body, cta_url, cta_text)


def build_revision_reminder_email() -> str:
    body = """
      <p style="color:#374151;font-size:15px;line-height:1.6;margin:0 0 12px;">
        Este é o seu lembrete mensal para fazer a <strong>revisão do Projeto de Vida</strong>.
      </p>
      <p style="color:#6B7280;font-size:14px;line-height:1.6;margin:0;">
        Reserve um momento de oração e reflexão para avaliar seu progresso,
        rotina espiritual e metas do ciclo atual.
      </p>"""
    return _base_template(
        "#7C3AED", "🙏", "Revisão Mensal do Projeto de Vida",
        body, APP_URL + "/vida", "Acessar Projeto de Vida",
    )
