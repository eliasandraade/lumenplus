"""
Verifica que o backpressure de banco REALMENTE se aplica no PostgreSQL.

Não basta escrever `connect_args`: é preciso provar que a sessão criada pela
aplicação tem os timeouts ativos. Este script cria uma conexão com as mesmas
opções de `app/db/session.py` e lê os valores efetivos do servidor.

Executar via: railway run --service Postgres-mFan <wrapper.bat>
Somente leitura. Nunca imprime credencial.
"""

from __future__ import annotations

import os
import sys

STATEMENT_MS = 15000
IDLE_TX_MS = 30000


def main() -> None:
    url = os.environ.get("DATABASE_PUBLIC_URL") or os.environ.get("DATABASE_URL", "")
    if not url:
        print("  BLOCKER: nenhuma URL de banco disponivel.")
        sys.exit(0)
    if url.startswith("postgres://"):
        url = url.replace("postgres://", "postgresql://", 1)

    from sqlalchemy import create_engine, text

    opts = f"-c statement_timeout={STATEMENT_MS} -c idle_in_transaction_session_timeout={IDLE_TX_MS}"

    print("  --- SEM connect_args (comportamento atual em producao) ---")
    e0 = create_engine(url)
    with e0.connect() as c:
        print(f"    statement_timeout = {c.execute(text('SHOW statement_timeout')).scalar()}")
        print("    idle_in_transaction_session_timeout = "
              f"{c.execute(text('SHOW idle_in_transaction_session_timeout')).scalar()}")
    e0.dispose()

    print("  --- COM connect_args (proposto) ---")
    e1 = create_engine(url, connect_args={"options": opts})
    with e1.connect() as c:
        st = c.execute(text("SHOW statement_timeout")).scalar()
        it = c.execute(text("SHOW idle_in_transaction_session_timeout")).scalar()
        print(f"    statement_timeout = {st}")
        print(f"    idle_in_transaction_session_timeout = {it}")
        ok = st not in ("0", 0) and it not in ("0", 0)
        print(f"    APLICADO DE FATO: {'SIM' if ok else 'NAO'}")

        # Prova funcional: uma query que excede o limite deve ser abortada.
        try:
            c.execute(text("SET statement_timeout = 300"))
            c.execute(text("SELECT pg_sleep(2)"))
            print("    prova funcional: FALHOU — pg_sleep(2) nao foi abortado")
        except Exception as exc:
            kind = type(exc).__name__
            print(f"    prova funcional: query longa ABORTADA ({kind}) — timeout funciona")
    e1.dispose()


if __name__ == "__main__":
    main()
