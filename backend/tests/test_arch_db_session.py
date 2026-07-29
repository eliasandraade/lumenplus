"""
Testes de ARQUITETURA — garantem UMA sessão de banco por request.

Regressão do bug de conexão duplicada (deps.py definia seu próprio get_db,
distinto do de app.db.session; o FastAPI cacheia dependency pelo callable, então
um handler que usasse CurrentUser + Depends(get_db) abria DUAS sessões e segurava
DUAS conexões por request, esgotando o pool).

Estes testes falham se a duplicação voltar — não dependem de benchmark.
"""

from __future__ import annotations

import ast
import pathlib

APP = pathlib.Path(__file__).resolve().parent.parent / "app"


def _iter_py(root: pathlib.Path):
    for p in root.rglob("*.py"):
        yield p, ast.parse(p.read_text(encoding="utf-8"))


def test_get_db_tem_uma_unica_definicao_canonica():
    """Só pode existir UMA definição de `get_db` em todo o app, em db/session.py."""
    defs = []
    for path, tree in _iter_py(APP):
        for node in ast.walk(tree):
            if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)) and node.name == "get_db":
                defs.append(path.relative_to(APP.parent).as_posix())
    assert defs == ["app/db/session.py"], (
        f"Esperava exatamente uma definicao de get_db em app/db/session.py; "
        f"encontrei: {defs}. Reintroduzir um get_db duplicado ressuscita o bug "
        f"de duas conexoes por request."
    )


def test_deps_get_db_e_o_mesmo_callable_de_session():
    """
    O FastAPI cacheia dependency pelo CALLABLE. deps.get_db precisa SER
    (identidade) o get_db de app.db.session — não uma cópia/wrapper.
    """
    from app.api import deps
    from app.db import session

    assert deps.get_db is session.get_db, (
        "app.api.deps.get_db NAO e o mesmo objeto que app.db.session.get_db. "
        "Se forem callables distintos, um request que usa CurrentUser e "
        "Depends(get_db) abre duas sessoes. deps deve REEXPORTAR o get_db "
        "canonico, nao redefini-lo."
    )


def test_nenhuma_dependency_de_api_instancia_SessionLocal_diretamente():
    """
    Dependencies de request em app/api NÃO devem chamar SessionLocal()
    diretamente — devem depender do get_db canônico, que garante close no
    finally. SessionLocal() solto vaza conexão se não for fechado.
    """
    offenders = []
    api = APP / "api"
    for path, tree in _iter_py(api):
        for node in ast.walk(tree):
            if isinstance(node, ast.Call):
                func = node.func
                name = func.id if isinstance(func, ast.Name) else getattr(func, "attr", "")
                if name == "SessionLocal":
                    offenders.append(f"{path.relative_to(APP.parent).as_posix()}:{node.lineno}")
    assert not offenders, (
        f"SessionLocal() chamado diretamente em app/api: {offenders}. "
        f"Use o get_db canonico como dependency."
    )


def test_get_current_user_usa_a_sessao_da_dependency_nao_uma_nova():
    """
    get_current_user recebe a sessão via DBSession (dependency), e não cria uma
    própria. Assim o provisionamento de usuário compartilha a MESMA conexão do
    resto do request.
    """
    import inspect

    from app.api import deps

    sig = inspect.signature(deps.get_current_user)
    assert "db" in sig.parameters, "get_current_user deve receber `db` por dependency"
    # A anotação de `db` é DBSession (Annotated[Session, Depends(get_db)]).
    src = inspect.getsource(deps.get_current_user)
    assert "SessionLocal(" not in src, (
        "get_current_user nao deve instanciar SessionLocal() — usa a sessao da dependency."
    )
