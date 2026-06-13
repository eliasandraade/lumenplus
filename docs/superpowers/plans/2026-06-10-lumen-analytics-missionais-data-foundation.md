# Lumen Analytics Missionais — Data Foundation

**Data:** 2026-06-10
**Natureza:** modelagem conceitual, produto e governança de dados. **Não é plano de implementação.** Sem código, migrations, endpoints, schema, telas ou alterações de back/front.
**Base:** auditoria do Admin atual; `admin-dashboard-2.0-product-definition`; `admin-dashboard-2.0-mission-alignment-review`; e leitura do banco/modelos atuais apenas para entender o que já existe.
**Propósito:** definir quais **eventos, transições e marcos** o Lumen+ precisa registrar para, no futuro, medir a **missão** da Obra — não apenas o cadastro — sem violar privacidade, foro íntimo ou LGPD.

---

## Princípio fundador

> A Obra hoje sabe **como está**; precisa passar a saber **como caminha**.

O sistema atual é um *retrato de estado*: contagens de hoje (quantos somos, quem está em cada degrau, quantos vínculos). A missão — perseverar, progredir, formar, evangelizar, ir em missão — é **movimento no tempo**, e movimento só se mede com **histórico de transições**. Estado não se deriva em jornada; jornada precisa ser **capturada quando acontece**. Cada dia sem captura é jornada perdida para sempre.

Duas regras inegociáveis atravessam todo o documento:
1. **Metadados de jornada, nunca conteúdo de foro íntimo.** Registramos *que* algo aconteceu (mudou de degrau, fez revisão), nunca *o que* a pessoa escreveu/confessou.
2. **Agregado por padrão; nominal só com necessidade e auditoria; k-anonimato sempre que houver risco de reidentificação.**

---

## 1. Quais perguntas missionais a Obra precisa responder?

Organizadas pelas 7 dimensões do carisma. Hoje, **nenhuma** é respondível de forma confiável (todas exigem transição, não estado).

| Dimensão | Pergunta missional |
|---|---|
| **Evangelização** | A evangelização está gerando **novos acolhidos**? Estamos alcançando gente *nova*, ou só remexendo quem já está dentro? |
| **Vocação** | As pessoas estão **progredindo** na escada vocacional? Quantas **consagrações** por período? Onde o funil vocacional trava? |
| **Formação** | A formação gera **constância** (não só adesão)? As pessoas terminam o que começam? |
| **Perseverança** | As pessoas estão **perseverando** (ficam) ou evadem? Quem sai, **retorna**? |
| **Comunidade** | As comunidades estão **formando vocações** ou só somando membros? Quais crescem em maturidade, não só em número? |
| **Missão** | As **missões estão vivas**? Há pessoas entrando e permanecendo em missão? |
| **Acompanhamento** | As pessoas estão sendo **acompanhadas** (vocacional/direção)? O acompanhamento tem continuidade? |
| **Transversal (alerta)** | Onde a Obra cresce **só em número, mas não em maturidade**? (crescimento sem progressão/perseverança/formação) |

---

## 2. Quais transições precisam ser registradas?

A coluna **Hoje** indica o que já é capturado: ✅ existe · ◐ parcial (estado/auditoria, sem evento limpo) · ✗ inexistente.

| Transição | O que marca | Hoje | Observação |
|---|---|---|---|
| **Primeiro contato** | pessoa toca a Obra pela 1ª vez | ✗ | não há entidade pré-membro |
| **Interessado** | manifesta interesse formal | ✗ | idem |
| **Acolhido** | entra no 1º degrau (Membro do Acolhida) | ◐ | só estado atual; sem data de entrada no degrau |
| **Aprofundamento** | sobe a Aprofundamento | ◐ | escada existe (catálogo ordenado), mudança não é registrada |
| **Vocacional** | sobe a Vocacional | ◐ | idem |
| **Postulante (1º/2º ano)** | sobe a Postulante | ◐ | idem |
| **Discípulo** | sobe a Discípulo Vocacional | ◐ | idem |
| **Consagrado** | consagração (Filho da Luz) | ◐ | só `consecration_year` (grão de ano), sem evento datado |
| **Saída** | deixa a Obra | ◐ | `is_active=False` + `account_deleted`; sem motivo/data limpa de "saída da Obra" |
| **Retorno** | volta após sair | ✗ | não há conceito de reentrada |
| **Mudança de comunidade** | troca de unidade | ✗ | só estado de membership atual |
| **Entrada em ministério** | vira membro de unidade | ◐ | `OrgMembership.joined_at` existe |
| **Saída de ministério** | deixa unidade | ◐ | status vira REMOVED; **data só no AuditLog**, não na linha |
| **Início de acompanhamento** | passa a ser acompanhado | ◐ | `has_vocational_accompaniment` (booleano de estado), sem data |
| **Fim de acompanhamento** | acompanhamento cessa | ✗ | não há |
| **Início de missão** | entra em missão | ◐ | vínculo a unidade `MISSAO` / `is_from_mission`; sem evento |
| **Fim de missão** | sai da missão | ✗ | não há |
| **Participação em retiro** | inscreve/participa de retiro | ✅ | `RetreatRegistration` + `RegistrationStatus` |
| **Conclusão de formação** | completa etapa formativa | ✗ | não há marco de "formação concluída" |
| **Criação de Projeto de Vida** | inicia ciclo | ✅ | `LifePlanCycle` (DRAFT) + `created_at` |
| **Revisão de Projeto de Vida** | faz revisão mensal | ✅ | `LifePlanMonthlyReview.review_date` |

**Leitura:** das 22 transições, **3 plenamente capturadas** (retiro, criação e revisão de Projeto de Vida), ~9 parciais (estado/auditoria) e ~10 inexistentes. O coração missionário (progressão, perseverança, evangelização, missão, acompanhamento) está no campo parcial/inexistente.

---

## 3. Quais eventos históricos devem existir?

Catálogo conceitual de eventos. Todos carregam **apenas metadados** (códigos, datas, referências) — **nunca texto de foro íntimo**. Campos comuns implícitos a todos: `id`, `tipo`, `sujeito` (referência pseudonimizável ao membro), `ator` (quem registrou), `quando`, `entidade relacionada`.

| Evento | Representa | Quem dispara | Quando | Entidade | Campos mínimos | Sensível? | Vira métrica? | Em dashboard? | Anonimização |
|---|---|---|---|---|---|---|---|---|---|
| `CONTATO_INICIAL` | 1º contato com a Obra | acolhida/sistema | no 1º registro de interesse | Contato (nova, pré-membro) | origem, data | Baixo | Sim | Sim (agregado) | k-anon |
| `TORNOU_INTERESSADO` | interesse formal | acolhida | ao manifestar | Contato | canal, data | Baixo | Sim | Sim | k-anon |
| `MUDANCA_DEGRAU_VOCACIONAL` | sobe/desce na escada | coordenação/formação | na decisão formativa | Membro + degrau origem/destino | de, para, data, motivo(código) | **Médio** (papel vocacional) | Sim | Sim (agregado) | k-anon; nunca externo |
| `CONSAGRACAO` | consagração | Conselho | na consagração | Membro | data, tipo | Médio | Sim | Sim | k-anon |
| `ENTRADA_OBRA` | torna-se membro | sistema | ao aceitar/acolher | Membro | data, via | Baixo | Sim | Sim | k-anon |
| `SAIDA_OBRA` | deixa a Obra | sistema/coord | ao sair | Membro | data, motivo(código), voluntária? | **Médio** | Sim | Sim (agregado) | k-anon; motivo nunca livre |
| `RETORNO_OBRA` | reentra | sistema | ao voltar | Membro | data | Baixo | Sim | Sim | k-anon |
| `ENTRADA_MINISTERIO` | vira membro de unidade | coord | ao aceitar convite | Membership | unidade, papel, data | Baixo | Sim | Sim | — |
| `SAIDA_MINISTERIO` | deixa unidade | coord/auto | ao remover/sair | Membership | unidade, data, motivo(código) | Baixo | Sim | Sim | — |
| `MUDANCA_COMUNIDADE` | troca de unidade | coord | ao migrar | Membership | de, para, data | Baixo | Sim | Sim | — |
| `INICIO_ACOMPANHAMENTO` | passa a ser acompanhado | acompanhante/membro | ao iniciar | Membro | tipo(voc/direção), data | **Médio** | Sim (só cobertura) | Sim (agregado) | k-anon; nome do acompanhante nunca |
| `FIM_ACOMPANHAMENTO` | acompanhamento cessa | acompanhante | ao encerrar | Membro | data | Médio | Sim | Sim (agregado) | k-anon |
| `INICIO_MISSAO` | entra em missão | coord | ao iniciar | Membro + missão | missão, data | Baixo | Sim | Sim | k-anon |
| `FIM_MISSAO` | sai da missão | coord | ao encerrar | Membro + missão | data, motivo(código) | Baixo | Sim | Sim | k-anon |
| `PARTICIPACAO_RETIRO` | participa de retiro | sistema | na confirmação | Retiro + Membro | retiro, papel, data | Baixo | Sim | Sim | k-anon |
| `CONCLUSAO_FORMACAO` | conclui etapa formativa | formação | ao concluir | Membro + etapa | etapa, data | Baixo | Sim | Sim | k-anon |
| `CRIOU_PROJETO_VIDA` | inicia ciclo | sistema | ao criar | Ciclo (metadado) | data | **Foro íntimo (só metadado)** | Sim (metadado) | Sim (agregado) | k-anon forte |
| `CONCLUIU_WIZARD_PV` | DRAFT→ACTIVE | sistema | ao ativar | Ciclo | data | metadado | Sim | Sim (agregado) | k-anon forte |
| `FEZ_REVISAO_PV` | revisão mensal | sistema | ao salvar revisão | Revisão (metadado) | data, decisão(código) | metadado | Sim (constância) | Sim (agregado) | k-anon forte; **decisão sim, texto não** |
| `RENOVOU_CICLO_PV` | inicia novo ciclo | sistema | ao renovar | Ciclo | data | metadado | Sim | Sim (agregado) | k-anon forte |

> **Regra de ouro do catálogo:** todo campo "motivo" é **código fechado** (lista), nunca texto livre. Nenhum evento do domínio Projeto de Vida carrega conteúdo — apenas o *fato* (criou, concluiu, revisou, renovou) e, no máximo, a *decisão codificada* da revisão.

---

## 4. KPIs missionários possíveis no futuro

`Já existe` = derivável hoje · `Falta` = exige evento(s) novo(s). "Executivo?" = candidato aos 10 do Conselho.

### Evangelização
| KPI | Fórmula conceitual | Eventos necessários | Já existe | Falta | LGPD | Executivo? |
|---|---|---|---|---|---|---|
| Novos acolhidos | entradas no 1º degrau no período | `ENTRADA_OBRA`/`MUDANCA_DEGRAU` (Acolhida) | proxy fraco (`created_at`) | evento de entrada no degrau | Baixo | **Sim** |
| Novo alcance real | contatos novos que viram acolhidos | `CONTATO_INICIAL`,`TORNOU_INTERESSADO` | ✗ | entidade pré-membro inteira | Baixo-Médio (consentimento de contato) | Futuro |
| Funil de evangelização | contato→interessado→acolhido (taxas) | os 3 acima | ✗ | todo o funil | Médio | Futuro |

### Vocação
| KPI | Fórmula | Eventos | Já existe | Falta | LGPD | Executivo? |
|---|---|---|---|---|---|---|
| Progressão vocacional | % que subiu ≥1 degrau no período | `MUDANCA_DEGRAU_VOCACIONAL` | só estado | histórico de degraus | Médio | **Sim** |
| Consagrações no período | nº de `CONSAGRACAO` | `CONSAGRACAO` | `consecration_year` (ano) | evento datado | Médio | **Sim** |
| Tempo médio por degrau | média de permanência entre transições | `MUDANCA_DEGRAU` | ✗ | histórico | Médio | Futuro |
| Conversão entre degraus | taxa de avanço degrau a degrau | `MUDANCA_DEGRAU` | ✗ | histórico | Médio | Futuro |

### Formação
| KPI | Fórmula | Eventos | Já existe | Falta | LGPD | Executivo? |
|---|---|---|---|---|---|---|
| Adesão | % membros com ciclo ativo | `CRIOU_PROJETO_VIDA` | ✅ (status) | — | metadado/baixo | **Sim** |
| Conclusão do wizard | ciclos ativos ÷ iniciados | `CONCLUIU_WIZARD_PV` | ✅ | — | metadado | Sim |
| Constância | % ciclos ativos com revisão em dia | `FEZ_REVISAO_PV` | ✅ | — | metadado | **Sim** |
| Renovação | ciclos que iniciaram novo ciclo | `RENOVOU_CICLO_PV` | ✅ (decisão) | — | metadado | Não (apoio) |

### Perseverança
| KPI | Fórmula | Eventos | Já existe | Falta | LGPD | Executivo? |
|---|---|---|---|---|---|---|
| Retenção de membros | % de coorte de N meses ainda ativa | `ENTRADA_OBRA`,`SAIDA_OBRA` | ◐ (`joined_at`; saída só em audit) | eventos de ciclo de vida limpos | Baixo | **Sim** |
| Perseverança na formação | % de ciclos mantidos vs abandonados | `FEZ_REVISAO_PV`,`RENOVOU` | ◐ | série de revisões | metadado | Sim |
| Retorno | % de saídas que retornam | `SAIDA_OBRA`,`RETORNO_OBRA` | ✗ | reentrada | Baixo | Futuro |

### Comunidade
| KPI | Fórmula | Eventos | Já existe | Falta | LGPD | Executivo? |
|---|---|---|---|---|---|---|
| Vida comunitária | pessoas distintas com serviço ativo ÷ membros | estado | ✅ | — | Baixo | **Sim** |
| Comunidades saudáveis × risco | semáforo por unidade (entradas/saídas, coord) | `ENTRADA/SAIDA_MINISTERIO` | ◐ | tendência por unidade | Baixo | **Sim** |
| Rotatividade por comunidade | saídas ÷ tamanho por período | `SAIDA_MINISTERIO` | ◐ | série temporal | Baixo | Não (drill) |
| Cobertura de liderança | unidades com coordenador ativo ÷ total | estado | ✅ | — | Baixo | Não (apoio) |

### Missão
| KPI | Fórmula | Eventos | Já existe | Falta | LGPD | Executivo? |
|---|---|---|---|---|---|---|
| Engajamento missionário | membros em missão ativos no período | `INICIO/FIM_MISSAO` | ◐ (unidades MISSAO, `is_from_mission`) | eventos de missão | Baixo | **Sim** |
| Missões vivas | unidades MISSAO com atividade no período | `INICIO_MISSAO`,`PARTICIPACAO_RETIRO` | ◐ | sinal de atividade | Baixo | Não (drill) |

### Acompanhamento
| KPI | Fórmula | Eventos | Já existe | Falta | LGPD | Executivo? |
|---|---|---|---|---|---|---|
| Cobertura de acompanhamento | % membros com acompanhamento ativo | `INICIO/FIM_ACOMPANHAMENTO` | ◐ (booleano) | eventos datados | Médio | **Sim** |
| Continuidade do acompanhamento | duração média / taxa de interrupção | `INICIO/FIM_ACOMPANHAMENTO` | ✗ | eventos | Médio | Futuro |

---

## 5. Quais dados NUNCA devem ser usados

**Conteúdo de foro íntimo do Projeto de Vida — nunca, em nenhuma hipótese, nem agregado, como métrica de gestão ou em dashboard.** Sob a LGPD, convicção religiosa é dado pessoal sensível (art. 5º, II); foro íntimo e prática sacramental são o núcleo mais protegido, e existem para a **formação pessoal do titular**, não para gestão.

**Proibido (lista fechada):**
- Defeito/pecado dominante (`dominant_defect`)
- Frequência de confissão (`confession_frequency`)
- Exame de consciência (`exam_of_conscience`)
- Direção espiritual — nome/identidade do diretor (`spiritual_director_name`)
- Diagnósticos pessoais (`abandonar`/`melhorar`/`deus_pede`)
- Objetivos espirituais pessoais (objetivos/ações do plano)
- Reflexões mensais (`progress_reflection`/`difficulties`/`constancy_reflection`/`notes`)
- Intenções pessoais
- **Qualquer texto livre espiritual**, sob qualquer rótulo.

> Mesmo agregada, prática sacramental (confissão/missa/exame) **não** vira indicador de gestão. Se um dia houver demanda legítima, exige consentimento específico, finalidade explícita e decisão formal de governança — e ainda assim com forte ressalva pastoral.

**Permitido (somente metadados — lista fechada):**
- Criou ciclo · Concluiu o wizard · Fez revisão · Renovou ciclo · Manteve constância (revisões em dia).

Esses metadados respondem "a formação acontece e persevera?" sem nunca tocar no que a pessoa viveu.

---

## 6. Modelo conceitual de dados históricos recomendado

Sem propor schema. Avaliação das três opções:

**A) Event Log missionário genérico** — uma trilha append-only de eventos tipados.
- ✅ Flexível, capta qualquer transição, ótimo para linha do tempo/jornada, fácil somar novos tipos, naturalmente temporal.
- ❌ Payload fracamente tipado (risco de "despejar" conteúdo sensível), agregações exigem disciplina, integridade referencial mais frouxa.

**B) Tabelas específicas por domínio** — ex.: transições vocacionais, ciclo de vida de membership, marcos de formação, missões.
- ✅ Fortemente tipado, integridade, semântica clara, seguro (sem campo livre para abusar).
- ❌ Muitas estruturas, rígido, mais trabalho por domínio, jornada unificada fica espalhada.

**C) Híbrido — event log como espinha dorsal + tabelas especializadas nos domínios fortes.** **← Recomendado.**
- Event log **somente-metadados** (códigos/datas/referências, jamais texto livre) serve a *linha do tempo da jornada* e a *novos tipos* baratos.
- Tabelas especializadas para os domínios que merecem integridade e consultas pesadas: **progressão vocacional** (fruto central) e **ciclo de vida de membership** (perseverança/comunidade).
- Projeto de Vida permanece **metadado-only**, fora de qualquer tabela de conteúdo para gestão.

**Por que C:** a Obra é pequena e o domínio é sensível. O log dá agilidade e visão de jornada; as tabelas especializadas protegem o que é crítico e mais consultado. A combinação evita tanto o "saco de eventos sem governança" quanto a rigidez de só-tabelas.

**Guarda-corpo de governança do modelo (vale para A, B e C):**
1. **Metadado, nunca conteúdo.** Nenhum motivo em texto livre — sempre código fechado.
2. **Sujeito pseudonimizável.** O evento referencia o membro por id que possa ser **anonimizado na exclusão de conta** — preservando a estatística agregada sem PII (resolve a tensão entre log append-only e direito ao esquecimento da LGPD).
3. **Append-only com correção por compensação** (não apaga o passado; corrige com novo evento) — exceto anonimização por LGPD.
4. **k-anonimato na leitura**, sempre.

---

## 7. Roadmap conceitual

| Fase | Foco | Depende de | Decisão de governança |
|---|---|---|---|
| **Fase 1 — Correções administrativas do Admin 2.0** | consertar cálculos/semântica e reorganizar o que já existe (auditoria) | nada novo | nenhuma — só execução |
| **Fase 2 — Base de eventos missionais** | definir e instituir a fundação de eventos (modelo híbrido), metadado-only | política de eventos + anonimização | **decidir registrar transições**; aprovar guarda-corpos LGPD |
| **Fase 3 — Registrar transições vocacionais e comunitárias** | passar a capturar `MUDANCA_DEGRAU`, ciclo de vida de membership, missão, acompanhamento, consagração | Fase 2 | definir **quem/quando** registra mudança de degrau (autoridade do dado); motivos codificados |
| **Fase 4 — KPIs missionários agregados** | construir indicadores sobre o histórico acumulado | histórico das Fases 3 + k-anon | limiares de k-anonimato; quais KPIs são públicos a quais papéis |
| **Fase 5 — Dashboard Executivo verdadeiramente missionário** | os 10 KPIs revisados, com missão no centro | maturação do histórico | validar painel final com o Conselho |

> Observação temporal crítica: **as Fases 4–5 só têm valor depois que o histórico amadurece.** Progressão e perseverança exigem *meses* de eventos acumulados. Por isso a Fase 3 (começar a registrar) tem urgência maior que a Fase 5 (mostrar) — o relógio dos dados começa a contar no dia em que a captura começa.

---

## 8. Recomendação final

### O que pode ser feito agora (dados atuais)
- **Todas as correções da Fase 1** (auditoria): convites, top ministérios, vínculos vs pessoas, base nos %, idade, geografia, dados mortos, linguagem.
- KPIs já deriváveis: **tamanho/membros ativos**, **pessoas distintas com vínculo**, **distribuição vocacional atual (foto)**, **comunidades ativas e cobertura de coordenação**, **adesão e constância de formação (metadado)**, **participação em retiros**, **contagem de unidades/missão**.

### O que NÃO pode ser prometido ainda
- **Perseverança/retenção**, **progressão vocacional**, **consagrações datadas**, **evangelização/novo alcance**, **ciclo de vida de missão** e **continuidade de acompanhamento** — todos exigem eventos de transição que **não existem hoje**. Mostrá-los antes da captura seria inventar número.

### Decisões de governança que o Conselho precisa tomar
1. **Sim/não à captura de transições** — a decisão fundadora. Sem ela, o Admin permanece administrativo para sempre.
2. **Autoridade do dado vocacional** — quem registra (e quando) uma mudança de degrau? É o ato de governança que dá veracidade à progressão.
3. **Modelar ou não contatos pré-membro** (funil de evangelização) — tem implicação de consentimento e privacidade de não-membros.
4. **Reafirmar como política** a exclusão do foro íntimo (Seção 5) — metadado sim, conteúdo nunca.
5. **Limiares de k-anonimato** e quais KPIs cada papel pode ver.
6. **Política de historização × esquecimento (LGPD)** — manter jornada agregada via anonimização do sujeito na exclusão de conta.

### Quais dados precisam começar a ser registrados a partir de agora
Em ordem de urgência (história não se reconstrói retroativamente):
1. **Mudanças de degrau vocacional** (com data e motivo codificado) — o fruto central.
2. **Ciclo de vida de membership** (entrada/saída/mudança de comunidade com data e motivo).
3. **Consagrações** como evento datado (hoje só ano).
4. **Início/fim de acompanhamento** (tipo + datas, sem nomes).
5. **Início/fim de missão.**
6. **Marcos de formação** (metadado do Projeto de Vida — já parcialmente capturável).

> Retiros, criação e revisão de Projeto de Vida **já são capturados** — começam a alimentar histórico desde já.

---

## Síntese

O Lumen+ pode, **agora**, ficar honesto sobre o que mede (Fase 1) e mostrar bem o estado atual. Mas para **medir a missão** — e não só o cadastro — a Obra precisa tomar uma decisão de governança e **começar a registrar a jornada hoje**, com uma fundação de eventos **metadado-only**, **híbrida** e **respeitosa do foro íntimo**. O valor não aparece amanhã; aparece nos meses em que o histórico amadurece. Por isso a recomendação central é simples: **decidir capturar transições é mais urgente do que construir o dashboard que um dia as mostrará.**

---

### Anexo — Rastreabilidade do estado atual
- Escada vocacional: catálogo `VOCATIONAL_REALITY` ordenado (Acolhida→Consagrado, 7 degraus); `UserProfile.vocational_reality_item_id` (só atual) + `consecration_year`.
- Membership: `OrgMembership.joined_at`, status ACTIVE/REMOVED (saída só datada no `AuditLog member_removed`).
- Convites: `OrgInvite` (PENDING/ACCEPTED/REJECTED/EXPIRED/CANCELLED) + `created_at`.
- Retiros: `RetreatRegistration` + `RegistrationStatus`.
- Formação: `LifePlanCycle` (DRAFT/ACTIVE/ARCHIVED + timestamps), `LifePlanMonthlyReview` (review_date, decision).
- Acompanhamento: `has_vocational_accompaniment` (booleano), `spiritual_direction_frequency` (foro íntimo — só metadado de existência).
- Trilha existente: `AuditLog` (ações admin/segurança — **não** é log missional), `SensitiveAccessAudit` (acessos a CPF/RG).
- **Inexistente:** entidade pré-membro/contato; tabela de eventos de jornada; histórico de transições de qualquer tipo.
