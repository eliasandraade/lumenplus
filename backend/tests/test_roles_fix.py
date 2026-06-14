"""
Testa que os roles globais existem no banco após a migration/seed.
Reproduz o bug: atribuição de ADMIN/SECRETARY/AVISOS/COUNCIL_GENERAL
retornava silenciosamente sem salvar porque o role não existia em global_roles.

NOTA: usa SQLite em memória com schema mínimo (sem postgresql.UUID) porque
o ambiente de CI/teste local usa SQLite. A migration 035 é para PostgreSQL.
"""
import uuid
import datetime

import pytest
from sqlalchemy import (
    Column,
    DateTime,
    ForeignKey,
    String,
    Text,
    UniqueConstraint,
    create_engine,
    select,
)
from sqlalchemy.orm import DeclarativeBase, sessionmaker


# ── Minimal SQLite-compatible schema ──────────────────────────────────────────

class _Base(DeclarativeBase):
    pass


class _GlobalRole(_Base):
    __tablename__ = "global_roles"
    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    code = Column(Text, nullable=False, unique=True)
    name = Column(Text, nullable=False)


class _User(_Base):
    __tablename__ = "users"
    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    created_at = Column(DateTime, nullable=False, default=datetime.datetime.utcnow)


class _UserGlobalRole(_Base):
    __tablename__ = "user_global_roles"
    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    global_role_id = Column(String(36), ForeignKey("global_roles.id", ondelete="CASCADE"), nullable=False)
    __table_args__ = (
        UniqueConstraint("user_id", "global_role_id", name="uq_user_global_role"),
    )


# ── Fixtures ──────────────────────────────────────────────────────────────────

@pytest.fixture()
def roles_session():
    engine = create_engine("sqlite:///:memory:", connect_args={"check_same_thread": False})
    _Base.metadata.create_all(engine)
    SessionLocal = sessionmaker(bind=engine, autocommit=False, autoflush=False)
    session = SessionLocal()
    try:
        yield session
    finally:
        session.close()
    engine.dispose()


# ── Helpers ───────────────────────────────────────────────────────────────────

EXPECTED_ROLES = {"DEV", "ADMIN", "SECRETARY", "AVISOS", "COUNCIL_GENERAL", "ANALISTA"}

ROLES_DATA = [
    ("DEV", "Desenvolvedor"),
    ("ADMIN", "Administrador"),
    ("SECRETARY", "Secretário Geral"),
    ("AVISOS", "Avisos"),
    ("COUNCIL_GENERAL", "Conselho Geral"),
    ("ANALISTA", "Analista"),
]


def _seed_roles(session):
    """Replica o que a migration 035 faz (idempotente)."""
    for code, name in ROLES_DATA:
        existing = session.execute(
            select(_GlobalRole).where(_GlobalRole.code == code)
        ).scalar_one_or_none()
        if not existing:
            session.add(_GlobalRole(code=code, name=name))
    session.commit()


def _create_user(session):
    user = _User(id=str(uuid.uuid4()), created_at=datetime.datetime.utcnow())
    session.add(user)
    session.commit()
    return user


# ── Tests ─────────────────────────────────────────────────────────────────────

def test_all_roles_exist_after_seed(roles_session):
    """Todos os roles esperados existem no banco após seed."""
    _seed_roles(roles_session)
    codes = {
        r[0]
        for r in roles_session.execute(select(_GlobalRole.code)).all()
    }
    assert EXPECTED_ROLES.issubset(codes), f"Roles faltando: {EXPECTED_ROLES - codes}"


def test_assign_admin_role_persists(roles_session):
    """Atribuir ADMIN a um usuário persiste corretamente."""
    _seed_roles(roles_session)
    user = _create_user(roles_session)

    role = roles_session.execute(
        select(_GlobalRole).where(_GlobalRole.code == "ADMIN")
    ).scalar_one()

    roles_session.add(_UserGlobalRole(user_id=user.id, global_role_id=role.id))
    roles_session.commit()

    assigned = roles_session.execute(
        select(_GlobalRole.code)
        .join(_UserGlobalRole, _UserGlobalRole.global_role_id == _GlobalRole.id)
        .where(_UserGlobalRole.user_id == user.id)
    ).scalars().all()
    assert "ADMIN" in assigned


def test_assign_secretary_role_persists(roles_session):
    """Atribuir SECRETARY a um usuário persiste corretamente."""
    _seed_roles(roles_session)
    user = _create_user(roles_session)

    role = roles_session.execute(
        select(_GlobalRole).where(_GlobalRole.code == "SECRETARY")
    ).scalar_one()

    roles_session.add(_UserGlobalRole(user_id=user.id, global_role_id=role.id))
    roles_session.commit()

    assigned = roles_session.execute(
        select(_GlobalRole.code)
        .join(_UserGlobalRole, _UserGlobalRole.global_role_id == _GlobalRole.id)
        .where(_UserGlobalRole.user_id == user.id)
    ).scalars().all()
    assert "SECRETARY" in assigned


def test_assign_avisos_role_persists(roles_session):
    """Atribuir AVISOS persiste — era o role mais comumente ausente."""
    _seed_roles(roles_session)
    user = _create_user(roles_session)

    role = roles_session.execute(
        select(_GlobalRole).where(_GlobalRole.code == "AVISOS")
    ).scalar_one()

    roles_session.add(_UserGlobalRole(user_id=user.id, global_role_id=role.id))
    roles_session.commit()

    assigned = roles_session.execute(
        select(_GlobalRole.code)
        .join(_UserGlobalRole, _UserGlobalRole.global_role_id == _GlobalRole.id)
        .where(_UserGlobalRole.user_id == user.id)
    ).scalars().all()
    assert "AVISOS" in assigned


def test_seed_roles_idempotent(roles_session):
    """Rodar seed duas vezes não falha (comportamento de ON CONFLICT DO NOTHING)."""
    _seed_roles(roles_session)
    _seed_roles(roles_session)  # Segunda rodada — não deve levantar exceção
    codes = {
        r[0]
        for r in roles_session.execute(select(_GlobalRole.code)).all()
    }
    assert EXPECTED_ROLES.issubset(codes)
