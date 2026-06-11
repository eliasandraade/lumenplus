# Lumen+ — Instruções para Claude

## Stack

- **Backend**: Python/FastAPI + PostgreSQL + Alembic (pasta `backend/`)
- **Mobile**: React Native / Expo (pasta `lumen_mobile/`)
- **CMS**: Strapi (pasta `strapi/`)
- **Deploy backend**: Railway
- **Deploy mobile**: Expo / EAS
- **Branch principal**: `main`

## Modo de Trabalho Padrão

Antes de implementar:
- Entenda o contexto; confirme stack, host, branch, scripts e objetivo
- Faça um plano curto; não gere explicações longas desnecessárias

Durante:
- Mudanças pequenas e rastreáveis
- Preserve lógica, APIs, contratos de dados e comportamento existente salvo pedido explícito
- Prefira correção mínima e segura; evite refatorações oportunistas
- Não faça mudanças visuais, arquiteturais ou destrutivas sem necessidade clara

Ao finalizar:
- Rode os checks obrigatórios
- Entregue resumo curto (≤200 palavras): arquivos alterados, comandos executados, status de build/lint/testes
- Não declare "feito" se lint, typecheck, build ou testes relevantes falharem

## Checks Obrigatórios (antes de commit/deploy)

```bash
# Mobile (lumen_mobile/)
cd lumen_mobile && npx tsc --noEmit   # typecheck
cd lumen_mobile && npm run lint       # lint

# Backend (backend/)
cd backend && python -m mypy app      # typecheck (se configurado)
cd backend && python -m pytest        # testes
```

Nunca ignore:
- Erro TypeScript / mypy
- Erro de lint / ESLint unused variables → já bloqueou deploys antes
- Build quebrado
- Teste falhando
- Warning que bloqueia deploy em Railway

## Deploy Seguro

Antes de qualquer deploy ou env var, confirme:
- **Plataforma**: Railway (backend) | Expo/EAS (mobile) — NUNCA assuma Vercel
- Conta correta, projeto correto, project ID correto
- Ambiente correto: dev / staging / production
- Branch correta
- Variáveis de ambiente necessárias presentes

Detecte pela configuração do repositório. Se não estiver documentado, **pergunte**.

Scripts de referência: `scripts/`, `Makefile`, `docker-compose.yml`

## Segurança Antes de Commit

- Revise o diff completo
- Verifique deleção em massa acidental
- Verifique secrets, tokens, credenciais, chaves privadas
- Nunca commite secrets hardcoded → use environment variables
- Se encontrar credencial exposta: pare, avise, proponha correção segura

## Design System, Temas e Dark Mode (lumen_mobile/)

- Não deixe migração parcial
- Não use hex/rgb/hsl hardcoded fora dos tokens permitidos
- Procure hardcoded colors: `grep -r "#[0-9a-fA-F]\{3,6\}\|rgb(\|hsl(" lumen_mobile/`
- Valide light mode e dark mode
- Preserve responsividade, acessibilidade básica e hierarquia visual
- **Light theme**: o redesign atual NÃO está aprovado — reverter para paleta anterior ao redesign
- **Dark mode**: deve continuar funcional
- Qualquer mudança de tema deve ser validada nos dois modos

## Banco de Dados e Slugs

Antes de assumir que algo falhou visualmente ou "não há dados":
- Consulte o banco real quando possível (MCP/Postgres se disponível)
- Confirme seeds, slugs reais, tenant, filtros e permissões
- Não use slug hardcoded sem validar com a base
- Não conclua que o código está errado antes de verificar estado real do banco

## Controle de Tokens e Contexto

- Respostas finais ≤200 palavras, salvo pedido contrário
- Não repetir histórico; não colar arquivos grandes sem necessidade
- Usar checklists curtos
- Em tarefas grandes: quebrar em checkpoints, commitar ao fim de cada um
- Não tentar resolver 30 arquivos em uma única resposta

## Commits e Branches

Antes de commitar:
- Rode checks, revise diff, confirme que não há arquivos indevidos
- Mensagem de commit clara e objetiva

Não commite com: build quebrado | lint quebrado | secrets | deleções inesperadas | arquivos temporários | logs | `.env` real

## Prompts Padrão Reutilizáveis

**Sprint segura**: "Trabalhe em checkpoints pequenos. Depois de cada checkpoint, rode checks, commite se estável e resuma em até 200 palavras. Não avance com build/lint/typecheck quebrado."

**Deploy seguro**: "Antes de deployar, confirme plataforma, conta, projeto, ambiente e branch. Rode typecheck, lint, build e testes relevantes. Revise diff contra secrets e deleções. Só depois faça push/deploy."

**Auditoria de tema**: "Audite todas as telas para hardcoded colors. Migre para tokens. Valide light e dark mode. Não declare concluído enquanto houver hex/rgb indevido ou tela parcialmente migrada."

**Banco real**: "Antes de assumir bug visual ou ausência de dados, consulte o banco real e confirme slugs, seeds, tenant, filtros e registros existentes."

## Regra Final

- Conflito entre velocidade e segurança → **segurança**
- Conflito entre explicação longa e ação verificável → **ação verificável**
- Dúvida sobre deploy, banco, secrets ou deleção → **pare e peça confirmação**
- Sem dúvida → **execute com objetividade**
