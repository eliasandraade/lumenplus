#!/usr/bin/env bash
# Backup OFF-SITE do Lumen+ -> Google Drive via rclone (remote crypt proprio).
# Cifrado em TRANSITO (HTTPS do rclone) e em REPOUSO (rclone crypt), com nomes
# de arquivo cifrados.
#
# LAYOUT NO REMOTE
#   gdrive-lumen-crypt:daily/                     <- este script; retencao 30d
#   gdrive-lumen-crypt:archive/cutover-2026-09-06/ <- artefatos historicos da
#                                                     migracao; SEM retencao
#
# ISOLAMENTO — duas separacoes, por motivos diferentes
# ---------------------------------------------------
# 1. Do PrecGS: o script do Portal termina com
#        rclone delete "gdrive-crypt:" --min-age 30d
#    e `rclone delete` e RECURSIVO. Backups do Lumen+ dentro daquele crypt
#    seriam apagados pela retencao do Portal, em silencio. Dai o crypt proprio.
#
# 2. Do proprio archive/: a retencao aqui atua SO em daily/. Rodar
#        rclone delete "gdrive-lumen-crypt:" --min-age 30d
#    na RAIZ apagaria tambem o archive/ — que existe justamente para nunca
#    expirar. Por isso o alvo da poda e uma variavel separada, e ha uma guarda
#    que recusa podar qualquer caminho que nao termine em `/daily/`.
set -euo pipefail

REMOTE="gdrive-lumen-crypt:"
DAILY="${REMOTE}daily/"
DIR=/srv/andrade/lumenplus/backups
RET_DIAS=30
LOG="[offsite-lumen]"

# ── Portao 1: destino correto ────────────────────────────────────────────────
case "$REMOTE" in
  *precatorios*|gdrive-crypt:*) echo "$LOG RECUSADO: destino do PrecGS" >&2; exit 1 ;;
esac
[ "$REMOTE" = "gdrive-lumen-crypt:" ] || { echo "$LOG destino invalido: $REMOTE" >&2; exit 1; }

# ── Portao 2: a poda so pode mirar daily/ ────────────────────────────────────
# Verificado ANTES de qualquer trabalho: se a variavel for editada por engano,
# o script para aqui, e nao depois de ja ter enviado.
#
# A comparacao e por IGUALDADE exata, nao por glob. A primeira versao usava
# `case "$DAILY" in */daily/)`, que NAO casa com "gdrive-lumen-crypt:daily/":
# o separador antes de `daily` e dois-pontos, nao barra. O guard recusava o
# proprio alvo correto — falha fechada, mas falha.
if [ "$DAILY" != "${REMOTE}daily/" ] || [ "$DAILY" = "$REMOTE" ]; then
  echo "$LOG RECUSADO: alvo de retencao '$DAILY' nao e '${REMOTE}daily/'" >&2; exit 1
fi

command -v rclone >/dev/null || { echo "$LOG rclone ausente" >&2; exit 1; }
rclone listremotes 2>/dev/null | grep -qx "$REMOTE" || {
  echo "$LOG remote '$REMOTE' nao configurado — rode 'rclone config'" >&2; exit 1; }

# ── Escolhe o backup local mais recente ──────────────────────────────────────
LATEST=$(ls -1t "$DIR"/lumenplus_*.dump 2>/dev/null | head -1 || true)
if [ -z "$LATEST" ]; then
  echo "$LOG nenhum backup local — rodando backup.sh primeiro"
  /srv/andrade/lumenplus/scripts/backup.sh
  LATEST=$(ls -1t "$DIR"/lumenplus_*.dump | head -1)
fi
NOME=$(basename "$LATEST")

# ── Revalida ANTES de enviar ─────────────────────────────────────────────────
# O backup.sh ja validou na criacao, mas o arquivo pode ter corrompido depois.
# Enviar dump ilegivel e pior que nao enviar: cria a impressao de que ha backup.
CONT=$(docker ps --filter "volume=lumenplus_postgres_data" --format "{{.Names}}" | head -1)
[ -n "$CONT" ] || { echo "$LOG nenhum Postgres em execucao para validar" >&2; exit 1; }
docker cp "$LATEST" "$CONT:/tmp/offsite_check.dump" >/dev/null
if ! docker exec "$CONT" pg_restore --list /tmp/offsite_check.dump >/dev/null 2>&1; then
  docker exec "$CONT" rm -f /tmp/offsite_check.dump || true
  echo "$LOG FALHOU: $NOME ilegivel pelo pg_restore — upload abortado" >&2; exit 1
fi
TABELAS=$(docker exec "$CONT" pg_restore --list /tmp/offsite_check.dump | grep -c "TABLE DATA" || true)
docker exec "$CONT" rm -f /tmp/offsite_check.dump
echo "$LOG $NOME validado ($TABELAS tabelas)"

SHA_LOCAL=$(sha256sum "$LATEST" | cut -d" " -f1)

# ── Upload para daily/ ───────────────────────────────────────────────────────
echo "$LOG upload $NOME -> $DAILY (cifrado)"
rclone copy "$LATEST" "$DAILY" --no-traverse

if ! rclone lsf "$DAILY" 2>/dev/null | grep -qx "$NOME"; then
  echo "$LOG FALHA: $NOME nao aparece em $DAILY" >&2; exit 1
fi

# ── Round-trip: baixa de daily/ e compara sha256 ─────────────────────────────
# Listar nao prova integridade. So o re-download com sha256 igual prova que o
# que esta la e restauravel.
TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT
rclone copy "${DAILY}${NOME}" "$TMP" --no-traverse
[ -s "$TMP/$NOME" ] || { echo "$LOG FALHA: re-download vazio" >&2; exit 1; }
SHA_REMOTO=$(sha256sum "$TMP/$NOME" | cut -d" " -f1)
if [ "$SHA_LOCAL" != "$SHA_REMOTO" ]; then
  echo "$LOG FALHA: sha256 divergente (local=$SHA_LOCAL remoto=$SHA_REMOTO)" >&2; exit 1
fi
echo "$LOG integridade confirmada (sha256 $SHA_LOCAL)"
rm -rf "$TMP"; trap - EXIT

# ── Retencao — EXCLUSIVAMENTE em daily/ ──────────────────────────────────────
# So chega aqui se upload e round-trip passaram (as etapas acima saem com
# exit!=0 em falha). A contagem e a ultima trava: nunca podar com uma copia so,
# para nao existir janela com o off-site vazio.
REMOTOS=$(rclone lsf "$DAILY" 2>/dev/null | grep -c "^lumenplus_.*\.dump$" || true)
if [ "${REMOTOS:-0}" -lt 2 ]; then
  echo "$LOG retencao PULADA: apenas ${REMOTOS:-0} copia(s) em daily/"
else
  echo "$LOG retencao em $DAILY (>${RET_DIAS}d) — archive/ nao e tocado"
  rclone delete "$DAILY" --min-age "${RET_DIAS}d" --include "lumenplus_*.dump" || true
fi

echo "$LOG daily/: $(rclone lsf "$DAILY" 2>/dev/null | grep -c '^lumenplus_.*\.dump$' || echo 0) copia(s)"
echo "$LOG archive/: $(rclone lsf "${REMOTE}archive/" --recursive 2>/dev/null | wc -l) arquivo(s) preservado(s)"
echo "$LOG OK"
