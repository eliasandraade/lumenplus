# Declarações de privacidade das lojas — respostas prontas

Formulários obrigatórios na submissão: **App Privacy** (App Store Connect) e
**Data safety** (Google Play Console). Este documento traz as respostas já
determinadas, cada uma ancorada no campo real do banco.

**Como foi levantado:** enumerando as colunas de `user_profiles` e as demais
tabelas com dado pessoal, a partir do metadata do SQLAlchemy. Não é estimativa.

> ⚠️ **Sub-declarar dado sensível é causa comum de rejeição e de remoção
> posterior do app.** Duas categorias abaixo são fáceis de esquecer e **se
> aplicam a este app**: crença religiosa e saúde.

---

## 1. O ponto que exige atenção: dado sensível

### Crença religiosa

O perfil coleta **7 campos** que descrevem a vida religiosa do usuário:

| Campo | Conteúdo |
|---|---|
| `vocational_reality_item_id` | realidade vocacional |
| `consecration_year` | ano de consagração |
| `has_vocational_accompaniment` | se tem acompanhamento vocacional |
| `realidade_atual` | estado de vida atual |
| `despertar_encounter` | participação em encontro |
| `interested_in_ministry` | interesse em ministério |
| `life_state_item_id` | estado de vida |

Some-se a isso o conteúdo espiritual em `projetos_vida_mensal` (`tema`,
`intencao`) e `life_plan_cycles`.

- **Apple:** categoria **Sensitive Info** — "religious beliefs" está
  explicitamente listada.
- **Google Play:** **Personal info → Political or religious beliefs.**

**Declarar. Não é opcional.** O fato de o app ser assumidamente de uma
comunidade católica não dispensa a declaração — ao contrário, torna o dado
inequivocamente identificável como religioso.

### Saúde

| Campo | Conteúdo |
|---|---|
| `dietary_restriction` + `_notes` | restrição alimentar |
| `health_insurance` + `_name` | plano de saúde |

- **Apple:** **Health & Fitness → Health**
- **Google Play:** **Health and fitness → Health info**

### Documentos de identificação

`cpf_hash`, `cpf_encrypted`, `rg_encrypted` — CPF e RG, cifrados em repouso.

- **Apple:** **Contact Info → Other User Contact Info** não serve; usar
  **Identifiers → User ID** para o vínculo e declarar CPF/RG em **Other Data**.
- **Google Play:** **Personal info → Other info** (o formulário não tem
  categoria específica para documento nacional).

---

## 2. Apple — App Privacy

Para cada tipo: *coletado?* · *vinculado à identidade?* · *usado para rastrear?*

**Rastreamento (tracking): NÃO, em todos os itens.** Não há IDFA, SDK de
publicidade, atribuição ou troca de dados com data brokers. Consistente com
`NSPrivacyTracking = false` no Privacy Manifest.

| Tipo de dado | Coletado | Vinculado | Rastreio | Finalidade | Origem |
|---|---|---|---|---|---|
| Name | Sim | Sim | Não | Funcionalidade do app | `user_profiles.full_name` |
| Email Address | Sim | Sim | Não | Funcionalidade do app | `user_identities.email` |
| Phone Number | Sim | Sim | Não | Funcionalidade do app | `user_profiles.phone_e164` |
| Physical Address | Sim | Sim | Não | Funcionalidade do app | `city`, `state`, `country` |
| Other User Contact Info | Sim | Sim | Não | Funcionalidade do app | `instagram` |
| **Health** | **Sim** | **Sim** | Não | Funcionalidade do app | restrição alimentar, plano de saúde |
| **Sensitive Info** | **Sim** | **Sim** | Não | Funcionalidade do app | **crença religiosa** (7 campos) |
| User ID | Sim | Sim | Não | Funcionalidade do app | `users.id`, Firebase UID |
| User Content | Sim | Sim | Não | Funcionalidade do app | posts e respostas de canal |
| Photos | Sim | Sim | Não | Funcionalidade do app | `photo_url` (foto de perfil) |
| Other Data | Sim | Sim | Não | Funcionalidade do app | CPF e RG (cifrados); data de nascimento; estado civil |
| Crash Data | Sim | **Não** | Não | Diagnóstico | Sentry — condicional ao DSN, `sendDefaultPii: false` |

**Não coletados** (marcar como não): Localização precisa/aproximada, Contatos,
Histórico de busca, Histórico de navegação, Dados financeiros, Identificadores
de publicidade, Áudio, Informação de compra.

### Terceiros

| SDK | Dados | Observação |
|---|---|---|
| Firebase Auth (Google) | e-mail, UID | autenticação |
| `@sentry/react` | crash, sem PII | só ativa com `EXPO_PUBLIC_SENTRY_DSN`; `sendDefaultPii: false`, `tracesSampleRate: 0.1` |

`@vercel/analytics` **não deve ser declarado** — foi removido do bundle
(dependência morta, nunca importada).

---

## 3. Google Play — Data safety

| Categoria | Tipo | Coletado | Compartilhado | Obrigatório? | Finalidade |
|---|---|---|---|---|---|
| Personal info | Name | Sim | Não | Sim | Funcionalidade |
| Personal info | Email address | Sim | Não | Sim | Funcionalidade, Gestão de conta |
| Personal info | User IDs | Sim | Não | Sim | Funcionalidade, Gestão de conta |
| Personal info | Address | Sim | Não | Não | Funcionalidade |
| Personal info | Phone number | Sim | Não | Não | Funcionalidade |
| **Personal info** | **Political or religious beliefs** | **Sim** | Não | Não | Funcionalidade |
| Personal info | Other info | Sim | Não | Não | Funcionalidade (CPF, RG, nascimento, estado civil) |
| **Health and fitness** | **Health info** | **Sim** | Não | Não | Funcionalidade |
| Photos and videos | Photos | Sim | Não | Não | Funcionalidade |
| Messages | Other in-app messages | Sim | Não | Não | Funcionalidade |
| App activity | Other actions | Sim | Não | Não | Funcionalidade |
| App info and performance | Crash logs | Sim | Não | Não | Diagnóstico |

**Nunca compartilhado com terceiros para publicidade ou marketing.**

### Práticas de segurança — respostas

| Pergunta | Resposta | Evidência |
|---|---|---|
| Dados criptografados em trânsito? | **Sim** | HTTPS; CSP enforced em staging |
| Usuário pode pedir exclusão dos dados? | **Sim** | `DELETE /auth/me` + página web de exclusão |
| Segue a Play Families Policy? | **Não se aplica** | não direcionado a crianças |
| Passou por revisão de segurança independente? | **Não** | escopo de pentest redigido, execução não contratada |

### URL de exclusão de conta (obrigatória)

O Google Play exige uma URL **pública, sem login**, descrevendo como excluir a
conta. A tela existe em `lumen_mobile/app/excluir-conta.tsx`. **Pendência:** a
URL pública definitiva depende do domínio de produção — ver "Pendências".

---

## 4. Coerência com o resto do repositório

Estas respostas precisam bater com três outros artefatos. Divergência entre
eles é motivo de rejeição:

| Artefato | Onde |
|---|---|
| Privacy Manifest (iOS) | `lumen_mobile/app.json` → `ios.privacyManifests` |
| Política de Privacidade | PR #17 (aguarda o Encarregado) |
| Matriz de exclusão de conta | [`account-deletion-data-map.md`](account-deletion-data-map.md) |

---

## 5. Pendências — decisão humana

1. **URL pública de exclusão de conta** — depende do domínio de produção.
2. **Aprovação do Encarregado** (Felipe Rocha Pinheiro Bastos —
   `lgpd@lumenserfeliz.org`) sobre declarar crença religiosa e saúde como
   coletadas. É a leitura tecnicamente correta dos campos existentes, mas a
   decisão sobre **continuar coletando** esses dados é dele e da coordenação —
   não de engenharia.
3. **Alternativa a considerar:** se a coordenação preferir não declarar dado
   sensível, o caminho não é omitir da declaração — é **deixar de coletar** os
   campos. Omitir dado coletado é o que gera remoção do app.
