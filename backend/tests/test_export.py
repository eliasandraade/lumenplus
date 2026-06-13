"""
Testa o fluxo de exportação de dados:
- Sem dados sensíveis → CSV gerado imediatamente (status GENERATED)
- Com dados sensíveis → fica PENDING, requer aprovação
- Aprovação por COUNCIL_GENERAL → CSV gerado
- Download só funciona no status GENERATED

NOTA: usa SQLite com schema mínimo (sem postgresql.UUID/ARRAY/JSONB) porque
o ambiente de CI/teste local usa SQLite. Os testes validam a lógica do endpoint
diretamente, espelhando o que os endpoints executam.
"""
import csv
import io
import os
import tempfile
import uuid
import datetime

import pytest
from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    ForeignKey,
    JSON,
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
        UniqueConstraint("user_id", "global_role_id", name="uq_user_global_role_exp"),
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
    extra_data = Column(JSON, nullable=True)
    created_at = Column(DateTime, nullable=False, default=datetime.datetime.utcnow)


class _DataExportRequest(_Base):
    __tablename__ = "data_export_requests"
    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    requested_by = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    status = Column(Text, nullable=False, default="PENDING")
    fields_requested = Column(JSON, nullable=False)  # stored as JSON array in SQLite
    filters_json = Column(JSON, nullable=True)
    has_sensitive = Column(Boolean, nullable=False, default=False)
    approved_by = Column(String(36), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    approved_at = Column(DateTime, nullable=True)
    file_path = Column(Text, nullable=True)
    expires_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, nullable=False, default=datetime.datetime.utcnow)


# ── Constants ─────────────────────────────────────────────────────────────────

SENSITIVE_FIELDS = {"cpf", "rg"}
ALLOWED_FIELDS = {
    "name", "email", "phone", "city", "state", "birth_date",
    "instagram", "profile_status", "cpf", "rg",
}
EXPORT_TTL_HOURS = 24


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
    identity = _UserIdentity(user_id=uid, provider="firebase", provider_uid=uid, email=email)
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


def _require_export_permission(session: Session, user_id: str) -> bool:
    roles = _get_user_roles(session, user_id)
    return any(r in roles for r in ["DEV", "ADMIN", "SECRETARY"])


def _require_approval_permission(session: Session, user_id: str) -> bool:
    roles = _get_user_roles(session, user_id)
    return any(r in roles for r in ["DEV", "ADMIN", "COUNCIL_GENERAL"])


def _generate_csv(session: Session, fields: list) -> str:
    users = session.execute(select(_User)).scalars().all()
    output = io.StringIO()
    writer = csv.DictWriter(output, fieldnames=fields)
    writer.writeheader()
    for user in users:
        profile = user.profile
        identity = user.identities[0] if user.identities else None
        row = {}
        for field in fields:
            if field == "name":
                row["name"] = profile.full_name if profile else ""
            elif field == "email":
                row["email"] = identity.email if identity else ""
            elif field == "city":
                row["city"] = profile.city if profile else ""
            elif field == "state":
                row["state"] = profile.state if profile else ""
            elif field == "cpf":
                row["cpf"] = "(encrypted)" if profile and profile.cpf_encrypted else ""
            elif field == "rg":
                row["rg"] = "(encrypted)" if profile and profile.rg_encrypted else ""
            else:
                row[field] = ""
        writer.writerow(row)
    return output.getvalue()


def _create_export_request(
    session: Session,
    requester_id: str,
    fields: list,
    filters: dict = None,
) -> _DataExportRequest:
    """Simula a lógica de POST /admin/export/request."""
    has_sensitive = bool(set(fields) & SENSITIVE_FIELDS)
    req = _DataExportRequest(
        requested_by=requester_id,
        status="PENDING",
        fields_requested=fields,
        filters_json=filters or {},
        has_sensitive=has_sensitive,
    )
    session.add(req)
    session.flush()

    session.add(
        _AuditLog(
            actor_user_id=requester_id,
            action="EXPORT_REQUESTED",
            entity_type="DATA_EXPORT",
            entity_id=req.id,
            extra_data={"fields": fields, "has_sensitive": has_sensitive},
        )
    )

    if not has_sensitive:
        csv_content = _generate_csv(session, fields)
        # Use temp file
        tmp = tempfile.NamedTemporaryFile(suffix=".csv", delete=False, mode="w", encoding="utf-8")
        tmp.write(csv_content)
        tmp.close()
        req.status = "GENERATED"
        req.file_path = tmp.name
        req.expires_at = datetime.datetime.utcnow() + datetime.timedelta(hours=EXPORT_TTL_HOURS)

    session.commit()
    return req


def _approve_export(
    session: Session,
    export_id: str,
    approver_id: str,
) -> _DataExportRequest:
    """Simula a lógica de POST /admin/export/{id}/approve."""
    req = session.execute(
        select(_DataExportRequest).where(_DataExportRequest.id == export_id)
    ).scalar_one_or_none()
    assert req is not None, "Export request not found"
    assert req.status == "PENDING", f"Expected PENDING, got {req.status}"

    csv_content = _generate_csv(session, req.fields_requested)
    tmp = tempfile.NamedTemporaryFile(suffix=".csv", delete=False, mode="w", encoding="utf-8")
    tmp.write(csv_content)
    tmp.close()

    now = datetime.datetime.utcnow()
    req.status = "GENERATED"
    req.approved_by = approver_id
    req.approved_at = now
    req.file_path = tmp.name
    req.expires_at = now + datetime.timedelta(hours=EXPORT_TTL_HOURS)

    session.add(
        _AuditLog(
            actor_user_id=approver_id,
            action="EXPORT_APPROVED",
            entity_type="DATA_EXPORT",
            entity_id=export_id,
        )
    )
    session.commit()
    return req


# ── Fixtures ──────────────────────────────────────────────────────────────────

@pytest.fixture()
def export_session():
    engine = _make_db()
    SL = sessionmaker(bind=engine)
    db = SL()
    yield db
    db.close()
    engine.dispose()


# ── Tests ─────────────────────────────────────────────────────────────────────

def test_export_without_sensitive_is_immediate(export_session):
    """Exportação sem dados sensíveis é gerada imediatamente (status GENERATED)."""
    db = export_session
    admin = _make_user(db, "admin@exp.com", ["ADMIN"])

    assert _require_export_permission(db, admin.id), "ADMIN deve ter permissão de exportação"

    req = _create_export_request(db, admin.id, ["name", "email", "city"])

    assert req.status == "GENERATED"
    assert req.id is not None
    assert req.has_sensitive is False
    assert req.file_path is not None
    assert req.expires_at is not None

    # Cleanup
    if req.file_path and os.path.exists(req.file_path):
        os.unlink(req.file_path)


def test_export_with_sensitive_stays_pending(export_session):
    """Exportação com CPF/RG fica PENDING aguardando aprovação."""
    db = export_session
    admin = _make_user(db, "admin2@exp.com", ["ADMIN"])

    req = _create_export_request(db, admin.id, ["name", "cpf", "rg"])

    assert req.status == "PENDING"
    assert req.has_sensitive is True
    assert req.file_path is None


def test_export_requires_admin_role(export_session):
    """Usuário sem cargo privilegiado não tem permissão (403 simulado)."""
    db = export_session
    regular = _make_user(db, "regular@exp.com")  # sem role

    has_permission = _require_export_permission(db, regular.id)
    assert not has_permission, "Usuário sem role não deve ter permissão de exportação"


def test_council_can_approve_export(export_session):
    """COUNCIL_GENERAL pode aprovar exportação pendente."""
    db = export_session
    admin = _make_user(db, "admin3@exp.com", ["ADMIN"])
    council = _make_user(db, "council@exp.com", ["COUNCIL_GENERAL"])

    # COUNCIL_GENERAL tem permissão de aprovação
    assert _require_approval_permission(db, council.id), "COUNCIL_GENERAL deve poder aprovar"

    # Criar exportação pendente
    req = _create_export_request(db, admin.id, ["name", "cpf"])
    assert req.status == "PENDING"

    # Aprovar
    approved = _approve_export(db, req.id, council.id)

    assert approved.status == "GENERATED"
    assert approved.approved_by == council.id
    assert approved.approved_at is not None
    assert approved.file_path is not None

    # Cleanup
    if approved.file_path and os.path.exists(approved.file_path):
        os.unlink(approved.file_path)


def test_download_returns_csv(export_session):
    """Arquivo gerado é um CSV válido com content correto."""
    db = export_session
    admin = _make_user(db, "admin4@exp.com", ["ADMIN"])

    req = _create_export_request(db, admin.id, ["name", "email"])
    assert req.status == "GENERATED"

    # Simula download: lê o arquivo e verifica content-type (CSV)
    assert req.file_path is not None
    assert os.path.exists(req.file_path)

    with open(req.file_path, "r", encoding="utf-8") as f:
        content = f.read()

    # Verifica que é um CSV válido com header correto
    reader = csv.DictReader(io.StringIO(content))
    assert set(reader.fieldnames) == {"name", "email"}, f"Headers incorretos: {reader.fieldnames}"

    # Registra auditoria de download
    db.add(
        _AuditLog(
            actor_user_id=admin.id,
            action="EXPORT_DOWNLOADED",
            entity_type="DATA_EXPORT",
            entity_id=req.id,
        )
    )
    db.commit()

    # Verifica que auditoria foi registrada
    logs = db.execute(
        select(_AuditLog).where(
            _AuditLog.entity_id == req.id,
            _AuditLog.action == "EXPORT_DOWNLOADED",
        )
    ).scalars().all()
    assert len(logs) == 1

    # Cleanup
    if req.file_path and os.path.exists(req.file_path):
        os.unlink(req.file_path)


def test_download_blocked_when_pending(export_session):
    """Download deve ser bloqueado se exportação ainda está PENDING."""
    db = export_session
    admin = _make_user(db, "admin5@exp.com", ["ADMIN"])

    req = _create_export_request(db, admin.id, ["name", "cpf"])
    assert req.status == "PENDING"

    # Simula lógica do endpoint: só permite download se GENERATED
    can_download = req.status == "GENERATED"
    assert not can_download, "Download não deve ser permitido em status PENDING"


def test_export_audit_log_recorded(export_session):
    """Solicitação de exportação registra entrada no audit log."""
    db = export_session
    admin = _make_user(db, "admin6@exp.com", ["ADMIN"])

    req = _create_export_request(db, admin.id, ["name", "email"])

    logs = db.execute(
        select(_AuditLog).where(
            _AuditLog.entity_id == req.id,
            _AuditLog.action == "EXPORT_REQUESTED",
        )
    ).scalars().all()
    assert len(logs) == 1
    assert logs[0].actor_user_id == admin.id

    # Cleanup
    if req.file_path and os.path.exists(req.file_path):
        os.unlink(req.file_path)


def test_regular_user_cannot_approve(export_session):
    """Usuário sem role privilegiada não pode aprovar exportação."""
    db = export_session
    regular = _make_user(db, "regular2@exp.com")

    has_approval_perm = _require_approval_permission(db, regular.id)
    assert not has_approval_perm, "Usuário sem role não deve poder aprovar exportação"


def test_invalid_fields_rejected(export_session):
    """Campos inválidos devem ser rejeitados (422 simulado)."""
    db = export_session
    _admin = _make_user(db, "admin7@exp.com", ["ADMIN"])

    fields = ["name", "email", "secret_field"]
    invalid = set(fields) - ALLOWED_FIELDS
    assert invalid == {"secret_field"}, f"Deveria detectar campo inválido: {invalid}"
