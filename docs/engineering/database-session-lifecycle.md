# Ciclo de vida de sessão de banco — uma conexão por request

**Data:** 2026-07-24. **Fix:** `fix/db-pool-single-session`.

## O defeito (corrigido)

`app/api/deps.py` definia seu **próprio** `get_db`, distinto do de
`app/db/session.py`. O FastAPI resolve e cacheia dependencies **pela identidade
do callable**. Como havia dois callables `get_db`, um handler que dependesse de:

- `CurrentUser` → `get_current_user` → `DBSession` → **`deps.get_db`**, e
- `Depends(get_db)` importado de **`app.db.session`**

recebia **duas sessões** e retinha **duas conexões físicas** ao mesmo tempo.

### Prova instrumentada

`performance/diag_auth_me.py` (faulthandler + dump de threads + eventos de pool)
mostrou, no travamento, todas as threads em `sqlalchemy/pool/impl.py:156
_do_get` e `connect = 15 = pool_size(5) + max_overflow(10)` — **pool esgotado**.

| Cenário (c=10) | conexões | resultado |
|---|---|---|
| Antes (dois `get_db`) | 15 (esgotado) | estourou 40 s · 0/10 |
| Depois (um `get_db`) | 10 (1/request) | 0,07 s · 10/10 · 200 |

## A correção

`deps.py` passou a **reexportar** o `get_db` canônico:

```python
from app.db.session import get_db
```

Mesmo callable → o cache do FastAPI resolve **uma vez** → **uma sessão por
request**, mesmo quando o handler usa `CurrentUser` e `Depends(get_db)` juntos.

## Auditoria dos handlers que combinavam as duas dependencies

O padrão de risco era: `CurrentUser` (ou `Depends(get_current_user)`) **+**
`Depends(get_db)`. Arquivos com esse padrão:

| Arquivo | Handlers com `Depends(get_db)` | Situação após o fix |
|---|---|---|
| `app/api/routes/auth.py` | `check_cpf`, `get_me`, `delete_me` (com `CurrentUser`); `register`, `login` (sem) | **1 sessão** — `deps.get_db` é `session.get_db` |
| `app/api/routes/dev.py` | 6 handlers | **1 sessão** — idem |
| `app/api/deps.py` | `DBSession`/`get_current_user` | **1 sessão** — fonte canônica |

Os demais routers usam `DBSession`/`CurrentUser` (ambos ancorados em
`deps`→`session.get_db`) e **nunca** foram afetados: já usavam uma sessão.

### Confirmações

- Nenhum handler recebe duas sessões (garantido pela identidade do callable).
- `get_current_user` recebe a sessão por dependency e **não** cria a própria
  (`SessionLocal()` não aparece em `app/api/`).
- Services recebem a sessão do request; não há `SessionLocal()` escondido em
  `app/api/`.
- `get_db_session` (context manager em `app/db/session.py`) é **outro** símbolo,
  de uso deliberado por `BackgroundTasks`/scheduler — sessão independente do
  request, com commit/rollback próprios. Não é usado como dependency de request.

## Regressões que impedem a volta do bug

`backend/tests/test_arch_db_session.py` (arquitetura):

- **uma única** definição de `get_db` em todo o `app/` (em `db/session.py`);
- `app.api.deps.get_db is app.db.session.get_db` (identidade — o coração do fix);
- nenhuma dependency em `app/api/` chama `SessionLocal()` diretamente;
- `get_current_user` não instancia `SessionLocal()`.

`backend/tests/test_db_session_lifecycle.py` (funcional):

- 1 request autenticado → **1 sessão** criada;
- 10 requests → **10 sessões** (uma por request; 20 sinalizaria a duplicação);
- caminho de erro (401) não retém conexão.

O teste funcional conta **sessões por request** — sinal robusto a reuso de
conexão física do pool, e não uma contagem frágil de conexões.
