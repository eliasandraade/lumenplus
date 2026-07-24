# Descoberta de infraestrutura e dimensionamento — Sprint 6

**Data:** 2026-07-24. **Método:** `railway run --service <svc>` executando
`backend/performance/load/discover_db_limits.py` (somente leitura; nunca imprime
DSN, host, usuário ou senha).

## Facts MEDIDOS — PostgreSQL de staging (`Postgres-mFan`)

| Parâmetro | Valor |
|---|---|
| `max_connections` | **100** |
| `superuser_reserved_connections` | 3 |
| `shared_buffers` | 128 MB |
| `work_mem` | 4 MB |
| `effective_cache_size` | 4 GB |
| `statement_timeout` | **0 (desabilitado)** |
| `idle_in_transaction_session_timeout` | **0 (desabilitado)** |
| Versão | PostgreSQL 18.4 (Debian) |
| Conexões no servidor (ocioso) | 11 |
| Conexões neste banco | 3 |

> **Escopo:** valores do **PostgreSQL de STAGING**. Os valores de **produção NÃO
> foram medidos** — o serviço `Postgres` (produção) não expõe variáveis no
> ambiente `staging` do CLI, e não fui buscar credencial de produção de
> propósito. **NÃO MEDIDA — produção:** exige rodar a mesma descoberta com o
> ambiente do CLI apontando para produção, decisão do operador.

## Serviços do projeto Railway `lumen+`

`backend`, `backend-staging`, `Postgres`, `Postgres-mFan`, `Redis`,
`astonishing-wholeness`.

## Dois achados de backpressure (ambos MEDIDOS)

### 1. `statement_timeout = 0`

Nenhuma query tem prazo. Uma query patológica (falta de índice, lock, plano
ruim) **roda indefinidamente** segurando uma conexão do pool. Sob carga, isso
transforma um problema local em exaustão global de conexões.

**Correção proposta:** definir `statement_timeout` por aplicação (não global no
servidor), via opções de conexão do SQLAlchemy — assim jobs e migrations podem
ter limite diferente do tráfego web.

### 2. `idle_in_transaction_session_timeout = 0`

Uma transação aberta e ociosa segura a conexão **para sempre**. Basta um caminho
de código que abra transação e não faça commit/rollback (ex.: exceção não
tratada antes do `finally`) para vazar conexões até esgotar o pool.

**Correção proposta:** `idle_in_transaction_session_timeout` de poucos minutos.

> Estes dois itens são **causa provável** de colapso sob carga e devem ser
> corrigidos **antes** da certificação da Sprint 7 — senão o teste de carga vai
> medir o sintoma, não a capacidade.

## Matemática de pool

```
conexões_usadas = instâncias × workers × (pool_size + max_overflow)
```

Configuração atual (versionada): `pool_size=5`, `max_overflow=10`, 1 worker,
1 instância → **15 conexões** (15 % de 100).

Orçamento disponível:

| Item | Conexões |
|---|---|
| `max_connections` | 100 |
| − reservadas superusuário | −3 |
| − outros consumidores observados (ocioso) | −11 |
| **Disponível para a aplicação** | **≈ 86** |

Margem obrigatória a preservar: **deploy paralelo** (instância antiga e nova
coexistem — dobra o consumo durante o rollout), migrations no boot,
administração, jobs e observabilidade.

Regra de segurança adotada:

```
workers × (pool_size + max_overflow) × 2  ≤  0,8 × 86  ≈  69
=> workers × (pool_size + max_overflow)   ≤  34
```

### Configurações candidatas

| Config | Workers | pool+overflow | Pico normal | Pico em deploy | Cabe? |
|---|---:|---:|---:|---:|---|
| **Atual** | 1 | 15 | 15 | 30 | sim (folgado) |
| **C1** | 2 | 15 | 30 | 60 | sim — dentro de 69 |
| C2 | 3 | 15 | 45 | 90 | **não** — estoura |
| C3 | 3 | 10 | 30 | 60 | sim |
| C4 | 4 | 8 | 32 | 64 | sim |

**Recomendação (NÃO validada sob carga):** testar **C1** (2 workers, pool
atual) contra a configuração atual, isolando **uma variável por vez** — primeiro
workers, mantendo pool; depois pool, mantendo workers. Não mexer nos dois juntos.

> **NÃO MEDIDA — blocker:** qual configuração vence. Exige a suíte da Sprint 5
> rodando contra um staging saudável. Ver bloqueio abaixo.

## Recursos de CPU/memória

**NÃO MEDIDOS.** `railway status` não expõe vCPU/memória por serviço, e não
consegui abrir shell no container a partir deste ambiente. Ler
`/sys/fs/cgroup/*` exigiria executar **dentro** do container.

**Ação humana exata:** no Railway → projeto `lumen+` → serviço `backend-staging`
→ aba *Metrics* (vCPU e memória alocadas), ou `railway ssh` seguido de
`cat /sys/fs/cgroup/cpu.max /sys/fs/cgroup/memory.max`.

## Bloqueio comprovado da certificação (Sprint 7)

O backend de staging **não está utilizável**:

```
GET https://backend-staging.up.railway.app/health   ->  HTTP 403
GET https://backend-staging.up.railway.app/auth/me  ->  HTTP 403
```

Para comparação, no mesmo momento:

```
GET https://backend-production-6efc.up.railway.app/health  ->  HTTP 200
GET https://lumenplus.vercel.app                            ->  HTTP 200
```

> **Correção de um relatório anterior:** o checkpoint pós-Sprint 4 afirmou que
> "prod/staging/frontend todos 200". **Staging está 403 agora** — a afirmação
> anterior está desatualizada e não deve ser reutilizada.

**Consequência:** a Sprint 7 (certificação de 250 simultâneos) **não pode ser
executada**. Não é falta de ferramenta — a suíte está pronta e a trava de
produção proíbe usar produção como substituto.

**Ação humana exata necessária:**

1. Restaurar o serviço `backend-staging` (403 sugere serviço não implantado, sem
   réplica ativa, ou proteção de borda). Verificar em Railway → `backend-staging`
   → *Deployments* e *Settings → Networking*.
2. Garantir que `backend-staging` aponte para o Postgres **de staging**
   (`Postgres-mFan`) e para um Redis de staging — nunca para os de produção.
3. Informar se `backend-staging` roda `AUTH_MODE=DEV`. Se rodar Firebase real,
   os tokens da carga precisam vir do Firebase (`--tokens-file`), pois o seed
   não consegue emiti-los sozinho.

## Ferramentas no ambiente de execução

| Ferramenta | Status |
|---|---|
| `railway` CLI | **disponível e autenticado** (projeto `lumen+`, ambiente `staging`) |
| `docker` | binário presente, **daemon parado** (`dockerDesktopLinuxEngine` indisponível) |
| `k6` | **não instalado**; `winget` não tem o pacote (`k6.k6` não encontrado) |
| `psql` | não instalado (contornado: descoberta via SQLAlchemy) |

k6 não é blocker de fato: a suíte roda via container (`grafana/k6`) assim que o
daemon do Docker estiver ativo, ou com o binário baixado manualmente. O blocker
real é o **staging 403**, não a ferramenta.
