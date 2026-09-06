# Rollback pós-cutover — Lumen+

**Documentado, não executado.** Cutover concluído em 06/09/2026, janela
06:41:51Z → 06:43:59Z.

---

## Por que o rollback aqui não é trivial

O plano original supunha que reverter seria "apontar o DNS de volta". Não é,
por um motivo descoberto durante a preparação: **`lumenplus.andradesystems.com.br`
sempre apontou para `13.140.36.49`**. O domínio nunca esteve na Railway.

Quer dizer: não existe registro DNS "anterior" para restaurar. A Railway só é
alcançável pelo host dela, `backend-production-6efc.up.railway.app`, e nenhum
cliente conhece esse endereço — o app de loja ainda não foi construído, e
quando for, apontará para o domínio próprio.

Hoje isso é vantagem: **não há app publicado apontando para lugar nenhum**, então
o rollback não exige nova submissão. Mas exige uma escolha explícita de rota.

---

## A — Rollback por rota

### A1. Traefik aponta para a Railway (recomendado)

Mantém o domínio funcionando e não mexe em DNS. Criar um arquivo dinâmico no
Traefik com um serviço apontando para a Railway:

```yaml
# /etc/dokploy/traefik/dynamic/lumenplus-rollback.yml
http:
  routers:
    lumenplus-rollback:
      rule: "Host(`lumenplus.andradesystems.com.br`)"
      entryPoints: [websecure]
      service: lumenplus-railway
      tls:
        certResolver: letsencrypt
  services:
    lumenplus-railway:
      loadBalancer:
        passHostHeader: false
        servers:
          - url: "https://backend-production-6efc.up.railway.app"
```

`passHostHeader: false` é obrigatório: a Railway roteia pelo `Host`, e repassar
`lumenplus.andradesystems.com.br` faria o edge dela devolver 404.

Ordem: parar a API da VPS **primeiro**, senão os dois routers disputam o mesmo
Host — o mesmo risco de colisão já documentado em `ADOCAO-DOKPLOY.md`.

```bash
docker stop lumenplus-lumenplus-buaufv-api-1
```

### A2. Rollback por DNS

Apontar o domínio para a Railway não funciona diretamente: a Railway não aceita
domínio próprio sem configurar Custom Domain no serviço dela, o que exige
validação e emissão de certificado — minutos a horas. Só usar se A1 estiver
indisponível, e configurando o Custom Domain **antes** de mexer no DNS.

---

## B — Escritas feitas na VPS depois do cutover

Este é o ponto que não tem solução automática.

A partir do momento em que a API subiu na VPS (06:43:59Z), toda escrita nova
existe **apenas lá**. O banco da Railway está congelado no estado do dump final.
Reverter sem tratar isso descarta silenciosamente tudo o que entrou depois.

### B1. Antes de qualquer rollback, capturar

```bash
ssh contabo-andrade '/srv/andrade/lumenplus/scripts/backup.sh'
```

Guarda um dump validado do estado atual da VPS. **Sempre fazer isso primeiro**,
mesmo que a decisão seja aceitar a perda — sem o dump, a decisão deixa de ser
reversível.

### B2. Decidir: preservar ou aceitar a perda

Comparar o que existe na VPS com o congelado na Railway:

```bash
# quantas linhas a mais existem hoje na VPS
ssh contabo-andrade '
  CONT=$(docker ps --filter volume=lumenplus_postgres_data --format "{{.Names}}" | head -1)
  docker exec "$CONT" sh -c "PGPASSWORD=\$POSTGRES_PASSWORD psql -qtA -U \$POSTGRES_USER -d \$POSTGRES_DB \
    -c \"select count(*) from users\""'
```

Baseline do cutover: **27 usuários, 623 linhas**. Qualquer número acima disso é
dado que só existe na VPS.

Se a diferença for zero, o rollback é limpo.

### B3. Se preservar, ressincronizar antes de reabrir

Restaurar o dump da VPS **na Railway** antes de religar a API de lá. Do
contrário a Railway volta com dados velhos e os usuários perdem o que fizeram:

```bash
# na VPS, com a URL publica da Railway vinda por stdin (nunca impressa)
railway variables --environment production --service backend --json \
  | python -c "import sys,json;sys.stdout.write(json.load(sys.stdin)['DATABASE_PUBLIC_URL'])" \
  | ssh contabo-andrade 'IFS= read -r U; umask 077; \
      printf "PGURL=%s\n" "$U" > /root/.rb.env; \
      docker run --rm --env-file /root/.rb.env -v /srv/andrade/lumenplus/backups:/b:ro postgres:18.6 \
        sh -c "pg_restore --no-owner --no-acl --clean --if-exists --exit-on-error -d \"\$PGURL\" /b/<DUMP>"; \
      rm -f /root/.rb.env'
```

`--clean --if-exists` porque o banco da Railway não está vazio.

---

## C — Reativar a Railway

**Somente depois de B resolvido.** Religar antes significa servir dados
incoerentes.

O deployment ativo antes do freeze foi:

```
60f5004b-7d00-418d-a3ac-c6eec994cc47   SUCCESS   2026-09-05 00:18:32 -03:00
```

Redeploy pela UI da Railway (Deployments → esse ID → Redeploy) ou:

```bash
railway redeploy --environment production --service backend
```

Confirmar:

```bash
curl -s https://backend-production-6efc.up.railway.app/health/ready
```

---

## Ordem completa

1. `backup.sh` na VPS — captura o estado atual
2. `docker stop` da API da VPS
3. Decidir B2: preservar ou aceitar perda
4. Se preservar: restaurar o dump na Railway (B3)
5. Reativar a API da Railway (C)
6. Aplicar o arquivo dinâmico do Traefik (A1)
7. Confirmar `https://lumenplus.andradesystems.com.br/health/ready`

---

## O que nunca fazer no rollback

- `docker compose down -v` ou remover `lumenplus_postgres_data` — o volume é a
  única cópia quente dos dados novos
- Reativar a Railway antes de decidir sobre B — serve dado velho como se fosse
  atual
- Deixar as duas APIs de pé ao mesmo tempo — duas fontes de escrita divergindo
