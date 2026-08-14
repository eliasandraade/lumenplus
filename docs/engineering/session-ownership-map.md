# Mapa de propriedade de sessão de banco

**Data:** 2026-07-24. Auditoria de **toda** criação de sessão no backend
(complementa `database-session-lifecycle.md`).

## Fonte única

`app/db/session.py` é o **único** lugar que cria sessões:

- `SessionLocal = sessionmaker(bind=engine)` — a única factory.
- `get_db()` — dependency de request.
- `get_db_session()` — context manager para contextos independentes.

**Verificado:** não há `SessionLocal()` nem `sessionmaker(` em nenhum outro
módulo de `app/` (grep limpo). A regressão `test_arch_db_session.py` falha se isso
mudar.

## Contextos e responsabilidades

| Contexto | Entrada | Quem cria | Quem fecha | Rollback | Atravessa thread? | Sobrevive ao request? |
|----------|---------|-----------|------------|----------|-------------------|------------------------|
| **Request** | `Depends(get_db)` / `DBSession` / `CurrentUser` | `get_db` | `finally: db.close()` | SQLAlchemy faz rollback no close se houver tx aberta | não (uma sessão por request, no threadpool a mesma sessão roda na thread do request) | **não** |
| **Background task** | `get_db_session()` | o próprio task | `finally: db.close()` | `except: db.rollback(); raise` | sim (task roda após a resposta) | **não** — sessão própria |
| **Scheduler** | `get_db_session()` | o job | `finally: db.close()` | idem | sim | não |
| **Migrations** | Alembic `engine_from_config` | engine **separado** | Alembic | — | — | — |
| **Testes** | `TestingSessionLocal` (conftest / harness) | fixture | fixture | — | — | — |

## Regra crítica: nenhum objeto ORM lazy cruza a fronteira da sessão

**Verificado nos pontos de risco:**

- `POST /inbox` (`inbox_routes.py:356`) agenda `notify_new_inbox` via
  `BackgroundTasks`, mas passa **apenas dados primitivos** (`user_ids` como
  strings, título, mensagem, ids como str) — **não** a sessão do request nem
  objetos ORM. O task cria a **própria** sessão com `get_db_session()`. Correto:
  nada lazy é acessado depois que a sessão do request fecha.
- `notification_service.notify_new_inbox` (linhas 163, 214) e `scheduler` (linha
  33) abrem `with get_db_session() as db:` e fazem todo o trabalho dentro do
  bloco. Nada escapa.

## Após o fix de conexão única (#24)

- `deps.get_db` **é** `session.get_db` (mesmo callable) → **uma sessão por
  request**, mesmo quando o handler usa `CurrentUser` + `Depends(get_db)`.
- `get_current_user` recebe a sessão por dependency e não instancia a própria.

## Conclusão

A propriedade de sessão está **correta e centralizada**: uma factory, dois pontos
de entrada com semântica clara, migrations isoladas, e nenhum vazamento de objeto
ORM entre sessões. Os riscos clássicos (sessão do request usada em background,
`SessionLocal()` solto sem `close`, ORM lazy após close) **não ocorrem** —
verificado por grep + leitura dos pontos de `BackgroundTasks`/scheduler, e
protegido por regressão de arquitetura.
