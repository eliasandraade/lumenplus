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
    partilha_acompanhador: Optional[str] = Field(None, max_length=2000)
    encontro_familia: Optional[str] = Field(None, max_length=2000)
    dias_grupo: Optional[str] = Field(None, max_length=1000)
    outros: Optional[str] = Field(None, max_length=2000)


class CuidadoData(BaseModel):
    consultas: Optional[str] = Field(None, max_length=2000)
    exames: Optional[str] = Field(None, max_length=2000)
    descanso: Optional[str] = Field(None, max_length=2000)
    outros: Optional[str] = Field(None, max_length=2000)


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
    graca: Optional[str] = Field(None, max_length=3000)
    fidelidade: Optional[str] = Field(None, max_length=3000)
    falhas: Optional[str] = Field(None, max_length=3000)
    ordenar: Optional[str] = Field(None, max_length=3000)
    passo: Optional[str] = Field(None, max_length=3000)
    decisao: Optional[str] = Field(None, max_length=3000)
    virtude: Optional[str] = Field(None, max_length=3000)
    conversao: Optional[str] = Field(None, max_length=3000)
    passo_proximo: Optional[str] = Field(None, max_length=3000)


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
    intencao: Optional[str] = Field(None, max_length=3000)
    pin: Optional[str] = Field(None, min_length=4, max_length=4, pattern=r"^\d{4}$")


class ProjetoVidaMensalUpdate(BaseModel):
    tema: Optional[str] = Field(None, max_length=500)
    intencao: Optional[str] = Field(None, max_length=3000)
    observacoes_mes: Optional[str] = Field(None, max_length=3000)
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
