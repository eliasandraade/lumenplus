"""
Testa os filtros avançados de GET /admin/users:
cidade, estado, realidade_vocacional, ministerio_id, estado_civil, profile_status.

NOTA: usa SQLite em memória com schema mínimo (sem postgresql.UUID) porque
o ambiente de CI/teste local usa SQLite. Os testes validam a lógica de filtragem
diretamente via queries SQLAlchemy, espelhando o que o endpoint executa.
"""
import uuid
import datetime

import pytest
from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
    create_engine,
    select,
)
from sqlalchemy.orm import DeclarativeBase, Session, relationship, sessionmaker


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
        UniqueConstraint("user_id", "global_role_id", name="uq_user_global_role_flt"),
    )


class _ProfileCatalog(_Base):
    __tablename__ = "profile_catalogs"
    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    code = Column(Text, nullable=False, unique=True)
    name = Column(Text, nullable=False)
    items = relationship("_ProfileCatalogItem", back_populates="catalog")


class _ProfileCatalogItem(_Base):
    __tablename__ = "profile_catalog_items"
    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    catalog_id = Column(String(36), ForeignKey("profile_catalogs.id", ondelete="CASCADE"), nullable=False)
    code = Column(Text, nullable=False)
    label = Column(Text, nullable=False)
    sort_order = Column(Integer, default=0)
    catalog = relationship("_ProfileCatalog", back_populates="items")


class _UserProfile(_Base):
    __tablename__ = "user_profiles"
    user_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    full_name = Column(Text, nullable=True)
    city = Column(Text, nullable=True)
    state = Column(String(2), nullable=True)
    status = Column(Text, nullable=False, default="INCOMPLETE")
    vocational_reality_item_id = Column(String(36), ForeignKey("profile_catalog_items.id"), nullable=True)
    marital_status_item_id = Column(String(36), ForeignKey("profile_catalog_items.id"), nullable=True)
    interested_ministry_id = Column(String(36), nullable=True)
    user = relationship("_User", back_populates="profile")
    vocational_reality_item = relationship("_ProfileCatalogItem", foreign_keys=[vocational_reality_item_id])
    marital_status_item = relationship("_ProfileCatalogItem", foreign_keys=[marital_status_item_id])


# ── Fixtures ──────────────────────────────────────────────────────────────────

@pytest.fixture()
def filter_session():
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

def _create_user(db: Session, email: str, **profile_kwargs) -> _User:
    uid = str(uuid.uuid4())
    user = _User(id=uid, created_at=datetime.datetime.utcnow(), is_active=True)
    identity = _UserIdentity(user_id=uid, provider="firebase", provider_uid=uid, email=email)
    profile = _UserProfile(user_id=uid, full_name=profile_kwargs.pop("full_name", "Test User"), **profile_kwargs)
    db.add_all([user, identity, profile])
    db.commit()
    return user


def _seed_catalog_item(db: Session, catalog_code: str, item_code: str, label: str) -> _ProfileCatalogItem:
    cat = db.execute(select(_ProfileCatalog).where(_ProfileCatalog.code == catalog_code)).scalar_one_or_none()
    if not cat:
        cat = _ProfileCatalog(id=str(uuid.uuid4()), code=catalog_code, name=catalog_code)
        db.add(cat)
        db.flush()
    item = db.execute(
        select(_ProfileCatalogItem).where(
            _ProfileCatalogItem.catalog_id == cat.id,
            _ProfileCatalogItem.code == item_code,
        )
    ).scalar_one_or_none()
    if not item:
        item = _ProfileCatalogItem(
            id=str(uuid.uuid4()), catalog_id=cat.id, code=item_code, label=label, sort_order=0
        )
        db.add(item)
        db.flush()
    db.commit()
    return item


def _apply_filters(stmt, db, cidade="", estado="", profile_status="",
                   realidade_vocacional="", estado_civil="", ministerio_id=""):
    """Replica a lógica de filtragem do endpoint list_users."""
    if cidade:
        stmt = stmt.where(_UserProfile.city.ilike(f"%{cidade}%"))
    if estado:
        stmt = stmt.where(_UserProfile.state.ilike(f"%{estado}%"))
    if profile_status:
        stmt = stmt.where(_UserProfile.status == profile_status)

    if realidade_vocacional:
        voc_item = db.execute(
            select(_ProfileCatalogItem)
            .join(_ProfileCatalog)
            .where(
                _ProfileCatalog.code == "VOCATIONAL_REALITY",
                _ProfileCatalogItem.code == realidade_vocacional,
            )
        ).scalar_one_or_none()
        if voc_item:
            stmt = stmt.where(_UserProfile.vocational_reality_item_id == voc_item.id)
        else:
            return None  # Sem resultados

    if estado_civil:
        ec_item = db.execute(
            select(_ProfileCatalogItem)
            .join(_ProfileCatalog)
            .where(
                _ProfileCatalog.code == "MARITAL_STATUS",
                _ProfileCatalogItem.code == estado_civil,
            )
        ).scalar_one_or_none()
        if ec_item:
            stmt = stmt.where(_UserProfile.marital_status_item_id == ec_item.id)
        else:
            return None  # Sem resultados

    if ministerio_id:
        stmt = stmt.where(_UserProfile.interested_ministry_id == ministerio_id)

    return stmt


def _query_users(db: Session, **filter_kwargs):
    base = (
        select(_User)
        .outerjoin(_UserProfile, _User.id == _UserProfile.user_id)
        .outerjoin(_UserIdentity, _User.id == _UserIdentity.user_id)
        .where(_User.is_active == True)  # noqa: E712
    )
    stmt = _apply_filters(base, db, **filter_kwargs)
    if stmt is None:
        return []
    users = db.execute(stmt).scalars().unique().all()
    result = []
    for u in users:
        email = u.identities[0].email if u.identities else None
        result.append({"id": u.id, "email": email, "profile": u.profile})
    return result


# ── Tests ─────────────────────────────────────────────────────────────────────

def test_filter_by_city(filter_session: Session):
    """Filtro por cidade retorna apenas usuários da cidade especificada."""
    _create_user(filter_session, "sp@test.com", city="São Paulo", state="SP")
    _create_user(filter_session, "rj@test.com", city="Rio de Janeiro", state="RJ")

    users = _query_users(filter_session, cidade="São Paulo")
    emails = [u["email"] for u in users]

    assert "sp@test.com" in emails
    assert "rj@test.com" not in emails


def test_filter_by_state(filter_session: Session):
    """Filtro por estado (UF) retorna apenas usuários do estado especificado."""
    _create_user(filter_session, "sp2@test.com", city="Campinas", state="SP")
    _create_user(filter_session, "mg@test.com", city="BH", state="MG")

    users = _query_users(filter_session, estado="SP")
    emails = [u["email"] for u in users]

    assert "sp2@test.com" in emails
    assert "mg@test.com" not in emails


def test_filter_by_profile_status(filter_session: Session):
    """Filtro por profile_status retorna apenas usuários com o status especificado."""
    _create_user(filter_session, "complete@test.com", status="COMPLETE")
    _create_user(filter_session, "incomplete@test.com", status="INCOMPLETE")

    users = _query_users(filter_session, profile_status="COMPLETE")
    emails = [u["email"] for u in users]

    assert "complete@test.com" in emails
    assert "incomplete@test.com" not in emails


def test_filter_by_vocational_reality(filter_session: Session):
    """Filtro por realidade_vocacional retorna apenas usuários com o item especificado."""
    item = _seed_catalog_item(filter_session, "VOCATIONAL_REALITY", "VOCACIONAL", "Vocacional")
    _create_user(filter_session, "voc@test.com", vocational_reality_item_id=item.id)
    _create_user(filter_session, "other@test.com")

    users = _query_users(filter_session, realidade_vocacional="VOCACIONAL")
    emails = [u["email"] for u in users]

    assert "voc@test.com" in emails
    assert "other@test.com" not in emails


def test_filter_by_vocational_reality_nonexistent_code(filter_session: Session):
    """Filtro com código inexistente retorna lista vazia."""
    _create_user(filter_session, "user@test.com")

    users = _query_users(filter_session, realidade_vocacional="CODIGO_INEXISTENTE")
    assert users == []


def test_filter_by_estado_civil(filter_session: Session):
    """Filtro por estado_civil retorna apenas usuários com o item especificado."""
    item = _seed_catalog_item(filter_session, "MARITAL_STATUS", "CASADO", "Casado")
    _create_user(filter_session, "casado@test.com", marital_status_item_id=item.id)
    _create_user(filter_session, "solteiro@test.com")

    users = _query_users(filter_session, estado_civil="CASADO")
    emails = [u["email"] for u in users]

    assert "casado@test.com" in emails
    assert "solteiro@test.com" not in emails


def test_filter_by_ministerio_id(filter_session: Session):
    """Filtro por ministerio_id retorna apenas usuários vinculados ao ministério."""
    min_id = str(uuid.uuid4())
    _create_user(filter_session, "membro@test.com", interested_ministry_id=min_id)
    _create_user(filter_session, "outro@test.com")

    users = _query_users(filter_session, ministerio_id=min_id)
    emails = [u["email"] for u in users]

    assert "membro@test.com" in emails
    assert "outro@test.com" not in emails


def test_combined_filters(filter_session: Session):
    """Filtros combinados (cidade + estado) funcionam corretamente."""
    _create_user(filter_session, "sp_sp@test.com", city="São Paulo", state="SP")
    _create_user(filter_session, "camp_sp@test.com", city="Campinas", state="SP")
    _create_user(filter_session, "rj_rj@test.com", city="Rio de Janeiro", state="RJ")

    users = _query_users(filter_session, cidade="São Paulo", estado="SP")
    emails = [u["email"] for u in users]

    assert "sp_sp@test.com" in emails
    assert "camp_sp@test.com" not in emails
    assert "rj_rj@test.com" not in emails


def test_no_filters_returns_all_active(filter_session: Session):
    """Sem filtros, todos os usuários ativos são retornados."""
    _create_user(filter_session, "a@test.com", city="SP")
    _create_user(filter_session, "b@test.com", city="RJ")

    users = _query_users(filter_session)
    emails = [u["email"] for u in users]

    assert "a@test.com" in emails
    assert "b@test.com" in emails
