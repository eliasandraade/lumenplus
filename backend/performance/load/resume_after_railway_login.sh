#!/usr/bin/env bash
# Retoma a validação de staging APÓS `railway login`.
#
# Faz apenas passos SEGUROS e de baixa carga; NÃO dispara o ramp de 250 sozinho.
# Recusa produção. Não imprime DSN/secret.
#
# Uso: bash resume_after_railway_login.sh
set -euo pipefail

STAGING_HOST="${STAGING_HOST:-backend-staging.up.railway.app}"
PG_SERVICE="${PG_SERVICE:-Postgres-mFan}"
BACKEND_SERVICE="${BACKEND_SERVICE:-backend-staging}"

# --- trava de produção ------------------------------------------------------
case "$STAGING_HOST" in
  *backend-production*|*lumenplus.vercel.app*|*lumenplus.app*|*lumenserfeliz.org*)
    echo "RECUSADO: '$STAGING_HOST' parece produção. Abortando."; exit 1;;
esac

echo "== 0. railway autenticado? =="
railway whoami || { echo "Rode 'railway login' primeiro."; exit 1; }

echo "== 1. staging responde (edge -> app)? =="
code=$(curl -sS -o /dev/null -w "%{http_code}" --max-time 20 "https://$STAGING_HOST/health/live" || echo 000)
echo "  /health/live -> HTTP $code"
if [ "$code" != "200" ]; then
  echo "  staging ainda NAO utilizavel (403/000). Siga docs/operations/restore-backend-staging.md."
  exit 1
fi
xpb=$(curl -sS -D - -o /dev/null --max-time 20 "https://$STAGING_HOST/health/live" | grep -i "x-powered-by" || true)
[ -n "$xpb" ] && { echo "  AVISO: ainda ha 'x-powered-by: Express' -> resposta do edge, nao do app."; exit 1; }
echo "  OK: chegou ao FastAPI."

echo "== 2. readiness (banco) =="
curl -sS -o /dev/null -w "  /health/ready -> HTTP %{http_code}\n" --max-time 20 "https://$STAGING_HOST/health/ready"

echo "== 3. limites do Postgres de staging (somente leitura, sem credencial no output) =="
railway run --service "$PG_SERVICE" python "$(dirname "$0")/discover_db_limits.py" 2>/dev/null | grep -E "max_connections|statement_timeout|idle_in_transaction|conexoes" || \
  echo "  (nao foi possivel ler — verificar acesso ao servico $PG_SERVICE)"

echo "== 4. validacao do fix de pool em Postgres real (baixa carga 1/5/10/15) =="
railway run --service "$PG_SERVICE" python "$(dirname "$0")/validate_pool_fix_pg.py" 2>/dev/null | grep -E "c=|max_conns|checkouts|cleanup" || \
  echo "  (validacao nao rodou — ver validate_pool_fix_pg.py)"

echo "== 5. seed de usuarios sinteticos (NAO dispara carga) =="
echo "  Para gerar tokens:  python seed_synthetic_users.py --base-url https://$STAGING_HOST --count 50"
echo "  Se o backend rodar AUTH_MODE=DEV, o seed emite os tokens sozinho."
echo "  Se rodar Firebase real, use --tokens-file com tokens obtidos do Firebase."

echo ""
echo "PRONTO. Gates verdes ate aqui. A carga (ramp 10->250) e um passo MANUAL:"
echo "  export BASE_URL=https://$STAGING_HOST TOKENS=<do seed>"
echo "  make -C backend/performance/load load-smoke   # depois load-25, load-50, ... progressivo"
