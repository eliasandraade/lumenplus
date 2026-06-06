"""
Projeto de Vida Mensal — API Routes
======================================
Dados pessoais sensíveis: acesso restrito ao próprio usuário.
Conteúdo textual NÃO entra em audit logs.

Modelo de segurança do PIN:
  O PIN é um bloqueio visual local (screen-lock). Protege contra acesso físico
  ao dispositivo (alguém que pega o celular desbloqueado). NÃO é um controle
  de acesso server-side: qualquer cliente autenticado como o próprio usuário
  pode chamar as rotas diretamente. Isso é design intencional — o dado já é
  protegido pela autenticação Firebase. O PIN acrescenta conveniência, não
  sigilo absoluto server-side.
"""

import hashlib
import hmac
from datetime import datetime, timezone
from typing import Any
from uuid import UUID

from fastapi import APIRouter, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.api.deps import CurrentUser, DBSession
from app.db.models import (
    ProfileCatalogItem,
    ProjetoVidaComunidade,
    ProjetoVidaCuidado,
    ProjetoVidaCompromisso,
    ProjetoVidaMensal,
    ProjetoVidaPratica,
    ProjetoVidaRevisao,
    UserIdentity,
    UserProfile,
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
    # comunidade e cuidado: JSON arrays → Pydantic valida cada item da lista
    return ProjetoVidaMensalFull(
        id=p.id,
        mes=p.mes,
        ano=p.ano,
        has_pin=p.pin_hash is not None,
        concluido=p.concluido,
        observacoes_mes=p.observacoes_mes,
        intencao=p.intencao,
        comunidade=ComunidadeData(
            partilha_acompanhador=p.comunidade.partilha_acompanhador or [],
            encontro_familia=p.comunidade.encontro_familia or [],
            dias_grupo=p.comunidade.dias_grupo or [],
            outros=p.comunidade.outros or [],
        ) if p.comunidade else None,
        cuidado=CuidadoData(
            consultas=p.cuidado.consultas or [],
            exames=p.cuidado.exames or [],
            descanso=p.cuidado.descanso or [],
            outros=p.cuidado.outros or [],
        ) if p.cuidado else None,
        compromissos=[CompromissoOut.model_validate(c) for c in p.compromissos],
        praticas=[PraticaOut.model_validate(pr) for pr in p.praticas],
        revisao=RevisaoOut.model_validate(p.revisao) if p.revisao else None,
        created_at=p.created_at,
        updated_at=p.updated_at,
    )


# ── Endpoints ──────────────────────────────────────────────────────────────


@router.get("/atual", response_model=ProjetoVidaMensalFull | None)
def get_atual(
    user: CurrentUser,
    db: DBSession,
    mes: int | None = None,
    ano: int | None = None,
) -> Any:
    """Retorna o projeto do mês/ano corrente ou null.

    Aceita ?mes=&ano= opcionais para usar o horário local do cliente
    (evita divergência UTC vs fuso horário do usuário).
    Se omitidos, usa UTC do servidor.
    """
    if mes is None or ano is None:
        now = datetime.now(timezone.utc)
        mes = mes or now.month
        ano = ano or now.year
    row = db.execute(
        select(ProjetoVidaMensal.id).where(
            ProjetoVidaMensal.user_id == user.id,
            ProjetoVidaMensal.mes == mes,
            ProjetoVidaMensal.ano == ano,
        )
    ).scalar_one_or_none()
    return _to_full(_load(db, row, user.id)) if row else None


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


@router.get("/contexto-vocacional")
def get_contexto_vocacional(
    user: CurrentUser,
    db: DBSession,
) -> Any:
    """Retorna códigos vocacionais do perfil para personalização do wizard."""
    profile = db.execute(
        select(UserProfile).where(UserProfile.user_id == user.id)
    ).scalar_one_or_none()

    vocational_code: str | None = None
    life_state_code: str | None = None

    if profile:
        if profile.vocational_reality_item_id:
            item = db.execute(
                select(ProfileCatalogItem).where(
                    ProfileCatalogItem.id == profile.vocational_reality_item_id
                )
            ).scalar_one_or_none()
            vocational_code = item.code if item else None

        if profile.life_state_item_id:
            item = db.execute(
                select(ProfileCatalogItem).where(
                    ProfileCatalogItem.id == profile.life_state_item_id
                )
            ).scalar_one_or_none()
            life_state_code = item.code if item else None

    perfil_incompleto = vocational_code is None or life_state_code is None

    # Resolve nome: UserProfile.full_name → identity email → empty string
    # Query explícita para evitar acesso lazy em sessão fechada
    nome: str = ""
    if profile and profile.full_name:
        nome = profile.full_name
    else:
        identity_row = db.execute(
            select(UserIdentity.email)
            .where(UserIdentity.user_id == user.id, UserIdentity.email.is_not(None))
            .limit(1)
        ).scalar_one_or_none()
        if identity_row:
            nome = identity_row

    return {
        "vocational_reality_code": vocational_code,
        "life_state_code": life_state_code,
        "perfil_incompleto": perfil_incompleto,
        "nome": nome,
    }


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
        pin_hash=_hash_pin(body.pin, user.id) if body.pin else None,
        intencao=body.intencao,
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
    """Atualiza campos escalares + comunidade + cuidado + listas (replace completo).

    Nota: PIN só pode ser definido na criação e não pode ser alterado posteriormente.
    """
    projeto = _load(db, projeto_id, user.id)

    if body.observacoes_mes is not None:
        projeto.observacoes_mes = body.observacoes_mes
    if body.concluido is not None:
        projeto.concluido = body.concluido
    if body.intencao is not None:
        projeto.intencao = body.intencao

    if body.comunidade is not None:
        if not projeto.comunidade:
            db.add(ProjetoVidaComunidade(projeto_id=projeto.id))
            db.flush()
            db.refresh(projeto)
        # Replace completo: comunidade usa listas JSON (não campos escalares simples)
        dump = body.comunidade.model_dump()
        for field, val in dump.items():
            setattr(projeto.comunidade, field, val)

    if body.cuidado is not None:
        if not projeto.cuidado:
            db.add(ProjetoVidaCuidado(projeto_id=projeto.id))
            db.flush()
            db.refresh(projeto)
        # Replace completo
        dump = body.cuidado.model_dump()
        for field, val in dump.items():
            setattr(projeto.cuidado, field, val)

    # Garante que updated_at é atualizado mesmo quando apenas listas (compromissos/praticas) mudam,
    # pois o onupdate do SQLAlchemy só dispara quando colunas escalares do próprio objeto são alteradas.
    projeto.updated_at = datetime.now(timezone.utc)

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
    for field, val in body.model_dump(exclude_none=True).items():
        setattr(rev, field, val)

    db.commit()
    return _to_full(_load(db, projeto_id, user.id))


PIN_MAX_FALHAS = 5          # tentativas antes de bloquear
PIN_BLOQUEIO_MINUTOS = 5   # duração do bloqueio


@router.post("/{projeto_id}/pin/verificar", response_model=PinVerifyResponse)
def verificar_pin(
    projeto_id: UUID, body: PinVerifyRequest, user: CurrentUser, db: DBSession
) -> Any:
    """Verifica PIN sem revelar hash. Retorna {valid: bool}.

    Rate limit por projeto: após 5 falhas consecutivas, bloqueia por 5 minutos.
    Sem PIN configurado: qualquer requisição é válida (sem restrição de acesso).
    """
    from datetime import timedelta

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
        # Sem PIN configurado: qualquer requisição é válida (sem restrição de acesso)
        return PinVerifyResponse(valid=True)

    # Verifica bloqueio por excesso de falhas
    now = datetime.now(timezone.utc)
    if projeto.pin_bloqueado_ate and now < projeto.pin_bloqueado_ate:
        raise HTTPException(
            status_code=429,
            detail={
                "error": "pin_locked",
                "message": "PIN bloqueado por excesso de tentativas. Tente novamente em alguns minutos.",
            },
        )

    # Verifica o PIN
    valido = hmac.compare_digest(_hash_pin(body.pin, user.id), projeto.pin_hash)

    if valido:
        projeto.pin_falhas_consecutivas = 0
        projeto.pin_bloqueado_ate = None
    else:
        projeto.pin_falhas_consecutivas = (projeto.pin_falhas_consecutivas or 0) + 1
        if projeto.pin_falhas_consecutivas >= PIN_MAX_FALHAS:
            projeto.pin_bloqueado_ate = now + timedelta(minutes=PIN_BLOQUEIO_MINUTOS)
            projeto.pin_falhas_consecutivas = 0

    db.commit()
    return PinVerifyResponse(valid=valido)
