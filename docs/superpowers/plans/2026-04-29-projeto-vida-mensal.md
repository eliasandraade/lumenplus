# Projeto de Vida Mensal — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Substituir o Projeto de Vida anual do Lumen+ por um planejador mensal (ciclo mensal), mantendo exatamente a lógica e o fluxo do novo projeto web, mas usando o visual nativo do Lumen+ (teal `#1A859B`, Ionicons, StyleSheet.create). Inclui backend completo (o projeto de origem só tem frontend web).

**Architecture:** Backend — novo módulo `projeto_vida_mensal` com 6 models SQLAlchemy, migration Alembic, schemas Pydantic v2 e rotas FastAPI registradas em `/projeto-vida-mensal`. Frontend — substituição de todas as telas `app/vida/` pelo fluxo mensal: hub → wizard de criação (6 passos) → tela de desbloqueio PIN → visualização do ciclo → revisão mensal (4 passos).

**Tech Stack:** Python 3.11 · FastAPI · SQLAlchemy 2 · PostgreSQL · Alembic · React Native · Expo Router · TypeScript · Ionicons

---

## File Structure

### Backend
| Ação | Arquivo | Responsabilidade |
|------|---------|-----------------|
| Modify | `backend/app/db/models.py` | Adicionar 6 classes: ProjetoVidaMensal, ProjetoVidaComunidade, ProjetoVidaCuidado, ProjetoVidaCompromisso, ProjetoVidaPratica, ProjetoVidaRevisao |
| Create | `backend/alembic/versions/032_projeto_vida_mensal.py` | Migration: criar 6 tabelas |
| Create | `backend/app/schemas/projeto_vida_mensal.py` | Schemas Pydantic v2 (input/output) |
| Create | `backend/app/api/projeto_vida_mensal_routes.py` | Router FastAPI `/projeto-vida-mensal` |
| Modify | `backend/app/main.py` | Importar e registrar o novo router |
| Create | `backend/tests/test_projeto_vida_mensal.py` | Testes de integração |

### Frontend
| Ação | Arquivo | Responsabilidade |
|------|---------|-----------------|
| Create | `lumen_mobile/src/services/projetoVidaMensal.ts` | Types TypeScript + funções de API |
| Modify | `lumen_mobile/app/vida/index.tsx` | Hub: exibe ciclo do mês atual ou CTA criar |
| Modify | `lumen_mobile/app/vida/wizard.tsx` | Wizard de criação (6 passos) |
| Create | `lumen_mobile/app/vida/unlock.tsx` | Tela de desbloqueio PIN |
| Create | `lumen_mobile/app/vida/ciclo.tsx` | Visualização completa do ciclo |
| Modify | `lumen_mobile/app/vida/revisao.tsx` | Fluxo de revisão mensal (4 passos) |
| Modify | `lumen_mobile/app/vida/_layout.tsx` | Adicionar screens unlock e ciclo ao Stack |

---

## Task 1: DB Models

**Files:**
- Modify: `backend/app/db/models.py` (append ao final do arquivo)

- [ ] **Step 1: Escrever o teste que falha**

```python
# backend/tests/test_projeto_vida_mensal.py
import pytest
from fastapi.testclient import TestClient

HEADERS = {"Authorization": "Bearer dev:pvm-test-user:pvm@test.com"}

def test_models_importable():
    """Verifica que os 6 models foram adicionados sem erros de import."""
    from app.db.models import (
        ProjetoVidaComunidade,
        ProjetoVidaCuidado,
        ProjetoVidaCompromisso,
        ProjetoVidaMensal,
        ProjetoVidaPratica,
        ProjetoVidaRevisao,
    )
    assert ProjetoVidaMensal.__tablename__ == "projetos_vida_mensal"
    assert ProjetoVidaComunidade.__tablename__ == "projetos_vida_comunidade"
    assert ProjetoVidaCuidado.__tablename__ == "projetos_vida_cuidado"
    assert ProjetoVidaCompromisso.__tablename__ == "projetos_vida_compromissos"
    assert ProjetoVidaPratica.__tablename__ == "projetos_vida_praticas"
    assert ProjetoVidaRevisao.__tablename__ == "projetos_vida_revisoes"
```

- [ ] **Step 2: Rodar o teste — deve falhar**

```
cd backend
pytest tests/test_projeto_vida_mensal.py::test_models_importable -v
# Expected: FAILED — ImportError: cannot import name 'ProjetoVidaMensal'
```

- [ ] **Step 3: Implementar — adicionar os 6 models ao final de `backend/app/db/models.py`**

```python
# ── PROJETO DE VIDA MENSAL ────────────────────────────────────────────────────


class ProjetoVidaMensal(Base):
    __tablename__ = "projetos_vida_mensal"

    id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True),
        primary_key=True,
        default=_uuid_mod.uuid4,
        server_default=func.gen_random_uuid(),
    )
    user_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    mes: Mapped[int] = mapped_column(Integer, nullable=False)
    ano: Mapped[int] = mapped_column(Integer, nullable=False)
    tema: Mapped[str | None] = mapped_column(Text, nullable=True)
    intencao: Mapped[str | None] = mapped_column(Text, nullable=True)
    pin_hash: Mapped[str | None] = mapped_column(Text, nullable=True)
    concluido: Mapped[bool] = mapped_column(Boolean, default=False, server_default="false")
    observacoes_mes: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    comunidade: Mapped["ProjetoVidaComunidade | None"] = relationship(
        "ProjetoVidaComunidade",
        back_populates="projeto",
        uselist=False,
        cascade="all, delete-orphan",
    )
    cuidado: Mapped["ProjetoVidaCuidado | None"] = relationship(
        "ProjetoVidaCuidado",
        back_populates="projeto",
        uselist=False,
        cascade="all, delete-orphan",
    )
    compromissos: Mapped[list["ProjetoVidaCompromisso"]] = relationship(
        "ProjetoVidaCompromisso",
        back_populates="projeto",
        cascade="all, delete-orphan",
        order_by="ProjetoVidaCompromisso.ordem",
    )
    praticas: Mapped[list["ProjetoVidaPratica"]] = relationship(
        "ProjetoVidaPratica",
        back_populates="projeto",
        cascade="all, delete-orphan",
        order_by="ProjetoVidaPratica.ordem",
    )
    revisao: Mapped["ProjetoVidaRevisao | None"] = relationship(
        "ProjetoVidaRevisao",
        back_populates="projeto",
        uselist=False,
        cascade="all, delete-orphan",
    )

    __table_args__ = (
        UniqueConstraint("user_id", "mes", "ano", name="uq_projeto_vida_mensal_user_mes_ano"),
    )


class ProjetoVidaComunidade(Base):
    __tablename__ = "projetos_vida_comunidade"

    id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True),
        primary_key=True,
        default=_uuid_mod.uuid4,
        server_default=func.gen_random_uuid(),
    )
    projeto_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey("projetos_vida_mensal.id", ondelete="CASCADE"),
        nullable=False,
        unique=True,
    )
    partilha_acompanhador: Mapped[str | None] = mapped_column(Text, nullable=True)
    encontro_familia: Mapped[str | None] = mapped_column(Text, nullable=True)
    dias_grupo: Mapped[str | None] = mapped_column(Text, nullable=True)
    outros: Mapped[str | None] = mapped_column(Text, nullable=True)

    projeto: Mapped["ProjetoVidaMensal"] = relationship(
        "ProjetoVidaMensal", back_populates="comunidade"
    )


class ProjetoVidaCuidado(Base):
    __tablename__ = "projetos_vida_cuidado"

    id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True),
        primary_key=True,
        default=_uuid_mod.uuid4,
        server_default=func.gen_random_uuid(),
    )
    projeto_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey("projetos_vida_mensal.id", ondelete="CASCADE"),
        nullable=False,
        unique=True,
    )
    consultas: Mapped[str | None] = mapped_column(Text, nullable=True)
    exames: Mapped[str | None] = mapped_column(Text, nullable=True)
    descanso: Mapped[str | None] = mapped_column(Text, nullable=True)
    outros: Mapped[str | None] = mapped_column(Text, nullable=True)

    projeto: Mapped["ProjetoVidaMensal"] = relationship(
        "ProjetoVidaMensal", back_populates="cuidado"
    )


class ProjetoVidaCompromisso(Base):
    __tablename__ = "projetos_vida_compromissos"

    id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True),
        primary_key=True,
        default=_uuid_mod.uuid4,
        server_default=func.gen_random_uuid(),
    )
    projeto_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey("projetos_vida_mensal.id", ondelete="CASCADE"),
        nullable=False,
    )
    semana: Mapped[str] = mapped_column(String(3), nullable=False)  # s1..s5
    titulo: Mapped[str | None] = mapped_column(String(200), nullable=True)
    dia: Mapped[str | None] = mapped_column(String(50), nullable=True)
    horario: Mapped[str | None] = mapped_column(String(50), nullable=True)
    obs: Mapped[str | None] = mapped_column(Text, nullable=True)
    ordem: Mapped[int] = mapped_column(Integer, default=0, server_default="0")

    projeto: Mapped["ProjetoVidaMensal"] = relationship(
        "ProjetoVidaMensal", back_populates="compromissos"
    )


class ProjetoVidaPratica(Base):
    __tablename__ = "projetos_vida_praticas"

    id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True),
        primary_key=True,
        default=_uuid_mod.uuid4,
        server_default=func.gen_random_uuid(),
    )
    projeto_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey("projetos_vida_mensal.id", ondelete="CASCADE"),
        nullable=False,
    )
    dia_semana: Mapped[str] = mapped_column(String(3), nullable=False)  # seg..dom
    tipo: Mapped[str] = mapped_column(String(100), nullable=False)
    horario: Mapped[str | None] = mapped_column(String(50), nullable=True)
    duracao: Mapped[str | None] = mapped_column(String(50), nullable=True)
    obs: Mapped[str | None] = mapped_column(Text, nullable=True)
    ordem: Mapped[int] = mapped_column(Integer, default=0, server_default="0")

    projeto: Mapped["ProjetoVidaMensal"] = relationship(
        "ProjetoVidaMensal", back_populates="praticas"
    )


class ProjetoVidaRevisao(Base):
    __tablename__ = "projetos_vida_revisoes"

    id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True),
        primary_key=True,
        default=_uuid_mod.uuid4,
        server_default=func.gen_random_uuid(),
    )
    projeto_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey("projetos_vida_mensal.id", ondelete="CASCADE"),
        nullable=False,
        unique=True,
    )
    # Revisão vocacional
    graca: Mapped[str | None] = mapped_column(Text, nullable=True)
    fidelidade: Mapped[str | None] = mapped_column(Text, nullable=True)
    falhas: Mapped[str | None] = mapped_column(Text, nullable=True)
    ordenar: Mapped[str | None] = mapped_column(Text, nullable=True)
    passo: Mapped[str | None] = mapped_column(Text, nullable=True)
    # Próximo ciclo (StepCommitment)
    decisao: Mapped[str | None] = mapped_column(Text, nullable=True)
    virtude: Mapped[str | None] = mapped_column(Text, nullable=True)
    conversao: Mapped[str | None] = mapped_column(Text, nullable=True)
    passo_proximo: Mapped[str | None] = mapped_column(Text, nullable=True)

    projeto: Mapped["ProjetoVidaMensal"] = relationship(
        "ProjetoVidaMensal", back_populates="revisao"
    )
```

- [ ] **Step 4: Rodar o teste — deve passar**

```
pytest tests/test_projeto_vida_mensal.py::test_models_importable -v
# Expected: PASSED
```

- [ ] **Step 5: Commit**

```bash
git add backend/app/db/models.py backend/tests/test_projeto_vida_mensal.py
git commit -m "feat: add ProjetoVidaMensal SQLAlchemy models (6 tables)"
```

---

## Task 2: Alembic Migration

**Files:**
- Create: `backend/alembic/versions/032_projeto_vida_mensal.py`

- [ ] **Step 1: Criar o arquivo de migration**

```python
# backend/alembic/versions/032_projeto_vida_mensal.py
"""Projeto de Vida Mensal — criar 6 tabelas

Revision ID: 032_projeto_vida_mensal
Revises: 031_add_missao_org_unit
Create Date: 2026-04-29
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "032_projeto_vida_mensal"
down_revision: Union[str, None] = "031_add_missao_org_unit"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "projetos_vida_mensal",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True,
                  server_default=sa.text("gen_random_uuid()")),
        sa.Column("user_id", postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("mes", sa.Integer(), nullable=False),
        sa.Column("ano", sa.Integer(), nullable=False),
        sa.Column("tema", sa.Text(), nullable=True),
        sa.Column("intencao", sa.Text(), nullable=True),
        sa.Column("pin_hash", sa.Text(), nullable=True),
        sa.Column("concluido", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("observacoes_mes", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True),
                  server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True),
                  server_default=sa.func.now(), nullable=False),
        sa.UniqueConstraint("user_id", "mes", "ano",
                            name="uq_projeto_vida_mensal_user_mes_ano"),
    )
    op.create_index("ix_projetos_vida_mensal_user_id", "projetos_vida_mensal", ["user_id"])

    op.create_table(
        "projetos_vida_comunidade",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True,
                  server_default=sa.text("gen_random_uuid()")),
        sa.Column("projeto_id", postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("projetos_vida_mensal.id", ondelete="CASCADE"),
                  nullable=False, unique=True),
        sa.Column("partilha_acompanhador", sa.Text(), nullable=True),
        sa.Column("encontro_familia", sa.Text(), nullable=True),
        sa.Column("dias_grupo", sa.Text(), nullable=True),
        sa.Column("outros", sa.Text(), nullable=True),
    )

    op.create_table(
        "projetos_vida_cuidado",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True,
                  server_default=sa.text("gen_random_uuid()")),
        sa.Column("projeto_id", postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("projetos_vida_mensal.id", ondelete="CASCADE"),
                  nullable=False, unique=True),
        sa.Column("consultas", sa.Text(), nullable=True),
        sa.Column("exames", sa.Text(), nullable=True),
        sa.Column("descanso", sa.Text(), nullable=True),
        sa.Column("outros", sa.Text(), nullable=True),
    )

    op.create_table(
        "projetos_vida_compromissos",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True,
                  server_default=sa.text("gen_random_uuid()")),
        sa.Column("projeto_id", postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("projetos_vida_mensal.id", ondelete="CASCADE"),
                  nullable=False),
        sa.Column("semana", sa.String(3), nullable=False),
        sa.Column("titulo", sa.String(200), nullable=True),
        sa.Column("dia", sa.String(50), nullable=True),
        sa.Column("horario", sa.String(50), nullable=True),
        sa.Column("obs", sa.Text(), nullable=True),
        sa.Column("ordem", sa.Integer(), nullable=False, server_default="0"),
    )
    op.create_index("ix_projetos_vida_compromissos_projeto_id",
                    "projetos_vida_compromissos", ["projeto_id"])

    op.create_table(
        "projetos_vida_praticas",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True,
                  server_default=sa.text("gen_random_uuid()")),
        sa.Column("projeto_id", postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("projetos_vida_mensal.id", ondelete="CASCADE"),
                  nullable=False),
        sa.Column("dia_semana", sa.String(3), nullable=False),
        sa.Column("tipo", sa.String(100), nullable=False),
        sa.Column("horario", sa.String(50), nullable=True),
        sa.Column("duracao", sa.String(50), nullable=True),
        sa.Column("obs", sa.Text(), nullable=True),
        sa.Column("ordem", sa.Integer(), nullable=False, server_default="0"),
    )
    op.create_index("ix_projetos_vida_praticas_projeto_id",
                    "projetos_vida_praticas", ["projeto_id"])

    op.create_table(
        "projetos_vida_revisoes",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True,
                  server_default=sa.text("gen_random_uuid()")),
        sa.Column("projeto_id", postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("projetos_vida_mensal.id", ondelete="CASCADE"),
                  nullable=False, unique=True),
        sa.Column("graca", sa.Text(), nullable=True),
        sa.Column("fidelidade", sa.Text(), nullable=True),
        sa.Column("falhas", sa.Text(), nullable=True),
        sa.Column("ordenar", sa.Text(), nullable=True),
        sa.Column("passo", sa.Text(), nullable=True),
        sa.Column("decisao", sa.Text(), nullable=True),
        sa.Column("virtude", sa.Text(), nullable=True),
        sa.Column("conversao", sa.Text(), nullable=True),
        sa.Column("passo_proximo", sa.Text(), nullable=True),
    )


def downgrade() -> None:
    op.drop_table("projetos_vida_revisoes")
    op.drop_index("ix_projetos_vida_praticas_projeto_id", "projetos_vida_praticas")
    op.drop_table("projetos_vida_praticas")
    op.drop_index("ix_projetos_vida_compromissos_projeto_id", "projetos_vida_compromissos")
    op.drop_table("projetos_vida_compromissos")
    op.drop_table("projetos_vida_cuidado")
    op.drop_table("projetos_vida_comunidade")
    op.drop_index("ix_projetos_vida_mensal_user_id", "projetos_vida_mensal")
    op.drop_table("projetos_vida_mensal")
```

- [ ] **Step 2: Verificar que a migration aparece no histórico**

```bash
cd backend
alembic history | head -5
# Expected: 032_projeto_vida_mensal (head)
```

- [ ] **Step 3: Testar upgrade/downgrade em banco local (se disponível)**

```bash
alembic upgrade 032_projeto_vida_mensal
alembic downgrade 031_add_missao_org_unit
alembic upgrade head
```

> Se não houver banco local, pule este passo — os testes em SQLite cobrem a criação via `Base.metadata.create_all`.

- [ ] **Step 4: Commit**

```bash
git add backend/alembic/versions/032_projeto_vida_mensal.py
git commit -m "feat: migration 032 — tabelas projeto de vida mensal"
```

---

## Task 3: Pydantic Schemas

**Files:**
- Create: `backend/app/schemas/projeto_vida_mensal.py`

- [ ] **Step 1: Escrever o teste que falha**

```python
# Adicionar em backend/tests/test_projeto_vida_mensal.py

def test_schemas_importable():
    from app.schemas.projeto_vida_mensal import (
        ProjetoVidaMensalCreate,
        ProjetoVidaMensalUpdate,
        ProjetoVidaMensalFull,
        ProjetoVidaMensalSummary,
        PinVerifyRequest,
        PinVerifyResponse,
        RevisaoUpsert,
    )
    # Validação básica de campos
    create = ProjetoVidaMensalCreate(mes=4, ano=2026)
    assert create.mes == 4
    assert create.ano == 2026
    assert create.pin is None

def test_schema_pin_validation():
    from app.schemas.projeto_vida_mensal import ProjetoVidaMensalCreate
    from pydantic import ValidationError
    with pytest.raises(ValidationError):
        ProjetoVidaMensalCreate(mes=4, ano=2026, pin="abc")  # não-numérico
    with pytest.raises(ValidationError):
        ProjetoVidaMensalCreate(mes=4, ano=2026, pin="123")   # 3 dígitos
    # válido
    ok = ProjetoVidaMensalCreate(mes=4, ano=2026, pin="1234")
    assert ok.pin == "1234"
```

- [ ] **Step 2: Rodar — deve falhar**

```
pytest tests/test_projeto_vida_mensal.py::test_schemas_importable -v
# Expected: FAILED — ModuleNotFoundError
```

- [ ] **Step 3: Criar `backend/app/schemas/projeto_vida_mensal.py`**

```python
"""
Schemas — Projeto de Vida Mensal
=================================
"""

from datetime import datetime
from typing import List, Optional
from uuid import UUID

from pydantic import BaseModel, Field


# ── Sub-schemas ────────────────────────────────────────────────────────────


class ComunidadeData(BaseModel):
    partilha_acompanhador: Optional[str] = None
    encontro_familia: Optional[str] = None
    dias_grupo: Optional[str] = None
    outros: Optional[str] = None


class CuidadoData(BaseModel):
    consultas: Optional[str] = None
    exames: Optional[str] = None
    descanso: Optional[str] = None
    outros: Optional[str] = None


class CompromissoIn(BaseModel):
    semana: str = Field(..., pattern=r"^s[1-5]$")
    titulo: Optional[str] = Field(None, max_length=200)
    dia: Optional[str] = Field(None, max_length=50)
    horario: Optional[str] = Field(None, max_length=50)
    obs: Optional[str] = Field(None, max_length=1000)
    ordem: int = 0


class CompromissoOut(BaseModel):
    id: UUID
    semana: str
    titulo: Optional[str] = None
    dia: Optional[str] = None
    horario: Optional[str] = None
    obs: Optional[str] = None
    ordem: int

    model_config = {"from_attributes": True}


class PraticaIn(BaseModel):
    dia_semana: str = Field(..., pattern=r"^(seg|ter|qua|qui|sex|sab|dom)$")
    tipo: str = Field(..., max_length=100)
    horario: Optional[str] = Field(None, max_length=50)
    duracao: Optional[str] = Field(None, max_length=50)
    obs: Optional[str] = Field(None, max_length=1000)
    ordem: int = 0


class PraticaOut(BaseModel):
    id: UUID
    dia_semana: str
    tipo: str
    horario: Optional[str] = None
    duracao: Optional[str] = None
    obs: Optional[str] = None
    ordem: int

    model_config = {"from_attributes": True}


class RevisaoUpsert(BaseModel):
    graca: Optional[str] = None
    fidelidade: Optional[str] = None
    falhas: Optional[str] = None
    ordenar: Optional[str] = None
    passo: Optional[str] = None
    decisao: Optional[str] = None
    virtude: Optional[str] = None
    conversao: Optional[str] = None
    passo_proximo: Optional[str] = None


class RevisaoOut(BaseModel):
    graca: Optional[str] = None
    fidelidade: Optional[str] = None
    falhas: Optional[str] = None
    ordenar: Optional[str] = None
    passo: Optional[str] = None
    decisao: Optional[str] = None
    virtude: Optional[str] = None
    conversao: Optional[str] = None
    passo_proximo: Optional[str] = None

    model_config = {"from_attributes": True}


# ── Top-level schemas ──────────────────────────────────────────────────────


class ProjetoVidaMensalCreate(BaseModel):
    mes: int = Field(..., ge=1, le=12)
    ano: int = Field(..., ge=2024, le=2100)
    tema: Optional[str] = Field(None, max_length=500)
    intencao: Optional[str] = None
    pin: Optional[str] = Field(None, min_length=4, max_length=4, pattern=r"^\d{4}$")


class ProjetoVidaMensalUpdate(BaseModel):
    tema: Optional[str] = Field(None, max_length=500)
    intencao: Optional[str] = None
    observacoes_mes: Optional[str] = None
    concluido: Optional[bool] = None
    comunidade: Optional[ComunidadeData] = None
    cuidado: Optional[CuidadoData] = None
    compromissos: Optional[List[CompromissoIn]] = None
    praticas: Optional[List[PraticaIn]] = None


class ProjetoVidaMensalSummary(BaseModel):
    id: UUID
    mes: int
    ano: int
    tema: Optional[str] = None
    concluido: bool
    has_pin: bool
    created_at: datetime

    model_config = {"from_attributes": True}


class ProjetoVidaMensalFull(BaseModel):
    id: UUID
    mes: int
    ano: int
    tema: Optional[str] = None
    intencao: Optional[str] = None
    has_pin: bool
    concluido: bool
    observacoes_mes: Optional[str] = None
    comunidade: Optional[ComunidadeData] = None
    cuidado: Optional[CuidadoData] = None
    compromissos: List[CompromissoOut] = []
    praticas: List[PraticaOut] = []
    revisao: Optional[RevisaoOut] = None
    created_at: datetime
    updated_at: datetime


class PinVerifyRequest(BaseModel):
    pin: str = Field(..., min_length=4, max_length=4, pattern=r"^\d{4}$")


class PinVerifyResponse(BaseModel):
    valid: bool
```

- [ ] **Step 4: Rodar — deve passar**

```
pytest tests/test_projeto_vida_mensal.py::test_schemas_importable tests/test_projeto_vida_mensal.py::test_schema_pin_validation -v
# Expected: PASSED, PASSED
```

- [ ] **Step 5: Commit**

```bash
git add backend/app/schemas/projeto_vida_mensal.py backend/tests/test_projeto_vida_mensal.py
git commit -m "feat: Pydantic schemas para projeto de vida mensal"
```

---

## Task 4: API Routes

**Files:**
- Create: `backend/app/api/projeto_vida_mensal_routes.py`

- [ ] **Step 1: Escrever os testes que falham**

```python
# Adicionar em backend/tests/test_projeto_vida_mensal.py

def test_criar_projeto(client: TestClient):
    r = client.post(
        "/projeto-vida-mensal/",
        json={"mes": 4, "ano": 2026, "tema": "Fé e perseverança"},
        headers=HEADERS,
    )
    assert r.status_code == 201
    data = r.json()
    assert data["mes"] == 4
    assert data["ano"] == 2026
    assert data["tema"] == "Fé e perseverança"
    assert data["has_pin"] is False
    assert data["concluido"] is False
    return data["id"]


def test_criar_projeto_duplicado_retorna_409(client: TestClient):
    client.post("/projeto-vida-mensal/", json={"mes": 5, "ano": 2026}, headers=HEADERS)
    r = client.post("/projeto-vida-mensal/", json={"mes": 5, "ano": 2026}, headers=HEADERS)
    assert r.status_code == 409


def test_get_atual(client: TestClient):
    """GET /atual retorna None quando não existe projeto para o mês corrente."""
    r = client.get("/projeto-vida-mensal/atual", headers=HEADERS)
    assert r.status_code == 200  # retorna null (body: "null") ou objeto


def test_get_historico(client: TestClient):
    r = client.get("/projeto-vida-mensal/historico", headers=HEADERS)
    assert r.status_code == 200
    assert isinstance(r.json(), list)


def test_update_projeto(client: TestClient):
    r = client.post(
        "/projeto-vida-mensal/",
        json={"mes": 6, "ano": 2026},
        headers=HEADERS,
    )
    pid = r.json()["id"]
    r2 = client.put(
        f"/projeto-vida-mensal/{pid}",
        json={
            "tema": "Novo tema",
            "comunidade": {"partilha_acompanhador": "Com o Pe. João"},
            "compromissos": [
                {"semana": "s1", "titulo": "Missa diária", "dia": "Segunda", "horario": "07:00", "obs": "", "ordem": 0}
            ],
        },
        headers=HEADERS,
    )
    assert r2.status_code == 200
    data = r2.json()
    assert data["tema"] == "Novo tema"
    assert data["comunidade"]["partilha_acompanhador"] == "Com o Pe. João"
    assert len(data["compromissos"]) == 1


def test_pin_verificar(client: TestClient):
    r = client.post(
        "/projeto-vida-mensal/",
        json={"mes": 7, "ano": 2026, "pin": "4321"},
        headers=HEADERS,
    )
    pid = r.json()["id"]
    assert r.json()["has_pin"] is True

    r_ok = client.post(
        f"/projeto-vida-mensal/{pid}/pin/verificar",
        json={"pin": "4321"},
        headers=HEADERS,
    )
    assert r_ok.json()["valid"] is True

    r_fail = client.post(
        f"/projeto-vida-mensal/{pid}/pin/verificar",
        json={"pin": "0000"},
        headers=HEADERS,
    )
    assert r_fail.json()["valid"] is False


def test_upsert_revisao(client: TestClient):
    r = client.post(
        "/projeto-vida-mensal/",
        json={"mes": 8, "ano": 2026},
        headers=HEADERS,
    )
    pid = r.json()["id"]
    r2 = client.put(
        f"/projeto-vida-mensal/{pid}/revisao",
        json={"graca": "Vi a graça em...", "decisao": "Orar mais"},
        headers=HEADERS,
    )
    assert r2.status_code == 200
    assert r2.json()["revisao"]["graca"] == "Vi a graça em..."
```

- [ ] **Step 2: Rodar — deve falhar (404 em todos)**

```
cd backend
pytest tests/test_projeto_vida_mensal.py -k "criar or get_atual or historico or update or pin or revisao" -v
# Expected: todos FAILED — 404 Not Found
```

- [ ] **Step 3: Criar `backend/app/api/projeto_vida_mensal_routes.py`**

```python
"""
Projeto de Vida Mensal — API Routes
======================================
Dados pessoais sensíveis: acesso restrito ao próprio usuário.
Conteúdo textual NÃO entra em audit logs.
"""

import hashlib
from datetime import datetime, timezone
from typing import Any
from uuid import UUID

from fastapi import APIRouter, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.api.deps import CurrentUser, DBSession
from app.db.models import (
    ProjetoVidaComunidade,
    ProjetoVidaCuidado,
    ProjetoVidaCompromisso,
    ProjetoVidaMensal,
    ProjetoVidaPratica,
    ProjetoVidaRevisao,
)
from app.schemas.projeto_vida_mensal import (
    ComunidadeData,
    CompromissoOut,
    CuidadoData,
    PinVerifyRequest,
    PinVerifyResponse,
    PraticaOut,
    ProjetoVidaMensalCreate,
    ProjetoVidaMensalFull,
    ProjetoVidaMensalSummary,
    ProjetoVidaMensalUpdate,
    RevisaoOut,
    RevisaoUpsert,
)

router = APIRouter(prefix="/projeto-vida-mensal", tags=["Projeto de Vida Mensal"])


# ── Helpers ────────────────────────────────────────────────────────────────


def _hash_pin(pin: str, user_id: UUID) -> str:
    """PBKDF2-SHA256 com user_id como salt. 100k iterações."""
    dk = hashlib.pbkdf2_hmac(
        "sha256",
        pin.encode("utf-8"),
        str(user_id).encode("utf-8"),
        100_000,
    )
    return dk.hex()


def _load(db: DBSession, projeto_id: UUID, user_id: UUID) -> ProjetoVidaMensal:
    result = db.execute(
        select(ProjetoVidaMensal)
        .where(
            ProjetoVidaMensal.id == projeto_id,
            ProjetoVidaMensal.user_id == user_id,
        )
        .options(
            selectinload(ProjetoVidaMensal.comunidade),
            selectinload(ProjetoVidaMensal.cuidado),
            selectinload(ProjetoVidaMensal.compromissos),
            selectinload(ProjetoVidaMensal.praticas),
            selectinload(ProjetoVidaMensal.revisao),
        )
    )
    projeto = result.scalar_one_or_none()
    if not projeto:
        raise HTTPException(
            status_code=404,
            detail={"error": "not_found", "message": "Projeto não encontrado"},
        )
    return projeto


def _to_full(p: ProjetoVidaMensal) -> ProjetoVidaMensalFull:
    return ProjetoVidaMensalFull(
        id=p.id,
        mes=p.mes,
        ano=p.ano,
        tema=p.tema,
        intencao=p.intencao,
        has_pin=p.pin_hash is not None,
        concluido=p.concluido,
        observacoes_mes=p.observacoes_mes,
        comunidade=ComunidadeData(
            partilha_acompanhador=p.comunidade.partilha_acompanhador,
            encontro_familia=p.comunidade.encontro_familia,
            dias_grupo=p.comunidade.dias_grupo,
            outros=p.comunidade.outros,
        ) if p.comunidade else None,
        cuidado=CuidadoData(
            consultas=p.cuidado.consultas,
            exames=p.cuidado.exames,
            descanso=p.cuidado.descanso,
            outros=p.cuidado.outros,
        ) if p.cuidado else None,
        compromissos=[CompromissoOut.model_validate(c) for c in p.compromissos],
        praticas=[PraticaOut.model_validate(pr) for pr in p.praticas],
        revisao=RevisaoOut.model_validate(p.revisao) if p.revisao else None,
        created_at=p.created_at,
        updated_at=p.updated_at,
    )


# ── Endpoints ──────────────────────────────────────────────────────────────


@router.get("/atual", response_model=ProjetoVidaMensalFull | None)
def get_atual(user: CurrentUser, db: DBSession) -> Any:
    """Retorna o projeto do mês/ano corrente ou null."""
    now = datetime.now(timezone.utc)
    result = db.execute(
        select(ProjetoVidaMensal)
        .where(
            ProjetoVidaMensal.user_id == user.id,
            ProjetoVidaMensal.mes == now.month,
            ProjetoVidaMensal.ano == now.year,
        )
        .options(
            selectinload(ProjetoVidaMensal.comunidade),
            selectinload(ProjetoVidaMensal.cuidado),
            selectinload(ProjetoVidaMensal.compromissos),
            selectinload(ProjetoVidaMensal.praticas),
            selectinload(ProjetoVidaMensal.revisao),
        )
    )
    projeto = result.scalar_one_or_none()
    return _to_full(projeto) if projeto else None


@router.get("/historico", response_model=list[ProjetoVidaMensalSummary])
def get_historico(user: CurrentUser, db: DBSession) -> Any:
    """Lista todos os projetos do usuário (sumário, sem conteúdo)."""
    result = db.execute(
        select(ProjetoVidaMensal)
        .where(ProjetoVidaMensal.user_id == user.id)
        .order_by(ProjetoVidaMensal.ano.desc(), ProjetoVidaMensal.mes.desc())
    )
    projetos = result.scalars().all()
    return [
        ProjetoVidaMensalSummary(
            id=p.id,
            mes=p.mes,
            ano=p.ano,
            tema=p.tema,
            concluido=p.concluido,
            has_pin=p.pin_hash is not None,
            created_at=p.created_at,
        )
        for p in projetos
    ]


@router.post("/", response_model=ProjetoVidaMensalFull, status_code=201)
def criar_projeto(body: ProjetoVidaMensalCreate, user: CurrentUser, db: DBSession) -> Any:
    """Cria novo projeto mensal. Retorna 409 se já existe para mes/ano."""
    existing = db.execute(
        select(ProjetoVidaMensal).where(
            ProjetoVidaMensal.user_id == user.id,
            ProjetoVidaMensal.mes == body.mes,
            ProjetoVidaMensal.ano == body.ano,
        )
    ).scalar_one_or_none()
    if existing:
        raise HTTPException(
            status_code=409,
            detail={"error": "conflict", "message": "Já existe projeto para este mês/ano"},
        )

    projeto = ProjetoVidaMensal(
        user_id=user.id,
        mes=body.mes,
        ano=body.ano,
        tema=body.tema,
        intencao=body.intencao,
        pin_hash=_hash_pin(body.pin, user.id) if body.pin else None,
    )
    db.add(projeto)
    db.flush()  # garante que projeto.id está disponível

    # Inicializa sub-registros em branco
    db.add(ProjetoVidaComunidade(projeto_id=projeto.id))
    db.add(ProjetoVidaCuidado(projeto_id=projeto.id))

    db.commit()
    db.refresh(projeto)
    return _to_full(_load(db, projeto.id, user.id))


@router.get("/{projeto_id}", response_model=ProjetoVidaMensalFull)
def get_projeto(projeto_id: UUID, user: CurrentUser, db: DBSession) -> Any:
    return _to_full(_load(db, projeto_id, user.id))


@router.put("/{projeto_id}", response_model=ProjetoVidaMensalFull)
def update_projeto(
    projeto_id: UUID, body: ProjetoVidaMensalUpdate, user: CurrentUser, db: DBSession
) -> Any:
    """Atualiza campos escalares + comunidade + cuidado + listas (replace completo)."""
    projeto = _load(db, projeto_id, user.id)

    if body.tema is not None:
        projeto.tema = body.tema
    if body.intencao is not None:
        projeto.intencao = body.intencao
    if body.observacoes_mes is not None:
        projeto.observacoes_mes = body.observacoes_mes
    if body.concluido is not None:
        projeto.concluido = body.concluido

    if body.comunidade is not None:
        if not projeto.comunidade:
            db.add(ProjetoVidaComunidade(projeto_id=projeto.id))
            db.flush()
            db.refresh(projeto)
        projeto.comunidade.partilha_acompanhador = body.comunidade.partilha_acompanhador
        projeto.comunidade.encontro_familia = body.comunidade.encontro_familia
        projeto.comunidade.dias_grupo = body.comunidade.dias_grupo
        projeto.comunidade.outros = body.comunidade.outros

    if body.cuidado is not None:
        if not projeto.cuidado:
            db.add(ProjetoVidaCuidado(projeto_id=projeto.id))
            db.flush()
            db.refresh(projeto)
        projeto.cuidado.consultas = body.cuidado.consultas
        projeto.cuidado.exames = body.cuidado.exames
        projeto.cuidado.descanso = body.cuidado.descanso
        projeto.cuidado.outros = body.cuidado.outros

    if body.compromissos is not None:
        # Replace completo: deletar os antigos e inserir os novos
        for c in list(projeto.compromissos):
            db.delete(c)
        db.flush()
        for item in body.compromissos:
            db.add(ProjetoVidaCompromisso(
                projeto_id=projeto.id,
                semana=item.semana,
                titulo=item.titulo,
                dia=item.dia,
                horario=item.horario,
                obs=item.obs,
                ordem=item.ordem,
            ))

    if body.praticas is not None:
        for pr in list(projeto.praticas):
            db.delete(pr)
        db.flush()
        for item in body.praticas:
            db.add(ProjetoVidaPratica(
                projeto_id=projeto.id,
                dia_semana=item.dia_semana,
                tipo=item.tipo,
                horario=item.horario,
                duracao=item.duracao,
                obs=item.obs,
                ordem=item.ordem,
            ))

    db.commit()
    return _to_full(_load(db, projeto_id, user.id))


@router.put("/{projeto_id}/revisao", response_model=ProjetoVidaMensalFull)
def upsert_revisao(
    projeto_id: UUID, body: RevisaoUpsert, user: CurrentUser, db: DBSession
) -> Any:
    """Cria ou atualiza a revisão mensal do projeto."""
    projeto = _load(db, projeto_id, user.id)

    if not projeto.revisao:
        db.add(ProjetoVidaRevisao(projeto_id=projeto.id))
        db.flush()
        db.refresh(projeto)

    rev = projeto.revisao
    for field in ("graca", "fidelidade", "falhas", "ordenar", "passo",
                  "decisao", "virtude", "conversao", "passo_proximo"):
        val = getattr(body, field)
        if val is not None:
            setattr(rev, field, val)

    db.commit()
    return _to_full(_load(db, projeto_id, user.id))


@router.post("/{projeto_id}/pin/verificar", response_model=PinVerifyResponse)
def verificar_pin(
    projeto_id: UUID, body: PinVerifyRequest, user: CurrentUser, db: DBSession
) -> Any:
    """Verifica PIN sem revelar hash. Retorna {valid: bool}."""
    result = db.execute(
        select(ProjetoVidaMensal).where(
            ProjetoVidaMensal.id == projeto_id,
            ProjetoVidaMensal.user_id == user.id,
        )
    )
    projeto = result.scalar_one_or_none()
    if not projeto:
        raise HTTPException(
            status_code=404,
            detail={"error": "not_found", "message": "Projeto não encontrado"},
        )
    if not projeto.pin_hash:
        return PinVerifyResponse(valid=True)  # sem PIN = sempre válido
    return PinVerifyResponse(valid=_hash_pin(body.pin, user.id) == projeto.pin_hash)
```

- [ ] **Step 4: Rodar — deve passar**

```
pytest tests/test_projeto_vida_mensal.py -v
# Expected: todos PASSED
```

- [ ] **Step 5: Commit**

```bash
git add backend/app/api/projeto_vida_mensal_routes.py backend/tests/test_projeto_vida_mensal.py
git commit -m "feat: rotas FastAPI para projeto de vida mensal"
```

---

## Task 5: Registrar Router em main.py

**Files:**
- Modify: `backend/app/main.py`

- [ ] **Step 1: Escrever o teste que falha**

```python
# Adicionar em backend/tests/test_projeto_vida_mensal.py

def test_router_registrado(client: TestClient):
    """Verifica que o router está disponível via HTTP (não retorna 404 genérico)."""
    r = client.get("/projeto-vida-mensal/historico", headers=HEADERS)
    assert r.status_code == 200  # rota existe e retorna lista vazia
    assert r.json() == []
```

- [ ] **Step 2: Rodar — deve falhar com 404**

```
pytest tests/test_projeto_vida_mensal.py::test_router_registrado -v
# Expected: FAILED — 404 (router não registrado)
```

- [ ] **Step 3: Adicionar ao final da seção de imports/includes em `backend/app/main.py`**

Logo após a linha `from app.api.life_plan_routes import router as life_plan_router  # noqa: E402`, adicionar:

```python
from app.api.projeto_vida_mensal_routes import router as projeto_vida_mensal_router  # noqa: E402
```

E logo após `app.include_router(life_plan_router)`, adicionar:

```python
app.include_router(projeto_vida_mensal_router)
```

- [ ] **Step 4: Rodar — deve passar**

```
pytest tests/test_projeto_vida_mensal.py -v
# Expected: todos PASSED
```

- [ ] **Step 5: Rodar suite completa para garantir que nada quebrou**

```
pytest --tb=short -q
# Expected: todos os testes existentes passam
```

- [ ] **Step 6: Commit**

```bash
git add backend/app/main.py
git commit -m "feat: registrar router projeto-vida-mensal em main.py"
```

---

---

## Task 6: TypeScript Types + API Service

**Files:**
- Create: `lumen_mobile/src/services/projetoVidaMensal.ts`

- [ ] **Step 1: Criar o arquivo**

```typescript
// lumen_mobile/src/services/projetoVidaMensal.ts
import api from '@/services/api';

// ── Constantes ─────────────────────────────────────────────────────────────

export const MESES = [
  'Janeiro','Fevereiro','Março','Abril','Maio','Junho',
  'Julho','Agosto','Setembro','Outubro','Novembro','Dezembro',
];

export const SEMANAS = ['s1','s2','s3','s4','s5'] as const;
export const SEMANA_LABELS: Record<string, string> = {
  s1: 'Semana 1', s2: 'Semana 2', s3: 'Semana 3', s4: 'Semana 4', s5: 'Semana 5',
};

export const DIAS = ['seg','ter','qua','qui','sex','sab','dom'] as const;
export const DIA_LABELS: Record<string, string> = {
  seg: 'Segunda', ter: 'Terça', qua: 'Quarta', qui: 'Quinta',
  sex: 'Sexta',   sab: 'Sábado', dom: 'Domingo',
};

export const TIPOS_PRATICA = [
  'Santa Missa',
  'Adoração',
  'Terço',
  'Leitura espiritual',
  'Liturgia das Horas',
  'Meditação',
  'Momento de Evangelização Ser Feliz',
  'Outro',
];

// ── Types ──────────────────────────────────────────────────────────────────

export interface CompromissoOut {
  id: string;
  semana: string;
  titulo: string | null;
  dia: string | null;
  horario: string | null;
  obs: string | null;
  ordem: number;
}

export interface PraticaOut {
  id: string;
  dia_semana: string;
  tipo: string;
  horario: string | null;
  duracao: string | null;
  obs: string | null;
  ordem: number;
}

export interface ComunidadeData {
  partilha_acompanhador: string | null;
  encontro_familia: string | null;
  dias_grupo: string | null;
  outros: string | null;
}

export interface CuidadoData {
  consultas: string | null;
  exames: string | null;
  descanso: string | null;
  outros: string | null;
}

export interface RevisaoOut {
  graca: string | null;
  fidelidade: string | null;
  falhas: string | null;
  ordenar: string | null;
  passo: string | null;
  decisao: string | null;
  virtude: string | null;
  conversao: string | null;
  passo_proximo: string | null;
}

export interface ProjetoVidaMensalFull {
  id: string;
  mes: number;
  ano: number;
  tema: string | null;
  intencao: string | null;
  has_pin: boolean;
  concluido: boolean;
  observacoes_mes: string | null;
  comunidade: ComunidadeData | null;
  cuidado: CuidadoData | null;
  compromissos: CompromissoOut[];
  praticas: PraticaOut[];
  revisao: RevisaoOut | null;
  created_at: string;
  updated_at: string;
}

export interface ProjetoVidaMensalSummary {
  id: string;
  mes: number;
  ano: number;
  tema: string | null;
  concluido: boolean;
  has_pin: boolean;
  created_at: string;
}

// ── Input types ────────────────────────────────────────────────────────────

export interface CompromissoIn {
  semana: string;
  titulo: string;
  dia: string;
  horario: string;
  obs: string;
  ordem: number;
}

export interface PraticaIn {
  dia_semana: string;
  tipo: string;
  horario: string;
  duracao: string;
  obs: string;
  ordem: number;
}

export interface CreateProjetoInput {
  mes: number;
  ano: number;
  tema?: string | null;
  intencao?: string | null;
  pin?: string | null;
}

export interface UpdateProjetoInput {
  tema?: string | null;
  intencao?: string | null;
  observacoes_mes?: string | null;
  concluido?: boolean | null;
  comunidade?: Partial<ComunidadeData> | null;
  cuidado?: Partial<CuidadoData> | null;
  compromissos?: CompromissoIn[] | null;
  praticas?: PraticaIn[] | null;
}

export interface RevisaoInput {
  graca?: string | null;
  fidelidade?: string | null;
  falhas?: string | null;
  ordenar?: string | null;
  passo?: string | null;
  decisao?: string | null;
  virtude?: string | null;
  conversao?: string | null;
  passo_proximo?: string | null;
}

// ── API ────────────────────────────────────────────────────────────────────

export const projetoVidaMensalApi = {
  getAtual: () =>
    api.get<ProjetoVidaMensalFull | null>('/projeto-vida-mensal/atual'),

  getHistorico: () =>
    api.get<ProjetoVidaMensalSummary[]>('/projeto-vida-mensal/historico'),

  criar: (data: CreateProjetoInput) =>
    api.post<ProjetoVidaMensalFull>('/projeto-vida-mensal/', data as Record<string, unknown>),

  get: (id: string) =>
    api.get<ProjetoVidaMensalFull>(`/projeto-vida-mensal/${id}`),

  update: (id: string, data: UpdateProjetoInput) =>
    api.put<ProjetoVidaMensalFull>(`/projeto-vida-mensal/${id}`, data as Record<string, unknown>),

  upsertRevisao: (id: string, data: RevisaoInput) =>
    api.put<ProjetoVidaMensalFull>(`/projeto-vida-mensal/${id}/revisao`, data as Record<string, unknown>),

  verificarPin: (id: string, pin: string) =>
    api.post<{ valid: boolean }>(`/projeto-vida-mensal/${id}/pin/verificar`, { pin }),
};

export default projetoVidaMensalApi;
```

- [ ] **Step 2: Verificar tipos**

```bash
cd lumen_mobile
npx tsc --noEmit
# Expected: sem erros de tipo
```

- [ ] **Step 3: Commit**

```bash
git add lumen_mobile/src/services/projetoVidaMensal.ts
git commit -m "feat: TypeScript types e API service para projeto de vida mensal"
```

---

## Task 7: Hub Screen (index.tsx)

**Files:**
- Modify: `lumen_mobile/app/vida/index.tsx` (substituição completa)

- [ ] **Step 1: Substituir `lumen_mobile/app/vida/index.tsx`**

```tsx
/**
 * Projeto de Vida Mensal — Hub
 * ==============================
 * Exibe o ciclo do mês atual ou convida a criar um novo.
 */

import { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  TouchableOpacity, ActivityIndicator, RefreshControl,
} from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import type { IoniconsName } from '@/types/icons';
import projetoVidaMensalApi, {
  type ProjetoVidaMensalFull,
  MESES,
} from '@/services/projetoVidaMensal';

const colors = {
  primary: '#1A859B',
  primaryLight: '#E8F4F7',
  white: '#ffffff',
  gray: '#6b7280',
  lightGray: '#f3f4f6',
  dark: '#171717',
  border: '#e5e7eb',
};

export default function VidaHubScreen() {
  const [projeto, setProjeto] = useState<ProjetoVidaMensalFull | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const now = new Date();
  const mesAtual = now.getMonth() + 1;
  const anoAtual = now.getFullYear();

  const load = useCallback(async (isRefresh = false) => {
    if (!isRefresh) setLoading(true);
    setError(null);
    try {
      const data = await projetoVidaMensalApi.getAtual();
      setProjeto(data);
    } catch {
      setError('Erro ao carregar projeto. Tente novamente.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const handleAbrirCiclo = () => {
    if (!projeto) return;
    if (projeto.has_pin) {
      router.push({ pathname: '/vida/unlock', params: { projetoId: projeto.id } });
    } else {
      router.push({ pathname: '/vida/ciclo', params: { projetoId: projeto.id } });
    }
  };

  const handleNovoMes = () => {
    router.push('/vida/wizard');
  };

  const handleHistorico = () => {
    router.push('/vida/historico');
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => { setRefreshing(true); load(true); }}
          colors={[colors.primary]}
        />
      }
    >
      {error && (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      {/* Cabeçalho */}
      <View style={styles.headerCard}>
        <View style={styles.iconWrap}>
          <Ionicons name={'calendar' as IoniconsName} size={28} color={colors.primary} />
        </View>
        <Text style={styles.title}>Projeto de Vida</Text>
        <Text style={styles.subtitle}>
          {MESES[mesAtual - 1]} {anoAtual}
        </Text>
      </View>

      {projeto ? (
        <>
          {/* Card do ciclo atual */}
          <TouchableOpacity style={styles.cicloCard} onPress={handleAbrirCiclo} activeOpacity={0.8}>
            <View style={styles.cicloCardHeader}>
              <Ionicons name={'book-outline' as IoniconsName} size={22} color={colors.primary} />
              <Text style={styles.cicloCardTitle}>
                {MESES[projeto.mes - 1]} {projeto.ano}
              </Text>
              {projeto.has_pin && (
                <Ionicons name={'lock-closed' as IoniconsName} size={16} color={colors.gray} style={{ marginLeft: 6 }} />
              )}
              {projeto.concluido && (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>Concluído</Text>
                </View>
              )}
            </View>
            {projeto.tema ? (
              <Text style={styles.cicloTema}>"{projeto.tema}"</Text>
            ) : null}
            <View style={styles.statsRow}>
              <StatItem
                icon={'people-outline' as IoniconsName}
                label="Comunidade"
                ok={!!projeto.comunidade?.partilha_acompanhador}
              />
              <StatItem
                icon={'heart-outline' as IoniconsName}
                label="Cuidado"
                ok={!!projeto.cuidado?.consultas || !!projeto.cuidado?.descanso}
              />
              <StatItem
                icon={'list-outline' as IoniconsName}
                label="Compromissos"
                ok={projeto.compromissos.length > 0}
              />
              <StatItem
                icon={'sunny-outline' as IoniconsName}
                label="Oração"
                ok={projeto.praticas.length > 0}
              />
            </View>
            <View style={styles.openRow}>
              <Text style={styles.openText}>Ver ciclo completo</Text>
              <Ionicons name={'chevron-forward' as IoniconsName} size={16} color={colors.primary} />
            </View>
          </TouchableOpacity>

          {/* Botão revisão */}
          {!projeto.concluido && (
            <TouchableOpacity
              style={styles.revisaoBtn}
              onPress={() =>
                router.push({ pathname: '/vida/revisao', params: { projetoId: projeto.id } })
              }
              activeOpacity={0.8}
            >
              <Ionicons name={'checkmark-circle-outline' as IoniconsName} size={20} color={colors.white} />
              <Text style={styles.revisaoBtnText}>Revisão Mensal</Text>
            </TouchableOpacity>
          )}
        </>
      ) : (
        /* Sem ciclo para o mês atual */
        <View style={styles.emptyCard}>
          <Ionicons name={'add-circle-outline' as IoniconsName} size={48} color={colors.primary} />
          <Text style={styles.emptyTitle}>Nenhum projeto para este mês</Text>
          <Text style={styles.emptySubtitle}>
            Crie seu Projeto de Vida para {MESES[mesAtual - 1]} {anoAtual}
          </Text>
          <TouchableOpacity style={styles.primaryBtn} onPress={handleNovoMes} activeOpacity={0.8}>
            <Text style={styles.primaryBtnText}>Criar projeto do mês</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Histórico */}
      <TouchableOpacity style={styles.histBtn} onPress={handleHistorico} activeOpacity={0.8}>
        <Ionicons name={'time-outline' as IoniconsName} size={18} color={colors.primary} />
        <Text style={styles.histBtnText}>Ver histórico de ciclos</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

function StatItem({ icon, label, ok }: { icon: IoniconsName; label: string; ok: boolean }) {
  return (
    <View style={styles.statItem}>
      <Ionicons name={icon} size={18} color={ok ? colors.primary : colors.gray} />
      <Text style={[styles.statLabel, ok && { color: colors.primary }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9fafb' },
  content: { padding: 20, paddingBottom: 40 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  errorBox: { backgroundColor: '#fef2f2', borderColor: '#fecaca', borderWidth: 1, borderRadius: 10, padding: 12, marginBottom: 16 },
  errorText: { color: '#dc2626', fontSize: 14 },
  headerCard: { alignItems: 'center', marginBottom: 24 },
  iconWrap: { width: 56, height: 56, borderRadius: 16, backgroundColor: colors.primaryLight, justifyContent: 'center', alignItems: 'center', marginBottom: 12 },
  title: { fontSize: 22, fontWeight: '700', color: colors.dark, marginBottom: 4 },
  subtitle: { fontSize: 15, color: colors.gray },
  cicloCard: { backgroundColor: colors.white, borderRadius: 14, padding: 18, marginBottom: 16, borderWidth: 1, borderColor: colors.border, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 6, elevation: 2 },
  cicloCardHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 8, gap: 8 },
  cicloCardTitle: { fontSize: 17, fontWeight: '600', color: colors.dark, flex: 1 },
  badge: { backgroundColor: colors.primaryLight, borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2 },
  badgeText: { fontSize: 11, color: colors.primary, fontWeight: '600' },
  cicloTema: { fontSize: 14, color: colors.gray, fontStyle: 'italic', marginBottom: 14 },
  statsRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 14 },
  statItem: { alignItems: 'center', gap: 4 },
  statLabel: { fontSize: 11, color: colors.gray },
  openRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 4 },
  openText: { fontSize: 13, color: colors.primary, fontWeight: '600' },
  revisaoBtn: { backgroundColor: colors.primary, borderRadius: 12, padding: 16, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8, marginBottom: 16 },
  revisaoBtnText: { color: colors.white, fontSize: 15, fontWeight: '700' },
  emptyCard: { backgroundColor: colors.white, borderRadius: 14, padding: 32, alignItems: 'center', borderWidth: 1, borderColor: colors.border, marginBottom: 16, gap: 8 },
  emptyTitle: { fontSize: 17, fontWeight: '600', color: colors.dark, textAlign: 'center' },
  emptySubtitle: { fontSize: 14, color: colors.gray, textAlign: 'center', marginBottom: 8 },
  primaryBtn: { backgroundColor: colors.primary, borderRadius: 12, paddingVertical: 14, paddingHorizontal: 28, marginTop: 8 },
  primaryBtnText: { color: colors.white, fontSize: 15, fontWeight: '700' },
  histBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, padding: 16 },
  histBtnText: { fontSize: 14, color: colors.primary, fontWeight: '600' },
});
```

- [ ] **Step 2: Verificar tipos**

```bash
cd lumen_mobile && npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add lumen_mobile/app/vida/index.tsx
git commit -m "feat: hub screen do projeto de vida mensal"
```

---

## Task 8: Creation Wizard (wizard.tsx)

**Files:**
- Modify: `lumen_mobile/app/vida/wizard.tsx` (substituição completa)

O wizard coleta todo o estado localmente e salva em um único passo final (POST + PUT).

- [ ] **Step 1: Substituir `lumen_mobile/app/vida/wizard.tsx`**

```tsx
/**
 * Projeto de Vida Mensal — Wizard de Criação
 * ============================================
 * 6 passos: Ciclo → Comunidade → Cuidado → Compromissos → Oração → Confirmar
 */

import { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, ActivityIndicator, KeyboardAvoidingView, Platform,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import type { IoniconsName } from '@/types/icons';
import projetoVidaMensalApi, {
  MESES, SEMANAS, SEMANA_LABELS, DIAS, DIA_LABELS, TIPOS_PRATICA,
  type CompromissoIn, type PraticaIn,
} from '@/services/projetoVidaMensal';

const colors = {
  primary: '#1A859B', primaryLight: '#E8F4F7',
  white: '#ffffff', gray: '#6b7280',
  lightGray: '#f3f4f6', dark: '#171717', border: '#e5e7eb', error: '#ef4444',
};

// ── Types ──────────────────────────────────────────────────────────────────

interface WizardData {
  mes: string;
  ano: string;
  tema: string;
  intencao: string;
  pin: string;
  comunidade: { partilha_acompanhador: string; encontro_familia: string; dias_grupo: string; outros: string };
  cuidado: { consultas: string; exames: string; descanso: string; outros: string };
  compromissos: CompromissoIn[];
  praticas: PraticaIn[];
}

const now = new Date();
const defaultData = (): WizardData => ({
  mes: String(now.getMonth() + 1),
  ano: String(now.getFullYear()),
  tema: '', intencao: '', pin: '',
  comunidade: { partilha_acompanhador: '', encontro_familia: '', dias_grupo: '', outros: '' },
  cuidado: { consultas: '', exames: '', descanso: '', outros: '' },
  compromissos: [],
  praticas: [],
});

const STEP_TITLES = ['Ciclo Mensal', 'Comunidade', 'Cuidado Pessoal', 'Compromissos', 'Oração Diária', 'Confirmar'];

// ── Main ───────────────────────────────────────────────────────────────────

export default function WizardScreen() {
  const [step, setStep] = useState(0);
  const [data, setData] = useState<WizardData>(defaultData());
  const [activeSemana, setActiveSemana] = useState('s1');
  const [activeDia, setActiveDia] = useState('seg');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const update = (partial: Partial<WizardData>) => setData(d => ({ ...d, ...partial }));

  const addCompromisso = () => {
    update({
      compromissos: [
        ...data.compromissos,
        { semana: activeSemana, titulo: '', dia: '', horario: '', obs: '', ordem: data.compromissos.length },
      ],
    });
  };

  const removeCompromisso = (idx: number) => {
    update({ compromissos: data.compromissos.filter((_, i) => i !== idx) });
  };

  const updateCompromisso = (idx: number, patch: Partial<CompromissoIn>) => {
    const list = [...data.compromissos];
    list[idx] = { ...list[idx], ...patch };
    update({ compromissos: list });
  };

  const addPratica = () => {
    update({
      praticas: [
        ...data.praticas,
        { dia_semana: activeDia, tipo: TIPOS_PRATICA[0], horario: '', duracao: '', obs: '', ordem: data.praticas.length },
      ],
    });
  };

  const removePratica = (idx: number) => {
    update({ praticas: data.praticas.filter((_, i) => i !== idx) });
  };

  const updatePratica = (idx: number, patch: Partial<PraticaIn>) => {
    const list = [...data.praticas];
    list[idx] = { ...list[idx], ...patch };
    update({ praticas: list });
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      const mes = parseInt(data.mes, 10);
      const ano = parseInt(data.ano, 10);
      const criado = await projetoVidaMensalApi.criar({
        mes, ano,
        tema: data.tema || null,
        intencao: data.intencao || null,
        pin: data.pin || null,
      });
      await projetoVidaMensalApi.update(criado.id, {
        comunidade: {
          partilha_acompanhador: data.comunidade.partilha_acompanhador || null,
          encontro_familia: data.comunidade.encontro_familia || null,
          dias_grupo: data.comunidade.dias_grupo || null,
          outros: data.comunidade.outros || null,
        },
        cuidado: {
          consultas: data.cuidado.consultas || null,
          exames: data.cuidado.exames || null,
          descanso: data.cuidado.descanso || null,
          outros: data.cuidado.outros || null,
        },
        compromissos: data.compromissos,
        praticas: data.praticas,
      });
      router.replace({ pathname: '/vida/ciclo', params: { projetoId: criado.id } });
    } catch (e: any) {
      const msg = e?.response?.data?.detail?.message ?? 'Erro ao salvar. Tente novamente.';
      setError(msg);
    } finally {
      setSaving(false);
    }
  };

  // ── Render steps ──────────────────────────────────────────────────────────

  const renderStep = () => {
    switch (step) {
      // ── Step 0: Ciclo Mensal ─────────────────────────────────────────────
      case 0:
        return (
          <View style={styles.stepContent}>
            <Text style={styles.fieldLabel}>Mês *</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
              <View style={styles.chipRow}>
                {MESES.map((m, i) => (
                  <TouchableOpacity
                    key={m}
                    style={[styles.chip, data.mes === String(i + 1) && styles.chipActive]}
                    onPress={() => update({ mes: String(i + 1) })}
                  >
                    <Text style={[styles.chipText, data.mes === String(i + 1) && styles.chipTextActive]}>
                      {m.slice(0, 3)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>

            <Text style={styles.fieldLabel}>Ano *</Text>
            <TextInput
              style={styles.input}
              value={data.ano}
              onChangeText={v => update({ ano: v })}
              keyboardType="numeric"
              maxLength={4}
            />

            <Text style={styles.fieldLabel}>Tema do mês (opcional)</Text>
            <TextInput
              style={styles.input}
              value={data.tema}
              onChangeText={v => update({ tema: v })}
              placeholder="Ex: Conversão e perseverança"
              placeholderTextColor={colors.gray}
            />

            <Text style={styles.fieldLabel}>Intenção do mês (opcional)</Text>
            <TextInput
              style={[styles.input, styles.textarea]}
              value={data.intencao}
              onChangeText={v => update({ intencao: v })}
              placeholder="Qual a sua intenção principal neste ciclo?"
              placeholderTextColor={colors.gray}
              multiline
              numberOfLines={4}
            />

            <Text style={styles.fieldLabel}>PIN de proteção (4 dígitos, opcional)</Text>
            <TextInput
              style={styles.input}
              value={data.pin}
              onChangeText={v => update({ pin: v.replace(/\D/g, '').slice(0, 4) })}
              placeholder="Deixe em branco para sem PIN"
              placeholderTextColor={colors.gray}
              keyboardType="numeric"
              secureTextEntry
              maxLength={4}
            />
          </View>
        );

      // ── Step 1: Comunidade ───────────────────────────────────────────────
      case 1:
        return (
          <View style={styles.stepContent}>
            {(['partilha_acompanhador', 'encontro_familia', 'dias_grupo', 'outros'] as const).map((key) => {
              const labels: Record<string, string> = {
                partilha_acompanhador: 'Partilha com acompanhador',
                encontro_familia: 'Encontro com família',
                dias_grupo: 'Dias de grupo',
                outros: 'Outros',
              };
              return (
                <View key={key} style={{ marginBottom: 16 }}>
                  <Text style={styles.fieldLabel}>{labels[key]}</Text>
                  <TextInput
                    style={[styles.input, styles.textarea]}
                    value={data.comunidade[key]}
                    onChangeText={v => update({ comunidade: { ...data.comunidade, [key]: v } })}
                    multiline
                    numberOfLines={3}
                    placeholderTextColor={colors.gray}
                  />
                </View>
              );
            })}
          </View>
        );

      // ── Step 2: Cuidado Pessoal ──────────────────────────────────────────
      case 2:
        return (
          <View style={styles.stepContent}>
            {(['consultas', 'exames', 'descanso', 'outros'] as const).map((key) => {
              const labels: Record<string, string> = {
                consultas: 'Consultas médicas',
                exames: 'Exames',
                descanso: 'Descanso e lazer',
                outros: 'Outros cuidados',
              };
              return (
                <View key={key} style={{ marginBottom: 16 }}>
                  <Text style={styles.fieldLabel}>{labels[key]}</Text>
                  <TextInput
                    style={[styles.input, styles.textarea]}
                    value={data.cuidado[key]}
                    onChangeText={v => update({ cuidado: { ...data.cuidado, [key]: v } })}
                    multiline
                    numberOfLines={3}
                    placeholderTextColor={colors.gray}
                  />
                </View>
              );
            })}
          </View>
        );

      // ── Step 3: Compromissos semanais ────────────────────────────────────
      case 3:
        const semanaItems = data.compromissos.filter(c => c.semana === activeSemana);
        const semanaIndexes = data.compromissos
          .map((c, i) => ({ c, i }))
          .filter(({ c }) => c.semana === activeSemana);
        return (
          <View style={styles.stepContent}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
              <View style={styles.chipRow}>
                {SEMANAS.map(s => (
                  <TouchableOpacity
                    key={s}
                    style={[styles.chip, activeSemana === s && styles.chipActive]}
                    onPress={() => setActiveSemana(s)}
                  >
                    <Text style={[styles.chipText, activeSemana === s && styles.chipTextActive]}>
                      {SEMANA_LABELS[s]}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>

            {semanaIndexes.map(({ c, i }) => (
              <View key={i} style={styles.itemCard}>
                <View style={styles.itemCardHeader}>
                  <Text style={styles.itemCardTitle}>Compromisso {semanaItems.indexOf(c) + 1}</Text>
                  <TouchableOpacity onPress={() => removeCompromisso(i)}>
                    <Ionicons name={'trash-outline' as IoniconsName} size={18} color={colors.error} />
                  </TouchableOpacity>
                </View>
                <TextInput style={styles.input} placeholder="Título" placeholderTextColor={colors.gray}
                  value={c.titulo} onChangeText={v => updateCompromisso(i, { titulo: v })} />
                <View style={styles.row}>
                  <TextInput style={[styles.input, { flex: 1, marginRight: 8 }]} placeholder="Dia"
                    placeholderTextColor={colors.gray} value={c.dia}
                    onChangeText={v => updateCompromisso(i, { dia: v })} />
                  <TextInput style={[styles.input, { flex: 1 }]} placeholder="Horário"
                    placeholderTextColor={colors.gray} value={c.horario}
                    onChangeText={v => updateCompromisso(i, { horario: v })} />
                </View>
                <TextInput style={[styles.input, styles.textarea]} placeholder="Observações"
                  placeholderTextColor={colors.gray} value={c.obs}
                  onChangeText={v => updateCompromisso(i, { obs: v })} multiline numberOfLines={2} />
              </View>
            ))}

            <TouchableOpacity style={styles.addBtn} onPress={addCompromisso}>
              <Ionicons name={'add-circle-outline' as IoniconsName} size={20} color={colors.primary} />
              <Text style={styles.addBtnText}>Adicionar compromisso em {SEMANA_LABELS[activeSemana]}</Text>
            </TouchableOpacity>
          </View>
        );

      // ── Step 4: Oração Diária ────────────────────────────────────────────
      case 4:
        const diaIndexes = data.praticas
          .map((p, i) => ({ p, i }))
          .filter(({ p }) => p.dia_semana === activeDia);
        return (
          <View style={styles.stepContent}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
              <View style={styles.chipRow}>
                {DIAS.map(d => (
                  <TouchableOpacity
                    key={d}
                    style={[styles.chip, activeDia === d && styles.chipActive]}
                    onPress={() => setActiveDia(d)}
                  >
                    <Text style={[styles.chipText, activeDia === d && styles.chipTextActive]}>
                      {DIA_LABELS[d].slice(0, 3)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>

            {diaIndexes.map(({ p, i }) => (
              <View key={i} style={styles.itemCard}>
                <View style={styles.itemCardHeader}>
                  <Text style={styles.itemCardTitle}>Prática {diaIndexes.indexOf({ p, i }) + 1}</Text>
                  <TouchableOpacity onPress={() => removePratica(i)}>
                    <Ionicons name={'trash-outline' as IoniconsName} size={18} color={colors.error} />
                  </TouchableOpacity>
                </View>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 8 }}>
                  <View style={styles.chipRow}>
                    {TIPOS_PRATICA.map(t => (
                      <TouchableOpacity key={t} style={[styles.chip, p.tipo === t && styles.chipActive]}
                        onPress={() => updatePratica(i, { tipo: t })}>
                        <Text style={[styles.chipText, p.tipo === t && styles.chipTextActive]}>{t}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </ScrollView>
                <View style={styles.row}>
                  <TextInput style={[styles.input, { flex: 1, marginRight: 8 }]} placeholder="Horário"
                    placeholderTextColor={colors.gray} value={p.horario}
                    onChangeText={v => updatePratica(i, { horario: v })} />
                  <TextInput style={[styles.input, { flex: 1 }]} placeholder="Duração"
                    placeholderTextColor={colors.gray} value={p.duracao}
                    onChangeText={v => updatePratica(i, { duracao: v })} />
                </View>
                <TextInput style={[styles.input, styles.textarea]} placeholder="Observações"
                  placeholderTextColor={colors.gray} value={p.obs}
                  onChangeText={v => updatePratica(i, { obs: v })} multiline numberOfLines={2} />
              </View>
            ))}

            <TouchableOpacity style={styles.addBtn} onPress={addPratica}>
              <Ionicons name={'add-circle-outline' as IoniconsName} size={20} color={colors.primary} />
              <Text style={styles.addBtnText}>Adicionar prática em {DIA_LABELS[activeDia]}</Text>
            </TouchableOpacity>
          </View>
        );

      // ── Step 5: Confirmar ────────────────────────────────────────────────
      case 5:
        return (
          <View style={styles.stepContent}>
            <View style={styles.summaryCard}>
              <Text style={styles.summaryTitle}>
                {MESES[parseInt(data.mes, 10) - 1]} {data.ano}
              </Text>
              {data.tema ? <Text style={styles.summaryItem}>🎯 {data.tema}</Text> : null}
              {data.pin ? <Text style={styles.summaryItem}>🔒 PIN configurado</Text> : null}
              <Text style={styles.summaryItem}>
                📅 {data.compromissos.length} compromisso(s)
              </Text>
              <Text style={styles.summaryItem}>
                🙏 {data.praticas.length} prática(s) de oração
              </Text>
            </View>
            {error && (
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>{error}</Text>
              </View>
            )}
            <TouchableOpacity style={styles.saveBtn} onPress={handleSave} disabled={saving} activeOpacity={0.8}>
              {saving
                ? <ActivityIndicator color={colors.white} />
                : <Text style={styles.saveBtnText}>Salvar Projeto de Vida</Text>
              }
            </TouchableOpacity>
          </View>
        );

      default:
        return null;
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      {/* Indicador de passo */}
      <View style={styles.stepBar}>
        {STEP_TITLES.map((_, i) => (
          <View key={i} style={[styles.stepDot, i === step && styles.stepDotActive, i < step && styles.stepDotDone]} />
        ))}
      </View>
      <View style={styles.stepHeader}>
        <Text style={styles.stepTitle}>{STEP_TITLES[step]}</Text>
        <Text style={styles.stepCounter}>{step + 1} / {STEP_TITLES.length}</Text>
      </View>

      <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 40 }}>
        {renderStep()}
      </ScrollView>

      {/* Navegação */}
      <View style={styles.navRow}>
        <TouchableOpacity
          style={[styles.navBtn, styles.navBtnBack]}
          onPress={() => (step === 0 ? router.back() : setStep(s => s - 1))}
        >
          <Ionicons name={'chevron-back' as IoniconsName} size={20} color={colors.primary} />
          <Text style={styles.navBtnBackText}>{step === 0 ? 'Cancelar' : 'Voltar'}</Text>
        </TouchableOpacity>

        {step < STEP_TITLES.length - 1 && (
          <TouchableOpacity
            style={[styles.navBtn, styles.navBtnNext]}
            onPress={() => setStep(s => s + 1)}
          >
            <Text style={styles.navBtnNextText}>Próximo</Text>
            <Ionicons name={'chevron-forward' as IoniconsName} size={20} color={colors.white} />
          </TouchableOpacity>
        )}
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9fafb' },
  stepBar: { flexDirection: 'row', justifyContent: 'center', gap: 6, paddingVertical: 12, backgroundColor: colors.white, borderBottomWidth: 1, borderColor: colors.border },
  stepDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.border },
  stepDotActive: { backgroundColor: colors.primary, width: 20 },
  stepDotDone: { backgroundColor: colors.primaryLight },
  stepHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 12, backgroundColor: colors.white },
  stepTitle: { fontSize: 18, fontWeight: '700', color: colors.dark },
  stepCounter: { fontSize: 13, color: colors.gray },
  stepContent: { padding: 20 },
  fieldLabel: { fontSize: 14, fontWeight: '600', color: colors.dark, marginBottom: 6 },
  input: { backgroundColor: colors.white, borderWidth: 1, borderColor: colors.border, borderRadius: 10, padding: 12, fontSize: 15, color: colors.dark, marginBottom: 12 },
  textarea: { height: 90, textAlignVertical: 'top' },
  chipRow: { flexDirection: 'row', gap: 8, paddingHorizontal: 2 },
  chip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.white },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { fontSize: 13, color: colors.gray },
  chipTextActive: { color: colors.white, fontWeight: '600' },
  row: { flexDirection: 'row' },
  itemCard: { backgroundColor: colors.white, borderRadius: 12, padding: 14, marginBottom: 12, borderWidth: 1, borderColor: colors.border },
  itemCardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  itemCardTitle: { fontSize: 14, fontWeight: '600', color: colors.dark },
  addBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, padding: 14, borderRadius: 12, borderWidth: 1.5, borderColor: colors.primary, borderStyle: 'dashed' },
  addBtnText: { fontSize: 14, color: colors.primary, fontWeight: '600' },
  summaryCard: { backgroundColor: colors.primaryLight, borderRadius: 14, padding: 20, marginBottom: 20, gap: 8 },
  summaryTitle: { fontSize: 20, fontWeight: '700', color: colors.primary, marginBottom: 8 },
  summaryItem: { fontSize: 15, color: colors.dark },
  errorBox: { backgroundColor: '#fef2f2', borderColor: '#fecaca', borderWidth: 1, borderRadius: 10, padding: 12, marginBottom: 12 },
  errorText: { color: '#dc2626', fontSize: 14 },
  saveBtn: { backgroundColor: colors.primary, borderRadius: 12, padding: 18, alignItems: 'center', marginTop: 8 },
  saveBtnText: { color: colors.white, fontSize: 16, fontWeight: '700' },
  navRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, backgroundColor: colors.white, borderTopWidth: 1, borderColor: colors.border },
  navBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 10, paddingHorizontal: 20, borderRadius: 10 },
  navBtnBack: { borderWidth: 1, borderColor: colors.border },
  navBtnBackText: { fontSize: 15, color: colors.primary, fontWeight: '600' },
  navBtnNext: { backgroundColor: colors.primary },
  navBtnNextText: { fontSize: 15, color: colors.white, fontWeight: '600' },
});
```

- [ ] **Step 2: Verificar tipos**

```bash
cd lumen_mobile && npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add lumen_mobile/app/vida/wizard.tsx
git commit -m "feat: wizard de criação do ciclo mensal (6 passos)"
```

---

## Task 9: PIN Unlock Screen (unlock.tsx)

**Files:**
- Create: `lumen_mobile/app/vida/unlock.tsx`

- [ ] **Step 1: Criar `lumen_mobile/app/vida/unlock.tsx`**

```tsx
/**
 * Projeto de Vida — Desbloqueio por PIN
 * =======================================
 * Recebe projetoId via params. Verifica PIN no backend.
 * Em caso de sucesso, navega para /vida/ciclo.
 */

import { useState, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  ActivityIndicator, TextInput,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import type { IoniconsName } from '@/types/icons';
import projetoVidaMensalApi from '@/services/projetoVidaMensal';

const colors = {
  primary: '#1A859B', primaryLight: '#E8F4F7',
  white: '#ffffff', gray: '#6b7280',
  dark: '#171717', border: '#e5e7eb', error: '#ef4444',
};

export default function UnlockScreen() {
  const { projetoId } = useLocalSearchParams<{ projetoId: string }>();
  const [pin, setPin] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<TextInput>(null);

  const handleVerify = async () => {
    if (pin.length < 4) {
      setError('Digite os 4 dígitos do PIN.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const result = await projetoVidaMensalApi.verificarPin(projetoId, pin);
      if (result.valid) {
        router.replace({ pathname: '/vida/ciclo', params: { projetoId } });
      } else {
        setError('PIN incorreto. Tente novamente.');
        setPin('');
        inputRef.current?.focus();
      }
    } catch {
      setError('Erro ao verificar PIN. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <View style={styles.iconWrap}>
          <Ionicons name={'lock-closed' as IoniconsName} size={32} color={colors.primary} />
        </View>
        <Text style={styles.title}>Projeto protegido</Text>
        <Text style={styles.subtitle}>Digite o PIN de 4 dígitos para acessar.</Text>

        {/* Exibição dos dots */}
        <View style={styles.dotsRow}>
          {[0, 1, 2, 3].map(i => (
            <View key={i} style={[styles.dot, i < pin.length && styles.dotFilled]} />
          ))}
        </View>

        {/* Input oculto que recebe o PIN */}
        <TextInput
          ref={inputRef}
          style={styles.hiddenInput}
          value={pin}
          onChangeText={v => { setPin(v.replace(/\D/g, '').slice(0, 4)); setError(null); }}
          keyboardType="numeric"
          secureTextEntry
          maxLength={4}
          autoFocus
          onSubmitEditing={handleVerify}
        />

        {error && <Text style={styles.errorText}>{error}</Text>}

        <TouchableOpacity style={styles.btn} onPress={handleVerify} disabled={loading} activeOpacity={0.8}>
          {loading
            ? <ActivityIndicator color={colors.white} />
            : <Text style={styles.btnText}>Desbloquear</Text>
          }
        </TouchableOpacity>

        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Text style={styles.backBtnText}>Voltar</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9fafb', justifyContent: 'center', alignItems: 'center', padding: 24 },
  card: { backgroundColor: colors.white, borderRadius: 20, padding: 32, width: '100%', maxWidth: 360, alignItems: 'center', borderWidth: 1, borderColor: colors.border, shadowColor: '#000', shadowOpacity: 0.07, shadowRadius: 12, elevation: 4 },
  iconWrap: { width: 72, height: 72, borderRadius: 20, backgroundColor: colors.primaryLight, justifyContent: 'center', alignItems: 'center', marginBottom: 16 },
  title: { fontSize: 20, fontWeight: '700', color: colors.dark, marginBottom: 6 },
  subtitle: { fontSize: 14, color: colors.gray, textAlign: 'center', marginBottom: 24 },
  dotsRow: { flexDirection: 'row', gap: 16, marginBottom: 8 },
  dot: { width: 18, height: 18, borderRadius: 9, borderWidth: 2, borderColor: colors.border, backgroundColor: colors.white },
  dotFilled: { backgroundColor: colors.primary, borderColor: colors.primary },
  hiddenInput: { position: 'absolute', opacity: 0, height: 1, width: 1 },
  errorText: { color: colors.error, fontSize: 14, marginBottom: 16, textAlign: 'center' },
  btn: { backgroundColor: colors.primary, borderRadius: 12, paddingVertical: 14, paddingHorizontal: 40, marginTop: 8, marginBottom: 8, width: '100%', alignItems: 'center' },
  btnText: { color: colors.white, fontSize: 16, fontWeight: '700' },
  backBtn: { padding: 12 },
  backBtnText: { color: colors.gray, fontSize: 14 },
});
```

- [ ] **Step 2: Verificar tipos**

```bash
cd lumen_mobile && npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add lumen_mobile/app/vida/unlock.tsx
git commit -m "feat: tela de desbloqueio PIN do projeto de vida"
```

---

## Task 10: Ciclo View Screen (ciclo.tsx)

**Files:**
- Create: `lumen_mobile/app/vida/ciclo.tsx`

- [ ] **Step 1: Criar `lumen_mobile/app/vida/ciclo.tsx`**

```tsx
/**
 * Projeto de Vida — Visualização do Ciclo
 * =========================================
 * Exibe todos os dados do ciclo mensal em seções.
 */

import { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  TouchableOpacity, ActivityIndicator, RefreshControl,
} from 'react-native';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import type { IoniconsName } from '@/types/icons';
import projetoVidaMensalApi, {
  MESES, SEMANAS, SEMANA_LABELS, DIAS, DIA_LABELS,
  type ProjetoVidaMensalFull,
} from '@/services/projetoVidaMensal';

const colors = {
  primary: '#1A859B', primaryLight: '#E8F4F7',
  white: '#ffffff', gray: '#6b7280',
  lightGray: '#f3f4f6', dark: '#171717', border: '#e5e7eb',
};

export default function CicloScreen() {
  const { projetoId } = useLocalSearchParams<{ projetoId: string }>();
  const [projeto, setProjeto] = useState<ProjetoVidaMensalFull | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (isRefresh = false) => {
    if (!isRefresh) setLoading(true);
    try {
      const data = await projetoVidaMensalApi.get(projetoId);
      setProjeto(data);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [projetoId]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  if (loading) {
    return <View style={styles.center}><ActivityIndicator size="large" color={colors.primary} /></View>;
  }
  if (!projeto) return null;

  const mesLabel = MESES[projeto.mes - 1];

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(true); }} colors={[colors.primary]} />}
    >
      {/* Cabeçalho */}
      <View style={styles.header}>
        <Text style={styles.headerMonth}>{mesLabel} {projeto.ano}</Text>
        {projeto.tema ? <Text style={styles.headerTheme}>"{projeto.tema}"</Text> : null}
        {projeto.intencao ? <Text style={styles.headerIntencao}>{projeto.intencao}</Text> : null}
        {projeto.concluido && <View style={styles.badge}><Text style={styles.badgeText}>Ciclo concluído</Text></View>}
      </View>

      {/* Comunidade */}
      <Section title="Comunidade" icon={'people-outline' as IoniconsName}>
        {projeto.comunidade ? (
          <>
            <Field label="Partilha com acompanhador" value={projeto.comunidade.partilha_acompanhador} />
            <Field label="Encontro com família" value={projeto.comunidade.encontro_familia} />
            <Field label="Dias de grupo" value={projeto.comunidade.dias_grupo} />
            <Field label="Outros" value={projeto.comunidade.outros} />
          </>
        ) : <Text style={styles.empty}>Não preenchido</Text>}
      </Section>

      {/* Cuidado */}
      <Section title="Cuidado Pessoal" icon={'heart-outline' as IoniconsName}>
        {projeto.cuidado ? (
          <>
            <Field label="Consultas" value={projeto.cuidado.consultas} />
            <Field label="Exames" value={projeto.cuidado.exames} />
            <Field label="Descanso e lazer" value={projeto.cuidado.descanso} />
            <Field label="Outros" value={projeto.cuidado.outros} />
          </>
        ) : <Text style={styles.empty}>Não preenchido</Text>}
      </Section>

      {/* Compromissos semanais */}
      <Section title="Compromissos" icon={'list-outline' as IoniconsName}>
        {SEMANAS.filter(s => projeto.compromissos.some(c => c.semana === s)).length === 0
          ? <Text style={styles.empty}>Nenhum compromisso cadastrado</Text>
          : SEMANAS.map(s => {
              const items = projeto.compromissos.filter(c => c.semana === s);
              if (items.length === 0) return null;
              return (
                <View key={s} style={{ marginBottom: 12 }}>
                  <Text style={styles.subheading}>{SEMANA_LABELS[s]}</Text>
                  {items.map((c, i) => (
                    <View key={i} style={styles.listItem}>
                      <Text style={styles.listItemTitle}>{c.titulo || '—'}</Text>
                      {c.dia || c.horario ? (
                        <Text style={styles.listItemMeta}>{[c.dia, c.horario].filter(Boolean).join(' · ')}</Text>
                      ) : null}
                      {c.obs ? <Text style={styles.listItemObs}>{c.obs}</Text> : null}
                    </View>
                  ))}
                </View>
              );
            })}
      </Section>

      {/* Oração diária */}
      <Section title="Oração Diária" icon={'sunny-outline' as IoniconsName}>
        {DIAS.filter(d => projeto.praticas.some(p => p.dia_semana === d)).length === 0
          ? <Text style={styles.empty}>Nenhuma prática cadastrada</Text>
          : DIAS.map(d => {
              const items = projeto.praticas.filter(p => p.dia_semana === d);
              if (items.length === 0) return null;
              return (
                <View key={d} style={{ marginBottom: 12 }}>
                  <Text style={styles.subheading}>{DIA_LABELS[d]}</Text>
                  {items.map((p, i) => (
                    <View key={i} style={styles.listItem}>
                      <Text style={styles.listItemTitle}>{p.tipo}</Text>
                      {p.horario || p.duracao ? (
                        <Text style={styles.listItemMeta}>{[p.horario, p.duracao].filter(Boolean).join(' · ')}</Text>
                      ) : null}
                      {p.obs ? <Text style={styles.listItemObs}>{p.obs}</Text> : null}
                    </View>
                  ))}
                </View>
              );
            })}
      </Section>

      {/* Revisão (se existir) */}
      {projeto.revisao && (
        <Section title="Revisão do Ciclo" icon={'checkmark-circle-outline' as IoniconsName}>
          <Field label="Onde percebi a graça de Deus" value={projeto.revisao.graca} />
          <Field label="Onde fui fiel" value={projeto.revisao.fidelidade} />
          <Field label="Onde falhei" value={projeto.revisao.falhas} />
          <Field label="O que preciso ordenar" value={projeto.revisao.ordenar} />
          <Field label="Passo concreto" value={projeto.revisao.passo} />
          {(projeto.revisao.decisao || projeto.revisao.virtude) && (
            <>
              <Text style={[styles.subheading, { marginTop: 8 }]}>Próximo ciclo</Text>
              <Field label="Decisão" value={projeto.revisao.decisao} />
              <Field label="Virtude" value={projeto.revisao.virtude} />
              <Field label="Conversão" value={projeto.revisao.conversao} />
              <Field label="Passo" value={projeto.revisao.passo_proximo} />
            </>
          )}
        </Section>
      )}

      {/* Ações */}
      {!projeto.concluido && (
        <TouchableOpacity
          style={styles.revisaoBtn}
          onPress={() => router.push({ pathname: '/vida/revisao', params: { projetoId } })}
          activeOpacity={0.8}
        >
          <Ionicons name={'checkmark-circle-outline' as IoniconsName} size={20} color={colors.white} />
          <Text style={styles.revisaoBtnText}>Iniciar Revisão Mensal</Text>
        </TouchableOpacity>
      )}
    </ScrollView>
  );
}

function Section({ title, icon, children }: { title: string; icon: IoniconsName; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <Ionicons name={icon} size={18} color={colors.primary} />
        <Text style={styles.sectionTitle}>{title}</Text>
      </View>
      {children}
    </View>
  );
}

function Field({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value) return null;
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <Text style={styles.fieldValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9fafb' },
  content: { padding: 20, paddingBottom: 40 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { backgroundColor: colors.primary, borderRadius: 16, padding: 22, marginBottom: 20, gap: 6 },
  headerMonth: { fontSize: 22, fontWeight: '700', color: colors.white },
  headerTheme: { fontSize: 15, color: 'rgba(255,255,255,0.85)', fontStyle: 'italic' },
  headerIntencao: { fontSize: 14, color: 'rgba(255,255,255,0.75)', marginTop: 2 },
  badge: { alignSelf: 'flex-start', backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 3, marginTop: 4 },
  badgeText: { color: colors.white, fontSize: 12, fontWeight: '600' },
  section: { backgroundColor: colors.white, borderRadius: 14, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: colors.border },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: colors.dark },
  subheading: { fontSize: 13, fontWeight: '600', color: colors.primary, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 },
  field: { marginBottom: 10 },
  fieldLabel: { fontSize: 12, color: colors.gray, marginBottom: 2 },
  fieldValue: { fontSize: 14, color: colors.dark, lineHeight: 20 },
  empty: { fontSize: 14, color: colors.gray, fontStyle: 'italic' },
  listItem: { backgroundColor: colors.lightGray, borderRadius: 8, padding: 10, marginBottom: 6 },
  listItemTitle: { fontSize: 14, fontWeight: '600', color: colors.dark },
  listItemMeta: { fontSize: 12, color: colors.gray, marginTop: 2 },
  listItemObs: { fontSize: 13, color: colors.dark, marginTop: 4, lineHeight: 18 },
  revisaoBtn: { backgroundColor: colors.primary, borderRadius: 12, padding: 16, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8, marginTop: 8 },
  revisaoBtnText: { color: colors.white, fontSize: 15, fontWeight: '700' },
});
```

- [ ] **Step 2: Verificar tipos e commit**

```bash
cd lumen_mobile && npx tsc --noEmit
git add lumen_mobile/app/vida/ciclo.tsx
git commit -m "feat: tela de visualização do ciclo mensal"
```

---

## Task 11: Review Flow (revisao.tsx)

**Files:**
- Modify: `lumen_mobile/app/vida/revisao.tsx` (substituição completa)

4 passos: Revisão Vocacional → Ato de Contrição → Próximo Ciclo → Concluído

- [ ] **Step 1: Substituir `lumen_mobile/app/vida/revisao.tsx`**

```tsx
/**
 * Projeto de Vida — Revisão Mensal
 * ==================================
 * 4 passos: Revisão Vocacional → Ato de Contrição → Próximo Ciclo → Concluído
 */

import { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, ActivityIndicator, KeyboardAvoidingView, Platform,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import type { IoniconsName } from '@/types/icons';
import projetoVidaMensalApi from '@/services/projetoVidaMensal';

const colors = {
  primary: '#1A859B', primaryLight: '#E8F4F7',
  white: '#ffffff', gray: '#6b7280',
  dark: '#171717', border: '#e5e7eb', error: '#ef4444',
};

const STEP_TITLES = ['Vigília Vocacional', 'Ato de Contrição', 'Próximo Ciclo', 'Revisão Salva'];

interface RevisaoState {
  graca: string; fidelidade: string; falhas: string; ordenar: string; passo: string;
  decisao: string; virtude: string; conversao: string; passo_proximo: string;
}

const defaultState = (): RevisaoState => ({
  graca: '', fidelidade: '', falhas: '', ordenar: '', passo: '',
  decisao: '', virtude: '', conversao: '', passo_proximo: '',
});

const QUESTOES_REVISAO: Array<{ key: keyof RevisaoState; q: string }> = [
  { key: 'graca',       q: 'Onde percebi a graça de Deus neste mês?' },
  { key: 'fidelidade',  q: 'Onde fui fiel?' },
  { key: 'falhas',      q: 'Onde falhei?' },
  { key: 'ordenar',     q: 'O que preciso ordenar melhor?' },
  { key: 'passo',       q: 'Que passo concreto Deus me pede para o próximo ciclo?' },
];

const QUESTOES_PROXIMO: Array<{ key: keyof RevisaoState; q: string }> = [
  { key: 'decisao',      q: 'Que decisão concreta tomarei?' },
  { key: 'virtude',      q: 'Que virtude quero cultivar?' },
  { key: 'conversao',    q: 'Em que área preciso de conversão?' },
  { key: 'passo_proximo', q: 'Qual o primeiro passo prático?' },
];

const CONTRICAO_TEXT =
  `Emanuel, eu, Teu Filho, reconheço minhas falhas e me arrependo de todo o mal que cometi e do bem que deixei de fazer. Confio no Teu amor misericordioso e me proponho, com a Tua graça, a recomeçar com mais fidelidade no próximo ciclo. Amém.`;

export default function RevisaoScreen() {
  const { projetoId } = useLocalSearchParams<{ projetoId: string }>();
  const [step, setStep] = useState(0);
  const [state, setState] = useState<RevisaoState>(defaultState());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const update = (key: keyof RevisaoState, val: string) =>
    setState(s => ({ ...s, [key]: val }));

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      await projetoVidaMensalApi.upsertRevisao(projetoId, {
        graca: state.graca || null,
        fidelidade: state.fidelidade || null,
        falhas: state.falhas || null,
        ordenar: state.ordenar || null,
        passo: state.passo || null,
        decisao: state.decisao || null,
        virtude: state.virtude || null,
        conversao: state.conversao || null,
        passo_proximo: state.passo_proximo || null,
      });
      setStep(3); // Concluído
    } catch {
      setError('Erro ao salvar revisão. Tente novamente.');
    } finally {
      setSaving(false);
    }
  };

  const renderStep = () => {
    switch (step) {
      // ── Passo 0: Revisão Vocacional ──────────────────────────────────────
      case 0:
        return (
          <View style={styles.stepContent}>
            <Text style={styles.sectionLabel}>Vigília Vocacional</Text>
            <Text style={styles.intro}>
              Na Vigília Vocacional, somos convidados a rever o caminho com sinceridade diante de Deus em comunidade.
            </Text>
            {QUESTOES_REVISAO.map(({ key, q }) => (
              <View key={key} style={styles.questionCard}>
                <Text style={styles.questionText}>{q}</Text>
                <TextInput
                  style={styles.textarea}
                  value={state[key]}
                  onChangeText={v => update(key, v)}
                  multiline
                  numberOfLines={4}
                  placeholderTextColor={colors.gray}
                  placeholder="Sua resposta..."
                />
              </View>
            ))}
          </View>
        );

      // ── Passo 1: Ato de Contrição ────────────────────────────────────────
      case 1:
        return (
          <View style={styles.stepContent}>
            <Text style={styles.sectionLabel}>Ato de Contrição</Text>
            <View style={styles.prayerCard}>
              <Ionicons name={'heart' as IoniconsName} size={28} color={colors.primary} style={{ marginBottom: 14, alignSelf: 'center' }} />
              <Text style={styles.prayerText}>{CONTRICAO_TEXT}</Text>
            </View>
          </View>
        );

      // ── Passo 2: Próximo Ciclo ───────────────────────────────────────────
      case 2:
        return (
          <View style={styles.stepContent}>
            <Text style={styles.sectionLabel}>Compromisso — Próximo Ciclo</Text>
            <Text style={styles.intro}>
              Com base na revisão, defina seus compromissos para o próximo mês.
            </Text>
            {QUESTOES_PROXIMO.map(({ key, q }) => (
              <View key={key} style={styles.questionCard}>
                <Text style={styles.questionText}>{q}</Text>
                <TextInput
                  style={styles.textarea}
                  value={state[key]}
                  onChangeText={v => update(key, v)}
                  multiline
                  numberOfLines={3}
                  placeholderTextColor={colors.gray}
                  placeholder="Sua resposta..."
                />
              </View>
            ))}
            {error && (
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>{error}</Text>
              </View>
            )}
          </View>
        );

      // ── Passo 3: Concluído ───────────────────────────────────────────────
      case 3:
        return (
          <View style={[styles.stepContent, { alignItems: 'center', paddingTop: 40 }]}>
            <View style={styles.successIcon}>
              <Ionicons name={'checkmark-circle' as IoniconsName} size={64} color={colors.primary} />
            </View>
            <Text style={styles.successTitle}>Revisão concluída!</Text>
            <Text style={styles.successSubtitle}>
              Que Deus abençoe o seu novo ciclo de vida.
            </Text>
            <TouchableOpacity
              style={styles.primaryBtn}
              onPress={() => router.replace({ pathname: '/vida/ciclo', params: { projetoId } })}
              activeOpacity={0.8}
            >
              <Text style={styles.primaryBtnText}>Ver ciclo atualizado</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.ghostBtn} onPress={() => router.replace('/vida')} activeOpacity={0.8}>
              <Text style={styles.ghostBtnText}>Voltar ao início</Text>
            </TouchableOpacity>
          </View>
        );

      default:
        return null;
    }
  };

  const isLastContentStep = step === 2;

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      {/* Indicador de passos */}
      {step < 3 && (
        <>
          <View style={styles.stepBar}>
            {[0, 1, 2].map(i => (
              <View key={i} style={[styles.stepDot, i === step && styles.stepDotActive, i < step && styles.stepDotDone]} />
            ))}
          </View>
          <View style={styles.stepHeader}>
            <Text style={styles.stepTitle}>{STEP_TITLES[step]}</Text>
            <Text style={styles.stepCounter}>{step + 1} / 3</Text>
          </View>
        </>
      )}

      <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 40 }}>
        {renderStep()}
      </ScrollView>

      {/* Navegação (não mostrar no passo final) */}
      {step < 3 && (
        <View style={styles.navRow}>
          <TouchableOpacity
            style={[styles.navBtn, styles.navBtnBack]}
            onPress={() => (step === 0 ? router.back() : setStep(s => s - 1))}
          >
            <Ionicons name={'chevron-back' as IoniconsName} size={20} color={colors.primary} />
            <Text style={styles.navBtnBackText}>{step === 0 ? 'Cancelar' : 'Voltar'}</Text>
          </TouchableOpacity>

          {isLastContentStep ? (
            <TouchableOpacity
              style={[styles.navBtn, styles.navBtnNext]}
              onPress={handleSave}
              disabled={saving}
            >
              {saving
                ? <ActivityIndicator color={colors.white} size="small" />
                : <>
                    <Text style={styles.navBtnNextText}>Salvar Revisão</Text>
                    <Ionicons name={'checkmark' as IoniconsName} size={20} color={colors.white} />
                  </>
              }
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={[styles.navBtn, styles.navBtnNext]}
              onPress={() => setStep(s => s + 1)}
            >
              <Text style={styles.navBtnNextText}>Próximo</Text>
              <Ionicons name={'chevron-forward' as IoniconsName} size={20} color={colors.white} />
            </TouchableOpacity>
          )}
        </View>
      )}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9fafb' },
  stepBar: { flexDirection: 'row', justifyContent: 'center', gap: 8, paddingVertical: 12, backgroundColor: colors.white, borderBottomWidth: 1, borderColor: colors.border },
  stepDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.border },
  stepDotActive: { backgroundColor: colors.primary, width: 24, borderRadius: 4 },
  stepDotDone: { backgroundColor: colors.primaryLight },
  stepHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 12, backgroundColor: colors.white },
  stepTitle: { fontSize: 18, fontWeight: '700', color: colors.dark },
  stepCounter: { fontSize: 13, color: colors.gray },
  stepContent: { padding: 20 },
  sectionLabel: { fontSize: 11, letterSpacing: 1.5, textTransform: 'uppercase', color: colors.primary, fontWeight: '700', marginBottom: 8 },
  intro: { fontSize: 14, color: colors.gray, lineHeight: 21, marginBottom: 20 },
  questionCard: { backgroundColor: colors.white, borderRadius: 12, padding: 16, marginBottom: 14, borderWidth: 1, borderColor: colors.border },
  questionText: { fontSize: 15, fontWeight: '600', color: colors.dark, marginBottom: 10, lineHeight: 22 },
  textarea: { borderWidth: 1, borderColor: colors.border, borderRadius: 8, padding: 10, fontSize: 14, color: colors.dark, textAlignVertical: 'top', minHeight: 90, backgroundColor: '#f9fafb' },
  prayerCard: { backgroundColor: colors.primaryLight, borderRadius: 14, padding: 24, borderWidth: 1, borderColor: colors.primary + '40' },
  prayerText: { fontSize: 16, color: colors.dark, lineHeight: 28, textAlign: 'center', fontStyle: 'italic' },
  errorBox: { backgroundColor: '#fef2f2', borderColor: '#fecaca', borderWidth: 1, borderRadius: 10, padding: 12, marginTop: 8 },
  errorText: { color: '#dc2626', fontSize: 14 },
  successIcon: { marginBottom: 16 },
  successTitle: { fontSize: 24, fontWeight: '700', color: colors.dark, marginBottom: 8 },
  successSubtitle: { fontSize: 15, color: colors.gray, textAlign: 'center', marginBottom: 32, lineHeight: 22 },
  primaryBtn: { backgroundColor: colors.primary, borderRadius: 12, paddingVertical: 14, paddingHorizontal: 36, marginBottom: 12, width: '100%', alignItems: 'center' },
  primaryBtnText: { color: colors.white, fontSize: 16, fontWeight: '700' },
  ghostBtn: { padding: 12 },
  ghostBtnText: { color: colors.gray, fontSize: 14 },
  navRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, backgroundColor: colors.white, borderTopWidth: 1, borderColor: colors.border },
  navBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 10, paddingHorizontal: 20, borderRadius: 10 },
  navBtnBack: { borderWidth: 1, borderColor: colors.border },
  navBtnBackText: { fontSize: 15, color: colors.primary, fontWeight: '600' },
  navBtnNext: { backgroundColor: colors.primary },
  navBtnNextText: { fontSize: 15, color: colors.white, fontWeight: '600' },
});
```

- [ ] **Step 2: Verificar tipos e commit**

```bash
cd lumen_mobile && npx tsc --noEmit
git add lumen_mobile/app/vida/revisao.tsx
git commit -m "feat: fluxo de revisão mensal (4 passos)"
```

---

## Task 12: Layout Update (_layout.tsx)

**Files:**
- Modify: `lumen_mobile/app/vida/_layout.tsx`

- [ ] **Step 1: Substituir `lumen_mobile/app/vida/_layout.tsx`**

```tsx
/**
 * Vida (Projeto de Vida Mensal) Layout
 * ======================================
 */

import { Stack } from 'expo-router';
import { BreadcrumbHeader } from '@/components/ui/BreadcrumbHeader';

const VIDA: { label: string; href: '/vida' } = { label: 'Projeto de Vida', href: '/vida' };

export default function VidaLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen
        name="index"
        options={{
          header: () => <BreadcrumbHeader items={[{ label: 'Projeto de Vida' }]} />,
          headerShown: true,
        }}
      />
      <Stack.Screen
        name="wizard"
        options={{
          header: () => <BreadcrumbHeader items={[VIDA, { label: 'Novo Ciclo' }]} />,
          headerShown: true,
        }}
      />
      <Stack.Screen
        name="unlock"
        options={{
          header: () => <BreadcrumbHeader items={[VIDA, { label: 'Desbloquear' }]} />,
          headerShown: true,
        }}
      />
      <Stack.Screen
        name="ciclo"
        options={{
          header: () => <BreadcrumbHeader items={[VIDA, { label: 'Ciclo Mensal' }]} />,
          headerShown: true,
        }}
      />
      <Stack.Screen
        name="revisao"
        options={{
          header: () => <BreadcrumbHeader items={[VIDA, { label: 'Revisão Mensal' }]} />,
          headerShown: true,
        }}
      />
      <Stack.Screen
        name="historico"
        options={{
          header: () => <BreadcrumbHeader items={[VIDA, { label: 'Histórico' }]} />,
          headerShown: true,
        }}
      />
    </Stack>
  );
}
```

- [ ] **Step 2: Verificar tipos e commit**

```bash
cd lumen_mobile && npx tsc --noEmit
git add lumen_mobile/app/vida/_layout.tsx
git commit -m "feat: atualizar layout — adicionar screens unlock e ciclo"
```

---

## Self-Review

### Cobertura do spec

| Requisito | Task |
|-----------|------|
| Ciclo mensal: mes, ano, tema, intencao | Tasks 1, 3, 4, 6, 8 |
| Comunidade: partilha, encontro, diasGrupo, outros | Tasks 1, 3, 4, 6, 8 |
| Cuidado: consultas, exames, descanso, outros | Tasks 1, 3, 4, 6, 8 |
| Semanal: s1-s5 × compromissos (titulo, dia, horario, obs) | Tasks 1, 3, 4, 6, 8 |
| Oração: seg-dom × praticas (tipo, horario, duracao, obs) | Tasks 1, 3, 4, 6, 8 |
| PIN de proteção (4 dígitos) | Tasks 1, 3, 4, 6, 9 |
| Revisão: graca, fidelidade, falhas, ordenar, passo | Tasks 1, 3, 4, 6, 11 |
| Ato de Contrição (texto estático) | Task 11 |
| Próximo ciclo: decisao, virtude, conversao, passo | Tasks 1, 3, 4, 6, 11 |
| Formatação visual do Lumen+ (teal, Ionicons, StyleSheet) | Tasks 7–12 |
| Backend completo (a pasta original só tinha frontend web) | Tasks 1–5 |
| Histórico de ciclos | Tasks 4, 6, 7 |

### Consistência de tipos

- Todos os campos `nullable` no Python são `Optional[str] = None` nos schemas e `string | null` no TypeScript.
- `has_pin: bool` é derivado em `_to_full()` — nunca expõe `pin_hash`.
- `semana` pattern `^s[1-5]$` — consistente entre Pydantic, SQLAlchemy (String(3)) e TypeScript.
- `dia_semana` pattern `^(seg|ter|qua|qui|sex|sab|dom)$` — idem.

