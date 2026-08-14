"""Vínculo de identidade Firebase — proteção contra takeover por e-mail.

POR QUE ESTE ARQUIVO EXISTE
---------------------------
Ao preparar o E2E, afirmei que "o backend religa a identidade pelo e-mail"
quando a conta some do Firebase e é recriada. A afirmação estava errada de um
jeito perigoso: esse relink existe, mas é **exclusivo de dev/test**
(`app/api/deps.py`, o fallback é guardado por `settings.is_dev`).

Se ele valesse em staging ou produção, seria account takeover direto: bastaria
criar uma conta Firebase com o e-mail de um registro órfão para herdar perfil,
inscrições e permissões da pessoa anterior.

Estes testes travam a garantia para que a otimização não seja reintroduzida
"para facilitar o login" numa refatoração futura.
"""

import uuid

import pytest
from sqlalchemy.orm import Session

from app.db.models import User, UserIdentity, UserProfile


def _criar_usuario(db: Session, email: str, uid: str, *, ativo: bool = True) -> User:
    user = User(is_active=ativo)
    db.add(user)
    db.flush()
    db.add(UserProfile(user_id=user.id, status="COMPLETE"))
    db.add(
        UserIdentity(
            user_id=user.id,
            provider="firebase",
            provider_uid=uid,
            email=email,
            email_verified=True,
        )
    )
    db.commit()
    return user


def _resolver(db: Session, email: str, uid: str, *, email_verified: bool = True):
    """Executa o caminho real de resolução de identidade do backend."""
    from types import SimpleNamespace

    from app.api.deps import _provision_user

    payload = SimpleNamespace(uid=uid, email=email, email_verified=email_verified)
    # O deps monta o audit log a partir do request: precisa de client E headers.
    request = SimpleNamespace(
        client=SimpleNamespace(host="127.0.0.1"),
        headers={},
    )
    return _provision_user(db=db, payload=payload, request=request)


@pytest.fixture(autouse=True)
def _forcar_ambiente_nao_dev(monkeypatch):
    """Os testes rodam com ENVIRONMENT=test, onde o relink É permitido.

    Staging e produção NÃO são dev. Sem forçar isto, o teste passaria a medir
    justamente o ramo que não vai para o ar — e daria falsa segurança.
    """
    from app.settings import settings

    monkeypatch.setattr(type(settings), "is_dev", property(lambda _self: False))


def test_uid_novo_com_mesmo_email_nao_herda_a_conta(db_session: Session):
    """O cenário de takeover: mesmo e-mail, UID diferente."""
    email = f"vitima-{uuid.uuid4().hex[:8]}@exemplo.test"
    original = _criar_usuario(db_session, email, uid="uid-original")

    # Um segundo cadastro Firebase com o MESMO e-mail e UID diferente.
    resolvido = _resolver(db_session, email=email, uid="uid-do-atacante")

    assert resolvido.id != original.id, (
        "TAKEOVER: um UID novo herdou a conta existente só por coincidir o "
        "e-mail. Perfil, inscrições e permissões da pessoa anterior seriam "
        "acessíveis pelo atacante."
    )


def test_email_nao_verificado_tambem_nao_vincula(db_session: Session):
    """`email_verified=false` não pode valer como prova de posse."""
    email = f"naoverificado-{uuid.uuid4().hex[:8]}@exemplo.test"
    original = _criar_usuario(db_session, email, uid="uid-original")

    resolvido = _resolver(
        db_session, email=email, uid="uid-outro", email_verified=False
    )

    assert resolvido.id != original.id


def test_identidade_nova_nasce_limpa(db_session: Session):
    """A conta recriada começa vazia — nada da anterior é reaproveitado."""
    email = f"limpa-{uuid.uuid4().hex[:8]}@exemplo.test"
    _criar_usuario(db_session, email, uid="uid-antigo")

    novo = _resolver(db_session, email=email, uid="uid-recriado")
    db_session.commit()

    perfil = (
        db_session.query(UserProfile).filter(UserProfile.user_id == novo.id).one()
    )
    # INCOMPLETE é o estado de quem acabou de chegar. COMPLETE aqui significaria
    # que o perfil anterior foi herdado.
    assert perfil.status == "INCOMPLETE"


def test_uid_correto_continua_resolvendo(db_session: Session):
    """Guarda contra o teste virar vácuo: o caminho legítimo precisa funcionar.

    Sem isto, uma mudança que quebrasse TODO o login passaria nos testes acima.
    """
    email = f"legitimo-{uuid.uuid4().hex[:8]}@exemplo.test"
    original = _criar_usuario(db_session, email, uid="uid-estavel")

    resolvido = _resolver(db_session, email=email, uid="uid-estavel")

    assert resolvido.id == original.id


def test_conta_desativada_e_recusada(db_session: Session):
    """Desativação não pode ser contornada reautenticando."""
    from fastapi import HTTPException

    email = f"desativada-{uuid.uuid4().hex[:8]}@exemplo.test"
    _criar_usuario(db_session, email, uid="uid-desativado", ativo=False)

    with pytest.raises(HTTPException) as exc:
        _resolver(db_session, email=email, uid="uid-desativado")
    assert exc.value.status_code == 403


def test_relink_por_email_so_existe_em_dev(db_session: Session, monkeypatch):
    """Documenta e trava o limite exato do fallback.

    Ele existe por compatibilidade com contas criadas via /auth/register antes
    do Firebase. Se um dia precisar valer fora de dev, terá de vir acompanhado
    de prova de posse explícita — não de coincidência de e-mail.
    """
    from app.settings import settings

    email = f"dev-{uuid.uuid4().hex[:8]}@exemplo.test"
    original = _criar_usuario(db_session, email, uid="uid-antigo")

    monkeypatch.setattr(type(settings), "is_dev", property(lambda _self: True))
    resolvido = _resolver(db_session, email=email, uid="uid-novo")

    assert resolvido.id == original.id, "em dev o fallback deve continuar valendo"
