# LGPD-06 — Revisar Política de Privacidade

**Data:** 2026-06-14 | **Prioridade:** P1 | **Depende de staging:** Não

---

## Estado Atual

Verificar se existe política de privacidade atual no app:
- [ ] Checar `lumen_mobile/` por tela de privacidade
- [ ] Checar backend por migration de aceite de termos
- [ ] Checar `strapi/` por conteúdo de política

---

## Problema

A LGPD Art. 9º exige que o titular seja informado de forma clara e acessível sobre o tratamento de seus dados antes ou no momento da coleta. Sem política de privacidade atualizada e acessível no app:
- Não conformidade com LGPD Art. 9º (transparência)
- Apple App Store e Google Play exigem URL de política de privacidade na submissão
- Consentimento coletado sem base legal clara pode ser inválido

---

## Objetivo

Revisar e publicar Política de Privacidade completa, cobrindo:
1. Dados coletados e finalidade (baseado no ROPA — LGPD-03)
2. Base legal para cada tratamento
3. Compartilhamento com terceiros (Firebase, Railway, Vercel, Sentry, Cloudinary, SendGrid)
4. Direitos do titular (Art. 18) com canal de contato do DPO
5. Prazo de retenção por categoria (baseado em LGPD-01)
6. Política de cookies (web app)
7. Atualizações da política (versionamento + notificação)

---

## Escopo

- Texto da Política de Privacidade
- Tela de Política de Privacidade no app (React Native)
- Link na tela de onboarding / cadastro
- URL pública (hospedada no Vercel ou domínio próprio)
- Migration de aceite se houve mudança material (coleta de novos dados)

## Fora de Escopo

- Termos de Uso (documento separado, se necessário)
- Política de Cookies separada (pode ser seção dentro da Política de Privacidade)

---

## Dependências

- **LGPD-02** — DPO identificado e contato publicado
- **LGPD-01** — prazos de retenção aprovados
- **LGPD-03** — ROPA completo (base para o texto da política)

---

## Decisões Humanas Requeridas

| Decisão | Responsável |
|---------|-------------|
| Revisar e aprovar texto final | DPO + Conselho |
| Decidir se mudança é material (requer novo aceite) | DPO |
| Definir URL pública da política | Elias |

---

## Riscos

| Risco | Probabilidade | Mitigação |
|-------|---------------|-----------|
| Mudança material exige nova migration de aceite | Média | Avaliar com DPO antes de publicar |
| Apple/Google rejeitam app sem URL de política | Alta | Publicar política antes de submeter às lojas |
| Política genérica demais (ANPD pode sancionar) | Média | Revisão jurídica; baseado no ROPA real |

---

## Plano de Implementação

### Passo 1 — Redigir texto (baseado em LGPD-01/02/03)
Estrutura mínima:
```markdown
1. Quem somos (controlador)
2. DPO — nome e contato
3. Dados que coletamos
4. Como usamos seus dados
5. Base legal para cada tratamento
6. Com quem compartilhamos (suboperadores)
7. Por quanto tempo guardamos
8. Seus direitos (Art. 18 LGPD)
9. Segurança
10. Atualizações desta política
11. Como nos contatar
```

### Passo 2 — Publicar no app
```tsx
// lumen_mobile/app/privacy-policy.tsx
// Tela com texto da política
// Link acessível a partir de: Settings, Login, Cadastro
```

### Passo 3 — URL pública
```
https://lumenplus.app/privacidade
ou
https://lumenplus-git-main-applumenplus.vercel.app/privacidade
```

### Passo 4 — Migration de aceite (se mudança material)
```python
# backend/alembic/versions/0XX_add_privacy_policy_v2_accepted.py
# Adicionar campo accepted_privacy_v2_at em users
# Mostrar modal de nova política na próxima abertura do app
```

---

## Critérios de Aceite

- Política de Privacidade publicada em URL pública permanente
- Texto revisado e aprovado pelo DPO
- Tela de política acessível no app (Settings → Privacidade)
- Link de política presente na tela de cadastro
- Se mudança material: migration de aceite implementada e testada

## Rollback

Reverter texto para versão anterior no git + reverter migration de aceite (apenas se não chegou a produção).

---

## Classificação

- **Depende de staging:** Não (texto/documento), mas tela no app deve ser testada em staging
- **Bloqueia App Store/Play Store:** ✅ Sim — Apple e Google exigem URL de política de privacidade
- **Implementável via código:** ✅ Parcialmente (texto é humano; tela no app é código)
- **Depende de decisão humana:** ✅ Sim — DPO aprova texto
