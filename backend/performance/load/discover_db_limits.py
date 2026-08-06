"""
Descobre limites reais do PostgreSQL — Sprint 6.

Executado via `railway run --service <svc> python discover_db_limits.py`, que
injeta as variáveis do serviço no processo. NUNCA imprime DSN, senha, host ou
qualquer credencial — apenas os parâmetros de capacidade.

Somente leitura: `SHOW` e consultas a `pg_stat_activity`. Nenhuma escrita.
"""

from __future__ import annotations

import os
import sys

PARAMS = (
    "max_connections",
    "superuser_reserved_connections",
    "shared_buffers",
    "statement_timeout",
    "idle_in_transaction_session_timeout",
    "work_mem",
    "effective_cache_size",
)


def main() -> None:
    # Nomes de variáveis (NUNCA valores) para diagnosticar o que existe.
    candidates = sorted(
        k for k in os.environ
        if any(t in k.upper() for t in ("DATABASE", "PGHOST", "POSTGRES", "TCP_PROXY"))
    )
    print(f"  variaveis relevantes presentes (nomes): {', '.join(candidates) or 'nenhuma'}")

    # DATABASE_URL usa rede privada do Railway (*.railway.internal), que não
    # resolve fora do container. Preferir o endpoint público quando existir.
    url = os.environ.get("DATABASE_PUBLIC_URL", "") or os.environ.get("DATABASE_URL", "")
    which = "DATABASE_PUBLIC_URL" if os.environ.get("DATABASE_PUBLIC_URL") else "DATABASE_URL"
    print(f"  usando: {which}")
    if not url:
        print("  BLOCKER: nenhuma URL de banco disponivel neste contexto.")
        sys.exit(0)

    try:
        from sqlalchemy import create_engine, text
    except ImportError:
        print("  BLOCKER: SQLAlchemy indisponivel no interpretador usado.")
        sys.exit(0)

    if url.startswith("postgres://"):
        url = url.replace("postgres://", "postgresql://", 1)

    try:
        engine = create_engine(url)
        with engine.connect() as conn:
            for key in PARAMS:
                try:
                    val = conn.execute(text(f"SHOW {key}")).scalar()
                    print(f"  {key} = {val}")
                except Exception as exc:  # parametro pode nao existir
                    print(f"  {key} = ERRO: {str(exc)[:70]}")

            ver = str(conn.execute(text("SELECT version()")).scalar())
            print(f"  version = {ver[:60]}")
            total = conn.execute(text("SELECT count(*) FROM pg_stat_activity")).scalar()
            mine = conn.execute(
                text("SELECT count(*) FROM pg_stat_activity WHERE datname = current_database()")
            ).scalar()
            idle = conn.execute(
                text("SELECT count(*) FROM pg_stat_activity WHERE state = 'idle in transaction'")
            ).scalar()
            print(f"  conexoes_no_servidor = {total}")
            print(f"  conexoes_neste_banco = {mine}")
            print(f"  idle_in_transaction = {idle}")
    except Exception as exc:
        # Mensagem sanitizada: erros de conexão podem conter host/usuario.
        msg = str(exc)
        for token in (os.environ.get("PGPASSWORD", ""), os.environ.get("PGUSER", "")):
            if token:
                msg = msg.replace(token, "***")
        print(f"  FALHA DE CONEXAO (sanitizada): {msg[:150]}")


if __name__ == "__main__":
    main()
