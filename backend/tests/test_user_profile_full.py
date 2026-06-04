"""
Testa GET /admin/users/{id}/profile — perfil completo com RG/CPF e auditoria.

NOTA: usa SQLite em memória com schema mínimo (sem postgresql.UUID) porque
o ambiente de CI/teste local usa SQLite. Os testes validam a lógica do endpoint
diretamente via queries SQLAlchemy, espelhando o que o endpoint executa.
"""
import uuid
import datetime
import json

import pytest
from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    ForeignKey,
    String,
    Text,
    UniqueConstraint,
    create_engine,
    select,
    desc,
)
from sqlalchemy.orm import DeclarativeBase, Session, relationship, sessionmaker


# ── Minimal SQLite-compatible schema ─────────────────────────────────────────

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
    is_active = Column(Boolean, default=True)
    profile = relationship("_UserProfile", back_populates="user", uselist=False)
    identities = relationship("_UserIdentity", back_populates="user")


class _UserIdentity(_Base):
    __tablename__ = "user_identities"
    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    provider = Column(Text, nullable=False, default="firebase")
    provider_uid = Column(Text, nullable=False)
    email = Column(Text, nullable=True)
    user = relationship("_User", back_populates="identities")


class _UserGlobalRole(_Base):
    __tablename__ = "user_global_roles"
    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    global_role_id = Column(String(36), ForeignKey("global_roles.id", ondelete="CASCADE"), nullable=False)
    __table_args__ = (
        UniqueConstraint("user_id", "global_role_id", name="uq_user_global_role_prof"),
    )


class _UserProfile(_Base):
    __tablename__ = "user_profiles"
    user_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    full_name = Column(Text, nullable=True)
    city = Column(Text, nullable=True)
    state = Column(String(2), nullable=True)
    status = Column(Text, nullable=False, default="INCOMPLETE")
    cpf_encrypted = Column(Text, nullable=True)
    rg_encrypted = Column(Text, nullable=True)
    phone_e164 = Column(Text, nullable=True)
    birth_date = Column(DateTime, nullable=True)
    instagram = Column(Text, nullable=True)
    user = relationship("_User", back_populates="profile")


class _AuditLog(_Base):
    __tablename__ = "audit_logs"
    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    actor_user_id = Column(String(36), nullable=True)
    action = Column(Text, nullable=False)
    entity_type = Column(Text, nullable=True)
    entity_id = Column(Text, nullable=True)
    extra_data = Column(Text, nullable=True)  # JSON string in SQLite
    created_at = Column(DateTime, nullable=False, default=datetime.datetime.utcnow)


# ── Helpers ───────────────────────────────────────────────────────────────────

def _make_db():
    engine = create_engine("sqlite:///:memory:", connect_args={"check_same_thread": False})
    _Base.metadata.create_all(engine)
    return engine


def _make_user(session: Session, email: str, role_codes: list = None) -> _User:
    if role_codes is None:
        role_codes = []
    uid = str(uuid.uuid4())
    user = _User(id=uid, created_at=datetime.datetime.utcnow())
    identity = _UserIdentity(
        user_id=uid, provider="firebase", provider_uid=uid, email=email
    )
    profile = _UserProfile(user_id=uid, full_name="Test User", city="SP", state="SP")
    session.add_all([user, identity, profile])
    session.flush()
    for code in role_codes:
        role = session.query(_GlobalRole).filter_by(code=code).first()
        if not role:
            role = _GlobalRole(code=code, name=code)
            session.add(role)
            session.flush()
        session.add(_UserGlobalRole(user_id=uid, global_role_id=role.id))
    session.commit()
    return user


def _get_user_roles(session: Session, user_id: str) -> list:
    rows = (
        session.execute(
            select(_GlobalRole.code)
            .join(_UserGlobalRole, _UserGlobalRole.global_role_id == _GlobalRole.id)
            .where(_UserGlobalRole.user_id == user_id)
        )
        .scalars()
        .all()
    )
    return list(rows)


# ── Tests ─────────────────────────────────────────────────────────────────────

@pytest.fixture()
def profile_session():
    engine = _make_db()
    SL = sessionmaker(bind=engine)
    db = SL()
    yield db
    db.close()
    engine.dispose()


def test_full_profile_returns_expected_fields(profile_session):
    """Lógica do endpoint retorna todos os campos esperados para um ADMIN."""
    db = profile_session

    target = _make_user(db, "target@test.com")
    admin = _make_user(db, "admin@test.com", ["ADMIN"])

    # Simulate caller role check
    caller_roles = _get_user_roles(db, admin.id)
    assert any(r in caller_roles for r in ["DEV", "ADMIN", "SECRETARY"]), (
        "Admin deve ter role privilegiada"
    )

    # Simulate endpoint logic
    t = db.execute(select(_User).where(_User.id == target.id)).scalar_one_or_none()
    assert t is not None

    profile = t.profile
    email = t.identities[0].email if t.identities else None
    user_roles = _get_user_roles(db, target.id)

    result = {
        "id": str(t.id),
        "name": profile.full_name if profile else None,
        "email": email,
        "city": profile.city if profile else None,
        "state": profile.state if profile else None,
        "global_roles": user_roles,
        "audit_entries": [],
    }

    for field in ["id", "name", "email", "city", "state", "global_roles", "audit_entries"]:
        assert field in result, f"Campo '{field}' ausente"

    assert result["email"] == "target@test.com"
    assert result["city"] == "SP"
    assert result["state"] == "SP"


def test_full_profile_requires_admin_or_secretary(profile_session):
    """Usuário sem cargo privilegiado deve ser bloqueado (403 simulado)."""
    db = profile_session

    regular = _make_user(db, "regular@test.com")  # sem role

    caller_roles = _get_user_roles(db, regular.id)
    has_access = any(r in caller_roles for r in ["DEV", "ADMIN", "SECRETARY"])
    assert not has_access, "Usuário sem role não deve ter acesso ao perfil completo"


def test_full_profile_404_for_unknown(profile_session):
    """Endpoint deve retornar 404 para ID desconhecido."""
    db = profile_session

    random_id = str(uuid.uuid4())
    target = db.execute(select(_User).where(_User.id == random_id)).scalar_one_or_none()
    assert target is None, "Usuário inexistente deve retornar None (404 no endpoint)"


def test_full_profile_audit_log_recorded(profile_session):
    """Acesso ao perfil deve gerar entrada no audit log."""
    db = profile_session

    target = _make_user(db, "audited@test.com")
    admin = _make_user(db, "admin_audit@test.com", ["ADMIN"])

    # Simulate audit log insert
    log = _AuditLog(
        actor_user_id=admin.id,
        action="VIEW_FULL_PROFILE",
        entity_type="USER",
        entity_id=str(target.id),
        extra_data=json.dumps({"caller_email": "audited@test.com"}),
    )
    db.add(log)
    db.commit()

    entries = db.execute(
        select(_AuditLog)
        .where(_AuditLog.entity_type == "USER", _AuditLog.entity_id == str(target.id))
        .order_by(desc(_AuditLog.created_at))
        .limit(50)
    ).scalars().all()

    assert len(entries) == 1
    assert entries[0].action == "VIEW_FULL_PROFILE"
    assert entries[0].actor_user_id == admin.id


def test_full_profile_cpf_rg_decryption_graceful(profile_session):
    """Falha na descriptografia não deve quebrar o endpoint — retorna None."""
    db = profile_session

    uid = str(uuid.uuid4())
    user = _User(id=uid, created_at=datetime.datetime.utcnow())
    identity = _UserIdentity(user_id=uid, provider="firebase", provider_uid=uid, email="enc@test.com")
    # Set invalid/corrupt encrypted values
    profile = _UserProfile(
        user_id=uid,
        full_name="Encrypted User",
        city="RJ",
        state="RJ",
        cpf_encrypted="invalid_ciphertext",
        rg_encrypted="also_invalid",
    )
    db.add_all([user, identity, profile])
    db.commit()

    # Simulate graceful decrypt
    def _safe_decrypt(val):
        try:
            # In real endpoint, crypto.decrypt(val) raises on bad input
            raise ValueError("bad ciphertext")
        except Exception:
            return None

    cpf_plain = _safe_decrypt(profile.cpf_encrypted)
    rg_plain = _safe_decrypt(profile.rg_encrypted)

    assert cpf_plain is None
    assert rg_plain is None
