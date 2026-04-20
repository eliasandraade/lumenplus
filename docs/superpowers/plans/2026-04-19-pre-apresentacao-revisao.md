# Lumen+ Pre-Apresentação Review Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Preparar o Lumen+ para demo ao vivo na sexta-feira, corrigindo bugs críticos, polindo UX e validando a confiabilidade do fluxo de demonstração.

**Architecture:** React Native (Expo Router 4, SPA export no Vercel) + FastAPI (Railway) + PostgreSQL (Railway) + Firebase Auth. Navegação por Stack aninhado — grupos `(auth)`, `(onboarding)`, `(tabs)`, mais módulos standalone (`vida`, `admin`, `biblia`, `catecismo`, `retreats`, `coordinator`).

**Tech Stack:** Expo SDK 52, Expo Router 4, React Query, FastAPI 0.115, SQLAlchemy 2.0 (mapped_column), Alembic 26 migrations, PostgreSQL (Railway), Firebase Auth, Vercel Analytics, Sentry.

---

## Mapa de Arquivos

| Arquivo | Responsabilidade |
|---------|-----------------|
| `lumen_mobile/app/_layout.tsx` | Stack raiz — registra todos os grupos de rotas |
| `lumen_mobile/app/vida/_layout.tsx` | Sub-Stack do módulo Projeto de Vida |
| `lumen_mobile/app/vida/index.tsx` | Tela principal do ciclo ativo/rascunho |
| `lumen_mobile/app/vida/wizard.tsx` | Wizard 8 passos de criação/edição |
| `lumen_mobile/app/vida/revisao.tsx` | Revisão mensal |
| `lumen_mobile/app/vida/historico.tsx` | Histórico de ciclos |
| `lumen_mobile/app/(auth)/register.tsx` | Wizard de cadastro 4 passos |
| `lumen_mobile/app/(tabs)/_layout.tsx` | Tab navigator principal |
| `lumen_mobile/app/(tabs)/profile.tsx` | Tela de perfil |
| `lumen_mobile/src/data/vida.ts` | Constantes do módulo Vida |
| `backend/app/db/session.py` | Pool SQLAlchemy |
| `backend/app/settings.py` | Configurações (pool_size, CORS, etc.) |
| `backend/app/api/routes/admin.py` | Rotas admin + superuser |
| `backend/alembic/versions/026_fix_catalog_items.py` | Último migration (catálogos) |

---

## Task 1: Corrigir Registro do Módulo "vida" no Stack Raiz (CRÍTICO)

**Problema:** `lumen_mobile/app/vida/` existe mas **não está declarado** no `Stack` do `_layout.tsx` raiz. Isso não impede a navegação básica no Expo Router (file-based routing detecta automaticamente), mas pode causar flash de cabeçalho incorreto, animações erradas e falha em deep links.

**Files:**
- Modify: `lumen_mobile/app/_layout.tsx` (linhas 87–96)

- [ ] **Step 1: Ler o arquivo atual**

```bash
# Confirmar o estado atual das linhas 87-96
cat -n "lumen_mobile/app/_layout.tsx" | head -100
```

- [ ] **Step 2: Adicionar Stack.Screen "vida" no root _layout.tsx**

No arquivo `lumen_mobile/app/_layout.tsx`, adicionar após a linha do `coordinator`:

```tsx
<Stack.Screen name="vida" options={{ headerShown: false }} />
```

O bloco final do `<Stack>` deve ficar assim:

```tsx
<Stack.Screen name="index" options={{ headerShown: false }} />
<Stack.Screen name="(auth)" options={{ headerShown: false }} />
<Stack.Screen name="(onboarding)" options={{ headerShown: false }} />
<Stack.Screen name="(tabs)" options={{ headerShown: false }} />
<Stack.Screen name="admin" options={{ headerShown: false }} />
<Stack.Screen name="biblia" options={{ headerShown: false }} />
<Stack.Screen name="catecismo" options={{ headerShown: false }} />
<Stack.Screen name="retreats" options={{ headerShown: false }} />
<Stack.Screen name="coordinator" options={{ headerShown: false }} />
<Stack.Screen name="vida" options={{ headerShown: false }} />
```

- [ ] **Step 3: Verificar visualmente no simulador**

Navegar para Projeto de Vida a partir da tela Home/Service. Confirmar que:
- Cabeçalho do BreadcrumbHeader aparece corretamente ("Projeto de Vida")
- Botão voltar funciona
- Animação de entrada é consistente com outros módulos

- [ ] **Step 4: Commit**

```bash
git add lumen_mobile/app/_layout.tsx
git commit -m "fix: register vida module in root Stack navigator"
```

---

## Task 2: Aumentar Pool SQLAlchemy para Demo (Performance)

**Problema:** `pool_size=5` e `max_overflow=10` causaram p95=60s no load test com 50 VUs. Para demo, 10–20 usuários simultâneos são o cenário realista — mas queremos margem de segurança.

**Files:**
- No code change needed — ajuste via variável de ambiente no Railway.

- [ ] **Step 1: Verificar valores atuais no Railway**

```bash
railway variables --service backend | grep -i pool
```

Esperado: nada (usa defaults do código: pool_size=5, max_overflow=10).

- [ ] **Step 2: Setar variáveis no Railway**

```bash
railway variables set DATABASE_POOL_SIZE=15 DATABASE_MAX_OVERFLOW=20 --service backend
```

Isso aumenta a capacidade total de conexões de 15 para 35.

- [ ] **Step 3: Verificar se Railway relançou o serviço**

```bash
railway status --service backend
```

Aguardar status `ACTIVE`. Se não relançar automaticamente:

```bash
railway up --service backend --detach
```

- [ ] **Step 4: Teste rápido de sanidade**

```bash
curl https://<BACKEND_URL>/health
```

Deve retornar `{"status": "ok"}` em menos de 500ms.

- [ ] **Step 5: Commit da documentação (settings.py já suporta as env vars)**

```bash
# Não é necessário alterar código — settings.py já lê DATABASE_POOL_SIZE e DATABASE_MAX_OVERFLOW
# Apenas documentar em .env.example
```

Abrir `backend/.env.example` (ou criar se não existir) e garantir que contém:

```env
# Connection Pool (aumentar para produção com muitos usuários simultâneos)
DATABASE_POOL_SIZE=15
DATABASE_MAX_OVERFLOW=20
```

```bash
git add backend/.env.example
git commit -m "docs: document recommended pool settings for production"
```

---

## Task 3: Validação do Wizard de Projeto de Vida (Todos os 8 Passos)

**Problema:** O wizard de 8 passos pode ter lacunas de validação que permitam avançar sem preencher campos obrigatórios — isso causa crash ao salvar e situação constrangedora na demo.

**Files:**
- Read + potentially modify: `lumen_mobile/app/vida/wizard.tsx`

- [ ] **Step 1: Ler o arquivo completo do wizard**

```bash
cat -n "lumen_mobile/app/vida/wizard.tsx"
```

Procurar pela função `validateStep` (ou equivalente `canAdvance`/`isStepValid`).

- [ ] **Step 2: Mapear validações por passo**

Verificar cada passo tem validação antes de `setStep(step + 1)`:

| Passo | Campo obrigatório | Validação esperada |
|-------|------------------|--------------------|
| 1 – Realidade Vocacional | `selectedVocational` | `!= null` |
| 2 – Diagnóstico | Cada dimensão: `abandonar`, `melhorar`, `deus_pede` | `trim().length > 0` |
| 3 – Síntese | `dominantDefect`, pelo menos 1 virtude | string não vazia |
| 4 – Objetivo Principal | `goalTitle`, `goalDescription` | `trim().length > 0` |
| 5 – Meios Concretos | Pelo menos 1 meio concreto com descrição | array.length > 0 |
| 6 – Rotina Espiritual | `prayer_types.length > 0`, `mass_frequency` | não vazio |
| 7 – Diretor Espiritual | `directorName` | pode ser opcional |
| 8 – Confirmar | Apenas revisão — sem campos | sempre pode confirmar |

- [ ] **Step 3: Corrigir validações faltantes**

Se algum passo não tiver validação, adicionar antes do botão "Próximo". Padrão a seguir (baseado no que já existe no wizard):

```tsx
// Exemplo de validação para passo de diagnóstico
const isDiagnosisComplete = () => {
  return DIMENSIONS.every(dim => {
    const d = diagnosis[dim.key];
    return d?.abandonar?.trim() && d?.melhorar?.trim() && d?.deus_pede?.trim();
  });
};

// No botão Próximo:
onPress={() => {
  if (!isDiagnosisComplete()) {
    // Mostrar feedback — NÃO usar Alert.alert (bug no Expo Web)
    setValidationError('Preencha todos os campos do diagnóstico antes de avançar.');
    return;
  }
  setStep(step + 1);
}}
```

**IMPORTANTE:** Nunca usar `Alert.alert` — usar estado de erro inline (o bug já foi corrigido no vida/index.tsx, aplicar o mesmo padrão aqui se encontrado).

- [ ] **Step 4: Testar fluxo completo do wizard**

Executar o app e tentar avançar cada passo sem preencher nada. Confirmar que:
- Cada passo bloqueia a progressão com mensagem de erro visível
- Nenhum `Alert.alert` é disparado

- [ ] **Step 5: Commit**

```bash
git add lumen_mobile/app/vida/wizard.tsx
git commit -m "fix: enforce validation on all wizard steps, replace Alert.alert with inline errors"
```

---

## Task 4: Polish de UX — Telas Críticas para a Demo

**Objetivo:** Garantir que as telas visíveis durante a demo tenham empty states dignos, loading states corretos e nenhuma mensagem de erro exposta ao usuário.

**Files:**
- Read + modify: `lumen_mobile/app/(tabs)/home.tsx`
- Read + modify: `lumen_mobile/app/(tabs)/service.tsx`
- Read + modify: `lumen_mobile/app/(tabs)/community.tsx`
- Read + modify: `lumen_mobile/app/vida/index.tsx`

- [ ] **Step 1: Ler cada tela e catalogar problemas**

Para cada arquivo, verificar:
1. Tem `ActivityIndicator` ou skeleton durante loading?
2. Tem empty state com texto explicativo (não apenas "array vazio")?
3. Erros de rede mostram mensagem amigável (não stack trace)?
4. Cores são consistentes com `primary: '#1A859B'`?

```bash
# Verificar padrão de loading em cada tab
grep -n "loading\|ActivityIndicator\|skeleton\|empty" \
  "lumen_mobile/app/(tabs)/home.tsx" \
  "lumen_mobile/app/(tabs)/service.tsx" \
  "lumen_mobile/app/(tabs)/community.tsx"
```

- [ ] **Step 2: Corrigir empty states nas tabs**

Se uma tela retorna array vazio sem mensagem, adicionar componente de empty state:

```tsx
// Padrão de empty state — usar em todas as tabs que listam itens
{items.length === 0 && !loading && (
  <View style={styles.emptyContainer}>
    <Ionicons name="leaf-outline" size={48} color="#d1d5db" />
    <Text style={styles.emptyTitle}>Nada por aqui ainda</Text>
    <Text style={styles.emptySubtitle}>
      Quando houver conteúdo, ele aparecerá aqui.
    </Text>
  </View>
)}

// Estilos
emptyContainer: {
  flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 60,
},
emptyTitle: {
  fontSize: 16, fontWeight: '600', color: '#374151', marginTop: 12, marginBottom: 4,
},
emptySubtitle: {
  fontSize: 14, color: '#9ca3af', textAlign: 'center', paddingHorizontal: 24,
},
```

- [ ] **Step 3: Verificar tela vida/index.tsx — fluxo do botão Ativar**

Confirmar que o `confirmCard` inline (sem Alert.alert) está funcionando corretamente:

```bash
grep -n "showActivateConfirm\|confirmCard\|Alert" "lumen_mobile/app/vida/index.tsx"
```

Confirmar que `Alert` não é chamado em nenhum caminho. Se ainda houver chamadas residuais de `Alert.alert`, substituir por estado de erro inline.

- [ ] **Step 4: Verificar BreadcrumbHeader em todos os sub-layouts**

```bash
grep -rn "BreadcrumbHeader" lumen_mobile/app/
```

Confirmar que o import `@/components/ui/BreadcrumbHeader` resolve corretamente em todos os layouts. Testar build de produção:

```bash
cd lumen_mobile && npx expo export --platform web 2>&1 | tail -20
```

Se houver erros de import, rastrear e corrigir o path.

- [ ] **Step 5: Commit**

```bash
git add lumen_mobile/app/(tabs)/ lumen_mobile/app/vida/
git commit -m "polish: improve empty states, loading states, and UX consistency across main tabs"
```

---

## Task 5: Auditoria de Segurança — CORS, Auth Guards e Superusuário

**Files:**
- Read: `backend/app/settings.py`
- Read: `backend/app/api/routes/admin.py`
- Read: `backend/app/api/dependencies/auth.py` (ou equivalente)

- [ ] **Step 1: Verificar CORS_ORIGINS no Railway**

```bash
railway variables --service backend | grep -i cors
```

Deve incluir `https://lumenplus.vercel.app`. Se não estiver presente:

```bash
railway variables set CORS_ORIGINS="http://localhost:3000,http://localhost:8081,https://lumenplus.vercel.app" --service backend
```

- [ ] **Step 2: Confirmar que endpoints admin requerem autenticação**

```bash
grep -n "require_admin\|get_current_user\|Depends(" backend/app/api/routes/admin.py | head -30
```

Verificar que todas as rotas de admin usam `Depends(require_admin_or_analista)` ou equivalente. Nenhuma rota admin deve ser pública.

- [ ] **Step 3: Confirmar superusuário oeliasandraade@gmail.com**

```bash
# Verificar role no banco via Railway
railway run --service backend python -c "
from app.db.session import SessionLocal
from app.db.models import User, UserIdentity, UserGlobalRole
db = SessionLocal()
identity = db.query(UserIdentity).filter(UserIdentity.email == 'oeliasandraade@gmail.com').first()
if identity:
    roles = db.query(UserGlobalRole).filter(UserGlobalRole.user_id == identity.user_id).all()
    print('Roles:', [r.role for r in roles])
else:
    print('Usuário não encontrado')
db.close()
"
```

Se o usuário não tiver role ADMIN, adicionar:

```bash
railway run --service backend python -c "
from app.db.session import SessionLocal
from app.db.models import UserIdentity, UserGlobalRole
from uuid import uuid4
import datetime
db = SessionLocal()
identity = db.query(UserIdentity).filter(UserIdentity.email == 'oeliasandraade@gmail.com').first()
if identity:
    existing = db.query(UserGlobalRole).filter(
        UserGlobalRole.user_id == identity.user_id,
        UserGlobalRole.role == 'ADMIN'
    ).first()
    if not existing:
        role = UserGlobalRole(
            id=uuid4(),
            user_id=identity.user_id,
            role='ADMIN',
            created_at=datetime.datetime.utcnow()
        )
        db.add(role)
        db.commit()
        print('ADMIN role adicionado com sucesso')
    else:
        print('Usuário já é ADMIN')
db.close()
"
```

- [ ] **Step 4: Verificar que auth_mode=PROD no Railway**

```bash
railway variables --service backend | grep AUTH_MODE
```

Deve ser `PROD`. Se `DEV`, a autenticação Firebase está desativada (qualquer token é aceito).

- [ ] **Step 5: Verificar que enable_dev_endpoints=False em produção**

```bash
railway variables --service backend | grep ENABLE_DEV
```

Deve ser `False` ou ausente (default é `True` — risco de segurança em produção!).

Se estiver faltando:

```bash
railway variables set ENABLE_DEV_ENDPOINTS=false --service backend
```

- [ ] **Step 6: Commit de qualquer ajuste**

```bash
git add backend/
git commit -m "security: confirm auth guards, CORS and dev endpoints disabled in production"
```

---

## Task 6: Verificar Catálogos de Perfil no Banco de Dados

**Contexto:** Migrações 025 + 026 foram criadas para corrigir duplicatas nos catálogos. Precisamos confirmar que o banco de produção está com os dados corretos antes da demo.

**Files:**
- Read (reference): `backend/alembic/versions/026_fix_catalog_items.py`

- [ ] **Step 1: Verificar versão atual do Alembic**

```bash
railway run --service backend alembic current
```

Deve mostrar `026_fix_catalog_items (head)`.

Se mostrar versão anterior, rodar upgrade:

```bash
railway run --service backend alembic upgrade head
```

- [ ] **Step 2: Confirmar contagem de itens no banco**

```bash
railway run --service backend python -c "
from app.db.session import SessionLocal
from app.db.models import ProfileCatalog, ProfileCatalogItem
db = SessionLocal()
for catalog in db.query(ProfileCatalog).all():
    count = db.query(ProfileCatalogItem).filter(
        ProfileCatalogItem.catalog_id == catalog.id
    ).count()
    print(f'{catalog.code}: {count} items')
db.close()
"
```

Esperado:
- `LIFE_STATE: 8 items`
- `MARITAL_STATUS: 7 items`
- `VOCATIONAL_REALITY: 7 items`

Se os números não baterem, executar o upgrade novamente.

- [ ] **Step 3: Confirmar que o register.tsx carrega os catálogos corretamente**

No app, iniciar o fluxo de cadastro e ir até o Passo 3 (Dados Vocacionais). Os dropdowns devem mostrar:

**Estado de Vida:** Leigo, Leigo Consagrado, Celibatário, Seminarista, Diácono Permanente, Diácono, Sacerdote, Bispo

**Estado Civil:** Solteiro, Noivo, Casado, Celibatário, Divorciado, Viúvo, União Estável

**Realidade Vocacional:** Membro do Acolhida, Membro do Aprofundamento, Vocacional, Postulante de Primeiro Ano, Postulante de Segundo Ano, Discípulo Vocacional, Consagrado Filho da Luz

- [ ] **Step 4: Confirmar Kadosh nos Encontros Despertar**

No perfil do usuário, abrir o seletor de "Encontro Despertar" e confirmar que "Kadosh" aparece na lista.

```bash
grep -n "Kadosh\|DESPERTAR" "lumen_mobile/app/(tabs)/profile.tsx" | head -10
```

---

## Task 7: Verificar e Testar o Fluxo de Demo Completo (Happy Path)

**Objetivo:** Simular exatamente o que será mostrado na sexta-feira, do início ao fim, sem nenhum erro visível.

**Fluxo de demo sugerido:**

1. Abrir app → Tela de login
2. Fazer login com `oeliasandraade@gmail.com`
3. Ver tela Home → Navegar pelas tabs
4. Acessar Projeto de Vida
5. Criar novo ciclo (wizard 8 passos, preencher tudo)
6. Ativar o ciclo
7. Ver ciclo ativo com todas as dimensões
8. Acessar Perfil → ver dados completos
9. Acessar Admin → ver dashboard

- [ ] **Step 1: Fazer login no app de produção (web ou simulador)**

```bash
# Abrir versão web no browser
cd lumen_mobile && npx expo start --web
```

Ou verificar a URL do Vercel: `https://lumenplus.vercel.app`

- [ ] **Step 2: Testar fluxo de cadastro novo usuário**

Criar uma conta de teste `demo@lumenplus.app` (se não existir) e seguir todos os 4 passos. Confirmar:
- Passo 1: Cria conta Firebase sem erros
- Passo 2: Salva dados pessoais
- Passo 3: Dropdowns de catálogo carregam (Estado de Vida, Estado Civil, Realidade Vocacional)
- Passo 4: Instrumentos como chips funcionam; Encontro Despertar com Kadosh visível

- [ ] **Step 3: Testar criação de Projeto de Vida**

Logar como usuário de teste e criar um ciclo completo:
- Passo 1: Selecionar Realidade Vocacional
- Passo 2: Preencher todos os 15 campos de diagnóstico (5 dimensões × 3 perguntas)
- Passo 3: Defeito Dominante + Virtudes
- Passo 4: Objetivo Principal
- Passo 5: 1 meio concreto
- Passo 6: Tipo de oração + frequência da missa
- Passo 7: Nome do diretor espiritual (opcional)
- Passo 8: Confirmar

Confirmar que salva sem erros e redireciona para `vida/index`.

- [ ] **Step 4: Ativar o ciclo**

Na tela vida/index, clicar em "Ativar Projeto de Vida". O confirmCard inline deve aparecer. Confirmar. O ciclo deve mudar de `DRAFT` para `ACTIVE`.

- [ ] **Step 5: Verificar Painel Admin**

Logar como `oeliasandraade@gmail.com` e acessar `/admin`. Verificar:
- Lista de usuários carrega
- Dashboard mostra métricas

- [ ] **Step 6: Acessar Bíblia e Catecismo**

Confirmar que as telas carregam sem erro. Se houver erro de parsing de dados, documentar.

- [ ] **Step 7: Registrar problemas encontrados**

Qualquer bug encontrado neste passo vira uma tarefa adicional para corrigir antes da demo.

---

## Task 8: Build e Deploy Final para Vercel

**Objetivo:** Garantir que a versão de produção no Vercel está atualizada e funcional.

**Files:**
- `lumen_mobile/` (build)

- [ ] **Step 1: Rodar build local de produção**

```bash
cd lumen_mobile
npx expo export --platform web 2>&1
```

Verificar que não há erros de TypeScript nem de importação. Se houver warnings, avaliar se são críticos.

- [ ] **Step 2: Verificar as variáveis de ambiente no Vercel**

```bash
vercel env ls --environment=production
```

Verificar que estão presentes:
- `EXPO_PUBLIC_API_URL` — URL do backend Railway
- `EXPO_PUBLIC_FIREBASE_*` — credenciais Firebase
- `EXPO_PUBLIC_SENTRY_DSN` — (opcional mas útil para monitorar a demo)
- `EXPO_PUBLIC_ENVIRONMENT=production`

- [ ] **Step 3: Deploy no Vercel**

```bash
cd lumen_mobile
vercel --prod --yes
```

Aguardar conclusão e confirmar URL de produção.

- [ ] **Step 4: Smoke test na URL de produção**

Abrir `https://lumenplus.vercel.app` no browser e confirmar:
1. Tela de login carrega
2. Login com credenciais de teste funciona
3. Nenhum erro de CORS no console
4. Vercel Analytics não gera erros no console

- [ ] **Step 5: Commit e tag de release**

```bash
git add .
git commit -m "chore: pre-presentation final polish and deploy"
git tag -a v0.3.0-demo -m "Versão demo apresentação sexta-feira"
git push && git push --tags
```

---

## Task 9: Checklist Final Pré-Demo

Execute este checklist no dia da apresentação (pelo menos 1 hora antes):

- [ ] Backend Railway está `ACTIVE` (verificar no dashboard)
- [ ] URL do Vercel abre sem erro
- [ ] Login funciona com `oeliasandraade@gmail.com`
- [ ] Projeto de Vida mostra ciclo ativo (pre-carregar dados de demonstração)
- [ ] Painel Admin está acessível
- [ ] Bíblia carrega (conexão de dados necessária)
- [ ] Catecismo carrega
- [ ] Sem erros de CORS no console do browser
- [ ] Sentry está capturando eventos (verificar dashboard)
- [ ] Vercel Analytics ativo (`/_vercel/insights` retorna 200)
- [ ] Conta demo tem dados pré-preenchidos (não começar do zero ao vivo)
- [ ] Backup: modo offline ou screenshots de cada tela caso o Railway esteja lento

---

## Resumo de Prioridades

| Prioridade | Tarefa | Impacto na Demo |
|-----------|--------|----------------|
| 🔴 CRÍTICO | Task 1 — Registrar "vida" no Stack raiz | Crash/flash na navegação |
| 🔴 CRÍTICO | Task 3 — Validação wizard (sem Alert.alert) | Crash ao salvar; bug visível |
| 🔴 CRÍTICO | Task 6 — Catálogos corretos no banco | Dropdowns vazios no cadastro |
| 🟡 ALTO | Task 2 — Pool SQLAlchemy | Lentidão com múltiplos demo viewers |
| 🟡 ALTO | Task 5 — CORS + Auth guards + superusuário | Admin panel inacessível |
| 🟡 ALTO | Task 7 — Happy path end-to-end | Demo quebrada ao vivo |
| 🟢 MÉDIO | Task 4 — UX polish (empty states) | Aparência inacabada |
| 🟢 MÉDIO | Task 8 — Build + deploy final | Versão desatualizada no Vercel |
| ✅ FINAL | Task 9 — Checklist pré-demo | Prevenção |
