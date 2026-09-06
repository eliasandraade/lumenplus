#!/usr/bin/env bash
# Backup diario do Postgres do Lumen+.
# Dump logico custom (pg_restore-avel), validado, com retencao local curta.
#
# Espelha /srv/andrade/precatorios/scripts/backup.sh, com duas diferencas
# deliberadas:
#
#   1. O container e localizado pelo VOLUME, nao por nome. O Dokploy gera o
#      nome do projeto (lumenplus-lumenplus-buaufv) e ele MUDA se o servico
#      for recriado na UI. O volume `lumenplus_postgres_data` e external e
#      tem nome fixo — e a ancora estavel.
#   2. Retencao de 14 dias em vez de 7. O banco tem ~200 KB; guardar o dobro
#      de historico custa 3 MB.
set -euo pipefail

DIR=/srv/andrade/lumenplus/backups
RETENCAO=14
VOLUME=lumenplus_postgres_data

mkdir -p "$DIR"
chmod 700 /srv/andrade/lumenplus "$DIR"

CONT=$(docker ps --filter "volume=${VOLUME}" --format "{{.Names}}" | head -1)
if [ -z "$CONT" ]; then
  echo "[backup] FALHOU: nenhum container em execucao montando ${VOLUME}" >&2
  exit 1
fi

TS=$(date +%F_%H%M%S)
OUT="$DIR/lumenplus_${TS}.dump"
TMP="/tmp/lumen_backup_${TS}.dump"

# Dump para arquivo DENTRO do container: o formato custom precisa de arquivo
# seekable para que o pg_restore --list consiga valida-lo.
docker exec "$CONT" sh -c \
  "PGPASSWORD=\$POSTGRES_PASSWORD pg_dump -U \$POSTGRES_USER -d \$POSTGRES_DB \
   --format=custom --no-owner --no-acl -f $TMP"

# So segue se o dump for legivel. Um dump corrompido que passa despercebido
# e pior do que nao ter backup: da falsa seguranca.
if ! docker exec "$CONT" pg_restore --list "$TMP" >/dev/null 2>&1; then
  echo "[backup] FALHOU: dump ilegivel pelo pg_restore" >&2
  docker exec "$CONT" rm -f "$TMP"
  exit 1
fi

TABELAS=$(docker exec "$CONT" pg_restore --list "$TMP" | grep -c "TABLE DATA" || true)
docker cp "$CONT:$TMP" "$OUT"
docker exec "$CONT" rm -f "$TMP"

if [ ! -s "$OUT" ]; then
  echo "[backup] FALHOU: dump vazio no host" >&2
  rm -f "$OUT"
  exit 1
fi
chmod 600 "$OUT"

SHA=$(sha256sum "$OUT" | cut -d" " -f1)
echo "[backup] OK $OUT ($(stat -c%s "$OUT") bytes, ${TABELAS} tabelas, sha256 ${SHA})"

# Retencao: poda SO depois do sucesso, nunca antes.
ls -1t "$DIR"/lumenplus_*.dump 2>/dev/null | tail -n +$((RETENCAO+1)) | xargs -r rm -f
echo "[backup] retidos: $(ls -1 "$DIR"/lumenplus_*.dump 2>/dev/null | wc -l) dumps"
