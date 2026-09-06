# SEC-05 — Runbook de Rotação de Segredos

**Data:** 2026-06-14  
**Responsável:** Elias  
**Plataforma:** Railway (backend) + Firebase Console + Cloudinary + SendGrid  
**Regra:** Nunca rotacionar produção sem janela de baixo tráfego e rollback pronto

---

## Inventário de Segredos

| Segredo | Onde vive | Onde regenerar | Rotável sem downtime | Invalida sessões |
|---------|-----------|----------------|---------------------|-----------------|
| `SECRET_KEY` | Railway env var | Gerar localmente | ✅ Sim (restart automático) | ✅ Sim — todos os JWT invalidados |
| `FIREBASE_PRIVATE_KEY` | Railway env var | Firebase Console → Service Accounts | ✅ Sim (manter chave antiga ativa até confirmar) | Não (token Firebase não usa SECRET_KEY) |
| `FIREBASE_CLIENT_EMAIL` | Railway env var | N/A (vinculado à service account) | ❌ Imutável | — |
| `FIREBASE_CLIENT_ID` | Railway env var | N/A (vinculado à service account) | ❌ Imutável | — |
| `FIREBASE_PROJECT_ID` | Railway env var | N/A (imutável) | ❌ Imutável | — |
| `FIREBASE_PRIVATE_KEY_ID` | Railway env var | Muda junto com FIREBASE_PRIVATE_KEY | Com FIREBASE_PRIVATE_KEY | — |
| `CLOUDINARY_API_KEY` | Railway env var | Cloudinary Dashboard → Access Keys | ✅ Sim (criar nova antes de revogar antiga) | Não |
| `CLOUDINARY_API_SECRET` | Railway env var | Cloudinary Dashboard → Access Keys | ✅ Sim (criar nova antes de revogar antiga) | Não |
| `SENDGRID_API_KEY` | Railway env var | SendGrid Dashboard → API Keys | ✅ Sim (criar nova antes de revogar antiga) | Não |
| `VAPID_PRIVATE_KEY` | Railway env var | Gerar com pywebpush | ⚠️ Invalida todas as subscriptions push | Não |
| `VAPID_PUBLIC_KEY` | Railway env var | Junto com VAPID_PRIVATE_KEY | ⚠️ Invalida todas as subscriptions push | Não |
| `VAPID_EMAIL` | Railway env var | Atualizar manualmente | ✅ Sim | Não |

---

## Frequência Recomendada

| Segredo | Frequência | Observação |
|---------|------------|------------|
| `SECRET_KEY` | A cada 6 meses ou após suspeita de vazamento | Avisa usuários com login ativo |
| `FIREBASE_PRIVATE_KEY` | Anualmente ou após mudança de equipe | Manter chave antiga até confirmar nova |
| `CLOUDINARY_API_KEY/SECRET` | A cada 12 meses | Criar nova → testar → revogar antiga |
| `SENDGRID_API_KEY` | A cada 12 meses | Criar nova → testar → revogar antiga |
| `VAPID_PRIVATE_KEY` | Somente se comprometida | Invalida todos os subscribers; re-subscribe necessária |

---

## Janela de Rotação Recomendada

**Horário:** Madrugada brasileira (00h–05h BRT) — tráfego mínimo  
**Dia:** Terça ou quarta-feira (longe do fim de semana e segunda)  
**Pré-requisito:** Confirmar acesso a todas as plataformas antes de iniciar

---

## Procedimentos por Segredo

### `SECRET_KEY` (JWT sessions)

**Impacto:** Todos os tokens JWT ativos são invalidados. Usuários precisam fazer login novamente.

```bash
# 1. Gerar novo valor
openssl rand -hex 32
# Saída exemplo: a3f8b2c1d4e5f6789...

# 2. Salvar o valor ATUAL antes de mudar (para rollback)
# Railway Dashboard → lumen+ → backend → Variables → SECRET_KEY → copiar valor atual

# 3. Atualizar no Railway
# Railway Dashboard → lumen+ → backend → Variables → SECRET_KEY → novo valor
# Railway reinicia automaticamente

# 4. Validar
curl https://backend-production-6efc.up.railway.app/health
# Esperado: 200 OK com JSON de status

# 5. Validar que login funciona (no browser)
```

**Rollback:** Restaurar valor anterior no Railway. Restart automático.

---

### `FIREBASE_PRIVATE_KEY` (autenticação)

**Impacto:** Se chave incorreta, autenticação cai completamente. Processo mais crítico.

```
1. Firebase Console → Project Settings → Service Accounts
2. Clicar em "Generate new private key" → Baixar JSON
3. Do JSON extrair:
   - private_key     → FIREBASE_PRIVATE_KEY
   - private_key_id  → FIREBASE_PRIVATE_KEY_ID
   - client_email    → FIREBASE_CLIENT_EMAIL (deve ser igual)
   - client_id       → FIREBASE_CLIENT_ID (deve ser igual)
4. Configurar NOVO VALOR no staging primeiro e validar login
5. Somente após validar staging: atualizar produção
6. Manter chave antiga ATIVA no Firebase por 24h antes de revogar
7. Após 24h sem erros: revogar chave antiga no Firebase Console
```

**Rollback:** Restaurar valores anteriores no Railway. Se revogou a chave antiga: gerar nova chave novamente.

---

### `CLOUDINARY_API_KEY` + `CLOUDINARY_API_SECRET`

```
1. Cloudinary Dashboard → Settings → Access Keys
2. "Add Access Key" → Copiar nova key e secret
3. Atualizar Railway env vars com nova key/secret
4. Testar upload de imagem (tela de perfil)
5. Confirmar: nenhum erro de autenticação Cloudinary nos logs Railway
6. Revogar chave antiga: Cloudinary → Access Keys → Delete
```

**Rollback:** Cloudinary mantém a chave antiga ativa até você revogar; se Railway foi atualizado mas há erro, restaurar valores anteriores.

---

### `SENDGRID_API_KEY`

```
1. SendGrid Dashboard → Settings → API Keys → Create API Key
   Permissões mínimas: Mail Send (Full Access)
2. Copiar nova key (visível apenas uma vez)
3. Atualizar Railway env var SENDGRID_API_KEY
4. Testar envio de e-mail (fluxo de inbox ou e-mail de teste)
5. Confirmar entrega no SendGrid Activity Feed
6. Revogar chave antiga: SendGrid → API Keys → Delete
```

**Rollback:** Criar nova chave no SendGrid (a antiga foi revogada). Railway → atualizar com nova chave.

---

### `VAPID_PRIVATE_KEY` + `VAPID_PUBLIC_KEY`

⚠️ **ATENÇÃO:** Rotacionar VAPID invalida TODAS as subscriptions push. Todos os usuários precisarão re-subscrever (acontece automaticamente na próxima visita ao app).

```bash
# Gerar novo par de chaves
cd backend
python -c "
from pywebpush import Vapid
vapid = Vapid()
vapid.generate_keys()
print('VAPID_PRIVATE_KEY:', vapid.private_key)
print('VAPID_PUBLIC_KEY:', vapid.public_key)
"

# Atualizar Railway env vars:
# VAPID_PRIVATE_KEY = <nova chave privada>
# VAPID_PUBLIC_KEY = <nova chave pública>
# VAPID_EMAIL = mailto:privacidade@lumenplus.app (ou atual)

# Validar:
curl https://backend-production-6efc.up.railway.app/push/vapid-public-key
# Esperado: 200 com nova public_key
```

**Rollback:** Restaurar par anterior no Railway. Subscriptions antigas voltam a funcionar (se existentes).  
**Nota:** VAPID está ativo em **staging e produção** (verificado 2026-07-16). Rotacionar invalida as subscriptions existentes — avisar usuários antes.

---

## Checklist de Validação Pós-Rotação

Para qualquer segredo:

- [ ] `GET /health` retorna 200
- [ ] `GET /openapi.json` retorna 200
- [ ] Login funciona (Firebase Auth)
- [ ] Nenhum erro de autenticação nos logs Railway nas primeiras 5 min
- [ ] Funcionalidade específica do segredo testada (upload Cloudinary, envio SendGrid, etc.)
- [ ] Nenhum erro no Sentry nas primeiras 15 min

---

## Rollback Geral

1. Para cada segredo: anotar valor anterior em local seguro **antes** de rotacionar
2. Railway NÃO mantém histórico de env vars — responsabilidade do operador salvar valor anterior
3. Em caso de erro: Railway → Variables → restaurar valor anterior → restart automático
4. Tempo estimado de rollback: ~2 minutos (restart Railway + health check)

---

## Riscos e Mitigações

| Risco | Probabilidade | Mitigação |
|-------|---------------|-----------|
| Não salvar valor anterior antes de rotacionar | Alta | Checklist obrigatório: copiar valor atual ANTES de mudar |
| `SECRET_KEY` invalida sessões em horário de pico | Média | Rotar na madrugada; avisar equipe |
| `FIREBASE_PRIVATE_KEY` incorreto derruba auth | Alta | Testar em staging primeiro; manter chave antiga ativa 24h |
| Revogar Cloudinary/SendGrid antes de confirmar nova | Média | Sempre testar antes de revogar |
| VAPID rotacionado sem comunicar usuários | Baixa | Notificar que push será temporariamente desativado |

---

## Auditoria de Rotações (manter atualizado)

| Data | Segredo | Responsável | Motivo | Resultado |
|------|---------|-------------|--------|-----------|
| (aguardando primeira rotação) | | | | |
