#!/usr/bin/env bash
# Backup OFF-SITE do Lumen+ -> Google Drive via rclone (remote crypt proprio).
# Cifrado em TRANSITO (HTTPS do rclone) e em REPOUSO (rclone crypt).
#
# ISOLAMENTO DO PrecGS — a razao de existir um crypt separado
# ------------------------------------------------------------
# O script do Portal de Precatorios termina com:
#     rclone delete "gdrive-crypt:" --min-age 30d
# e `rclone delete` e RECURSIVO. Se os backups do Lumen+ vivessem num
# subdiretorio de `gdrive-crypt:` (que aponta para gdrive:precatorios-backups),
# a retencao do PrecGS os apagaria junto, em silencio. Por isso este script usa
# um remote proprio, com raiz propria, e RECUSA rodar contra qualquer outro.
set -euo pipefail

REMOTE="gdrive-lumen-crypt:"      # crypt -> gdrive:lumenplus-backups
DIR=/srv/andrade/lumenplus/backups
RET_DIAS=30
LOG="[offsite-lumen]"

# ── Portao duro de destino ───────────────────────────────────────────────────
# Nao e paranoia: um typo aqui mandaria dumps do Lumen+ para dentro do espaco
# do PrecGS, e a retencao de la os apagaria.
if [ "$REMOTE" != "gdrive-lumen-crypt:" ]; then
  echo "$LOG destino invalido: $REMOTE" >&2; exit 1
fi
case "$REMOTE" in
  *precatorios*|gdrive-crypt:*) echo "$LOG RECUSADO: destino do PrecGS" >&2; exit 1 ;;
esac

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
# O backup.sh ja validou na criacao, mas o arquivo pode ter sido corrompido
# depois (disco, copia interrompida). Enviar um dump ilegivel e pior do que
# nao enviar: cria a impressao de que existe backup.
CONT=$(docker ps --filter "volume=lumenplus_postgres_data" --format "{{.Names}}" | head -1)
if [ -z "$CONT" ]; then
  echo "$LOG nenhum container Postgres em execucao para validar o dump" >&2; exit 1
fi
docker cp "$LATEST" "$CONT:/tmp/offsite_check.dump" >/dev/null
if ! docker exec "$CONT" pg_restore --list /tmp/offsite_check.dump >/dev/null 2>&1; then
  docker exec "$CONT" rm -f /tmp/offsite_check.dump || true
  echo "$LOG FALHOU: $NOME ilegivel pelo pg_restore — upload abortado" >&2; exit 1
fi
TABELAS=$(docker exec "$CONT" pg_restore --list /tmp/offsite_check.dump | grep -c "TABLE DATA" || true)
docker exec "$CONT" rm -f /tmp/offsite_check.dump
echo "$LOG $NOME validado ($TABELAS tabelas)"

SHA_LOCAL=$(sha256sum "$LATEST" | cut -d" " -f1)

# ── Upload ───────────────────────────────────────────────────────────────────
echo "$LOG upload $NOME -> $REMOTE (cifrado)"
rclone copy "$LATEST" "$REMOTE" --no-traverse

# ── Confere que chegou ───────────────────────────────────────────────────────
if ! rclone lsf "$REMOTE" 2>/dev/null | grep -qx "$NOME"; then
  echo "$LOG FALHA: $NOME nao aparece na listagem remota" >&2; exit 1
fi

# ── Round-trip: baixa e compara sha256 ───────────────────────────────────────
# Listar nao prova integridade. Só o re-download com sha256 igual prova que o
# que esta la e restauravel.
TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT
rclone copy "${REMOTE}${NOME}" "$TMP" --no-traverse
if [ ! -s "$TMP/$NOME" ]; then
  echo "$LOG FALHA: re-download vazio" >&2; exit 1
fi
SHA_REMOTO=$(sha256sum "$TMP/$NOME" | cut -d" " -f1)
if [ "$SHA_LOCAL" != "$SHA_REMOTO" ]; then
  echo "$LOG FALHA: sha256 divergente (local=$SHA_LOCAL remoto=$SHA_REMOTO)" >&2; exit 1
fi
echo "$LOG integridade confirmada (sha256 $SHA_LOCAL)"
rm -rf "$TMP"; trap - EXIT

# ── Retencao ─────────────────────────────────────────────────────────────────
# So chega aqui se o upload E o round-trip passaram — as duas linhas acima
# saem com exit!=0 em qualquer falha. A contagem abaixo e a ultima trava:
# nunca podar quando ha um unico arquivo remoto, para nao existir janela em
# que o off-site fique vazio.
REMOTOS=$(rclone lsf "$REMOTE" 2>/dev/null | grep -c "^lumenplus_.*\.dump$" || true)
if [ "${REMOTOS:-0}" -lt 2 ]; then
  echo "$LOG retencao PULADA: apenas ${REMOTOS:-0} copia(s) remota(s)"
else
  echo "$LOG retencao: remove copias remotas com mais de ${RET_DIAS}d"
  rclone delete "$REMOTE" --min-age "${RET_DIAS}d" --include "lumenplus_*.dump" || true
fi

echo "$LOG copias off-site agora: $(rclone lsf "$REMOTE" 2>/dev/null | grep -c '^lumenplus_.*\.dump$' || echo 0)"
echo "$LOG OK"
