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
    db.flush()

    db.add(ProjetoVidaComunidade(projeto_id=projeto.id))
    db.add(ProjetoVidaCuidado(projeto_id=projeto.id))

    db.commit()
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
        return PinVerifyResponse(valid=True)
    return PinVerifyResponse(valid=_hash_pin(body.pin, user.id) == projeto.pin_hash)
