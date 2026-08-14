"""
Aceite versionado das Diretrizes da Comunidade (pré-requisito para publicar UGC)
===============================================================================
App Store Review Guideline 1.2 exige, entre as quatro salvaguardas de UGC, que
o usuário concorde com termos que declarem **tolerância zero** a conteúdo
censurável e a comportamento abusivo — e esse aceite precisa acontecer *antes*
de o usuário conseguir publicar.

Decisão de projeto: NÃO criamos tabela nova. O repositório já versiona
documentos legais (`legal_documents` com UNIQUE(type, version)) e registra
aceite por documento (`user_consents`). Reusar isso dá de graça:

  - versionamento real: publicar a v2 invalida o aceite da v1, porque o
    consentimento aponta para o `document_id`, não para o tipo;
  - trilha de auditoria já existente (`create_audit_log`);
  - re-aceite automático quando o texto mudar, que é o requisito da Apple.

O enforcement devolve **428 Precondition Required** — código pensado
exatamente para "o cliente precisa satisfazer uma condição antes de repetir a
requisição". Não usamos 403: o usuário TEM permissão, só falta o aceite, e o
app precisa distinguir os dois casos para abrir a tela certa.
"""

from __future__ import annotations

from uuid import UUID

from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.db.models import LegalDocument, UserConsent

LEGAL_TYPE = "COMMUNITY_GUIDELINES"

ERROR_CODE = "community_guidelines_not_accepted"


def latest_guidelines(db: Session) -> LegalDocument | None:
    """Versão publicada mais recente das diretrizes."""
    return (
        db.query(LegalDocument)
        .filter(LegalDocument.type == LEGAL_TYPE)
        .order_by(LegalDocument.published_at.desc())
        .first()
    )


def has_accepted_latest(db: Session, user_id: UUID) -> tuple[bool, LegalDocument | None]:
    """
    Diz se o usuário aceitou a versão VIGENTE.

    Devolve também o documento para o chamador poder informar ao app qual
    versão precisa ser exibida — sem uma segunda consulta.
    """
    doc = latest_guidelines(db)
    if doc is None:
        # Sem documento publicado não há o que aceitar. Tratamos como aceito
        # para não travar o produto por falha de seed — a ausência é um
        # problema operacional, e bloquear toda publicação seria pior.
        return True, None

    accepted = (
        db.query(UserConsent.id)
        .filter(UserConsent.user_id == user_id, UserConsent.document_id == doc.id)
        .first()
        is not None
    )
    return accepted, doc


def require_accepted(db: Session, user_id: UUID) -> None:
    """
    Barra a publicação se o usuário não aceitou a versão vigente.

    Levanta 428 com a versão exigida, para o app abrir a tela de aceite e
    repetir a requisição depois.
    """
    accepted, doc = has_accepted_latest(db, user_id)
    if accepted:
        return

    assert doc is not None  # has_accepted_latest só devolve False com doc
    raise HTTPException(
        status_code=428,
        detail={
            "error": ERROR_CODE,
            "message": (
                "Para publicar, é necessário aceitar as Diretrizes da Comunidade."
            ),
            "required_version": doc.version,
            "document_id": str(doc.id),
        },
    )
