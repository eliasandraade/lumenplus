# Projeto de Vida 2.0 — Plano de Implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Evoluir o módulo Projeto de Vida do Lumen+ para fidelidade ao Documento Oficial da Obra Lumen, adicionando três camadas temporais (Mensal/Semanal/Diário), cinco áreas estruturadas, Exame de Consciência, Intercessão e adaptação vocacional — sem quebrar dados existentes.

**Architecture:** Quatro novas tabelas (`projetos_vida_areas_mensais`, `projetos_vida_exame`, `projetos_vida_semanal`, `projetos_vida_intercessao`) + dois campos novos no cabeçalho mensal. Planejamento diário vive como JSONB dentro do semanal. Tabelas históricas mantidas intactas com discriminador `has_new_structure`. Proteção por PIN via `UnlockedCyclesContext` in-memory no frontend.

**Tech Stack:** FastAPI + SQLAlchemy + Alembic (backend) · React Native / Expo Router + TypeScript (frontend) · PostgreSQL (banco) · Pydantic v2 (validação)

**Spec de referência:** `docs/superpowers/specs/2026-06-06-projeto-vida-2.0-spec.md`

---

## MAPA DE ARQUIVOS

### Backend — Arquivos modificados

| Arquivo | Modificação |
|---|---|
| `backend/alembic/versions/039_pvm_add_reflexao_evangelizacao.py` | CRIAR — ADD coluna `reflexao_evangelizacao` em `projetos_vida_mensal` |
| `backend/alembic/versions/040_pvm_areas_mensais.py` | CRIAR — CREATE TABLE `projetos_vida_areas_mensais` |
| `backend/alembic/versions/041_pvm_exame.py` | CRIAR — CREATE TABLE `projetos_vida_exame` |
| `backend/alembic/versions/042_pvm_semanal.py` | CRIAR — CREATE TABLE `projetos_vida_semanal` |
| `backend/alembic/versions/043_pvm_intercessao.py` | CRIAR — CREATE TABLE `projetos_vida_intercessao` |
| `backend/app/db/models.py` | MODIFICAR — 4 novos modelos ORM + campo novo em `ProjetoVidaMensal` |
| `backend/app/schemas/projeto_vida_mensal.py` | MODIFICAR — novos schemas para áreas, exame, semanal, intercessão |
| `backend/app/api/projeto_vida_mensal_routes.py` | MODIFICAR — novos endpoints + lógica dual de leitura |
| `backend/tests/test_projeto_vida_mensal.py` | MODIFICAR — testes para todos os novos endpoints |

### Backend — Arquivos novos

| Arquivo | Propósito |
|---|---|
| `backend/app/api/projeto_vida_semanal_routes.py` | Endpoints do semanal (`GET/PUT /projeto-vida-semanal/{id}`) |

### Frontend — Arquivos modificados

| Arquivo | Modificação |
|---|---|
| `lumen_mobile/src/services/projetoVidaMensal.ts` | MODIFICAR — novos tipos e métodos de API |
| `lumen_mobile/src/data/vida.ts` | MODIFICAR — constantes de áreas e práticas de vida interior |
| `lumen_mobile/app/vida/_layout.tsx` | MODIFICAR — registrar novas rotas |
| `lumen_mobile/app/vida/index.tsx` | MODIFICAR — hub com novas seções |
| `lumen_mobile/app/vida/wizard.tsx` | MODIFICAR — reformular para 11 passos |
| `lumen_mobile/app/vida/ciclo.tsx` | MODIFICAR — exibir áreas novas e legado |

### Frontend — Arquivos novos

| Arquivo | Propósito |
|---|---|
| `lumen_mobile/src/data/conteudoVocacional.ts` | Textos de motivação e templates de dever de estado por vocação |
| `lumen_mobile/src/contexts/UnlockedCyclesContext.tsx` | Contexto in-memory do PIN desbloqueado |
| `lumen_mobile/app/vida/exame.tsx` | Tela de exame de consciência |
| `lumen_mobile/app/vida/semanal.tsx` | Tela do projeto semanal |
| `lumen_mobile/app/vida/diario.tsx` | Tela "Amanhã com o Emanuel" |

---

## FASE 0 — Motivação Adaptada ao Perfil

> **Objetivo:** Contextualizar a abertura do wizard com dados vocacionais já existentes no perfil. Zero migrations. Entrega imediata.

---

### Tarefa 0.1 — Arquivo de conteúdo vocacional

**Arquivos:**
- Criar: `lumen_mobile/src/data/conteudoVocacional.ts`

- [ ] Criar o arquivo `conteudoVocacional.ts` com a interface `MotivacaoContent`:
  ```typescript
  export interface MotivacaoContent {
    saudacao: string;
    reflexao: string;
    escritura: string;
    questaoMeditacao: string;
  }
  ```

- [ ] Adicionar o mapa `MOTIVACAO_CONTENT` com entradas para cada etapa formativa. Usar as chaves exatas retornadas pelo backend para `vocational_reality_code`:
  ```typescript
  export const MOTIVACAO_CONTENT: Record<string, MotivacaoContent> = {
    ACOLHIDA: {
      saudacao: 'Bem-vindo ao seu Projeto de Vida, {nome}.',
      reflexao: 'Você está dando os primeiros passos neste caminho. Deus te chama a conhecer Seu amor e a descobrir Sua presença em cada detalhe da sua vida.',
      escritura: '"Vinde a mim, todos os que estais cansados e oprimidos, e Eu vos aliviarei." (Mt 11,28)',
      questaoMeditacao: 'Como Deus está me chamando a confiar mais nEle neste mês?',
    },
    APROFUNDAMENTO: {
      saudacao: 'Seja bem-vindo ao seu novo ciclo, {nome}.',
      reflexao: 'Nesta etapa de aprofundamento, você é convidado a mergulhar mais fundo no amor de Deus e a discernir Sua vontade para a sua vida.',
      escritura: '"O Senhor é meu pastor e nada me faltará." (Sl 23,1)',
      questaoMeditacao: 'Em que área da minha vida Deus está me pedindo maior entrega neste mês?',
    },
    VOCACIONAL: {
      saudacao: 'Que este ciclo seja um tempo de graça, {nome}.',
      reflexao: 'Como membro vocacional, você está num momento especial de discernimento. Deixe que o Senhor ilumine cada decisão deste mês.',
      escritura: '"Não fostes vós que me escolhestes, mas fui Eu que vos escolhi." (Jo 15,16)',
      questaoMeditacao: 'Como estou respondendo ao chamado de Deus na minha vida concreta hoje?',
    },
    POSTULANTADO: {
      saudacao: 'Que Deus guie cada passo seu neste ciclo, {nome}.',
      reflexao: 'O postulantado é um tempo de preparação e discernimento. Cada comprometimento que você assume neste mês é uma resposta concreta ao chamado que ouviu.',
      escritura: '"Aqui estou, envia-me." (Is 6,8)',
      questaoMeditacao: 'Como estou vivendo a disponibilidade que Deus me pede neste momento da minha formação?',
    },
    DISCIPULADO: {
      saudacao: 'Bem-vindo ao seu novo ciclo de discipulado, {nome}.',
      reflexao: 'Como discípulo vocacional, você é chamado a seguir Jesus de perto, a aprender com Ele e a irradiar Sua presença ao redor.',
      escritura: '"Segue-me." (Jo 1,43)',
      questaoMeditacao: 'Como Jesus está me convidando a crescer como Seu discípulo neste mês?',
    },
    CONSAGRADO_FILHO_DA_LUZ: {
      saudacao: 'Que o Emanuel renove seu coração neste ciclo, {nome}.',
      reflexao: 'Como consagrado Filho da Luz, seu Projeto de Vida é expressão de um amor total. Cada área planejada aqui é uma oferta concreta ao Senhor.',
      escritura: '"Não sou mais eu que vivo, é Cristo que vive em mim." (Gl 2,20)',
      questaoMeditacao: 'Como minha consagração está se tornando mais concreta e mais viva neste mês?',
    },
    GENERICO: {
      saudacao: 'Seja bem-vindo ao seu Projeto de Vida, {nome}.',
      reflexao: 'Este é um tempo sagrado. Antes de planejar, coloque-se diante de Deus e deixe que Ele ilumine suas escolhas.',
      escritura: '"Eu vim para que tenham vida, e a tenham em abundância." (Jo 10,10)',
      questaoMeditacao: 'Como Deus está me chamando a viver melhor Sua vontade neste mês?',
    },
  };
  ```

- [ ] Adicionar a interface `DeveEstadoCategoria` e o tipo `DeveEstadoTemplate`:
  ```typescript
  export interface DeveEstadoCategoria {
    label: string;
    placeholder: string;
  }
  
  export interface DeveEstadoTemplate {
    titulo: string;
    descricao: string;
    categorias: DeveEstadoCategoria[];
  }
  ```

- [ ] Adicionar `DEVER_ESTADO_TEMPLATES` com entradas para cada estado de vida:
  ```typescript
  export const DEVER_ESTADO_TEMPLATES: Record<string, DeveEstadoTemplate> = {
    CASADO: {
      titulo: 'Dever de Estado — Casado(a)',
      descricao: 'Como pessoa casada, seu dever de estado perante Deus envolve viver a aliança matrimonial como caminho de santificação.',
      categorias: [
        { label: 'Cônjuge', placeholder: 'Que momentos concretos vou reservar para minha esposa/marido esta semana?' },
        { label: 'Filhos', placeholder: 'Como cuidarei da educação e presença com meus filhos?' },
        { label: 'Lar e Família', placeholder: 'Que responsabilidades familiares assumirei?' },
        { label: 'Oração em Família', placeholder: 'Como organizarei a vida de oração da minha família?' },
      ],
    },
    SOLTEIRO: {
      titulo: 'Dever de Estado — Solteiro(a)',
      descricao: 'Como pessoa solteira, seu dever de estado envolve cultivar a vida interior, as relações familiares e o serviço comunitário.',
      categorias: [
        { label: 'Vida de Oração', placeholder: 'Como cuidarei da minha vida interior esta semana?' },
        { label: 'Família de Origem', placeholder: 'Que presença concreta oferecerei à minha família?' },
        { label: 'Trabalho e Estudo', placeholder: 'Como viverei meu trabalho/estudo com espírito de serviço?' },
        { label: 'Serviço na Comunidade', placeholder: 'Como contribuirei com a comunidade esta semana?' },
      ],
    },
    CELIBATARIO: {
      titulo: 'Dever de Estado — Celibatário(a)',
      descricao: 'Seu celibato é uma entrega total ao Senhor. Seu dever de estado envolve fidelidade à vida consagrada e à missão.',
      categorias: [
        { label: 'Fidelidade à Consagração', placeholder: 'Como viverei minha entrega ao Senhor esta semana?' },
        { label: 'Missão', placeholder: 'Que ações concretas de missão assumirei?' },
        { label: 'Vida Comunitária', placeholder: 'Como cultivarei os vínculos fraternos?' },
        { label: 'Vida Interior', placeholder: 'Como aprofundarei minha vida de oração?' },
      ],
    },
    SEMINARISTA: {
      titulo: 'Dever de Estado — Seminarista',
      descricao: 'Como seminarista, seu dever de estado envolve formação integral para o sacerdócio.',
      categorias: [
        { label: 'Formação', placeholder: 'Como me dedicarei à formação esta semana?' },
        { label: 'Oração', placeholder: 'Como aprofundarei minha vida de oração?' },
        { label: 'Estudos', placeholder: 'Quais são meus compromissos acadêmicos desta semana?' },
        { label: 'Pastoral', placeholder: 'Como viverei os compromissos pastorais?' },
      ],
    },
    DIACONO: {
      titulo: 'Dever de Estado — Diácono',
      descricao: 'Como diácono, seu dever de estado envolve serviço litúrgico, caritativo e evangelizador.',
      categorias: [
        { label: 'Serviço Litúrgico', placeholder: 'Quais ministérios litúrgicos exercerei esta semana?' },
        { label: 'Serviço Caritativo', placeholder: 'Como servirei os pobres e necessitados?' },
        { label: 'Família', placeholder: 'Como cuidarei da minha família?' },
        { label: 'Formação Permanente', placeholder: 'Como cuidarei da minha formação contínua?' },
      ],
    },
    DIACONO_PERMANENTE: {
      titulo: 'Dever de Estado — Diácono Permanente',
      descricao: 'Como diácono permanente, você vive a tensão fecunda entre família, trabalho e ministério.',
      categorias: [
        { label: 'Família', placeholder: 'Como cuidarei da minha família esta semana?' },
        { label: 'Ministério Diaconal', placeholder: 'Quais serviços diaconais assumirei?' },
        { label: 'Trabalho', placeholder: 'Como viverei o trabalho como missão?' },
        { label: 'Oração', placeholder: 'Como sustentarei minha vida interior?' },
      ],
    },
    SACERDOTE: {
      titulo: 'Dever de Estado — Sacerdote',
      descricao: 'Como sacerdote, seu dever de estado centra-se na Eucaristia, no confessionário e no serviço ao povo de Deus.',
      categorias: [
        { label: 'Vida Eucarística', placeholder: 'Como cuidarei da celebração e adoração?' },
        { label: 'Serviço Sacramental', placeholder: 'Quais sacramentos administrarei esta semana?' },
        { label: 'Pregação e Catequese', placeholder: 'Como prepararei minha pregação?' },
        { label: 'Paróquia e Comunidade', placeholder: 'Quais são meus compromissos comunitários?' },
      ],
    },
    BISPO: {
      titulo: 'Dever de Estado — Bispo',
      descricao: 'Como bispo, seu dever de estado é ser sinal de unidade, pai e pastor da Igreja.',
      categorias: [
        { label: 'Magistério e Governo', placeholder: 'Quais decisões pastorais assumirei esta semana?' },
        { label: 'Vida de Oração', placeholder: 'Como sustentarei minha vida interior?' },
        { label: 'Serviço à Diocese', placeholder: 'Como servirei concretamente a diocese?' },
        { label: 'Presença Fraterna', placeholder: 'Como me farei presente ao clero e ao povo?' },
      ],
    },
    LEIGO_CONSAGRADO: {
      titulo: 'Dever de Estado — Leigo(a) Consagrado(a)',
      descricao: 'Como leigo consagrado, você vive no mundo com coração totalmente entregue a Deus.',
      categorias: [
        { label: 'Fidelidade aos Direcionamentos', placeholder: 'Como viverei os direcionamentos da minha consagração?' },
        { label: 'Missão no Mundo', placeholder: 'Como exercerei minha missão no ambiente onde vivo?' },
        { label: 'Vida Comunitária', placeholder: 'Como cultivarei a comunhão com meus irmãos?' },
        { label: 'Vida Interior', placeholder: 'Como aprofundarei minha vida de oração?' },
      ],
    },
    GENERICO: {
      titulo: 'Dever de Estado',
      descricao: 'Seu dever de estado são as responsabilidades concretas que Deus lhe confia pelo seu estado de vida.',
      categorias: [
        { label: 'Relações Primárias', placeholder: 'Como cuidarei das pessoas mais próximas a mim?' },
        { label: 'Trabalho e Missão', placeholder: 'Como viverei minhas responsabilidades com espírito de serviço?' },
        { label: 'Vida Interior', placeholder: 'Como cuidarei da minha vida de oração?' },
        { label: 'Serviço', placeholder: 'Como servirei o próximo esta semana?' },
      ],
    },
  };
  ```

- [ ] Adicionar função helper para substituir `{nome}` na saudação:
  ```typescript
  export function getMotivacaoContent(
    vocationalRealityCode: string | null | undefined,
    nome: string,
  ): MotivacaoContent {
    const key = vocationalRealityCode ?? 'GENERICO';
    const content = MOTIVACAO_CONTENT[key] ?? MOTIVACAO_CONTENT.GENERICO;
    return { ...content, saudacao: content.saudacao.replace('{nome}', nome.split(' ')[0]) };
  }
  
  export function getDeveEstadoTemplate(lifeStateCode: string | null | undefined): DeveEstadoTemplate {
    const key = lifeStateCode ?? 'GENERICO';
    return DEVER_ESTADO_TEMPLATES[key] ?? DEVER_ESTADO_TEMPLATES.GENERICO;
  }
  ```

- [ ] Commit:
  ```
  git add lumen_mobile/src/data/conteudoVocacional.ts
  git commit -m "feat(vida): conteúdo vocacional para Motivação e Dever de Estado"
  ```

---

### Tarefa 0.2 — Endpoint de contexto vocacional (backend)

**Arquivos:**
- Modificar: `backend/app/api/projeto_vida_mensal_routes.py`
- Modificar: `backend/tests/test_projeto_vida_mensal.py`

- [ ] Escrever o teste antes de implementar:
  ```python
  def test_contexto_vocacional_sem_perfil(client, auth_headers):
      """Usuário sem perfil vocacional retorna conteúdo genérico sem erro."""
      resp = client.get("/projeto-vida-mensal/contexto-vocacional", headers=auth_headers)
      assert resp.status_code == 200
      data = resp.json()
      assert data["perfil_incompleto"] is True
      assert "motivacao" in data
      assert "dever_estado_template" in data
  
  def test_contexto_vocacional_com_perfil(client, auth_headers, db_session, test_user):
      """Usuário com perfil preenchido recebe conteúdo personalizado."""
      # Configurar perfil com vocational_reality_item e life_state_item
      # (usar fixtures existentes de perfil)
      resp = client.get("/projeto-vida-mensal/contexto-vocacional", headers=auth_headers)
      assert resp.status_code == 200
      data = resp.json()
      assert data["perfil_incompleto"] is False
  ```

- [ ] Executar os testes: `pytest tests/test_projeto_vida_mensal.py::test_contexto_vocacional -v`. Esperado: FAIL (endpoint não existe).

- [ ] Implementar o endpoint no final de `projeto_vida_mensal_routes.py` (antes das rotas com `{id}` para evitar conflito de rota):
  ```python
  @router.get("/contexto-vocacional")
  def get_contexto_vocacional(
      current_user: User = Depends(get_current_user),
      db: Session = Depends(get_db),
  ):
      profile = db.query(UserProfile).filter(UserProfile.user_id == current_user.id).first()
  
      vocational_code = None
      life_state_code = None
      perfil_incompleto = True
  
      if profile:
          if profile.vocational_reality_item_id:
              item = db.get(ProfileCatalogItem, profile.vocational_reality_item_id)
              vocational_code = item.code if item else None
          if profile.life_state_item_id:
              item = db.get(ProfileCatalogItem, profile.life_state_item_id)
              life_state_code = item.code if item else None
          perfil_incompleto = not bool(vocational_code and life_state_code)
  
      # O conteúdo é gerado pelo frontend via conteudoVocacional.ts.
      # O backend apenas retorna os códigos para que o frontend selecione o template correto.
      return {
          "vocational_reality_code": vocational_code,
          "life_state_code": life_state_code,
          "perfil_incompleto": perfil_incompleto,
          "nome": current_user.full_name or current_user.email,
      }
  ```

- [ ] Executar os testes: `pytest tests/test_projeto_vida_mensal.py::test_contexto_vocacional -v`. Esperado: PASS.

- [ ] Commit:
  ```
  git add backend/app/api/projeto_vida_mensal_routes.py backend/tests/test_projeto_vida_mensal.py
  git commit -m "feat(vida): endpoint GET /contexto-vocacional para Motivação adaptada"
  ```

---

### Tarefa 0.3 — Expor campo `intencao` no schema mensal (backend)

**Arquivos:**
- Modificar: `backend/app/schemas/projeto_vida_mensal.py`
- Modificar: `backend/tests/test_projeto_vida_mensal.py`

- [ ] Escrever o teste:
  ```python
  def test_criar_projeto_com_intencao(client, auth_headers):
      resp = client.post("/projeto-vida-mensal/", json={
          "mes": 7, "ano": 2026,
          "intencao": "Viver este mês com mais presença"
      }, headers=auth_headers)
      assert resp.status_code == 201
      assert resp.json()["intencao"] == "Viver este mês com mais presença"
  
  def test_criar_projeto_sem_intencao(client, auth_headers):
      """intencao é opcional — não deve falhar quando ausente."""
      resp = client.post("/projeto-vida-mensal/", json={"mes": 8, "ano": 2026}, headers=auth_headers)
      assert resp.status_code == 201
      assert resp.json()["intencao"] is None
  ```

- [ ] Executar: `pytest tests/test_projeto_vida_mensal.py::test_criar_projeto_com_intencao -v`. Esperado: FAIL.

- [ ] Adicionar `intencao` em `ProjetoVidaMensalCreate`, `ProjetoVidaMensalUpdate` e `ProjetoVidaMensalFull` no arquivo de schemas:
  ```python
  # Em ProjetoVidaMensalCreate:
  intencao: Optional[str] = Field(None, max_length=2000)
  
  # Em ProjetoVidaMensalUpdate:
  intencao: Optional[str] = Field(None, max_length=2000)
  
  # Em ProjetoVidaMensalFull:
  intencao: Optional[str] = None
  ```

- [ ] No route handler de `POST /`, propagar `intencao` para o modelo ORM (o campo já existe na tabela `projetos_vida_mensal`).

- [ ] No route handler de `PUT /{id}`, propagar `intencao` quando presente.

- [ ] Executar: `pytest tests/test_projeto_vida_mensal.py -v`. Todos os testes devem passar.

- [ ] Commit:
  ```
  git add backend/app/schemas/projeto_vida_mensal.py backend/app/api/projeto_vida_mensal_routes.py backend/tests/test_projeto_vida_mensal.py
  git commit -m "feat(vida): expor campo intencao no ciclo mensal (ressuscitado da migration 032)"
  ```

---

### Tarefa 0.4 — UnlockedCyclesContext (frontend)

**Arquivos:**
- Criar: `lumen_mobile/src/contexts/UnlockedCyclesContext.tsx`

- [ ] Criar o contexto:
  ```typescript
  import { createContext, useContext, useRef, useCallback, ReactNode } from 'react';
  import { AppState, AppStateStatus } from 'react-native';
  
  // TTL em milissegundos (15 minutos)
  const UNLOCK_TTL_MS = 15 * 60 * 1000;
  
  interface UnlockEntry { unlockedAt: number }
  
  interface UnlockedCyclesContextValue {
    isUnlocked: (projetoId: string) => boolean;
    markUnlocked: (projetoId: string) => void;
    clearAll: () => void;
  }
  
  const UnlockedCyclesContext = createContext<UnlockedCyclesContextValue | null>(null);
  
  export function UnlockedCyclesProvider({ children }: { children: ReactNode }) {
    const mapRef = useRef<Map<string, UnlockEntry>>(new Map());
    const backgroundEnteredAt = useRef<number | null>(null);
  
    // Monitora app going background para invalidar após TTL
    AppState.addEventListener('change', (state: AppStateStatus) => {
      if (state === 'background' || state === 'inactive') {
        backgroundEnteredAt.current = Date.now();
      } else if (state === 'active' && backgroundEnteredAt.current !== null) {
        const elapsed = Date.now() - backgroundEnteredAt.current;
        if (elapsed >= UNLOCK_TTL_MS) {
          mapRef.current.clear();
        }
        backgroundEnteredAt.current = null;
      }
    });
  
    const isUnlocked = useCallback((projetoId: string) => {
      const entry = mapRef.current.get(projetoId);
      if (!entry) return false;
      return Date.now() - entry.unlockedAt < UNLOCK_TTL_MS;
    }, []);
  
    const markUnlocked = useCallback((projetoId: string) => {
      mapRef.current.set(projetoId, { unlockedAt: Date.now() });
    }, []);
  
    const clearAll = useCallback(() => {
      mapRef.current.clear();
    }, []);
  
    return (
      <UnlockedCyclesContext.Provider value={{ isUnlocked, markUnlocked, clearAll }}>
        {children}
      </UnlockedCyclesContext.Provider>
    );
  }
  
  export function useUnlockedCycles(): UnlockedCyclesContextValue {
    const ctx = useContext(UnlockedCyclesContext);
    if (!ctx) throw new Error('useUnlockedCycles must be used within UnlockedCyclesProvider');
    return ctx;
  }
  ```

- [ ] Registrar o provider no root layout do app (arquivo `lumen_mobile/app/_layout.tsx`). Envolver o conteúdo existente com `<UnlockedCyclesProvider>`.

- [ ] Atualizar `lumen_mobile/app/vida/unlock.tsx`: após a chamada bem-sucedida a `verificarPin`, chamar `markUnlocked(projetoId)` antes de navegar para o ciclo.

- [ ] Commit:
  ```
  git add lumen_mobile/src/contexts/UnlockedCyclesContext.tsx lumen_mobile/app/_layout.tsx lumen_mobile/app/vida/unlock.tsx
  git commit -m "feat(vida): UnlockedCyclesContext — controle de PIN in-memory com TTL de 15min"
  ```

---

### Tarefa 0.5 — Refatorar Step 0 do wizard para Motivação adaptada

**Arquivos:**
- Modificar: `lumen_mobile/app/vida/wizard.tsx`
- Modificar: `lumen_mobile/src/services/projetoVidaMensal.ts`

- [ ] Adicionar tipo e método ao serviço:
  ```typescript
  export interface ContextoVocacionalOut {
    vocational_reality_code: string | null;
    life_state_code: string | null;
    perfil_incompleto: boolean;
    nome: string;
  }
  
  // No objeto projetoVidaMensalApi:
  getContextoVocacional: () =>
    api.get<ContextoVocacionalOut>('/projeto-vida-mensal/contexto-vocacional'),
  ```

- [ ] No `wizard.tsx`, adicionar estado para contexto vocacional:
  ```typescript
  const [contextoVoc, setContextoVoc] = useState<ContextoVocacionalOut | null>(null);
  const [loadingContexto, setLoadingContexto] = useState(false);
  ```

- [ ] Carregar o contexto ao montar (useEffect com dependência vazia):
  ```typescript
  useEffect(() => {
    setLoadingContexto(true);
    projetoVidaMensalApi.getContextoVocacional()
      .then(setContextoVoc)
      .catch(() => setContextoVoc(null))
      .finally(() => setLoadingContexto(false));
  }, []);
  ```

- [ ] Substituir o conteúdo do `case 0` (Intro) pelo Step de Motivação adaptada:
  - Se `loadingContexto`: exibir `ActivityIndicator`
  - Se `contextoVoc` disponível: derivar `MotivacaoContent` via `getMotivacaoContent(contextoVoc.vocational_reality_code, contextoVoc.nome)`
  - Exibir: saudação, reflexão, escritura em bloco espiritual, questão de meditação
  - Campo de texto para `intencao` (label: "Minha intenção para este ciclo:", opcional)
  - Se `contextoVoc.perfil_incompleto`: nota suave "Complete seu perfil para uma experiência mais personalizada"

- [ ] Atualizar o estado `WizardData` para incluir `intencao`:
  ```typescript
  interface WizardData {
    // ... campos existentes ...
    intencao: string;
  }
  // No defaultData():
  intencao: '',
  ```

- [ ] Incluir `intencao` no payload de criação em `handleSave`:
  ```typescript
  const criado = await projetoVidaMensalApi.criar({
    mes, ano, pin: data.pin || null,
    intencao: data.intencao || null,
  });
  ```

- [ ] Commit:
  ```
  git add lumen_mobile/app/vida/wizard.tsx lumen_mobile/src/services/projetoVidaMensal.ts
  git commit -m "feat(vida): Motivação adaptada ao perfil vocacional no Step 0 do wizard"
  ```

---

## FASE 1 — Áreas Mensais Reestruturadas

> **Objetivo:** As 5 áreas do Documento Oficial substituem comunidade/cuidado nos novos ciclos.

---

### Tarefa 1.1 — Migration 039: ADD reflexao_evangelizacao

**Arquivos:**
- Criar: `backend/alembic/versions/039_pvm_add_reflexao_evangelizacao.py`

- [ ] Verificar antes de criar a migration:
  ```sql
  SELECT COUNT(*) FROM projetos_vida_mensal WHERE tema IS NOT NULL;
  -- Esperado: 0
  SELECT COUNT(*) FROM projetos_vida_mensal WHERE intencao IS NOT NULL;
  -- Esperado: 0 (ou valor baixo de testes — verificar)
  ```

- [ ] Criar o arquivo de migration com `revision = "039_pvm_add_reflexao_evangelizacao"` e `down_revision = "038_push_notifications"`. O `upgrade()` deve executar `ADD COLUMN reflexao_evangelizacao TEXT` na tabela `projetos_vida_mensal`. O `downgrade()` deve executar `DROP COLUMN reflexao_evangelizacao`.

- [ ] Aplicar em dev: `alembic upgrade 039_pvm_add_reflexao_evangelizacao`. Verificar que a coluna existe com `\d projetos_vida_mensal`.

- [ ] Testar o downgrade: `alembic downgrade -1`. Verificar que a coluna foi removida. Reaplicar com `alembic upgrade head`.

- [ ] Commit:
  ```
  git add backend/alembic/versions/039_pvm_add_reflexao_evangelizacao.py
  git commit -m "migration(039): ADD reflexao_evangelizacao em projetos_vida_mensal"
  ```

---

### Tarefa 1.2 — Migration 040: CREATE projetos_vida_areas_mensais

**Arquivos:**
- Criar: `backend/alembic/versions/040_pvm_areas_mensais.py`

- [ ] Criar o arquivo com `revision = "040_pvm_areas_mensais"` e `down_revision = "039_pvm_add_reflexao_evangelizacao"`. O `upgrade()` deve criar a tabela `projetos_vida_areas_mensais` com os campos: `id` UUID PK, `projeto_id` UUID FK CASCADE, `tipo_area` VARCHAR(50) NOT NULL, `objetivo` TEXT, `compromissos` JSONB default `'[]'`, `observacoes` TEXT, `created_at` TIMESTAMPTZ, `updated_at` TIMESTAMPTZ. Adicionar UNIQUE constraint em `(projeto_id, tipo_area)` e index em `projeto_id`.

- [ ] Aplicar em dev: `alembic upgrade 040_pvm_areas_mensais`.

- [ ] Testar downgrade: `alembic downgrade -1`. Verificar remoção. Reaplicar.

- [ ] Commit:
  ```
  git add backend/alembic/versions/040_pvm_areas_mensais.py
  git commit -m "migration(040): CREATE projetos_vida_areas_mensais"
  ```

---

### Tarefa 1.3 — Model ORM para áreas mensais

**Arquivos:**
- Modificar: `backend/app/db/models.py`

- [ ] Adicionar o modelo `ProjetoVidaAreaMensal` na seção de modelos do Projeto de Vida (após `ProjetoVidaRevisao`):
  ```python
  class ProjetoVidaAreaMensal(Base):
      __tablename__ = "projetos_vida_areas_mensais"
  
      id: Mapped[UUID] = mapped_column(pg.UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()"))
      projeto_id: Mapped[UUID] = mapped_column(pg.UUID(as_uuid=True), ForeignKey("projetos_vida_mensal.id", ondelete="CASCADE"), nullable=False)
      tipo_area: Mapped[str] = mapped_column(String(50), nullable=False)
      objetivo: Mapped[str | None] = mapped_column(Text, nullable=True)
      compromissos: Mapped[dict | list | None] = mapped_column(JSONB, nullable=True, server_default=text("'[]'::jsonb"))
      observacoes: Mapped[str | None] = mapped_column(Text, nullable=True)
      created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
      updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
  
      __table_args__ = (
          UniqueConstraint("projeto_id", "tipo_area", name="uq_pv_areas_mensais_projeto_tipo"),
      )
  ```

- [ ] Adicionar o relacionamento em `ProjetoVidaMensal`:
  ```python
  areas_mensais: Mapped[list["ProjetoVidaAreaMensal"]] = relationship("ProjetoVidaAreaMensal", backref="projeto", cascade="all, delete-orphan")
  ```

- [ ] Também adicionar o campo `reflexao_evangelizacao` ao modelo `ProjetoVidaMensal`:
  ```python
  reflexao_evangelizacao: Mapped[str | None] = mapped_column(Text, nullable=True)
  ```

- [ ] Executar os testes existentes para verificar que o modelo não quebrou nada: `pytest tests/test_projeto_vida_mensal.py -v`. Todos devem passar.

- [ ] Commit:
  ```
  git add backend/app/db/models.py
  git commit -m "feat(vida): ORM ProjetoVidaAreaMensal + campo reflexao_evangelizacao"
  ```

---

### Tarefa 1.4 — Schemas Pydantic para áreas mensais

**Arquivos:**
- Modificar: `backend/app/schemas/projeto_vida_mensal.py`

- [ ] Adicionar os schemas de área mensal:
  ```python
  TIPOS_AREA_VALIDOS = {
      "FAMILIA_VOCACIONAL",
      "MINISTERIO_BOM_PASTOR",
      "GRUPO_FORMATIVO",
      "SAUDE_LAZER",
      "FAMILIA_ORIGEM",
  }
  
  class CompromissoAreaItem(BaseModel):
      descricao: Optional[str] = Field(None, max_length=500)
      data: Optional[str] = Field(None, max_length=20)
      horario: Optional[str] = Field(None, max_length=20)
      local: Optional[str] = Field(None, max_length=300)
      obs: Optional[str] = Field(None, max_length=1000)
  
  class AreaMensalIn(BaseModel):
      tipo_area: str
      objetivo: Optional[str] = Field(None, max_length=3000)
      compromissos: Optional[List[CompromissoAreaItem]] = []
      observacoes: Optional[str] = Field(None, max_length=3000)
  
      @field_validator("tipo_area")
      @classmethod
      def validar_tipo_area(cls, v: str) -> str:
          if v not in TIPOS_AREA_VALIDOS:
              raise ValueError(f"tipo_area inválido: {v}. Valores aceitos: {TIPOS_AREA_VALIDOS}")
          return v
  
  class AreaMensalOut(BaseModel):
      id: UUID
      tipo_area: str
      objetivo: Optional[str] = None
      compromissos: Optional[List[CompromissoAreaItem]] = []
      observacoes: Optional[str] = None
  
      model_config = {"from_attributes": True}
  ```

- [ ] Atualizar `ProjetoVidaMensalCreate` para incluir `reflexao_evangelizacao`:
  ```python
  reflexao_evangelizacao: Optional[str] = Field(None, max_length=3000)
  ```

- [ ] Atualizar `ProjetoVidaMensalUpdate` para incluir `reflexao_evangelizacao` e `areas`:
  ```python
  reflexao_evangelizacao: Optional[str] = Field(None, max_length=3000)
  areas: Optional[List[AreaMensalIn]] = None
  ```

- [ ] Atualizar `ProjetoVidaMensalFull` para incluir novos campos:
  ```python
  reflexao_evangelizacao: Optional[str] = None
  has_new_structure: bool = False
  areas: List[AreaMensalOut] = []
  ```

- [ ] Commit:
  ```
  git add backend/app/schemas/projeto_vida_mensal.py
  git commit -m "feat(vida): schemas Pydantic para áreas mensais e reflexao_evangelizacao"
  ```

---

### Tarefa 1.5 — Lógica de upsert de áreas e resposta dual no backend

**Arquivos:**
- Modificar: `backend/app/api/projeto_vida_mensal_routes.py`
- Modificar: `backend/tests/test_projeto_vida_mensal.py`

- [ ] Escrever os testes:
  ```python
  def test_criar_ciclo_com_areas(client, auth_headers):
      resp = client.post("/projeto-vida-mensal/", json={"mes": 9, "ano": 2026}, headers=auth_headers)
      projeto_id = resp.json()["id"]
      resp2 = client.put(f"/projeto-vida-mensal/{projeto_id}", json={
          "areas": [
              {
                  "tipo_area": "FAMILIA_VOCACIONAL",
                  "objetivo": "Participar de todos os encontros",
                  "compromissos": [{"descricao": "Encontro da família", "data": "20/09"}],
                  "observacoes": None,
              }
          ]
      }, headers=auth_headers)
      assert resp2.status_code == 200
      data = resp2.json()
      assert data["has_new_structure"] is True
      assert len(data["areas"]) == 1
      assert data["areas"][0]["tipo_area"] == "FAMILIA_VOCACIONAL"
  
  def test_upsert_area_existente(client, auth_headers):
      """Segunda chamada com a mesma tipo_area atualiza, não duplica."""
      resp = client.post("/projeto-vida-mensal/", json={"mes": 10, "ano": 2026}, headers=auth_headers)
      pid = resp.json()["id"]
      client.put(f"/projeto-vida-mensal/{pid}", json={"areas": [{"tipo_area": "GRUPO_FORMATIVO", "objetivo": "v1"}]}, headers=auth_headers)
      client.put(f"/projeto-vida-mensal/{pid}", json={"areas": [{"tipo_area": "GRUPO_FORMATIVO", "objetivo": "v2"}]}, headers=auth_headers)
      resp3 = client.get(f"/projeto-vida-mensal/{pid}", headers=auth_headers)
      areas = resp3.json()["areas"]
      assert sum(1 for a in areas if a["tipo_area"] == "GRUPO_FORMATIVO") == 1
      assert next(a for a in areas if a["tipo_area"] == "GRUPO_FORMATIVO")["objetivo"] == "v2"
  
  def test_ciclo_antigo_retorna_has_new_structure_false(client, auth_headers, ciclo_antigo_fixture):
      """Ciclos sem areas_mensais retornam has_new_structure: False."""
      resp = client.get(f"/projeto-vida-mensal/{ciclo_antigo_fixture}", headers=auth_headers)
      assert resp.json()["has_new_structure"] is False
  ```

- [ ] Executar: `pytest tests/test_projeto_vida_mensal.py::test_criar_ciclo_com_areas -v`. Esperado: FAIL.

- [ ] Implementar a lógica de upsert no handler de `PUT /{id}`: quando `body.areas` está presente, para cada item em `areas`, fazer `SELECT` por `(projeto_id, tipo_area)`. Se existe: atualizar. Se não existe: inserir.

- [ ] Implementar o campo `has_new_structure` no helper que monta a resposta `ProjetoVidaMensalFull`: `True` se `len(projeto.areas_mensais) > 0`.

- [ ] No handler de `GET /{id}`: quando `has_new_structure` é `False`, retornar campos históricos (`comunidade`, `cuidado`, etc.) normalmente. Quando `True`, retornar `areas` e deixar campos históricos como `null`.

- [ ] Executar: `pytest tests/test_projeto_vida_mensal.py -v`. Todos devem passar.

- [ ] Commit:
  ```
  git add backend/app/api/projeto_vida_mensal_routes.py backend/tests/test_projeto_vida_mensal.py
  git commit -m "feat(vida): upsert de áreas mensais + discriminador has_new_structure"
  ```

---

### Tarefa 1.6 — Wizard reformulado: 5 áreas (frontend)

**Arquivos:**
- Modificar: `lumen_mobile/app/vida/wizard.tsx`
- Modificar: `lumen_mobile/src/services/projetoVidaMensal.ts`

- [ ] Adicionar tipos ao serviço:
  ```typescript
  export interface CompromissoAreaItem {
    descricao: string | null;
    data: string | null;
    horario: string | null;
    local: string | null;
    obs: string | null;
  }
  
  export interface AreaMensalIn {
    tipo_area: string;
    objetivo: string | null;
    compromissos: CompromissoAreaItem[];
    observacoes: string | null;
  }
  
  export interface AreaMensalOut extends AreaMensalIn {
    id: string;
  }
  ```

- [ ] Adicionar `reflexao_evangelizacao` e `areas` ao `CreateProjetoInput` e `UpdateProjetoInput` no serviço.

- [ ] Adicionar `has_new_structure`, `areas`, `reflexao_evangelizacao` ao `ProjetoVidaMensalFull`.

- [ ] Atualizar o estado `WizardData` com os 5 arrays de área e `reflexao_evangelizacao`:
  ```typescript
  interface WizardData {
    mes: string; ano: string; pin: string; intencao: string;
    reflexao_evangelizacao: string;
    areas: Record<string, { objetivo: string; compromissos: CompromissoAreaItem[]; observacoes: string }>;
  }
  // defaultData():
  areas: {
    FAMILIA_VOCACIONAL: { objetivo: '', compromissos: [], observacoes: '' },
    MINISTERIO_BOM_PASTOR: { objetivo: '', compromissos: [], observacoes: '' },
    GRUPO_FORMATIVO: { objetivo: '', compromissos: [], observacoes: '' },
    SAUDE_LAZER: { objetivo: '', compromissos: [], observacoes: '' },
    FAMILIA_ORIGEM: { objetivo: '', compromissos: [], observacoes: '' },
  }
  ```

- [ ] Atualizar `STEP_TITLES` para 11 passos: `['Motivação', 'Ciclo Mensal', 'Família Vocacional', 'Ministério Bom Pastor', 'Grupo Formativo', 'Saúde e Lazer', 'Família de Origem', 'Evangelização', 'Intercessão', 'Privacidade', 'Confirmar']`.

- [ ] Criar componente local `AreaMensalStep` dentro do arquivo (antes de `renderStep`):
  ```typescript
  function AreaMensalStep({
    tipoArea, titulo, descricaoOrientadora, data: areaData,
    onChange, t, r,
  }: {
    tipoArea: string;
    titulo: string;
    descricaoOrientadora: string;
    data: { objetivo: string; compromissos: CompromissoAreaItem[]; observacoes: string };
    onChange: (patch: Partial<typeof areaData>) => void;
    t: ThemeTokens; r: RadiiTokens;
  }) { /* ... */ }
  ```
  O componente renderiza: campo objetivo, lista de compromissos (add/remove/edit descricao+data+horario+local), campo observações.

- [ ] Substituir os cases 2, 3, 4, 5, 6 do `renderStep` para usar `AreaMensalStep` com os respectivos `tipoArea` e `titulo`:
  - case 2: `FAMILIA_VOCACIONAL` / "Família Vocacional"
  - case 3: `MINISTERIO_BOM_PASTOR` / "Ministério Bom Pastor"
  - case 4: `GRUPO_FORMATIVO` / "Grupo Formativo"
  - case 5: `SAUDE_LAZER` / "Saúde, Descanso e Lazer"
  - case 6: `FAMILIA_ORIGEM` / "Família de Origem"

- [ ] Adicionar case 7 (Evangelização):
  ```typescript
  case 7:
    return (
      <View style={styles.stepContent}>
        <Text>…</Text>
        <TextInput
          value={data.reflexao_evangelizacao}
          onChangeText={v => update({ reflexao_evangelizacao: v })}
          multiline placeholder="Como você quer viver a Evangelização neste mês?..."
        />
      </View>
    );
  ```

- [ ] Atualizar `handleSave`: incluir `reflexao_evangelizacao` e `areas` (convertendo o objeto de áreas para array `AreaMensalIn[]`) nos payloads de criação e atualização.

- [ ] Commit:
  ```
  git add lumen_mobile/app/vida/wizard.tsx lumen_mobile/src/services/projetoVidaMensal.ts
  git commit -m "feat(vida): wizard reformulado com 5 áreas mensais estruturadas"
  ```

---

### Tarefa 1.7 — ciclo.tsx: visualização dual (novo e legado)

**Arquivos:**
- Modificar: `lumen_mobile/app/vida/ciclo.tsx`

- [ ] Carregar `projetoVidaMensalApi.get(projetoId)` (já feito na tela atual). Verificar que o response inclui os novos campos.

- [ ] Adicionar seção condicional de intenção do ciclo:
  ```typescript
  {projeto.intencao && (
    <View style={[styles.intencaoCard, { backgroundColor: t.bg.spiritual, borderLeftColor: t.accent.spiritual }]}>
      <Text style={{ ...spiritual text styles... }}>{projeto.intencao}</Text>
    </View>
  )}
  ```

- [ ] Adicionar renderização condicional das áreas:
  ```typescript
  {projeto.has_new_structure ? (
    <AreasMensaisView areas={projeto.areas} t={t} r={r} />
  ) : (
    <LegacyView comunidade={projeto.comunidade} cuidado={projeto.cuidado} compromissos={projeto.compromissos} praticas={projeto.praticas} t={t} r={r} />
  )}
  ```

- [ ] Criar componente `AreasMensaisView` (no mesmo arquivo): renderiza cada área com título, objetivo e lista de compromissos.

- [ ] Criar componente `LegacyView` (no mesmo arquivo): contém a lógica de exibição atual de comunidade/cuidado/compromissos/praticas.

- [ ] Adicionar exibição de `reflexao_evangelizacao` quando presente:
  ```typescript
  {projeto.reflexao_evangelizacao && (
    <EvangelizacaoCard reflexao={projeto.reflexao_evangelizacao} t={t} />
  )}
  ```

- [ ] Commit:
  ```
  git add lumen_mobile/app/vida/ciclo.tsx
  git commit -m "feat(vida): ciclo.tsx com visualização dual (novo/legado) e intenção"
  ```

---

## FASE 2 — Exame de Consciência

> **Objetivo:** Transição espiritual entre ciclos com exame e ato de contrição.

---

### Tarefa 2.1 — Migration 041: CREATE projetos_vida_exame

**Arquivos:**
- Criar: `backend/alembic/versions/041_pvm_exame.py`

- [ ] Criar migration com `revision = "041_pvm_exame"` e `down_revision = "040_pvm_areas_mensais"`. O `upgrade()` cria a tabela `projetos_vida_exame` com os campos: `id` UUID PK, `projeto_id` UUID FK UNIQUE CASCADE, 6 campos TEXT nullable (`gracas_recebidas`, `infidelidades`, `dificuldades_espirituais`, `jesus_abandonado`, `onde_deixei_de_responder`, `proposito_conversao`), `created_at` e `updated_at` TIMESTAMPTZ.

- [ ] Aplicar e testar downgrade conforme padrão da Tarefa 1.1.

- [ ] Commit:
  ```
  git add backend/alembic/versions/041_pvm_exame.py
  git commit -m "migration(041): CREATE projetos_vida_exame"
  ```

---

### Tarefa 2.2 — Model, schemas e endpoints do exame

**Arquivos:**
- Modificar: `backend/app/db/models.py`
- Modificar: `backend/app/schemas/projeto_vida_mensal.py`
- Modificar: `backend/app/api/projeto_vida_mensal_routes.py`
- Modificar: `backend/tests/test_projeto_vida_mensal.py`

- [ ] Adicionar o modelo ORM `ProjetoVidaExame` em `models.py` (pattern idêntico ao `ProjetoVidaRevisao`, com os 6 campos TEXT nullable + FK único para o projeto).

- [ ] Adicionar o relacionamento em `ProjetoVidaMensal`: `exame: Mapped["ProjetoVidaExame | None"] = relationship(...)`.

- [ ] Escrever os testes:
  ```python
  def test_exame_upsert_e_get(client, auth_headers):
      pid = client.post("/projeto-vida-mensal/", json={"mes": 11, "ano": 2026}, headers=auth_headers).json()["id"]
      # Criar
      resp = client.put(f"/projeto-vida-mensal/{pid}/exame", json={
          "gracas_recebidas": "Muita paz neste mês",
          "proposito_conversao": "Ser mais paciente",
      }, headers=auth_headers)
      assert resp.status_code == 200
      assert resp.json()["gracas_recebidas"] == "Muita paz neste mês"
      # Reler
      resp2 = client.get(f"/projeto-vida-mensal/{pid}/exame", headers=auth_headers)
      assert resp2.status_code == 200
      assert resp2.json()["proposito_conversao"] == "Ser mais paciente"
  
  def test_exame_get_sem_exame(client, auth_headers):
      """Retorna null quando exame ainda não foi criado."""
      pid = client.post("/projeto-vida-mensal/", json={"mes": 12, "ano": 2026}, headers=auth_headers).json()["id"]
      resp = client.get(f"/projeto-vida-mensal/{pid}/exame", headers=auth_headers)
      assert resp.status_code == 200
      assert resp.json() is None
  
  def test_exame_upsert_idempotente(client, auth_headers):
      """Dois PUTs com campos diferentes: segundo atualiza, não duplica."""
      pid = client.post("/projeto-vida-mensal/", json={"mes": 1, "ano": 2027}, headers=auth_headers).json()["id"]
      client.put(f"/projeto-vida-mensal/{pid}/exame", json={"gracas_recebidas": "v1"}, headers=auth_headers)
      client.put(f"/projeto-vida-mensal/{pid}/exame", json={"gracas_recebidas": "v2"}, headers=auth_headers)
      resp = client.get(f"/projeto-vida-mensal/{pid}/exame", headers=auth_headers)
      assert resp.json()["gracas_recebidas"] == "v2"
  
  def test_exame_outro_usuario_retorna_403(client, auth_headers_b):
      """Usuário B não pode acessar o exame do Usuário A."""
      # criar projeto com auth_headers_a, tentar acessar com auth_headers_b
      pass  # implementar com fixture de segundo usuário
  ```

- [ ] Executar testes. Esperado: FAIL.

- [ ] Adicionar schemas `ExameUpsert` e `ExameOut` no arquivo de schemas.

- [ ] Implementar endpoints em `projeto_vida_mensal_routes.py`:
  ```python
  @router.get("/{projeto_id}/exame")
  def get_exame(projeto_id: UUID, ...): ...
  
  @router.put("/{projeto_id}/exame")
  def upsert_exame(projeto_id: UUID, body: ExameUpsert, ...): ...
  ```
  Ambos verificam autoria. O `PUT` faz upsert: `db.get(ProjetoVidaExame, projeto_id=projeto_id)` — se existe: atualiza campos não-None; se não: cria.

- [ ] Executar testes. Esperado: PASS.

- [ ] Commit:
  ```
  git add backend/app/db/models.py backend/app/schemas/projeto_vida_mensal.py backend/app/api/projeto_vida_mensal_routes.py backend/tests/test_projeto_vida_mensal.py
  git commit -m "feat(vida): endpoint GET/PUT /{id}/exame — Exame de Consciência"
  ```

---

### Tarefa 2.3 — Tela de Exame de Consciência (frontend)

**Arquivos:**
- Criar: `lumen_mobile/app/vida/exame.tsx`
- Modificar: `lumen_mobile/src/services/projetoVidaMensal.ts`
- Modificar: `lumen_mobile/app/vida/_layout.tsx`
- Modificar: `lumen_mobile/app/vida/index.tsx`

- [ ] Adicionar tipos e métodos ao serviço:
  ```typescript
  export interface ExameOut {
    id: string;
    gracas_recebidas: string | null;
    infidelidades: string | null;
    dificuldades_espirituais: string | null;
    jesus_abandonado: string | null;
    onde_deixei_de_responder: string | null;
    proposito_conversao: string | null;
    created_at: string;
    updated_at: string;
  }
  
  export interface ExameUpsert {
    gracas_recebidas?: string | null;
    infidelidades?: string | null;
    dificuldades_espirituais?: string | null;
    jesus_abandonado?: string | null;
    onde_deixei_de_responder?: string | null;
    proposito_conversao?: string | null;
  }
  
  // No projetoVidaMensalApi:
  getExame: (id: string) => api.get<ExameOut | null>(`/projeto-vida-mensal/${id}/exame`),
  upsertExame: (id: string, data: ExameUpsert) => api.put<ExameOut>(`/projeto-vida-mensal/${id}/exame`, data),
  ```

- [ ] Criar `exame.tsx`. A tela recebe `projetoId` como param de rota. Estrutura:
  - Carregar exame existente via `getExame` no mount (preencher campos se já existir)
  - 6 seções de reflexão, cada uma com: label da pergunta orientadora + TextInput multilinhas
  - Bloco do Ato de Contrição (texto fixo `CONTRICAO_TEXT` já definido em `revisao.tsx`) em estilo espiritual
  - **Dois botões**: "Salvar e continuar para o novo ciclo" (chama `upsertExame` → navega para wizard) e "Pular por enquanto" (navega diretamente para wizard **sem salvar**)
  - Botão "Pular" também visível no header (ícone de fechar ou texto "Pular")
  - Perguntas por campo:
    - `gracas_recebidas`: "Quais graças recebi neste mês?"
    - `infidelidades`: "Onde percebo minhas infidelidades diante de Deus?"
    - `dificuldades_espirituais`: "Quais dificuldades espirituais enfrentei?"
    - `jesus_abandonado`: "Onde encontrei Jesus Abandonado neste período?"
    - `onde_deixei_de_responder`: "Onde deixei de responder ao chamado de Deus?"
    - `proposito_conversao`: "Meu propósito de conversão para o próximo ciclo:"

- [ ] Registrar a rota em `_layout.tsx`:
  ```typescript
  <Stack.Screen name="exame" options={{ title: 'Exame de Consciência', headerShown: true }} />
  ```

- [ ] No hub (`index.tsx`), adicionar lógica de sugestão de exame. Quando `projeto !== null && projeto.concluido`:
  - Verificar se existe exame: `projetoVidaMensalApi.getExame(projeto.id)` (na mesma chamada de `load`)
  - Se `!exame`: exibir card de convite com dois botões visíveis:
    - **"Fazer o Exame"** → navega para `/vida/exame?projetoId={projeto.id}`
    - **"Pular por enquanto"** → navega para `/vida/wizard`
  - Se `exame` já existe: exibir apenas o botão "Iniciar novo ciclo"

- [ ] Commit:
  ```
  git add lumen_mobile/app/vida/exame.tsx lumen_mobile/src/services/projetoVidaMensal.ts lumen_mobile/app/vida/_layout.tsx lumen_mobile/app/vida/index.tsx
  git commit -m "feat(vida): tela de Exame de Consciência com opção de pular"
  ```

---

## FASE 3 — Intercessão

> **Objetivo:** O wizard fecha em oração com intenções e oferecimento.

---

### Tarefa 3.1 — Migration 043: CREATE projetos_vida_intercessao

**Arquivos:**
- Criar: `backend/alembic/versions/043_pvm_intercessao.py`

> **Nota:** A migration 042 (semanal) pode ser desenvolvida em paralelo. A numeração 043 já está reservada para a intercessão independentemente da ordem de desenvolvimento.

- [ ] Criar migration com `revision = "043_pvm_intercessao"` e `down_revision = "042_pvm_semanal"`. O `upgrade()` cria a tabela `projetos_vida_intercessao` com: `id` UUID PK, `projeto_id` UUID FK UNIQUE CASCADE, `intencoes_pessoais` TEXT, `intencoes_comunitarias` TEXT, `oferecimento` TEXT, `created_at` e `updated_at` TIMESTAMPTZ.

- [ ] Aplicar e testar downgrade conforme padrão.

- [ ] Commit:
  ```
  git add backend/alembic/versions/043_pvm_intercessao.py
  git commit -m "migration(043): CREATE projetos_vida_intercessao"
  ```

---

### Tarefa 3.2 — Model, schemas e endpoints da intercessão

**Arquivos:**
- Modificar: `backend/app/db/models.py`
- Modificar: `backend/app/schemas/projeto_vida_mensal.py`
- Modificar: `backend/app/api/projeto_vida_mensal_routes.py`
- Modificar: `backend/tests/test_projeto_vida_mensal.py`

- [ ] Escrever os testes (pattern idêntico aos testes do exame: upsert, get, idempotência, 403).

- [ ] Executar. Esperado: FAIL.

- [ ] Adicionar modelo ORM `ProjetoVidaIntercessao` (3 campos TEXT + FK único + timestamps).

- [ ] Adicionar relacionamento em `ProjetoVidaMensal`: `intercessao: Mapped["ProjetoVidaIntercessao | None"]`.

- [ ] Adicionar schemas `IntercessaoUpsert` e `IntercessaoOut`.

- [ ] Implementar `GET /{id}/intercessao` e `PUT /{id}/intercessao` (upsert, verificação de autoria).

- [ ] Executar testes. Esperado: PASS.

- [ ] Commit:
  ```
  git add backend/app/db/models.py backend/app/schemas/projeto_vida_mensal.py backend/app/api/projeto_vida_mensal_routes.py backend/tests/test_projeto_vida_mensal.py
  git commit -m "feat(vida): endpoint GET/PUT /{id}/intercessao"
  ```

---

### Tarefa 3.3 — Passo 8 (Intercessão) no wizard

**Arquivos:**
- Modificar: `lumen_mobile/app/vida/wizard.tsx`
- Modificar: `lumen_mobile/src/services/projetoVidaMensal.ts`

- [ ] Adicionar tipos e método ao serviço:
  ```typescript
  export interface IntercessaoOut {
    id: string;
    intencoes_pessoais: string | null;
    intencoes_comunitarias: string | null;
    oferecimento: string | null;
  }
  export interface IntercessaoUpsert {
    intencoes_pessoais?: string | null;
    intencoes_comunitarias?: string | null;
    oferecimento?: string | null;
  }
  // No projetoVidaMensalApi:
  upsertIntercessao: (id: string, data: IntercessaoUpsert) =>
    api.put<IntercessaoOut>(`/projeto-vida-mensal/${id}/intercessao`, data),
  ```

- [ ] Adicionar campos de intercessão ao `WizardData`:
  ```typescript
  intencoes_pessoais: string;
  intencoes_comunitarias: string;
  oferecimento: string;
  ```

- [ ] Adicionar `case 8` em `renderStep` com 3 campos de texto e texto introdutório contemplativo.

- [ ] Em `handleSave`, após o upsert das áreas, chamar `upsertIntercessao` com os dados:
  ```typescript
  await projetoVidaMensalApi.upsertIntercessao(projetoId, {
    intencoes_pessoais: data.intencoes_pessoais || null,
    intencoes_comunitarias: data.intencoes_comunitarias || null,
    oferecimento: data.oferecimento || null,
  });
  ```

- [ ] Commit:
  ```
  git add lumen_mobile/app/vida/wizard.tsx lumen_mobile/src/services/projetoVidaMensal.ts
  git commit -m "feat(vida): Passo 8 de Intercessão no wizard — encerrar o ciclo em oração"
  ```

---

## FASE 4 — Projeto Semanal

> **Objetivo:** Camada semanal com Dever de Estado, Vida Interior, Evangelização e plano diário.

---

### Tarefa 4.1 — Migration 042: CREATE projetos_vida_semanal

**Arquivos:**
- Criar: `backend/alembic/versions/042_pvm_semanal.py`

- [ ] Criar migration com `revision = "042_pvm_semanal"` e `down_revision = "041_pvm_exame"`. O `upgrade()` cria a tabela com: `id` UUID PK, `projeto_id` UUID FK CASCADE, `numero_semana` INTEGER NOT NULL CHECK (1–5), `dever_estado` JSONB, `vida_interior` JSONB, `evangelizacao_disposicao` TEXT, `evangelizacao_momentos` JSONB default `'[]'`, `plano_diario` JSONB default `'{}'`, `observacoes` TEXT, `created_at` e `updated_at` TIMESTAMPTZ. UNIQUE em `(projeto_id, numero_semana)`. INDEX em `projeto_id`.

- [ ] Aplicar e testar downgrade conforme padrão.

- [ ] Commit:
  ```
  git add backend/alembic/versions/042_pvm_semanal.py
  git commit -m "migration(042): CREATE projetos_vida_semanal"
  ```

---

### Tarefa 4.2 — Model ORM, schemas e endpoints do semanal

**Arquivos:**
- Modificar: `backend/app/db/models.py`
- Modificar: `backend/app/schemas/projeto_vida_mensal.py`
- Modificar: `backend/app/api/projeto_vida_mensal_routes.py`
- Criar: `backend/app/api/projeto_vida_semanal_routes.py`
- Modificar: `backend/app/main.py`
- Modificar: `backend/tests/test_projeto_vida_mensal.py`

- [ ] Escrever os testes:
  ```python
  def test_criar_semanal(client, auth_headers):
      pid = client.post("/projeto-vida-mensal/", json={"mes": 2, "ano": 2027}, headers=auth_headers).json()["id"]
      resp = client.post(f"/projeto-vida-mensal/{pid}/semanal", json={
          "numero_semana": 1,
          "evangelizacao_disposicao": "Com disponibilidade total",
      }, headers=auth_headers)
      assert resp.status_code == 201
      assert resp.json()["numero_semana"] == 1
  
  def test_criar_semanal_duplicado_retorna_409(client, auth_headers):
      pid = client.post("/projeto-vida-mensal/", json={"mes": 3, "ano": 2027}, headers=auth_headers).json()["id"]
      client.post(f"/projeto-vida-mensal/{pid}/semanal", json={"numero_semana": 2}, headers=auth_headers)
      resp2 = client.post(f"/projeto-vida-mensal/{pid}/semanal", json={"numero_semana": 2}, headers=auth_headers)
      assert resp2.status_code == 409
  
  def test_merge_parcial_plano_diario(client, auth_headers):
      """Atualizar apenas segunda não deve alterar sexta."""
      pid = client.post("/projeto-vida-mensal/", json={"mes": 4, "ano": 2027}, headers=auth_headers).json()["id"]
      sid = client.post(f"/projeto-vida-mensal/{pid}/semanal", json={"numero_semana": 1}, headers=auth_headers).json()["id"]
      # Salvar sexta
      client.put(f"/projeto-vida-semanal/{sid}", json={"plano_diario": {"sex": {"proposito": "paz"}}}, headers=auth_headers)
      # Salvar segunda
      client.put(f"/projeto-vida-semanal/{sid}", json={"plano_diario": {"seg": {"proposito": "foco"}}}, headers=auth_headers)
      # Verificar que sexta não foi perdida
      resp = client.get(f"/projeto-vida-semanal/{sid}", headers=auth_headers)
      assert resp.json()["plano_diario"]["sex"]["proposito"] == "paz"
      assert resp.json()["plano_diario"]["seg"]["proposito"] == "foco"
  ```

- [ ] Executar testes. Esperado: FAIL.

- [ ] Adicionar modelo ORM `ProjetoVidaSemanal` em `models.py` com os campos da tabela e relacionamento com `ProjetoVidaMensal`.

- [ ] Adicionar schemas: `EvangelizacaoMomentoItem`, `PlanoDiarioItem`, `ProjetoVidaSemanasCreate`, `ProjetoVidaSemanasUpdate`, `ProjetoVidaSemanasOut` em `projeto_vida_mensal.py`.

- [ ] Implementar endpoints em `projeto_vida_mensal_routes.py`:
  - `GET /projeto-vida-mensal/{id}/semanal` → lista de semanas (sumário sem `plano_diario`)
  - `POST /projeto-vida-mensal/{id}/semanal` → criar semana (409 se duplicada)

- [ ] Criar `projeto_vida_semanal_routes.py` com:
  - `GET /projeto-vida-semanal/{id}` → buscar semana completa
  - `PUT /projeto-vida-semanal/{id}` → atualizar semana com **merge parcial de `plano_diario`**

  **Lógica de merge parcial para `plano_diario`:**
  ```python
  if body.plano_diario is not None:
      current = semanal.plano_diario or {}
      for dia, valores in body.plano_diario.items():
          current[dia] = {**(current.get(dia) or {}), **valores.model_dump(exclude_none=True)}
      semanal.plano_diario = current
  ```

- [ ] Registrar `projeto_vida_semanal_routes.py` em `main.py`.

- [ ] Atualizar `GET /projeto-vida-mensal/atual` para incluir `semanal_atual` (semana com `numero_semana` correspondente à semana atual do calendário dentro do ciclo ativo).

- [ ] Executar todos os testes. Esperado: PASS.

- [ ] Commit:
  ```
  git add backend/app/db/models.py backend/app/schemas/projeto_vida_mensal.py backend/app/api/projeto_vida_mensal_routes.py backend/app/api/projeto_vida_semanal_routes.py backend/app/main.py backend/tests/test_projeto_vida_mensal.py
  git commit -m "feat(vida): endpoints semanal — criação, leitura, merge parcial de plano diário"
  ```

---

### Tarefa 4.3 — Tela do Projeto Semanal (frontend)

**Arquivos:**
- Criar: `lumen_mobile/app/vida/semanal.tsx`
- Modificar: `lumen_mobile/src/services/projetoVidaMensal.ts`
- Modificar: `lumen_mobile/app/vida/_layout.tsx`
- Modificar: `lumen_mobile/app/vida/ciclo.tsx`

- [ ] Adicionar tipos e métodos ao serviço:
  ```typescript
  export interface ProjetoVidaSemanasCreate {
    numero_semana: number;
    dever_estado?: object | null;
    vida_interior?: object | null;
    evangelizacao_disposicao?: string | null;
    evangelizacao_momentos?: Array<{ descricao: string }>;
    plano_diario?: Record<string, PlanoDiarioItem>;
    observacoes?: string | null;
  }
  export interface ProjetoVidaSemanasOut extends ProjetoVidaSemanasCreate {
    id: string;
    created_at: string;
    updated_at: string;
  }
  // métodos:
  listSemanas: (projetoId: string) => api.get<ProjetoVidaSemanasOut[]>(`/projeto-vida-mensal/${projetoId}/semanal`),
  createSemanal: (projetoId: string, data: ProjetoVidaSemanasCreate) => api.post<ProjetoVidaSemanasOut>(`/projeto-vida-mensal/${projetoId}/semanal`, data),
  getSemanal: (id: string) => api.get<ProjetoVidaSemanasOut>(`/projeto-vida-semanal/${id}`),
  updateSemanal: (id: string, data: Partial<ProjetoVidaSemanasCreate>) => api.put<ProjetoVidaSemanasOut>(`/projeto-vida-semanal/${id}`, data),
  ```

- [ ] Criar `semanal.tsx` com wizard de 4 passos. O componente recebe `projetoId` como param de rota.
  - **Passo 0:** seletor de semana (chips 1–5). Detectar `numero_semana` atual. Carregar semana existente se houver.
  - **Passo 1 — Dever de Estado:** Chamar `getContextoVocacional()`. Usar `getDeveEstadoTemplate(life_state_code)` para renderizar seções dinâmicas. Campo de reflexão livre ao final.
  - **Passo 2 — Vida Interior:** 6 práticas (Missa, Lectio, Terço, Leitura Espiritual, Adoração, Jejum). Cada uma: toggle + dias + horário/obs (cards colapsáveis).
  - **Passo 3 — Evangelização:** Bloco com `reflexao_evangelizacao` do ciclo mensal (somente leitura). Campo `evangelizacao_disposicao`. Lista de momentos (`evangelizacao_momentos`).
  - **Passo 4 — Confirmar:** POST (criar) se semana nova, PUT (atualizar) se já existe.

- [ ] Registrar rota `semanal` em `_layout.tsx`.

- [ ] Adicionar link para o semanal em `ciclo.tsx` (botão "Projeto Semanal" no final da tela).

- [ ] Commit:
  ```
  git add lumen_mobile/app/vida/semanal.tsx lumen_mobile/src/services/projetoVidaMensal.ts lumen_mobile/app/vida/_layout.tsx lumen_mobile/app/vida/ciclo.tsx
  git commit -m "feat(vida): tela Projeto Semanal com Dever de Estado, Vida Interior e Evangelização"
  ```

---

## FASE 5 — "Amanhã com o Emanuel"

> **Objetivo:** Atalho de primeiro nível no hub para planejamento do dia seguinte.

---

### Tarefa 5.1 — Tela diário e card no hub

**Arquivos:**
- Criar: `lumen_mobile/app/vida/diario.tsx`
- Modificar: `lumen_mobile/app/vida/index.tsx`
- Modificar: `lumen_mobile/app/vida/_layout.tsx`

- [ ] Criar `diario.tsx`. Recebe `semanalId` e `dia` como params de rota (ex.: `dia=sex`). Se `dia` não informado, calcula o dia seguinte automaticamente.

  ```typescript
  function getDiaSeguinte(): string {
    const dias = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sab'];
    return dias[(new Date().getDay() + 1) % 7];
  }
  ```

- [ ] Estrutura da tela:
  - Cabeçalho: "Amanhã com o Emanuel — [DIA_LABELS[dia]], [data formatada]"
  - Chips de navegação entre os dias (seg–dom) — mostra apenas os dias da semana ativa
  - Campos conforme spec (proposito, missa+horario, oracao_manha, lectio, terco, leitura_espiritual, evangelizacao, compromissos)
  - Botão "Salvar" → chama `updateSemanal(semanalId, { plano_diario: { [dia]: values } })`
  - Se não há semanal ativo (`semanalId` null): mensagem + link para criar semanal

- [ ] Registrar rota `diario` em `_layout.tsx`.

- [ ] No hub (`index.tsx`), adicionar card "Amanhã com o Emanuel":
  - Visível apenas quando `projetoAtual !== null` E `projetoAtual.semanal_atual !== null`
  - Exibe o dia seguinte e o propósito (se já preenchido)
  - Navega para `/vida/diario?semanalId={semanal_atual.id}&dia={diaSeguinte}`

- [ ] Commit:
  ```
  git add lumen_mobile/app/vida/diario.tsx lumen_mobile/app/vida/index.tsx lumen_mobile/app/vida/_layout.tsx
  git commit -m "feat(vida): tela 'Amanhã com o Emanuel' + card de acesso rápido no hub"
  ```

---

## CHECKLIST DE ENTREGA POR FASE

### Fase 0
- [ ] `GET /contexto-vocacional` retorna 200 com perfil completo e incompleto
- [ ] Campo `intencao` salvo e retornado no ciclo mensal
- [ ] Step 0 do wizard exibe reflexão adaptada à etapa formativa
- [ ] `UnlockedCyclesContext` invalida após 15 min em background

### Fase 1
- [ ] Migration 039 aplicada e testada (upgrade + downgrade)
- [ ] Migration 040 aplicada e testada
- [ ] `has_new_structure: true` para ciclos com áreas
- [ ] `has_new_structure: false` para ciclos históricos — dados históricos retornam normalmente
- [ ] Upsert de área não cria duplicata (segundo PUT atualiza o existente)
- [ ] `ciclo.tsx` exibe template novo para ciclos v2 e template legado para ciclos v1

### Fase 2
- [ ] Migration 041 aplicada e testada
- [ ] Exame upsert idempotente (segundo PUT atualiza, não cria novo)
- [ ] Hub exibe card com dois botões: "Fazer o Exame" e "Pular por enquanto"
- [ ] Tela de exame tem botão "Pular" no header
- [ ] Ciclo sem exame: GET retorna null (não 404)

### Fase 3
- [ ] Migration 043 aplicada e testada
- [ ] Passo 8 do wizard salva intercessão com os 3 campos
- [ ] Intercessão visível na tela do ciclo

### Fase 4
- [ ] Migration 042 aplicada e testada
- [ ] `POST /semanal` com `numero_semana` duplicado retorna 409
- [ ] Merge parcial de `plano_diario` verificado (dia A não afeta dia B)
- [ ] Tela semanal adapta categorias do Dever de Estado ao perfil
- [ ] Link para semanal visível em `ciclo.tsx`

### Fase 5
- [ ] Card "Amanhã com o Emanuel" aparece e desaparece corretamente
- [ ] Salvar apenas `sex` não altera `seg` nem outros dias
- [ ] Navegação entre dias da semana funciona sem recarregar o semanal
