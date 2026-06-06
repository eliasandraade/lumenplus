"""
Projeto de Vida Semanal — API Routes
=====================================
Dados pessoais sensíveis: acesso restrito ao próprio usuário.
Conteúdo textual NÃO entra em audit logs.
"""

from typing import Any
from uuid import UUID

from fastapi import APIRouter, HTTPException
from sqlalchemy import select

from app.api.deps import CurrentUser, DBSession
from app.db.models import ProjetoVidaMensal, ProjetoVidaSemanal
from app.schemas.projeto_vida_mensal import (
    ProjetoVidaSemanasOut,
    ProjetoVidaSemanasUpdate,
)

router = APIRouter(prefix="/projeto-vida-semanal", tags=["Projeto de Vida Semanal"])


def _load_semanal(db: DBSession, semanal_id: UUID, user_id: UUID) -> ProjetoVidaSemanal:
    """Carrega semanal verificando propriedade via JOIN com o projeto mensal."""
    result = db.execute(
        select(ProjetoVidaSemanal)
        .join(ProjetoVidaMensal, ProjetoVidaMensal.id == ProjetoVidaSemanal.projeto_id)
        .where(
            ProjetoVidaSemanal.id == semanal_id,
            ProjetoVidaMensal.user_id == user_id,
        )
    ).scalar_one_or_none()
    if not result:
        raise HTTPException(
            status_code=404,
            detail={"error": "not_found", "message": "Semana não encontrada"},
        )
    return result


@router.get("/{semanal_id}", response_model=ProjetoVidaSemanasOut)
def get_semanal(semanal_id: UUID, user: CurrentUser, db: DBSession) -> Any:
    """Retorna a semana completa incluindo plano_diario."""
    return _load_semanal(db, semanal_id, user.id)


@router.put("/{semanal_id}", response_model=ProjetoVidaSemanasOut)
def update_semanal(
    semanal_id: UUID, body: ProjetoVidaSemanasUpdate, user: CurrentUser, db: DBSession
) -> Any:
    """Atualiza a semana.

    plano_diario usa MERGE PARCIAL por chave de dia:
    atualizar 'seg' não apaga 'sex'.
    """
    semanal = _load_semanal(db, semanal_id, user.id)

    if body.dever_estado is not None:
        semanal.dever_estado = body.dever_estado
    if body.vida_interior is not None:
        semanal.vida_interior = body.vida_interior
    if body.evangelizacao_disposicao is not None:
        semanal.evangelizacao_disposicao = body.evangelizacao_disposicao
    if body.evangelizacao_momentos is not None:
        semanal.evangelizacao_momentos = [m.model_dump() for m in body.evangelizacao_momentos]
    if body.observacoes is not None:
        semanal.observacoes = body.observacoes

    # Merge parcial do plano_diario: cada dia é independente
    if body.plano_diario is not None:
        current = dict(semanal.plano_diario) if semanal.plano_diario else {}
        for dia, item in body.plano_diario.items():
            existing_day = current.get(dia) or {}
            updated_day = {**existing_day, **item.model_dump(exclude_none=True)}
            current[dia] = updated_day
        semanal.plano_diario = current

    db.commit()
    db.refresh(semanal)
    return semanal
