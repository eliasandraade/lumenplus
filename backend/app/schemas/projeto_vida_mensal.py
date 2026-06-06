"""
Schemas — Projeto de Vida Mensal
=================================
"""

from datetime import datetime
from typing import Any, List, Optional
from uuid import UUID

from pydantic import BaseModel, Field, field_validator


# ── Sub-schemas: itens de lista ─────────────────────────────────────────────


class EventoItem(BaseModel):
    """Compromisso/encontro com data, horário e local. Usado em comunidade."""
    data: Optional[str] = Field(None, max_length=20)        # "2026-04-04"
    horario: Optional[str] = Field(None, max_length=20)     # "19:00"
    local: Optional[str] = Field(None, max_length=500)
    observacoes: Optional[str] = Field(None, max_length=2000)


class OutroItemComunidade(BaseModel):
    """Item genérico de compromisso comunitário."""
    titulo: Optional[str] = Field(None, max_length=200)
    descricao: Optional[str] = Field(None, max_length=2000)
    local: Optional[str] = Field(None, max_length=500)
    data: Optional[str] = Field(None, max_length=20)
    horario: Optional[str] = Field(None, max_length=20)


class CuidadoEventoItem(BaseModel):
    """Consulta / exame / descanso com data, horário e local."""
    data: Optional[str] = Field(None, max_length=20)
    horario: Optional[str] = Field(None, max_length=20)
    local: Optional[str] = Field(None, max_length=500)
    descricao: Optional[str] = Field(None, max_length=2000)


class OutroItemCuidado(BaseModel):
    """Item genérico de cuidado pessoal."""
    titulo: Optional[str] = Field(None, max_length=200)
    descricao: Optional[str] = Field(None, max_length=2000)
    local: Optional[str] = Field(None, max_length=500)
    data: Optional[str] = Field(None, max_length=20)
    horario: Optional[str] = Field(None, max_length=20)


# ── Sub-schemas de seção ────────────────────────────────────────────────────


class ComunidadeData(BaseModel):
    partilha_acompanhador: List[EventoItem] = []
    encontro_familia: List[EventoItem] = []
    dias_grupo: List[EventoItem] = []
    outros: List[OutroItemComunidade] = []


class CuidadoData(BaseModel):
    consultas: List[CuidadoEventoItem] = []
    exames: List[CuidadoEventoItem] = []
    descanso: List[CuidadoEventoItem] = []
    outros: List[OutroItemCuidado] = []


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
    """4 perguntas da revisão mensal v2."""
    pratica_melhorar: Optional[str] = Field(None, max_length=5000)
    taticas_vigilancia: Optional[str] = Field(None, max_length=5000)
    rotina_evangelizacao: Optional[str] = Field(None, max_length=5000)
    outra_area_atencao: Optional[str] = Field(None, max_length=5000)


class RevisaoOut(BaseModel):
    pratica_melhorar: Optional[str] = None
    taticas_vigilancia: Optional[str] = None
    rotina_evangelizacao: Optional[str] = None
    outra_area_atencao: Optional[str] = None

    model_config = {"from_attributes": True}


# ── Áreas mensais ───────────────────────────────────────────────────────────

TIPOS_AREA_VALIDOS = frozenset({
    "FAMILIA_VOCACIONAL",
    "MINISTERIO_BOM_PASTOR",
    "GRUPO_FORMATIVO",
    "SAUDE_LAZER",
    "FAMILIA_ORIGEM",
})


class CompromissoAreaItem(BaseModel):
    descricao: Optional[str] = Field(None, max_length=500)
    data: Optional[str] = Field(None, max_length=20)
    horario: Optional[str] = Field(None, max_length=20)
    local: Optional[str] = Field(None, max_length=300)
    obs: Optional[str] = Field(None, max_length=1000)


class AreaMensalIn(BaseModel):
    tipo_area: str
    objetivo: Optional[str] = Field(None, max_length=3000)
    compromissos: Optional[List[CompromissoAreaItem]] = []
    observacoes: Optional[str] = Field(None, max_length=3000)

    @field_validator("tipo_area")
    @classmethod
    def validar_tipo_area(cls, v: str) -> str:
        if v not in TIPOS_AREA_VALIDOS:
            raise ValueError(
                f"tipo_area inválido: '{v}'. Valores aceitos: {sorted(TIPOS_AREA_VALIDOS)}"
            )
        return v


class AreaMensalOut(BaseModel):
    id: UUID
    tipo_area: str
    objetivo: Optional[str] = None
    compromissos: Optional[List[CompromissoAreaItem]] = []
    observacoes: Optional[str] = None

    model_config = {"from_attributes": True}


# ── Top-level schemas ──────────────────────────────────────────────────────


class ProjetoVidaMensalCreate(BaseModel):
    mes: int = Field(..., ge=1, le=12)
    ano: int = Field(..., ge=2024, le=2100)
    pin: Optional[str] = Field(None, min_length=4, max_length=4, pattern=r"^\d{4}$")
    intencao: Optional[str] = Field(None, max_length=2000)
    reflexao_evangelizacao: Optional[str] = Field(None, max_length=3000)


class ProjetoVidaMensalUpdate(BaseModel):
    observacoes_mes: Optional[str] = Field(None, max_length=3000)
    concluido: Optional[bool] = None
    intencao: Optional[str] = Field(None, max_length=2000)
    reflexao_evangelizacao: Optional[str] = Field(None, max_length=3000)
    areas: Optional[List[AreaMensalIn]] = None
    comunidade: Optional[ComunidadeData] = None
    cuidado: Optional[CuidadoData] = None
    compromissos: Optional[List[CompromissoIn]] = None
    praticas: Optional[List[PraticaIn]] = None


class ProjetoVidaMensalSummary(BaseModel):
    id: UUID
    mes: int
    ano: int
    concluido: bool
    has_pin: bool
    created_at: datetime


class ProjetoVidaMensalFull(BaseModel):
    id: UUID
    mes: int
    ano: int
    has_pin: bool
    concluido: bool
    observacoes_mes: Optional[str] = None
    reflexao_evangelizacao: Optional[str] = None
    has_new_structure: bool = False
    areas: List[AreaMensalOut] = []
    intencao: Optional[str] = None
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


# ── Exame de Consciência ────────────────────────────────────────────────────


class ExameUpsert(BaseModel):
    """6 campos de reflexão — todos opcionais (exame nunca é obrigatório)."""
    gracas_recebidas: Optional[str] = Field(None, max_length=5000)
    infidelidades: Optional[str] = Field(None, max_length=5000)
    dificuldades_espirituais: Optional[str] = Field(None, max_length=5000)
    jesus_abandonado: Optional[str] = Field(None, max_length=5000)
    onde_deixei_de_responder: Optional[str] = Field(None, max_length=5000)
    proposito_conversao: Optional[str] = Field(None, max_length=5000)


class ExameOut(BaseModel):
    id: UUID
    gracas_recebidas: Optional[str] = None
    infidelidades: Optional[str] = None
    dificuldades_espirituais: Optional[str] = None
    jesus_abandonado: Optional[str] = None
    onde_deixei_de_responder: Optional[str] = None
    proposito_conversao: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


# ── Intercessão ─────────────────────────────────────────────────────────────


class IntercessaoUpsert(BaseModel):
    intencoes_pessoais: Optional[str] = Field(None, max_length=5000)
    intencoes_comunitarias: Optional[str] = Field(None, max_length=5000)
    oferecimento: Optional[str] = Field(None, max_length=3000)


class IntercessaoOut(BaseModel):
    id: UUID
    intencoes_pessoais: Optional[str] = None
    intencoes_comunitarias: Optional[str] = None
    oferecimento: Optional[str] = None
    created_at: datetime
    updated_at: datetime


# ── Projeto Semanal ─────────────────────────────────────────────────────────


class EvangelizacaoMomentoItem(BaseModel):
    """Momento relacional planejado — apenas descrição, sem métricas."""
    descricao: str = Field(..., max_length=500)


class PlanoDiarioItem(BaseModel):
    """Planejamento de um dia — todos os campos opcionais."""
    proposito: Optional[str] = Field(None, max_length=1000)
    missa: Optional[bool] = None
    horario_missa: Optional[str] = Field(None, max_length=20)
    oracao_manha: Optional[str] = Field(None, max_length=500)
    lectio: Optional[str] = Field(None, max_length=500)
    terco: Optional[bool] = None
    leitura_espiritual: Optional[str] = Field(None, max_length=500)
    evangelizacao: Optional[str] = Field(None, max_length=500)
    compromissos: Optional[List[str]] = None


class ProjetoVidaSemanasCreate(BaseModel):
    numero_semana: int = Field(..., ge=1, le=5)
    dever_estado: Optional[Any] = None
    vida_interior: Optional[Any] = None
    evangelizacao_disposicao: Optional[str] = Field(None, max_length=3000)
    evangelizacao_momentos: Optional[List[EvangelizacaoMomentoItem]] = None
    plano_diario: Optional[dict[str, PlanoDiarioItem]] = None
    observacoes: Optional[str] = Field(None, max_length=2000)


class ProjetoVidaSemanasUpdate(BaseModel):
    dever_estado: Optional[Any] = None
    vida_interior: Optional[Any] = None
    evangelizacao_disposicao: Optional[str] = Field(None, max_length=3000)
    evangelizacao_momentos: Optional[List[EvangelizacaoMomentoItem]] = None
    plano_diario: Optional[dict[str, PlanoDiarioItem]] = None
    observacoes: Optional[str] = Field(None, max_length=2000)


class ProjetoVidaSemanasOut(BaseModel):
    id: UUID
    numero_semana: int
    dever_estado: Optional[Any] = None
    vida_interior: Optional[Any] = None
    evangelizacao_disposicao: Optional[str] = None
    evangelizacao_momentos: Optional[List[EvangelizacaoMomentoItem]] = None
    plano_diario: Optional[dict] = None
    observacoes: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class ProjetoVidaSemanasSummary(BaseModel):
    """Sumário sem plano_diario para listagem."""
    id: UUID
    numero_semana: int
    created_at: datetime

    model_config = {"from_attributes": True}

    model_config = {"from_attributes": True}
