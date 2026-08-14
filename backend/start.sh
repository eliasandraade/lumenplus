#!/bin/bash
# =============================================================================
# Lumen+ API — Script de inicialização para produção
# Executa as migrations do banco antes de subir o servidor.
# =============================================================================

set -e

# -----------------------------------------------------------------------------
# Portão de configuração de banco.
#
# O staging entrou em crash loop tentando conectar em 127.0.0.1:5432 — que é
# exatamente o DEFAULT de `settings.database_url`. Ou seja: a DATABASE_URL da
# plataforma não estava chegando ao processo, e o alembic caía no fallback
# local. O traceback do psycopg não diz isso: fala em "Connection refused",
# o que manda quem lê investigar rede e banco, não configuração.
#
# Este bloco troca 40 linhas de traceback por uma linha de diagnóstico, e
# recusa subir com configuração de banco local fora de desenvolvimento.
# -----------------------------------------------------------------------------
if [ -z "${DATABASE_URL:-}" ]; then
  echo "ERRO: DATABASE_URL nao esta definida no ambiente do container."
  echo "  O app cairia no default local (localhost:5432) e falharia com"
  echo "  'Connection refused', escondendo a causa real."
  echo "  Verifique as variables do servico no Railway."
  exit 1
fi

# Mascara a senha: o host e o que importa para diagnostico.
echo "▶ Banco alvo: $(echo "$DATABASE_URL" | sed -E 's#://[^@]*@#://***@#')"

case "${ENVIRONMENT:-}" in
  production|staging)
    case "$DATABASE_URL" in
      *localhost*|*127.0.0.1*)
        echo "ERRO: ENVIRONMENT=${ENVIRONMENT} apontando para banco LOCAL."
        echo "  Recusando subir — isso indica que a variavel da plataforma"
        echo "  nao foi aplicada e o processo caiu no fallback de dev."
        exit 1
        ;;
    esac
    ;;
esac

echo "▶ Rodando migrations do banco de dados..."
alembic upgrade head

echo "▶ Iniciando servidor Uvicorn..."
exec uvicorn app.main:app \
  --host 0.0.0.0 \
  --port "${PORT:-8000}" \
  --workers 1 \
  --log-level info
