# SEC-05 — Rotação de Segredos

**Data:** 2026-06-14 | **Prioridade:** P1 | **Depende de staging:** Não

---

## Estado Atual (auditado)

Segredos mapeados em `backend/app/settings.py`:

| Segredo | Onde está | Rotado alguma vez? |
|---------|-----------|-------------------|
| `SECRET_KEY` | Railway env var | Desconhecido |
| `FIREBASE_PRIVATE_KEY` | Railway env var | Nunca (mesma chave desde criação do projeto) |
| `FIREBASE_CLIENT_EMAIL` | Railway env var | N/A (e-mail de service account) |
| `FIREBASE_PROJECT_ID` | Railway env var | N/A (imutável) |
| `VAPID_PRIVATE_KEY` | Railway env var | N/A (não configurado ainda) |
| `VAPID_PUBLIC_KEY` | Railway env var | N/A (não configurado ainda) |
| `SENDGRID_API_KEY` | Railway env var | Desconhecido |
| `CLOUDINARY_API_KEY` | Railway env var | Desconhecido |
| `CLOUDINARY_API_SECRET` | Railway env var | Desconhecido |

---

## Problema

Nenhuma política de rotação de segredos documentada. Segredos como `SECRET_KEY`, `FIREBASE_PRIVATE_KEY` e `CLOUDINARY_API_SECRET` podem estar ativos por tempo indeterminado sem auditoria. Se houver vazamento (ex: commit acidental, acesso indevido ao Railway), não há processo para detecção e resposta rápida.

---

## Objetivo

1. Documentar processo formal de rotação de cada segredo
2. Executar rotação inicial de todos os segredos que podem ser rotados sem downtime
3. Configurar frequência de rotação recomendada

---

## Escopo

- Rotação de: `SECRET_KEY`, `SENDGRID_API_KEY`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`
- Geração de novas VAPID keys (quando PROD-01 for implementado)
- Documentação de processo para `FIREBASE_PRIVATE_KEY` (requer regeneração no Firebase Console)

## Fora de Escopo

- `FIREBASE_PROJECT_ID` — imutável
- `FIREBASE_CLIENT_EMAIL` — imutável (vinculado à service account)
- Rotação automática (OOTB não disponível no Railway free tier)

---

## Dependências

- Acesso ao Railway Dashboard (env vars de produção)
- Acesso ao Firebase Console (regenerar service account key se necessário)
- Acesso ao Cloudinary Dashboard
- Acesso ao SendGrid

---

## Decisões Humanas Requeridas

| Decisão | Responsável |
|---------|-------------|
| Quando rotar (janela de baixo tráfego) | Elias |
| Confirmar acesso às plataformas antes de rotar | Elias |
| Validar serviço após rotação | Elias |

---

## Riscos

| Risco | Probabilidade | Mitigação |
|-------|---------------|-----------|
| `SECRET_KEY` rotado invalida tokens JWT ativos | Alta | Avisar usuários ativos; rotar em janela de madrugada |
| `FIREBASE_PRIVATE_KEY` incorreto derruba autenticação | Alta | Testar em staging primeiro com nova chave |
| Cloudinary key incorreta quebra upload de imagens | Média | Testar antes de remover key antiga |

---

## Plano de Implementação

### Passo 1 — Documentar processo (fazer agora, sem risco)
Criar `docs/ops/secrets-rotation.md` com:
- Lista de segredos e onde regenerar cada um
- Janela de rotação recomendada (madrugada, baixo tráfego)
- Checklist de validação pós-rotação

### Passo 2 — Rotação do `SECRET_KEY` (JWT sessions)
```bash
# Gerar novo valor
openssl rand -hex 32

# Railway Dashboard → lumen+ → backend → Variables
# Atualizar SECRET_KEY com novo valor
# Railway reinicia o serviço automaticamente

# Validar:
curl https://backend-production-6efc.up.railway.app/health
# → 200 OK
```

**Nota:** Todos os tokens JWT ativos serão invalidados. Usuários precisarão fazer login novamente.

### Passo 3 — Rotação de Cloudinary
```
Cloudinary Dashboard → Settings → Access Keys
Criar nova API Key/Secret → atualizar Railway env vars → testar upload → revogar key antiga
```

### Passo 4 — Rotação de SendGrid
```
SendGrid Dashboard → Settings → API Keys
Criar nova key → atualizar Railway → testar envio de e-mail → revogar key antiga
```

### Passo 5 — Rotação de Firebase Service Account Key (quando necessário)
```
Firebase Console → Project Settings → Service Accounts
Generate new private key → baixar JSON → extrair campos → atualizar Railway env vars
IMPORTANTE: manter key antiga ativa até confirmar que nova key funciona
```

---

## Frequência de Rotação Recomendada

| Segredo | Frequência |
|---------|------------|
| `SECRET_KEY` | A cada 6 meses ou após suspeita de vazamento |
| `FIREBASE_PRIVATE_KEY` | Anualmente ou após mudança de equipe |
| `CLOUDINARY_API_KEY/SECRET` | A cada 12 meses |
| `SENDGRID_API_KEY` | A cada 12 meses |
| `VAPID_PRIVATE_KEY` | Nunca rotar sem migrar subscriptions (invalida todos os subscribers) |

---

## Critérios de Aceite

- `docs/ops/secrets-rotation.md` criado com processo documentado
- Todos os segredos rotáveis rotados ao menos uma vez
- Health check passando após cada rotação
- Nenhum erro de autenticação após rotação

## Rollback

Para cada segredo: restaurar valor anterior no Railway. O Railway guarda histórico de deploys; não guarda histórico de env vars — **salvar valores antigos antes de rotar**.

---

## Classificação

- **Depende de staging:** Não (mas testar rotação em staging primeiro é recomendado)
- **Bloqueia App Store/Play Store:** Não
- **Implementável via código:** Não — processo manual no painel Railway/Firebase/Cloudinary
- **Depende de decisão humana:** ✅ Sim — timing, acesso às plataformas
