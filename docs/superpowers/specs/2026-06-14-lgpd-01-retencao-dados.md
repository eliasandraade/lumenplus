# LGPD-01 — Política de Retenção de Dados

**Data:** 2026-06-14 | **Prioridade:** P1 | **Depende de staging:** Não

---

## Problema

O Lumen+ armazena dados pessoais de usuários (perfil, projeto de vida mensal, métricas espirituais, evangelização) sem política documentada de retenção. A LGPD (Lei 13.709/2018, Art. 15) exige que dados pessoais sejam mantidos apenas pelo tempo necessário para a finalidade que motivou sua coleta, ou pelo prazo legal aplicável.

Sem política de retenção:
- Dados de usuários inativos acumulam indefinidamente
- Não há processo de purga automatizada
- Risco de não conformidade com requisição de exclusão (Art. 18, VI)

---

## Objetivo

1. Definir períodos de retenção para cada categoria de dado
2. Implementar mecanismo de purga/anonimização para dados expirados
3. Garantir que solicitação de exclusão (LGPD Art. 18) seja atendível

---

## Escopo

- Mapeamento de dados armazenados por categoria
- Definição de períodos de retenção
- Implementação de task/script de purga (se necessário)
- Documentação em Política de Privacidade (LGPD-06)

## Fora de Escopo

- Logs de servidor Railway (responsabilidade da Railway por seus SLAs)
- Dados de Firebase Auth (gerenciados pelo Firebase)

---

## Categorias de Dados Mapeadas

| Categoria | Tabelas / Campos | Finalidade | Retenção Sugerida |
|-----------|-----------------|------------|-------------------|
| Dados de conta | `users` (name, email, uid) | Identificação e autenticação | Até exclusão da conta + 30 dias |
| Projeto de Vida Mensal | `projetos_vida_mensal`, campos reflexão | Ferramenta espiritual pessoal | Ativo enquanto usuário ativo; 1 ano após inatividade |
| Áreas mensais | `areas_mensais` | Organização espiritual | Junto com PVM |
| Evangelização | `plano_evangelizacao`, `acoes_evangelizacao` | Ferramenta missionária | Ativo enquanto usuário ativo |
| Reflexões | `reflexao_evangelizacao` | Formação espiritual | Junto com PVM |
| Sessões/tokens | JWT (`SECRET_KEY`) | Autenticação | Expiração natural (não persistido) |

---

## Dependências

- **LGPD-02** (DPO designado) — períodos de retenção devem ser aprovados pelo DPO antes de serem vinculantes
- Consulta jurídica para confirmar prazos legais (ex: se há dados contábeis que exigem retenção mínima por lei)

---

## Decisões Humanas Requeridas

| Decisão | Responsável |
|---------|-------------|
| Aprovação dos períodos de retenção | DPO (LGPD-02) + Conselho |
| Definir o que é "usuário inativo" (1 ano? 2 anos?) | Elias + DPO |
| Definir se purga é hard delete ou anonimização | Elias + DPO |

---

## Riscos

| Risco | Probabilidade | Mitigação |
|-------|---------------|-----------|
| Purga acidental de dados ativos | Alta | Testar em staging; soft delete antes de hard delete |
| Período de retenção muito curto (insatisfação de usuário) | Média | Avisar usuário antes de purgar; oferecer exportação |
| Período muito longo (não conformidade LGPD) | Média | Revisão jurídica |

---

## Plano de Implementação

### Fase 1 — Decisão e documentação (sem código)
- [ ] DPO revisa categorias de dados
- [ ] DPO aprova períodos de retenção
- [ ] Decisão: hard delete vs anonimização para cada categoria

### Fase 2 — Código (após aprovação)
```python
# backend/app/tasks/data_retention.py
# Task executada periodicamente (APScheduler ou Railway cron)
# Para usuários inativos há N dias: anonimizar ou deletar dados pessoais

# Exemplo de anonimização (preserva estatísticas, remove dados pessoais):
# UPDATE users SET name = 'Usuário Anonimizado', email = NULL WHERE last_active < NOW() - INTERVAL '2 years'
```

### Fase 3 — Endpoint de exclusão por solicitação
```python
# GET /me/export — exportar todos os dados do usuário
# DELETE /me — iniciar processo de exclusão (30 dias de grace period)
```

---

## Critérios de Aceite

- Política de retenção documentada e aprovada pelo DPO
- Mecanismo de purga implementado e testado em staging
- Endpoint `DELETE /me` funcional
- Documentado na Política de Privacidade (LGPD-06)
- Sem dados de usuários deletados ainda presentes após execução da purga

## Rollback

Purga de dados é irreversível por design (LGPD). Implementar soft delete (campo `deleted_at`) antes do hard delete para período de grace.

---

## Classificação

- **Depende de staging:** Não (mas testes de purga obrigatórios em staging antes de produção)
- **Bloqueia App Store/Play Store:** Indiretamente (Apple exige política de privacidade com retenção definida)
- **Implementável via código:** ✅ Parcialmente (decisão humana primeiro)
- **Depende de decisão humana:** ✅ Sim — DPO deve aprovar períodos
