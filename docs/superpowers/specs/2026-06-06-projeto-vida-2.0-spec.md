# Spec — Projeto de Vida 2.0

**Módulo:** Projeto de Vida — Lumen+  
**Versão:** 2.0  
**Data:** 2026-06-06  
**Status:** Aguardando aprovação para implementação  
**Baseado em:** Documento Oficial da Obra Lumen + Auditoria do módulo atual + Revisão arquitetural aprovada

---

## 1. VISÃO GERAL

O módulo Projeto de Vida do Lumen+ é o instrumento central de acompanhamento espiritual, vocacional e comunitário dos membros da Obra Lumen. Ele não é uma ferramenta de produtividade. É um caderno espiritual digital — um espaço íntimo entre o membro e Deus, orientado pelo carisma da Obra Lumen.

A versão 1.x implementou um ciclo mensal com estrutura de comunidade, cuidado pessoal, compromissos semanais e práticas espirituais diárias. A versão 2.0 expande e refina esse módulo em fidelidade ao Documento Oficial da Obra Lumen, adicionando:

- **Três camadas temporais:** Mensal, Semanal e Diário
- **Cinco etapas espirituais:** Motivação, Exame de Consciência, Ato de Contrição, Criação do Projeto e Intercessão
- **Cinco áreas estruturadas** no projeto mensal, conforme o Documento Oficial
- **Adaptação por realidade vocacional:** experiência contextualizada pelo estado de vida e etapa formativa do membro
- **Evangelização Ser Feliz** como dimensão espiritual própria, sem gamificação

Toda a informação registrada neste módulo é **estritamente privada**. Nenhum administrador, formador ou membro da equipe técnica tem acesso ao conteúdo escrito pelo usuário.

---

## 2. OBJETIVOS DO MÓDULO

### Objetivo primário
Oferecer ao membro um instrumento fiel à pedagogia da Obra Lumen para planejar, viver e revisar sua jornada espiritual, vocacional e comunitária em três horizonte temporais: mês, semana e dia.

### Objetivos específicos

1. **Fidelidade pedagógica:** Implementar exatamente as cinco áreas mensais, o exame de consciência e a intercessão conforme o Documento Oficial.
2. **Contextualização vocacional:** Adaptar a experiência do módulo ao estado de vida e à etapa formativa de cada membro, usando dados já existentes no perfil.
3. **Continuidade espiritual:** Criar um fluxo de transição entre ciclos que passa pelo exame de consciência e pelo ato de contrição antes do novo projeto.
4. **Planejamento semanal concreto:** Traduzir as decisões mensais em compromissos vocacionais concretos para cada semana.
5. **Preparação diária contemplativa:** Oferecer um espaço leve de preparação do dia seguinte ("Amanhã com o Emanuel") integrado ao semanal.
6. **Evangelização sem produtividade:** Dar à Evangelização Ser Feliz dimensão própria de disposição e presença — sem métricas, contadores ou gamificação.
7. **Preservação de dados:** Manter intactos todos os dados existentes dos ciclos anteriores.

### O que este módulo NÃO é

- Não é um gerenciador de tarefas
- Não é uma agenda ou calendário
- Não é um diário de hábitos
- Não possui sistema de pontos, metas numéricas, rankings ou conquistas
- Não registra tempo de práticas espirituais com fins de controle ou comparação

---

## 3. FLUXO COMPLETO DO USUÁRIO

### 3.1 Diagrama geral de estados

```
INÍCIO
  │
  ├── [Sem ciclo ativo neste mês]
  │     │
  │     ├── [Com ciclo anterior concluído e sem exame registrado]
  │     │     └── EXAME DE CONSCIÊNCIA → ATO DE CONTRIÇÃO → WIZARD
  │     │
  │     └── [Primeiro acesso ou ciclo anterior sem exame pendente]
  │           └── WIZARD DE CRIAÇÃO DO CICLO MENSAL
  │
  └── [Com ciclo ativo]
        │
        ├── Ver Projeto Mensal (5 áreas + reflexão evangelização)
        │
        ├── Projeto Semanal
        │     └── "Amanhã com o Emanuel" (dentro do semanal)
        │
        └── Ao encerrar o ciclo:
              REVISÃO MENSAL → ATO DE CONTRIÇÃO → CONCLUÍDO
              (próximo acesso ao hub → sugere exame)
```

### 3.2 Fluxo de criação de novo ciclo

**Passo 0 — Motivação**
O app lê o perfil do usuário (`vocational_reality_item_id`, `life_state_item_id`) e exibe uma experiência contemplativa personalizada:
- Saudação pelo nome
- Reflexão adaptada à etapa formativa (acolhida, vocacional, discipulado, consagrado etc.)
- Escritura ou texto carismatic relacionado à sua vocação
- Questão de meditação para preparar o coração
- Campo: **Intenção do ciclo** — uma frase ou palavra que o membro oferece como intenção para o mês

**Passo 1 — Ciclo**
Seleção do mês e ano.

**Passos 2 a 6 — Cinco Áreas Mensais**
Cada área tem: objetivo, lista de compromissos concretos, observações livres.
- Passo 2: Família Vocacional
- Passo 3: Ministério Bom Pastor
- Passo 4: Grupo Formativo
- Passo 5: Saúde, Descanso e Lazer
- Passo 6: Família de Origem

**Passo 7 — Evangelização Ser Feliz**
Campo único de reflexão mensal: "Como você quer viver a Evangelização neste mês? Quais pessoas estão no seu coração?"

**Passo 8 — Intercessão**
Encerramento do projeto em oração:
- Intenções pessoais
- Intenções comunitárias
- Oferecimento do mês

**Passo 9 — Privacidade (PIN)**
Opcional. Senha de 4 dígitos. Comportamento idêntico ao atual.

**Passo 10 — Confirmar**
Sumário e salvamento.

### 3.3 Fluxo do Exame de Consciência (transição entre ciclos)

Quando o usuário volta ao hub após concluir um ciclo e antes de criar o próximo:

1. O hub detecta ciclo anterior concluído sem exame registrado
2. Exibe convite: "Antes de iniciar o próximo ciclo, que tal fazer um breve Exame de Consciência?"
3. Usuário acessa tela de Exame
4. 6 campos de reflexão (descritos na seção de telas)
5. Ato de Contrição (texto fixo ao final)
6. Botão: "Continuar para o novo ciclo" → vai para o wizard

O Exame é salvo vinculado ao ciclo **encerrado** (como reflexão de saída daquele ciclo). Isso garante que cada ciclo tenha seu próprio registro de transição.

### 3.4 Fluxo do Projeto Semanal

1. Usuário acessa "Projeto Semanal" a partir do hub ou da tela do ciclo
2. Seletor de semana (1 a 5) — semana atual pré-selecionada
3. Se a semana já existe: modo edição; se não existe: modo criação
4. 4 passos: Dever de Estado → Vida Interior → Evangelização → Confirmar
5. Dentro do semanal, acesso ao planejamento diário

### 3.5 Fluxo do "Amanhã com o Emanuel"

1. Usuário acessa atalho de primeiro nível no hub (visível quando há ciclo e semanal ativos)
2. App detecta automaticamente o dia seguinte
3. Exibe campos leves de preparação espiritual do dia
4. Salvamento imediato (merge parcial no semanal — não altera outros dias)

### 3.6 Fluxo da Revisão Mensal (mantido e reposicionado)

1. Botão "Revisão Mensal" no hub quando há ciclo ativo
2. 4 perguntas de reflexão (estrutura atual mantida)
3. Ato de Contrição
4. Conclusão: opções de ver o ciclo, iniciar novo ciclo ou voltar ao hub

---

## 4. ARQUITETURA DE DADOS FINAL

### 4.1 Princípios

- **Aditivo:** Nenhuma tabela existente é droppada. Dados históricos preservados integralmente.
- **Discriminado:** A tabela de áreas usa `tipo_area` como discriminador — uma tabela para cinco áreas.
- **Compacto para o diário:** O planejamento diário vive como JSONB dentro do semanal, sem tabela própria.
- **Separado por responsabilidade:** Exame, Intercessão e Semanal são entidades independentes com ciclos de vida próprios.
- **Retrocompatível:** O response da API inclui `has_new_structure` para o frontend decidir qual template exibir.

### 4.2 Visão geral das tabelas

```
TABELAS EXISTENTES (sem alteração estrutural)
  projetos_vida_mensal           — cabeçalho do ciclo (campos novos adicionados via ALTER)
  projetos_vida_comunidade       — dados históricos; leitura apenas para ciclos antigos
  projetos_vida_cuidado          — dados históricos; leitura apenas para ciclos antigos
  projetos_vida_compromissos     — dados históricos; leitura apenas para ciclos antigos
  projetos_vida_praticas         — dados históricos; leitura apenas para ciclos antigos
  projetos_vida_revisoes         — revisão de saída; mantida e preservada

TABELAS NOVAS (criadas em migrations aditivas)
  projetos_vida_areas_mensais    — 5 áreas estruturadas (nova estrutura dos ciclos v2)
  projetos_vida_exame            — exame de consciência de transição entre ciclos
  projetos_vida_semanal          — projeto semanal + vida interior + plano diário (JSONB)
  projetos_vida_intercessao      — encerramento em oração do ciclo

CAMPOS NOVOS EM TABELA EXISTENTE
  projetos_vida_mensal.intencao                — ressuscitado (já existe, nunca exposto)
  projetos_vida_mensal.reflexao_evangelizacao  — novo
```

### 4.3 Discriminador de compatibilidade

O campo `has_new_structure` no response do projeto mensal é calculado pelo backend:
- `true` se existe ao menos um registro em `projetos_vida_areas_mensais` para aquele projeto
- `false` se o projeto usa apenas as tabelas históricas

O frontend usa esse campo para escolher o template de visualização.

---

## 5. MODELAGEM DAS ENTIDADES

### 5.1 `projetos_vida_mensal` (alterada — aditivo)

**Campos existentes:** todos mantidos sem alteração  
**Campos ressuscitados (já existem no DB, agora expostos):**
- `intencao` TEXT nullable — intenção espiritual do ciclo, preenchida na etapa de Motivação

**Campos novos (ALTER TABLE):**
- `reflexao_evangelizacao` TEXT nullable — reflexão mensal sobre Evangelização Ser Feliz

**Campo mantido como reservado (não exposto):**
- `tema` TEXT nullable — mantido para uso futuro sem exposição imediata

---

### 5.2 `projetos_vida_areas_mensais` (nova)

**Relação:** N:1 com `projetos_vida_mensal` (máximo 5 registros por projeto, um por `tipo_area`)  
**Constraint:** UNIQUE (`projeto_id`, `tipo_area`)

**Campos:**

| Campo | Tipo | Nullable | Descrição |
|---|---|---|---|
| `id` | UUID PK | — | gerado automaticamente |
| `projeto_id` | UUID FK | NÃO | referência ao ciclo mensal |
| `tipo_area` | VARCHAR(50) | NÃO | ENUM: ver abaixo |
| `objetivo` | TEXT | SIM | objetivo da área para o mês |
| `compromissos` | JSONB | SIM | array de compromissos concretos |
| `observacoes` | TEXT | SIM | observações livres |
| `created_at` | TIMESTAMPTZ | NÃO | auto |
| `updated_at` | TIMESTAMPTZ | NÃO | auto |

**Valores do ENUM `tipo_area`:**
- `FAMILIA_VOCACIONAL`
- `MINISTERIO_BOM_PASTOR`
- `GRUPO_FORMATIVO`
- `SAUDE_LAZER`
- `FAMILIA_ORIGEM`

**Estrutura do JSONB `compromissos`:**  
Array de itens. Cada item:
- `descricao` — texto livre (obrigatório no item)
- `data` — string de data opcional
- `horario` — string de horário opcional
- `local` — local opcional
- `obs` — observação do item opcional

**Semântica de `descricao` por área:**
- FAMILIA_VOCACIONAL: encontro, partilha, missão comunitária
- MINISTERIO_BOM_PASTOR: atividades pastorais e de serviço
- GRUPO_FORMATIVO: datas do grupo, retiros, formações
- SAUDE_LAZER: consultas, exames, descanso, atividades físicas, lazer
- FAMILIA_ORIGEM: momentos com família de sangue, ligações, visitas

---

### 5.3 `projetos_vida_exame` (nova)

**Relação:** 1:1 com `projetos_vida_mensal`  
**Semântica:** Exame de consciência registrado na **transição de saída** de um ciclo, antes de criar o próximo.

**Campos:**

| Campo | Tipo | Nullable | Pergunta orientadora |
|---|---|---|---|
| `id` | UUID PK | — | — |
| `projeto_id` | UUID FK UNIQUE | NÃO | referência ao ciclo encerrado |
| `gracas_recebidas` | TEXT | SIM | "Quais graças recebi neste mês?" |
| `infidelidades` | TEXT | SIM | "Onde percebo minhas infidelidades?" |
| `dificuldades_espirituais` | TEXT | SIM | "Quais dificuldades espirituais enfrentei?" |
| `jesus_abandonado` | TEXT | SIM | "Onde encontrei Jesus Abandonado neste período?" |
| `onde_deixei_de_responder` | TEXT | SIM | "Onde deixei de responder ao chamado de Deus?" |
| `proposito_conversao` | TEXT | SIM | "Meu propósito de conversão para o próximo ciclo:" |
| `created_at` | TIMESTAMPTZ | NÃO | auto |
| `updated_at` | TIMESTAMPTZ | NÃO | auto |

---

### 5.4 `projetos_vida_semanal` (nova)

**Relação:** N:1 com `projetos_vida_mensal` (máximo 5 por ciclo)  
**Constraint:** UNIQUE (`projeto_id`, `numero_semana`)

**Campos:**

| Campo | Tipo | Nullable | Descrição |
|---|---|---|---|
| `id` | UUID PK | — | gerado automaticamente |
| `projeto_id` | UUID FK | NÃO | referência ao ciclo mensal |
| `numero_semana` | INTEGER 1–5 | NÃO | número da semana no ciclo |
| `dever_estado` | JSONB | SIM | compromissos vocacionais da semana |
| `vida_interior` | JSONB | SIM | planejamento das práticas espirituais |
| `evangelizacao_disposicao` | TEXT | SIM | disposição espiritual para evangelizar na semana |
| `evangelizacao_momentos` | JSONB | SIM | array de momentos relacionais planejados |
| `plano_diario` | JSONB | SIM | planejamento de cada dia (chaves: seg–dom) |
| `observacoes` | TEXT | SIM | observações gerais da semana |
| `created_at` | TIMESTAMPTZ | NÃO | auto |
| `updated_at` | TIMESTAMPTZ | NÃO | auto |

**Estrutura do JSONB `dever_estado`:**
```
{
  "estado_de_vida": "<código do life_state>",
  "itens": [
    {
      "categoria": "<ex.: Cônjuge, Filhos, Família>",
      "descricao": "<compromissos concretos da semana>"
    }
  ],
  "reflexao": "<reflexão livre sobre o dever de estado>"
}
```
As categorias dentro de `itens` são determinadas pelo template vocacional (`DEVER_ESTADO_TEMPLATES` no frontend), não pelo banco. O banco armazena o que foi preenchido.

**Estrutura do JSONB `vida_interior`:**
```
{
  "missa":              { "dias": ["seg","qui","dom"], "horario": "07:00", "obs": "" },
  "lectio_divina":      { "dias": ["seg","ter","qua","qui","sex"], "horario": "06:30", "duracao": "20min" },
  "terco":              { "dias": ["dom"], "horario": "20:00" },
  "leitura_espiritual": { "dias": ["sab"], "obra": "<título da obra>", "duracao": "30min" },
  "adoracao":           { "dias": ["sex"], "horario": "19:00" },
  "jejum":              { "dias": ["sex"], "obs": "<tipo de jejum>" }
}
```
Todos os campos de cada prática são nullable. Práticas não planejadas são omitidas ou ficam com array vazio.

**Estrutura do JSONB `evangelizacao_momentos`:**
```
[
  { "descricao": "<descrição livre do momento relacional planejado>" },
  { "descricao": "..." }
]
```
Sem campos de duração, sem campos de status, sem campos de conclusão.

**Estrutura do JSONB `plano_diario`:**
```
{
  "seg": {
    "proposito":          "<propósito do dia>",
    "missa":              true,
    "horario_missa":      "07:00",
    "oracao_manha":       "<descrição>",
    "lectio":             "<intenção da lectio>",
    "terco":              false,
    "leitura_espiritual": "<obra e trecho>",
    "evangelizacao":      "<como pretendo estar presente>",
    "compromissos":       ["<compromisso 1>", "<compromisso 2>"]
  },
  "ter": { ... },
  "qua": { ... },
  "qui": { ... },
  "sex": { ... },
  "sab": { ... },
  "dom": { ... }
}
```
Todos os campos de cada dia são nullable. Dias não preenchidos não precisam estar presentes. O salvamento de um único dia faz merge parcial — os demais dias não são afetados.

---

### 5.5 `projetos_vida_intercessao` (nova)

**Relação:** 1:1 com `projetos_vida_mensal`  
**Semântica:** Encerramento do ciclo em oração, criado durante o wizard de criação.

**Campos:**

| Campo | Tipo | Nullable | Descrição |
|---|---|---|---|
| `id` | UUID PK | — | gerado automaticamente |
| `projeto_id` | UUID FK UNIQUE | NÃO | referência ao ciclo |
| `intencoes_pessoais` | TEXT | SIM | intenções pessoais do membro |
| `intencoes_comunitarias` | TEXT | SIM | intenções pela comunidade |
| `oferecimento` | TEXT | SIM | oferecimento do mês a Deus |
| `created_at` | TIMESTAMPTZ | NÃO | auto |
| `updated_at` | TIMESTAMPTZ | NÃO | auto |

---

### 5.6 `projetos_vida_revisoes` (mantida sem alteração)

Estrutura atual preservada integralmente. Permanece como revisão de **saída** do ciclo:
- `pratica_melhorar`
- `taticas_vigilancia`
- `rotina_evangelizacao`
- `outra_area_atencao`

---

## 6. CONTRATOS DE API

### Prefixo base: `/projeto-vida-mensal`

---

#### 6.1 Endpoint de contexto vocacional

**`GET /projeto-vida-mensal/contexto-vocacional`**  
Auth: Bearer token

**Response 200:**
```json
{
  "vocational_reality_code": "DISCIPULADO",
  "life_state_code": "CASADO",
  "perfil_incompleto": false,
  "motivacao": {
    "saudacao": "Bem-vindo ao seu novo ciclo, [Nome].",
    "reflexao": "Como discípulo vocacional e homem casado, ...",
    "escritura": "\"Eu vim para que tenham vida, e a tenham em abundância.\" (Jo 10,10)",
    "questao_meditacao": "Como Deus está me chamando a viver minha vocação neste mês?"
  },
  "dever_estado_template": {
    "titulo": "Dever de Estado — Casado",
    "descricao": "Como pessoa casada, seu dever de estado perante Deus envolve...",
    "categorias": [
      { "label": "Cônjuge", "placeholder": "Que momentos concretos vou reservar para minha esposa/marido esta semana?" },
      { "label": "Filhos", "placeholder": "Como cuidarei da educação e presença com meus filhos?" },
      { "label": "Lar e Família", "placeholder": "Que responsabilidades familiares assumirei esta semana?" },
      { "label": "Oração em Família", "placeholder": "Como organizarei a vida de oração da minha família?" }
    ]
  }
}
```

Quando `perfil_incompleto: true`: campos `dever_estado_template` usam versão genérica. `motivacao` usa texto padrão sem personalização.

---

#### 6.2 Endpoints do ciclo mensal (alterados)

**`POST /projeto-vida-mensal/`**  
Body (campos novos adicionados):
```json
{
  "mes": 6,
  "ano": 2026,
  "pin": null,
  "intencao": "Viver este mês inteiramente voltado para a família",
  "reflexao_evangelizacao": "Quero estar mais presente para meus colegas de trabalho"
}
```

**`PUT /projeto-vida-mensal/{id}`**  
Body (campos novos adicionados):
```json
{
  "intencao": "...",
  "reflexao_evangelizacao": "...",
  "areas": [
    {
      "tipo_area": "FAMILIA_VOCACIONAL",
      "objetivo": "Participar de todos os encontros comunitários do mês",
      "compromissos": [
        { "descricao": "Encontro da Família Vocacional", "data": "14/06", "horario": "15h", "local": "Sede" }
      ],
      "observacoes": "Falar com o acompanhador sobre minha vida de oração"
    }
  ]
}
```
Quando `areas` está presente: upsert em `projetos_vida_areas_mensais` por `tipo_area`. Áreas não enviadas não são alteradas.

**`GET /projeto-vida-mensal/{id}`**  
Response (campos novos adicionados):
```json
{
  "id": "...",
  "mes": 6,
  "ano": 2026,
  "has_pin": false,
  "concluido": false,
  "intencao": "Viver este mês inteiramente voltado para a família",
  "reflexao_evangelizacao": "...",
  "has_new_structure": true,
  "areas": [
    {
      "id": "...",
      "tipo_area": "FAMILIA_VOCACIONAL",
      "objetivo": "...",
      "compromissos": [ ... ],
      "observacoes": "..."
    }
  ],
  "exame": null,
  "intercessao": {
    "id": "...",
    "intencoes_pessoais": "...",
    "intencoes_comunitarias": "...",
    "oferecimento": "..."
  },
  "semanas": [
    { "id": "...", "numero_semana": 1, "created_at": "..." }
  ],
  "revisao": null,
  "observacoes_mes": null,
  "created_at": "...",
  "updated_at": "..."
}
```

Quando `has_new_structure: false`: campos `areas` retornam `[]` e os campos históricos (`comunidade`, `cuidado`, `compromissos`, `praticas`) retornam como antes.

**`GET /projeto-vida-mensal/atual`**  
Response: adicionar `semanal_atual` (semana numericamente mais próxima da data atual, ou null):
```json
{
  "semanal_atual": {
    "id": "...",
    "numero_semana": 2,
    "plano_diario": { "sex": { "proposito": "...", ... } }
  }
}
```

---

#### 6.3 Endpoints de Exame de Consciência

**`GET /projeto-vida-mensal/{id}/exame`**  
Response: `ExameOut | null`

**`PUT /projeto-vida-mensal/{id}/exame`**  
Body:
```json
{
  "gracas_recebidas": "...",
  "infidelidades": "...",
  "dificuldades_espirituais": "...",
  "jesus_abandonado": "...",
  "onde_deixei_de_responder": "...",
  "proposito_conversao": "..."
}
```
Semântica: upsert (cria se não existe; atualiza se existe).  
Response: `ExameOut` com todos os campos + `id`, `created_at`, `updated_at`.

---

#### 6.4 Endpoints de Projeto Semanal

**`GET /projeto-vida-mensal/{id}/semanal`**  
Response: lista de semanas criadas (sumário — sem `plano_diario` completo):
```json
[
  { "id": "...", "numero_semana": 1, "created_at": "..." },
  { "id": "...", "numero_semana": 2, "created_at": "..." }
]
```

**`POST /projeto-vida-mensal/{id}/semanal`**  
Body: `ProjetoVidaSemanasCreate` com todos os campos opcionais exceto `numero_semana`.  
Response: `ProjetoVidaSemanasOut` completo.  
Erro 409: se `numero_semana` já existe para este projeto.

**`GET /projeto-vida-semanal/{id}`**  
Response: `ProjetoVidaSemanasOut` completo incluindo `plano_diario` com todos os dias.

**`PUT /projeto-vida-semanal/{id}`**  
Body: campos opcionais. Quando `plano_diario` está presente: merge parcial por chave de dia.  
Exemplo de atualização de um único dia:
```json
{
  "plano_diario": {
    "sex": {
      "proposito": "Ser mais paciente",
      "missa": true,
      "horario_missa": "07:00"
    }
  }
}
```
Dias não enviados (`seg`, `ter`, `qua`, `qui`, `sab`, `dom`) permanecem intactos.  
Response: `ProjetoVidaSemanasOut` completo atualizado.

---

#### 6.5 Endpoints de Intercessão

**`GET /projeto-vida-mensal/{id}/intercessao`**  
Response: `IntercessaoOut | null`

**`PUT /projeto-vida-mensal/{id}/intercessao`**  
Body:
```json
{
  "intencoes_pessoais": "...",
  "intencoes_comunitarias": "...",
  "oferecimento": "..."
}
```
Semântica: upsert.  
Response: `IntercessaoOut` completo.

---

#### 6.6 Segurança e privacidade em todos os endpoints novos

- Todos verificam que o `user_id` do projeto corresponde ao usuário autenticado
- Retornam 403 se o projeto pertence a outro usuário
- Nenhum dado é incluído em audit logs ou dashboards administrativos
- PIN do projeto pai é verificado antes de qualquer acesso a exame, semanal e intercessão

---

## 7. ESTRUTURA DAS TELAS

### 7.1 Rotas

```
/vida                → index.tsx       — hub principal (alterado)
/vida/wizard         → wizard.tsx      — wizard de criação (reformulado, 11 passos)
/vida/ciclo          → ciclo.tsx       — visualização do ciclo (expandido)
/vida/exame          → exame.tsx       — exame de consciência (NOVA)
/vida/semanal        → semanal.tsx     — projeto semanal (NOVA)
/vida/diario         → diario.tsx      — "Amanhã com o Emanuel" (NOVA)
/vida/revisao        → revisao.tsx     — revisão mensal (mantida)
/vida/historico      → historico.tsx   — histórico de ciclos (mantido)
/vida/unlock         → unlock.tsx      — PIN (mantido)
/vida/_layout.tsx    → _layout.tsx     — atualizar com novas rotas
```

---

### 7.2 `index.tsx` — Hub (alterado)

**Seções:**
1. Header contemplativo com mês/ano atual
2. Recomendação espiritual (mantida)
3. Estado do ciclo:
   - **Sem ciclo ativo:** card convite + botão "Iniciar novo ciclo"
   - **Com ciclo ativo:** card do ciclo com status das 5 áreas + botões de acesso
4. **[NOVO]** Card "Amanhã com o Emanuel" — visível quando há ciclo ativo e semanal da semana corrente. Mostra o dia de amanhã e abre `/vida/diario`.
5. **[NOVO]** Indicadores de status das três camadas: Mensal / Semanal / Diário
6. Bloco de privacidade (mantido)
7. Link para histórico (mantido)

**Lógica nova:**
- Se há ciclo concluído e sem exame: exibir convite ao exame antes do wizard
- Status do semanal: verificar se a semana atual já foi preenchida

---

### 7.3 `wizard.tsx` — 11 passos (reformulado)

**Barra de progresso:** mantida, ajustada para 11 passos.

**Passo 0 — Motivação**
- Chama `GET /contexto-vocacional` ao montar
- Exibe: saudação, reflexão adaptada, escritura
- Campo: intenção do ciclo (texto livre, optional)
- Botão: "Iniciar meu Projeto de Vida"

**Passos 2 a 6 — Áreas mensais (componente reutilizado)**
- Cada passo usa o mesmo componente `AreaMensalStep`
- Props: `tipoArea`, `titulo`, `descricaoOrientadora`
- Campos: objetivo (TextInput), lista de compromissos (add/remove/edit), observações
- Compromisso item: descricao, data, horário, local, obs

**Passo 7 — Evangelização Ser Feliz**
- Campo de reflexão mensal (TextArea)
- Texto orientador: "Como você quer viver a Evangelização neste mês? Quais pessoas estão no seu coração?"

**Passo 8 — Intercessão**
- Texto introdutório contemplativo
- 3 campos: intenções pessoais, intenções comunitárias, oferecimento

**Passo 9 — PIN**
- Idêntico ao atual

**Passo 10 — Confirmar**
- Sumário: intenção, 5 áreas preenchidas, evangelização, intercessão, PIN
- Botão "Salvar Projeto de Vida"
- Sequência de salvamento:
  1. POST criar projeto (com `intencao`, `reflexao_evangelizacao`)
  2. PUT atualizar com `areas`
  3. PUT salvar intercessão
  4. Navigate para `/vida/ciclo`

---

### 7.4 `exame.tsx` — Exame de Consciência (NOVA)

**Layout:** tela única com scroll, sem passos múltiplos.

**Estrutura:**
1. Cabeçalho contemplativo (não é um formulário — é uma abertura espiritual em texto)
2. 6 cartões de reflexão, cada um com:
   - Pergunta orientadora (em destaque)
   - TextInput multilinhas
3. Bloco do Ato de Contrição (texto fixo, estilo espiritual)
4. Botão: "Continuar para o novo ciclo"

**Comportamento:**
- Carrega `GET /projeto-vida-mensal/{id_ciclo_anterior}/exame` para ver se já existe
- Salva com `PUT /projeto-vida-mensal/{id_ciclo_anterior}/exame` (upsert — pode ser editado)
- Ao clicar "Continuar": navega para `/vida/wizard`

---

### 7.5 `semanal.tsx` — Projeto Semanal (NOVA)

**Estrutura:** wizard de 4 passos.

**Passo 0 — Seletor de semana**
- Chips numerados: Semana 1 / 2 / 3 / 4 / 5
- A semana calculada com base na data atual é pré-selecionada
- Exibe status de cada semana (preenchida / não preenchida)

**Passo 1 — Dever de Estado**
- Cabeçalho: "Seu dever de estado perante Deus"
- Sub-cabeçalho: "[label do estado de vida do perfil]"
- Se perfil incompleto: aviso com link para completar perfil
- Seções dinâmicas baseadas no `dever_estado_template` retornado pelo backend
- Cada seção: label da categoria + TextInput para compromissos concretos da semana
- Campo livre: reflexão sobre o dever de estado

**Passo 2 — Vida Interior**
- 6 práticas: Missa, Lectio Divina, Terço, Leitura Espiritual, Adoração, Jejum
- Cada prática: toggle de ativação + (quando ativo) seletor de dias (chips seg–dom) + campo horário/obs
- Layout: cards colapsáveis para compactar a tela

**Passo 3 — Evangelização Ser Feliz**
- Bloco de âncora: mostra `reflexao_evangelizacao` do ciclo mensal (somente leitura)
- Campo `evangelizacao_disposicao`: "Com qual espírito e disposição você entra nesta semana para evangelizar?"
- Lista `evangelizacao_momentos`: campo de adição de momentos relacionais (texto livre, sem duração)
- Placeholder de exemplo: "Conversa com colega de trabalho durante o almoço"

**Passo 4 — Confirmar**
- Sumário dos itens preenchidos
- POST (criar) ou PUT (editar) conforme o estado

---

### 7.6 `diario.tsx` — "Amanhã com o Emanuel" (NOVA)

**Acesso:** atalho de primeiro nível no hub.

**Layout:** tela única leve, sem wizard.

**Cabeçalho:**
- Título: "Amanhã com o Emanuel"
- Subtítulo: "[dia da semana], [data de amanhã]"
- Navegação lateral para outros dias da semana

**Campos (todos opcionais):**
- `proposito`: "O propósito do dia de amanhã:" (TextInput, 1–2 linhas)
- `missa`: Toggle booleano + campo `horario_missa` (quando ativo)
- `oracao_manha`: campo de oração planejada
- `lectio`: intenção da Lectio Divina
- `terco`: Toggle booleano
- `leitura_espiritual`: campo livre
- `evangelizacao`: "Como pretendo estar presente para evangelizar amanhã?"
- `compromissos`: lista de até 5 compromissos do dia (campos de texto curto)

**Comportamento:**
- Carrega dados do `plano_diario[dia]` do semanal atual
- Salva via `PUT /projeto-vida-semanal/{id}` com merge parcial no dia
- Se não há semanal ativo: exibe mensagem e link para criar o semanal da semana

---

### 7.7 `ciclo.tsx` — Visualização do ciclo (expandido)

**Seções novas:**
- Intenção do ciclo (card espiritual de destaque, quando preenchida)
- 5 áreas estruturadas (quando `has_new_structure: true`): cada área com seu objetivo e lista de compromissos
- Reflexão sobre Evangelização Ser Feliz
- Links de acesso: Projeto Semanal, Revisão, Intercessão

**Seções mantidas (para ciclos antigos):**
- Comunidade, Cuidado, Compromissos, Práticas (quando `has_new_structure: false`)

---

### 7.8 Arquivo de conteúdo vocacional (novo)

**Arquivo:** `src/data/conteudoVocacional.ts`

**Contém:**

`MOTIVACAO_CONTENT` — mapa por etapa formativa:
- Chaves: `ACOLHIDA`, `APROFUNDAMENTO`, `VOCACIONAL`, `POSTULANTADO`, `DISCIPULADO`, `CONSAGRADO_FILHO_DA_LUZ`, `GENERICO`
- Campos por chave: `saudacao`, `reflexao`, `escritura`, `questao_meditacao`

`DEVER_ESTADO_TEMPLATES` — mapa por estado de vida:
- Chaves: `CASADO`, `SOLTEIRO`, `CELIBATARIO`, `SEMINARISTA`, `DIACONO`, `DIACONO_PERMANENTE`, `SACERDOTE`, `BISPO`, `LEIGO_CONSAGRADO`, `GENERICO`
- Campos por chave: `titulo`, `descricao`, `categorias: [{label, placeholder}]`

---

## 8. REGRAS DE NEGÓCIO

### 8.1 Privacidade e acesso

- **RN-01:** Nenhum dado do módulo Projeto de Vida é incluído em audit logs, respostas administrativas ou dashboards.
- **RN-02:** Todos os endpoints verificam que o `user_id` do projeto pertence ao usuário autenticado. 403 caso contrário.
- **RN-03:** Se o projeto tem PIN, o acesso a exame, semanal, intercessão e ciclo requer verificação prévia do PIN (fluxo de unlock existente estendido para os novos recursos).
- **RN-04:** A equipe técnica não pode acessar o conteúdo escrito pelo usuário.

### 8.2 Integridade dos dados

- **RN-05:** Cada projeto mensal pode ter no máximo 5 registros em `projetos_vida_areas_mensais` — um por `tipo_area`. Tentativa de criar duplicata retorna 409.
- **RN-06:** Cada projeto mensal pode ter no máximo 5 registros em `projetos_vida_semanal` — um por `numero_semana`. Tentativa de criar duplicata retorna 409.
- **RN-07:** `projetos_vida_exame` e `projetos_vida_intercessao` têm relação 1:1 com o ciclo mensal. Upsert idempotente.
- **RN-08:** A deleção de um projeto mensal remove em cascata todos os registros vinculados (áreas, exame, semanal, intercessão, revisão).

### 8.3 Salvamento parcial do plano diário

- **RN-09:** O endpoint `PUT /projeto-vida-semanal/{id}` ao receber `plano_diario` faz **merge por chave de dia**. Dias não enviados no body permanecem intactos no banco. Não é uma substituição total do JSONB.
- **RN-10:** Um usuário pode preencher apenas um dia da semana sem afetar os demais.

### 8.4 Compatibilidade retroativa

- **RN-11:** Ciclos criados antes da Fase 1 continuam lendo dados de `projetos_vida_comunidade`, `projetos_vida_cuidado`, `projetos_vida_compromissos` e `projetos_vida_praticas`.
- **RN-12:** O campo `has_new_structure` no response do ciclo é `true` somente se existir ao menos um registro em `projetos_vida_areas_mensais` para aquele projeto.
- **RN-13:** Tabelas históricas não são populadas por novos ciclos após a Fase 1.

### 8.5 Exame de Consciência

- **RN-14:** O exame é sempre vinculado ao ciclo **encerrado** (ciclo anterior), não ao novo ciclo que será criado.
- **RN-15:** O exame pode ser criado ou atualizado a qualquer momento após o ciclo ser marcado como concluído.
- **RN-16:** O exame não é obrigatório para criar um novo ciclo. O hub sugere; o usuário pode pular.

### 8.6 Evangelização Ser Feliz

- **RN-17:** Nenhum endpoint calcula, retorna ou armazena totais de minutos, contagens, percentuais, streaks ou qualquer métrica quantitativa de evangelização.
- **RN-18:** O campo `evangelizacao_momentos` armazena descrições relacionais livres. Não possui campos de duração, status de conclusão ou marcação de "feito".
- **RN-19:** O campo `reflexao_evangelizacao` do mensal e o campo `evangelizacao_disposicao` do semanal são campos de disposição espiritual, não de planejamento de tarefas.

### 8.7 Dever de Estado

- **RN-20:** O conteúdo e as categorias do Dever de Estado são determinados pelo `DEVER_ESTADO_TEMPLATES` do frontend, baseado no `life_state_code` retornado pelo endpoint de contexto vocacional.
- **RN-21:** O banco armazena apenas o conteúdo preenchido pelo usuário no JSONB `dever_estado`. O template em si não é armazenado.
- **RN-22:** Quando o perfil não tem `life_state_item_id`, o template `GENERICO` é usado. O usuário vê um aviso suave sugerindo completar o perfil.

### 8.8 Campos do cabeçalho mensal

- **RN-23:** O campo `tema` em `projetos_vida_mensal` não é exposto via API nem exibido no frontend nesta versão. É mantido para uso futuro.
- **RN-24:** O campo `intencao` é exposto e preenchível a partir da Fase 0. É opcional.

---

## 9. ESTRATÉGIA DE MIGRAÇÃO

### 9.1 Princípios

1. **Zero downtime:** Cada fase é deployável independentemente sem interromper o serviço.
2. **Aditivo:** Nenhuma tabela existente é droppada em nenhuma fase.
3. **Compatibilidade retroativa:** Ciclos antigos continuam sendo lidos e exibidos corretamente.
4. **Sem migração de dados automática:** Dados das tabelas históricas permanecem onde estão. Não são copiados para as novas tabelas.

### 9.2 Verificação pré-migration

Antes da migration 035 (alter table mensal), executar:
```sql
SELECT COUNT(*) FROM projetos_vida_mensal WHERE tema IS NOT NULL;
SELECT COUNT(*) FROM projetos_vida_mensal WHERE intencao IS NOT NULL;
```
Ambas devem retornar 0. Caso retornem valores, investigar antes de prosseguir.

### 9.3 Rollback por fase

- **Fase 0:** Rollback é apenas código (sem migration). Reverter o deploy.
- **Fases 1–5:** Cada migration tem `downgrade()` implementado. O downgrade remove as colunas/tabelas adicionadas sem afetar dados existentes.
- **Dados criados nas novas tabelas após o deploy não são perdidos no rollback do schema** — as tabelas históricas continuam intactas.

### 9.4 Coexistência das estruturas

O backend mantém lógica de leitura dual:

```
GET /projeto-vida-mensal/{id}
  → Se has_new_structure: retornar areas_mensais + campos novos
  → Se NOT has_new_structure: retornar comunidade + cuidado + compromissos + praticas
```

O frontend usa `has_new_structure` para escolher qual template de visualização renderizar:
- Template novo: 5 áreas estruturadas
- Template legado: comunidade + cuidado + compromissos + práticas

Esta coexistência permanece indefinidamente — não há data de deprecação das tabelas históricas neste spec.

---

## 10. PLANO DE IMPLEMENTAÇÃO POR FASES

### FASE 0 — Motivação adaptada ao perfil
**Duração estimada:** 2–3 dias  
**Migrations:** Nenhuma  
**Entrega:** Experiência de motivação personalizada ao criar próximo ciclo

Escopo:
- Backend: criar endpoint `GET /projeto-vida-mensal/contexto-vocacional`
- Frontend: criar `src/data/conteudoVocacional.ts` com `MOTIVACAO_CONTENT`
- Frontend: refatorar Passo 0 do `wizard.tsx` para consumir o endpoint e exibir reflexão adaptada
- Frontend: adicionar campo `intencao` no Passo 0 do wizard
- Backend: expor `intencao` nos schemas `ProjetoVidaMensalCreate`, `ProjetoVidaMensalFull` e `ProjetoVidaMensalUpdate`

**Dependências:** nenhuma

---

### FASE 1 — Áreas mensais reestruturadas
**Duração estimada:** 4–5 dias  
**Migrations:** 035, 036  
**Entrega:** Novos ciclos usam as 5 áreas estruturadas do Documento Oficial

Escopo:
- Migration 035: ADD `reflexao_evangelizacao` em `projetos_vida_mensal`
- Migration 036: CREATE `projetos_vida_areas_mensais`
- Backend: novos schemas (`AreaMensalIn/Out`, `CompromissoAreaItem`)
- Backend: atualizar `ProjetoVidaMensalCreate/Update/Full` com campos novos
- Backend: lógica de upsert de áreas em `PUT /{id}`
- Backend: adicionar `has_new_structure` e `areas` no `GET /{id}`
- Backend: lógica dual de leitura (novo vs. legado)
- Frontend: reformular Passos 2–6 do wizard (componente `AreaMensalStep` reutilizável)
- Frontend: adicionar Passo 7 (Evangelização) no wizard
- Frontend: expandir `ciclo.tsx` — template novo para ciclos v2, template legado para ciclos antigos

**Dependências:** Fase 0 (campo `intencao` já exposto)

---

### FASE 2 — Exame de Consciência
**Duração estimada:** 2–3 dias  
**Migrations:** 037  
**Entrega:** Transição entre ciclos com exame espiritual de entrada

Escopo:
- Migration 037: CREATE `projetos_vida_exame`
- Backend: schemas `ExameUpsert/Out`
- Backend: endpoints `GET/PUT /projeto-vida-mensal/{id}/exame`
- Frontend: criar `app/vida/exame.tsx` com 6 campos + Ato de Contrição
- Frontend: lógica no hub — detectar ciclo concluído sem exame → exibir convite
- Frontend: atualizar `_layout.tsx` com nova rota

**Dependências:** nenhuma (pode ser feita em paralelo com Fase 1)

---

### FASE 3 — Intercessão
**Duração estimada:** 1–2 dias  
**Migrations:** 039  
**Entrega:** Wizard fecha em oração

Escopo:
- Migration 039: CREATE `projetos_vida_intercessao`
- Backend: schemas `IntercessaoUpsert/Out`
- Backend: endpoints `GET/PUT /projeto-vida-mensal/{id}/intercessao`
- Frontend: adicionar Passo 8 (Intercessão) no wizard
- Frontend: incluir salvamento da intercessão na sequência `handleSave` do wizard

**Dependências:** Fase 1 (wizard já reformulado)

---

### FASE 4 — Projeto Semanal
**Duração estimada:** 5–6 dias  
**Migrations:** 038  
**Entrega:** Camada semanal com Dever de Estado, Vida Interior e Evangelização

Escopo:
- Migration 038: CREATE `projetos_vida_semanal`
- Backend: schemas `ProjetoVidaSemanasCreate/Update/Out`
- Backend: endpoints `GET/POST /projeto-vida-mensal/{id}/semanal`
- Backend: endpoints `GET/PUT /projeto-vida-semanal/{id}` (com merge parcial para `plano_diario`)
- Backend: atualizar `GET /projeto-vida-mensal/atual` para incluir `semanal_atual`
- Frontend: criar `src/data/conteudoVocacional.ts` — seção `DEVER_ESTADO_TEMPLATES`
- Frontend: criar `app/vida/semanal.tsx` (wizard de 4 passos)
- Frontend: integrar acesso ao semanal em `ciclo.tsx` e no hub
- Frontend: atualizar `_layout.tsx` com nova rota
- Frontend: atualizar serviço `projetoVidaMensal.ts` com novos tipos e métodos

**Dependências:** Fase 1 (ciclo com `reflexao_evangelizacao` disponível para âncora no semanal)

---

### FASE 5 — "Amanhã com o Emanuel"
**Duração estimada:** 2 dias  
**Migrations:** Nenhuma (dados vivem no semanal)  
**Entrega:** Atalho de primeiro nível para planejamento diário

Escopo:
- Frontend: criar `app/vida/diario.tsx`
- Frontend: adicionar card "Amanhã com o Emanuel" no hub (visível quando há semanal ativo)
- Frontend: lógica de detecção do dia seguinte e navegação por dias
- Frontend: atualizar `_layout.tsx` com nova rota

**Dependências:** Fase 4 (semanal existente com `plano_diario`)

---

### FASE 6 — Consolidação (futura)
**Duração estimada:** 1 dia (sem data definida)  
**Triggered por:** Análise de adoção — quando proporção de ciclos v2 vs. v1 justificar

Escopo:
- Frontend: adicionar label visual "Ciclo anterior" nos ciclos com `has_new_structure: false`
- Avaliação de deprecação das tabelas históricas (decisão em momento futuro)

---

## 11. CRITÉRIOS DE ACEITAÇÃO

### CA-01 — Motivação adaptada ao perfil
- [ ] Usuário com perfil completo vê reflexão diferente de outro usuário com etapa formativa diferente
- [ ] Usuário sem `life_state_item_id` preenchido vê versão genérica (sem erro)
- [ ] Campo `intencao` preenchido no Passo 0 é salvo e exibido no ciclo
- [ ] Endpoint `/contexto-vocacional` retorna 200 mesmo com perfil incompleto

### CA-02 — Cinco áreas mensais
- [ ] Wizard apresenta exatamente 5 passos de áreas (Família Vocacional, Ministério, Grupo, Saúde/Lazer, Família de Origem)
- [ ] Cada área permite: objetivo, ao menos um compromisso, observações
- [ ] Cada compromisso permite: descrição, data, horário, local, obs
- [ ] Um compromisso pode ser adicionado e removido
- [ ] Salvar um ciclo com áreas parcialmente preenchidas funciona (todas as áreas são opcionais)
- [ ] `GET /{id}` retorna `has_new_structure: true` para ciclos novos e `false` para ciclos antigos
- [ ] Ciclos antigos continuam exibindo dados históricos corretamente

### CA-03 — Evangelização Ser Feliz
- [ ] Campo `reflexao_evangelizacao` do mensal é salvo e exibido
- [ ] Tela do semanal exibe `reflexao_evangelizacao` do mensal como âncora (somente leitura)
- [ ] Campo `evangelizacao_disposicao` do semanal é salvo e recuperado
- [ ] Momentos de evangelização podem ser adicionados e removidos
- [ ] Nenhum campo de duração, contagem ou percentual aparece na tela ou response

### CA-04 — Exame de Consciência
- [ ] Tela de exame exibe 6 campos com perguntas orientadoras
- [ ] Dados salvos são recuperados corretamente ao reabrir a tela
- [ ] Ao finalizar o exame, usuário é direcionado ao wizard
- [ ] O exame é vinculado ao ciclo anterior (não ao novo)
- [ ] Hub exibe convite ao exame quando há ciclo concluído sem exame

### CA-05 — Ato de Contrição
- [ ] Aparece após os 6 campos no exame de consciência (tela de exame)
- [ ] Aparece como passo da revisão mensal (fluxo atual mantido)
- [ ] Texto é idêntico em ambos os contextos

### CA-06 — Intercessão
- [ ] Passo de Intercessão aparece no wizard (Passo 8)
- [ ] 3 campos preenchíveis: intenções pessoais, comunitárias, oferecimento
- [ ] Dados da intercessão são salvos e exibidos no ciclo
- [ ] Passo não é obrigatório (salva com campos vazios sem erro)

### CA-07 — Projeto Semanal
- [ ] Usuário pode criar até 5 semanas por ciclo
- [ ] Tentativa de criar semana já existente retorna 409
- [ ] Dever de Estado exibe seções adaptadas ao estado de vida do perfil
- [ ] Usuário sem estado de vida no perfil vê template genérico e aviso suave
- [ ] Vida Interior: cada prática pode ser ativada/desativada com dias e horário
- [ ] Evangelização semanal salva corretamente

### CA-08 — "Amanhã com o Emanuel"
- [ ] Card no hub é visível apenas quando há ciclo e semanal ativos
- [ ] Tela exibe por padrão o dia seguinte
- [ ] Navegação entre dias da semana funciona
- [ ] Salvar o planejamento de um dia não altera os demais dias
- [ ] Sem semanal ativo: tela exibe mensagem e link para criar semanal

### CA-09 — Privacidade e segurança
- [ ] Usuário A não pode acessar o projeto de Usuário B (403)
- [ ] Nenhum dado do módulo aparece em responses administrativas
- [ ] PIN continua funcionando para todos os recursos do ciclo (incluindo semanal e exame)

### CA-10 — Retrocompatibilidade
- [ ] Ciclos criados antes da evolução continuam exibindo dados corretos
- [ ] `has_new_structure: false` retorna dados das tabelas históricas
- [ ] Nenhum dado histórico foi alterado ou perdido

---

## 12. CHECKLIST DE GO-LIVE

### Banco de dados
- [ ] Migration 035 executada e verificada em staging
- [ ] Migration 036 executada e verificada em staging
- [ ] Migration 037 executada e verificada em staging
- [ ] Migration 038 executada e verificada em staging
- [ ] Migration 039 executada e verificada em staging
- [ ] Query de verificação: `SELECT COUNT(*) FROM projetos_vida_mensal WHERE tema IS NOT NULL` = 0 antes da migration 035
- [ ] Todos os downgrade() testados em staging
- [ ] Backups realizados antes de cada migration em produção

### Backend
- [ ] Todos os endpoints novos retornam 200/201 com dados corretos
- [ ] Endpoint `/contexto-vocacional` funciona para todos os `vocational_reality_code` conhecidos
- [ ] Merge parcial do `plano_diario` verificado (dia único não afeta outros dias)
- [ ] Lógica dual de leitura (`has_new_structure`) verificada para ciclos antigos e novos
- [ ] Todos os 403 para acesso cruzado funcionando
- [ ] Nenhum dado do módulo exposto em endpoints admin (verificação manual)
- [ ] Testes unitários passando: `pytest tests/test_projeto_vida_mensal.py -v`
- [ ] Testes novos escritos para cada endpoint novo

### Frontend
- [ ] Wizard completo de 11 passos funciona sem erros de ponta a ponta
- [ ] Componente `AreaMensalStep` reutilizado corretamente em 5 passos
- [ ] `conteudoVocacional.ts` preenchido para todos os códigos vocacionais conhecidos
- [ ] Tela de exame exibe 6 perguntas + Ato de Contrição
- [ ] Tela semanal adapta Dever de Estado ao perfil
- [ ] Tela diária faz merge parcial corretamente
- [ ] Ciclos antigos (`has_new_structure: false`) exibem template legado sem erros
- [ ] Ciclos novos (`has_new_structure: true`) exibem template novo corretamente
- [ ] Card "Amanhã com o Emanuel" aparece e desaparece corretamente no hub

### Qualidade
- [ ] Nenhum campo de métricas quantitativas de evangelização presente em qualquer tela
- [ ] Textos de orientação espiritual revisados por membro da Obra Lumen antes do go-live
- [ ] Conteúdo vocacional (`MOTIVACAO_CONTENT`) revisado e aprovado
- [ ] Templates de Dever de Estado revisados e aprovados
- [ ] Fluxo completo testado manualmente com perfil de cada estado de vida principal (Casado, Solteiro, Seminarista, Consagrado)

### Comunicação
- [ ] Membros informados sobre a nova versão do Projeto de Vida
- [ ] Nota explicativa disponível no app sobre os ciclos anteriores (continuam visíveis no histórico)

---

## APÊNDICE — Decisões arquiteturais registradas

| Decisão | Escolha | Fundamento |
|---|---|---|
| Modelagem das áreas mensais | Tabela genérica com `tipo_area` (Opção A) | Fidelidade ao Documento Oficial: mesma estrutura para as 5 áreas. Extensível sem custo. |
| Projeto Diário | JSONB dentro do semanal (Opção C) | Natureza efêmera da preparação diária. Sem valor histórico independente. |
| Etapa de Motivação | Sem entidade nova; campo `intencao` ressuscitado | Campo já existe na tabela. Motivação é experiência UX, não coleta de dados. |
| Fraternidade como 6ª área | Não incluída | Não está nas 5 áreas do Documento Oficial. Arquitetura já suporta adição futura. |
| Campo `tema` | Mantido sem exposição | Reservado para uso futuro sem impacto imediato. |
| Exame de Consciência | Entidade própria (`projetos_vida_exame`) | Semanticamente distinto da revisão de saída. Ciclo de vida diferente. |
| Tabelas históricas | Mantidas indefinidamente | Zero risco de perda de dados. Coexistência com discriminador `has_new_structure`. |
| Evangelização Ser Feliz | Mensal (reflexão) + Semanal (disposição e momentos) | Natureza dual: intenção mensal + presença concreta semanal. Sem métricas. |
