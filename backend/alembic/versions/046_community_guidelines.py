"""Publica as Diretrizes da Comunidade v1.0 (pre-requisito de UGC)

App Store Review Guideline 1.2 exige que o usuario concorde com termos de
tolerancia zero a conteudo censuravel e a usuarios abusivos ANTES de publicar.
Reusamos legal_documents/user_consents, que ja sao versionados — publicar uma
v2 no futuro invalida automaticamente o aceite da v1, porque o consentimento
aponta para o document_id.

Idempotente: se a versao ja existir, nao duplica (ha UNIQUE(type, version)).

Revision ID: 046_community_guidelines
Revises: 045_ugc_moderation
"""

from alembic import op
import sqlalchemy as sa

revision = "046_community_guidelines"
down_revision = "045_ugc_moderation"
branch_labels = None
depends_on = None

LEGAL_TYPE = "COMMUNITY_GUIDELINES"
VERSION = "1.0"

CONTENT = """# Diretrizes da Comunidade Lumen+

Ao publicar qualquer conteudo no Lumen+ voce concorda com estas diretrizes.

## Tolerancia zero

Nao ha tolerancia para conteudo censuravel nem para usuarios abusivos.
Conteudo que viole estas diretrizes e removido, e contas reincidentes sao
suspensas ou encerradas.

## O que nao e permitido

- Discurso de odio ou incitacao a violencia contra pessoa ou grupo, inclusive
  por religiao, raca, cor, etnia, origem, deficiencia, idade, sexo,
  orientacao sexual ou identidade de genero.
- Ameaca, assedio, perseguicao, intimidacao ou exposicao de pessoa.
- Conteudo sexual explicito; qualquer conteudo de natureza sexual envolvendo
  menor de idade e proibido de forma absoluta e sera denunciado as
  autoridades competentes.
- Dados pessoais de terceiros sem consentimento (telefone, endereco,
  documentos, fotos identificaveis).
- Golpes, pedidos de dinheiro em nome da comunidade, correntes, spam,
  propaganda ou divulgacao comercial nao autorizada.
- Uso da imagem ou do nome da comunidade para fins politicos ou comerciais.
- Personificacao de outra pessoa, de sacerdote ou de coordenacao.

## O que esperamos

Este e um espaco de comunhao. Assuntos dificeis — sofrimento, luto, vicio,
conflito familiar — sao parte legitima do acompanhamento pastoral e tem lugar
aqui, desde que tratados com respeito e cuidado com quem le.

## Como agimos

- Todo conteudo publicado pode ser denunciado por qualquer usuario.
- Voce pode bloquear outro usuario; o conteudo dele deixa de aparecer para
  voce e o seu deixa de aparecer para ele.
- Denuncias sao analisadas pela moderacao em ate 24 horas.
- Conteudo que viole estas diretrizes e removido, e a conta responsavel pode
  ser suspensa ou encerrada, sem aviso previo em casos graves.

## Contato

Duvidas, recursos ou denuncias urgentes: moderacao@lumenserfeliz.org

Versao 1.0.
"""


def upgrade() -> None:
    legal_documents = sa.table(
        "legal_documents",
        sa.column("type", sa.Text),
        sa.column("version", sa.Text),
        sa.column("content", sa.Text),
    )

    conn = op.get_bind()
    exists = conn.execute(
        sa.text(
            "SELECT 1 FROM legal_documents WHERE type = :t AND version = :v LIMIT 1"
        ),
        {"t": LEGAL_TYPE, "v": VERSION},
    ).first()

    if exists is None:
        op.bulk_insert(
            legal_documents,
            [{"type": LEGAL_TYPE, "version": VERSION, "content": CONTENT}],
        )


def downgrade() -> None:
    conn = op.get_bind()
    # Remove primeiro os consentimentos que apontam para este documento —
    # o FK tem ON DELETE CASCADE, mas ser explicito deixa claro o efeito:
    # desfazer esta migration APAGA o registro de aceite dos usuarios.
    conn.execute(
        sa.text(
            "DELETE FROM user_consents WHERE document_id IN "
            "(SELECT id FROM legal_documents WHERE type = :t AND version = :v)"
        ),
        {"t": LEGAL_TYPE, "v": VERSION},
    )
    conn.execute(
        sa.text("DELETE FROM legal_documents WHERE type = :t AND version = :v"),
        {"t": LEGAL_TYPE, "v": VERSION},
    )
