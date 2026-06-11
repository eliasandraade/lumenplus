# Spec — RC Frontend · Estabilização 1

- **Data:** 2026-06-11 (arquivo datado 2026-06-10 conforme solicitado)
- **Base:** [`2026-06-10-frontend-rc-audit.md`](../audits/2026-06-10-frontend-rc-audit.md)
- **Objetivo:** corrigir BLOCKER B1 (Alert na web) e diagnosticar M4 (IS_DEV_AUTH) e M5 (hardcoded colors). Sem features novas, sem backend, sem redesign.
- **Status:** SPEC APROVADO — decisões fixadas (2026-06-11). Em implementação por checkpoints.

### Decisões do responsável (2026-06-11)
1. **M4:** ✅ **Autorizado implementar fail-fast** — produção sem `EXPO_PUBLIC_FIREBASE_API_KEY` não cai em DEV silencioso; falha explícita com erro de config. Não altera o fluxo válido de auth; DEV/local mantém o modo DEV atual.
2. **B1/INFO:** ✅ **Migrar os 8 críticos + os 23 informativos** via wrapper único. Fallback web simples (`window.alert/confirm`), sem toast system novo, sem redesign.
3. **M5:** ✅ **Só blocker de legibilidade** evidente em dark; usar token semântico existente; não tocar tokens; não mexer em `login`/`register` salvo ilegibilidade real; resto = POST-RC.

> ⚠️ **Correção do diagnóstico inicial da auditoria:** a investigação detalhada mostrou que **3 fluxos já estão web-safe** e não precisam de mudança: `admin/approvals` (usa **Modal inline**), remoção de membro em `members.tsx` (usa modal `showRemoveConfirm`) e logout em `profile.tsx` (tem branch `Platform.OS === 'web'` → `window.confirm`). O alvo real de B1 é **menor e mais específico** do que estimado.

---

## 1. Inventário exato de `Alert.alert`

**34 chamadas reais** de `Alert.alert(` em 9 telas (+3 ocorrências em `admin/approvals` que são **comentários**, não código — a tela já migrou para Modal).

| # | Arquivo:linha | Conteúdo | Ação no `onPress`? | Classe |
|---|---|---|---|---|
| 1 | `members.tsx:350` | 'Erro' carregar membros | não | INFO |
| 2 | `members.tsx:411` | 'Sucesso!' convite enviado | não | INFO |
| 3 | `members.tsx:414` | 'Erro' enviar convite | não | INFO |
| 4 | **`members.tsx:429`** | confirm **alterar cargo** | **sim → `updateRole`** | **CRÍTICO** |
| 5 | `members.tsx:441` | 'Sucesso!' cargo (aninhado) | não | INFO |
| 6 | `members.tsx:446` | 'Erro' cargo (aninhado) | não | INFO |
| 7 | `members.tsx:470` | 'Erro' remover (catch) | não | INFO |
| 8 | `register.tsx:396` | 'Atenção' validação | não | INFO |
| 9 | `community.tsx:212` | 'Erro' aceitar convite | não | INFO |
| 10 | **`community.tsx:219`** | confirm **recusar convite** | **sim → `reject`** | **CRÍTICO** |
| 11 | `community.tsx:233` | 'Erro' recusar (aninhado) | não | INFO |
| 12 | `invites.tsx:168` | 'Aprovado!' aviso | não | INFO |
| 13 | `invites.tsx:172` | 'Erro' aprovar | não | INFO |
| 14 | **`invites.tsx:180`** | confirm **reprovar aviso** | **sim → `reject`** | **CRÍTICO** |
| 15 | `invites.tsx:192` | 'Reprovado' (aninhado) | não | INFO |
| 16 | `invites.tsx:196` | 'Erro' reprovar (aninhado) | não | INFO |
| 17 | **`terms.tsx:57`** | confirm **recusar termos** | **sim → logout/signOut** | **CRÍTICO** |
| 18 | `verify-phone.tsx:72` | 'DEV Mode' código (só DEV) | não | INFO |
| 19 | **`verify-phone.tsx:139`** | 'Sucesso!' telefone | **sim → `router.replace` p/ onboarding** | **CRÍTICO** (trava onboarding na web) |
| 20 | `(onboarding)/profile.tsx:303` | 'Erro' carregar dados | não | INFO |
| 21 | `(onboarding)/profile.tsx:312` | 'Permissão' fotos | não | INFO |
| 22 | `(onboarding)/profile.tsx:327` | 'Permissão' câmera | não | INFO |
| 23 | **`(onboarding)/profile.tsx:339`** | escolher fonte da **foto** [Câmera/Galeria/Cancelar] | **sim → `takePhoto`/`pickImage`** | **CRÍTICO** (3 opções, ver §3.3) |
| 24 | `(onboarding)/profile.tsx:407` | 'Atenção' campos obrigatórios | não | INFO |
| 25 | **`(onboarding)/profile.tsx:466`** | 'Sucesso!' perfil salvo | **sim → `router.replace` p/ home** | **CRÍTICO** (trava onboarding na web) |
| 26 | `(onboarding)/profile.tsx:471` | 'Erro' salvar perfil | não | INFO |
| 27 | `(tabs)/profile.tsx:378` | 'Erro ao Salvar' | não | INFO |
| 28 | `(tabs)/profile.tsx:391` | confirm logout (**ramo mobile**; web já usa `window.confirm`) | sim, mas **já tem fallback web** | OK (sem mudança) |
| 29 | `admin/users/export.tsx:75` | 'CSV gerado' | não | INFO |
| 30 | **`admin/users/export.tsx:115`** | 'Download iniciado' | **sim → `router.back`** | MAJOR (nav pós-download) |
| 31 | **`admin/users/export.tsx:122`** | 'Enviado para aprovação' | **sim → `router.back`** | MAJOR (nav pós-envio) |
| 32 | `admin/users/export.tsx:133` | 'Erro' exportar | não | INFO |
| 33 | `admin/users/export.tsx:141` | 'Selecione ao menos um campo' | não | INFO |
| 34 | **`admin/users/export.tsx:145`** | confirm **exportação sensível** | **sim → `doExport`** | **CRÍTICO** |

## 2. Críticas × informativas

- **CRÍTICAS (ação/navegação no `onPress`, sem fallback web) — 8:**
  `members:429`, `community:219`, `invites:180`, `terms:57`, `verify-phone:139`, `onboarding/profile:339`, `onboarding/profile:466`, `export:145`.
  Dessas, **`verify-phone:139` e `onboarding/profile:466` travam a conclusão do onboarding na web** (navegação não dispara) → maior prioridade.
- **MAJOR (navegação pós-ação no `onPress`) — 2:** `export:115`, `export:122`.
- **INFO (apenas exibição; ação subjacente funciona, mas usuário não vê feedback na web) — 23.**
- **Já web-safe (nenhuma mudança) — 3:** `admin/approvals` (Modal), `members` remoção (Modal), `profile` logout (`window.confirm`).

---

## 3. Arquitetura do wrapper cross-platform

### 3.1 Novo arquivo: `src/utils/alerts.ts`

```ts
import { Alert, Platform } from 'react-native';

/** Alerta informativo (1 botão). Web: window.alert; nativo: Alert.alert. */
export function showAlert(title: string, message?: string, onClose?: () => void): void {
  if (Platform.OS === 'web') {
    window.alert([title, message].filter(Boolean).join('\n\n'));
    onClose?.();
    return;
  }
  Alert.alert(title, message, onClose ? [{ text: 'OK', onPress: onClose }] : undefined);
}

export interface ConfirmOptions {
  title: string;
  message?: string;
  confirmText?: string;   // default 'Confirmar'
  cancelText?: string;    // default 'Cancelar'
  destructive?: boolean;  // estilo do botão de confirmação (nativo)
  onConfirm?: () => void | Promise<void>;
  onCancel?: () => void;
}

/** Confirmação (2 botões). Retorna true se confirmado. Web: window.confirm. */
export async function showConfirm(opts: ConfirmOptions): Promise<boolean> {
  const { title, message, confirmText = 'Confirmar', cancelText = 'Cancelar', destructive, onConfirm, onCancel } = opts;

  if (Platform.OS === 'web') {
    const ok = window.confirm([title, message].filter(Boolean).join('\n\n'));
    if (ok) await onConfirm?.(); else onCancel?.();
    return ok;
  }

  return new Promise<boolean>((resolve) => {
    Alert.alert(title, message, [
      { text: cancelText, style: 'cancel', onPress: () => { onCancel?.(); resolve(false); } },
      { text: confirmText, style: destructive ? 'destructive' : 'default', onPress: async () => { await onConfirm?.(); resolve(true); } },
    ]);
  });
}
```

### 3.2 Princípios

- **RC = funcionalidade e segurança**, não estética. Usar `window.confirm`/`window.alert` na web é suficiente; **não** introduzir modal bonito agora.
- `admin/approvals` permanece como **referência** de modal inline; **não** será trocado por `window.confirm`.
- Mensagens INFO migram para `showAlert` para restaurar feedback de erro na web (M1), mas isso é **secundário**; o foco é eliminar `Alert.alert` direto em **fluxos críticos**.

### 3.3 Caso especial — seletor de foto (`onboarding/profile:339`)

É um menu de 3 opções (Câmera / Galeria / Cancelar), não um confirm binário. `window.confirm` não cobre 3 opções. Proposta RC-mínima:

```ts
if (Platform.OS === 'web') { pickImage(); return; } // web usa file input (galeria); câmera não se aplica
// nativo: mantém Alert.alert com as 3 opções
```

Sem `showActionSheet` novo (evita scope creep). Foto no onboarding é opcional, então o risco é baixo, mas o atalho web torna o fluxo utilizável.

---

## 4. Arquivos que serão alterados

| Arquivo | Mudança |
|---|---|
| `src/utils/alerts.ts` | **novo** — wrapper |
| `app/members.tsx` | `:429` → `showConfirm` (cargo); INFO → `showAlert` |
| `app/(tabs)/community.tsx` | `:219` → `showConfirm` (recusar); INFO → `showAlert` |
| `app/(tabs)/invites.tsx` | `:180` → `showConfirm` (reprovar); INFO → `showAlert` |
| `app/(onboarding)/terms.tsx` | `:57` → `showConfirm` (recusar termos → logout) |
| `app/(auth)/verify-phone.tsx` | `:139` → `showAlert(..., onClose=navigate)` ou navegação direta; INFO → `showAlert` |
| `app/(onboarding)/profile.tsx` | `:466` → navegação garantida na web; `:339` → branch web (§3.3); INFO → `showAlert` |
| `app/admin/users/export.tsx` | `:145` → `showConfirm` (export sensível); `:115/:122` → `showAlert(..., onClose=router.back)`; INFO → `showAlert` |
| `app/(auth)/register.tsx` | `:396` INFO → `showAlert` (opcional) |
| `app/(tabs)/profile.tsx` | `:378` INFO → `showAlert` (opcional); `:391` **inalterado** |

**Não tocar:** `app/admin/approvals/index.tsx`, lógica de remoção em `members.tsx`, backend, tokens de tema, permissões, Projeto de Vida (nenhum Alert crítico encontrado em `vida/*`).

## 5. Plano de migração por tela (ordem)

1. **`src/utils/alerts.ts`** (base).
2. **Onboarding crítico:** `verify-phone:139` + `onboarding/profile:466` + `:339` → desbloqueia cadastro na web. *(checkpoint + commit)*
3. **Moderação/ações destrutivas:** `members:429`, `community:219`, `invites:180`, `terms:57`, `export:145`. *(checkpoint + commit)*
4. **Navegação pós-ação:** `export:115`, `export:122`.
5. **INFO (feedback de erro web):** demais chamadas. *(checkpoint + commit)*

Cada checkpoint: `tsc --noEmit` + `expo export` antes de commitar.

---

## 6. Diagnóstico M4 — `IS_DEV_AUTH`

- **Definição:** `src/config/firebase.ts:19` → `export const IS_DEV_AUTH = !process.env.EXPO_PUBLIC_FIREBASE_API_KEY;`
- **Consumo:** `src/services/api.ts` (token via AsyncStorage quando DEV) e `app/index.tsx` (gate de sessão).
- **Risco:** `EXPO_PUBLIC_*` são **inlined no bundle em build-time** (`expo export`). Se o build de produção (Vercel/Railway) **não** tiver `EXPO_PUBLIC_FIREBASE_API_KEY`, o bundle publicado entra em **modo DEV silencioso** (mock auth) → login real quebrado, sem erro visível.
- **Env exigidas no build web:** `EXPO_PUBLIC_FIREBASE_API_KEY` (gatilho), demais `EXPO_PUBLIC_FIREBASE_*`, e `EXPO_PUBLIC_API_URL`. Hoje presentes em `.env.local` (não rastreado) — **só valem em build local**.
- **Configuração esperada na Vercel:** as `EXPO_PUBLIC_*` devem estar em **Project → Settings → Environment Variables (Production)**. **Verificar manualmente no painel** (não inspecionável pelo repo). Mesmo para Railway (`server.js` só serve `dist/`, mas o `expo export` roda no build da plataforma).
- **Sem secrets expostos:** a Firebase Web API key é pública por design (não é secret); ainda assim não colar valores reais em docs/commits.

### Trava segura — ✅ AUTORIZADA (Opção B)

Implementação escolhida: **flag `MISCONFIGURED` + tela de erro de config** (não `throw`, que quebraria no import antes do ErrorBoundary).

- `src/config/firebase.ts`: `export const MISCONFIGURED = !__DEV__ && IS_DEV_AUTH;` (mantém `mockAuth` para o import não crashar).
- `app/_layout.tsx`: se `MISCONFIGURED`, renderiza tela clara de "Configuração de ambiente ausente" em vez do app.

- **Risco:** baixo (só ativa no cenário já quebrado: build de produção sem Firebase). Não altera o caminho válido de auth; DEV/local intocado.
- **Aceite:** produção com Firebase → normal; produção sem Firebase → tela de erro (não DEV AUTH); DEV/local → modo DEV mantido; tsc + build verdes.

---

## 7. Tratamento proposto para hardcoded colors (M5)

**Não migrar tudo. Não mexer em tokens.** Apenas identificar e corrigir **blocker de legibilidade** evidente.

Arquivos por volume de hex/rgb (446 ocorrências / 47 arquivos): `register`(40), `audit-logs`(36), `retreats/[id]`(34), `(tabs)/profile`(31), `service`(25), `login`(20), `retreats/index`(16).

**Triagem proposta (a executar em QA dark mode):**
- **MINOR / POST-RC (maioria):** `shadowColor:'#000'`, `rgba(0,0,0,x)` overlays, e paleta de marca fixa em `login`/`register` (telas teal intencionais). Não reagem ao tema **por design** → não corrigir.
- **BLOCKER (corrigir):** apenas onde houver **texto/fundo hardcoded que fica ilegível no dark** (ex.: `#fff`/`#1a1a1a`/`#9ca3af` fixos em texto ou superfície que deveria inverter). Candidatos prioritários para inspeção visual: `audit-logs`, `retreats/[id]`, `(tabs)/profile`.
- **MAJOR (corrigir se evidente):** cor fora da paleta que destoa claramente, sem risco de redesign.

**Método:** abrir cada tela candidata em **dark mode** no boot web → marcar apenas casos ilegíveis → trocar pelo token semântico equivalente (`t.text.*`, `t.bg.*`). Sem reorganizar estilos. Correções de M5 entram **somente** se confirmadas como blocker/major na inspeção; caso contrário → POST-RC.

### Resultado da triagem M5 (executada — análise estática verificando o `backgroundColor` real de cada texto)

**Corrigido (blocker de legibilidade confirmado — texto escuro hardcoded sobre fundo TEMÁTICO `t.bg.elevated`/`t.bg.screen`, vizinho a textos já temáticos):**
- `app/retreats/[id].tsx`: `title`, `infoValue`, `modalTitle`, `textArea` (texto digitado), `teamOptionName` (`#111827` → `t.text.primary`); `fieldLabel`, `outlineBtnText` (`#374151` → `t.text.secondary`). O modal de inscrição (`modalBox: t.bg.elevated`) ficava com labels e texto digitado **invisíveis** no dark.
- `app/retreats/index.tsx`: `title` (`#111827`) e `emptyTitle` (`#374151`) → `t.text.primary`.
- Em light mode os tokens equivalem ao valor anterior (`t.text.primary≈#171717`, `t.text.secondary≈#525252`), então o claro fica praticamente inalterado; o dark passa a ser legível.

**NÃO corrigido — confirmado intencional/correto (não tocar):**
- `app/(tabs)/service.tsx`: liturgia usa `#374151`/`#111827` **por design** — comentário no código: *"o fundo litúrgico é sempre pastel claro"*. Trocar por token **quebraria** o dark (texto claro sobre pastel claro). Mantido.
- `app/retreats/[id].tsx`: `actionMsgText` (`#166534`) sobre card `#f0fdf4` (verde claro) — dark-on-light intencional. Mantido.
- `app/admin/audit-logs.tsx`: ~36 hex são **cores de status/accent** (vermelho/verde/roxo/âmbar/ciano) para ícones e badges — legíveis nos dois temas. Mantido.
- `app/(tabs)/profile.tsx`: hardcodes são branco sobre botão `PRIMARY` (teal) — legível. Mantido.
- `app/(auth)/login.tsx` e `register.tsx`: 100% hardcoded (marca teal, não temáticas por design) — fora do escopo por decisão. POST-RC.

**Limitação honesta:** a confirmação foi por **análise estática do par texto×fundo** (verificado que o fundo é token temático). Não houve boot autenticado em dark mode (as telas de retiro exigem login/Firebase). Os fixes são troca por token garantido nos dois temas; recomenda-se confirmação visual no smoke test manual em dark (já no §10).

---

## 8. POST-RC (documentar, não implementar)

- **MAINT-FE-LINT-01:** `npm run lint` inoperante (sem config ESLint). **Não bloqueia o RC.** Não configurar agora salvo se trivial e sem risco. Gate efetivo do RC = `tsc --noEmit` + `expo export` + boot web + QA manual.
- Migração 100% de hardcoded colors → tokens.
- Substituir `window.confirm`/`window.alert` por componente de confirmação/toast cross-platform unificado.
- Suíte de testes de frontend.
- Code-splitting / redução do bundle web (11,1 MB).
- Endurecer headers de segurança no `server.js` (Railway) e promover CSP `Report-Only` → enforced.

---

## 9. Critérios de aceite

1. **Nenhum `Alert.alert` direto** em fluxo **crítico** (os 8 itens de §2) — todos via `showConfirm`/`showAlert` ou navegação garantida na web.
2. Na **web**: recusar convite, reprovar aviso, alterar cargo, recusar termos, export sensível e os **dois passos de navegação do onboarding** (`verify-phone` → profile; profile salvo → home) **funcionam de ponta a ponta**.
3. Feedback de erro visível na web nas telas migradas (sem mais "silêncio").
4. `admin/approvals`, remoção de membro e logout **inalterados** e ainda funcionando.
5. `tsc --noEmit` limpo e `expo export --platform web` com sucesso.
6. Nenhuma feature nova, sem mudança de backend/permissões/tokens, sem redesign.
7. M4: env de produção confirmada na Vercel **ou** trava segura aprovada e aplicada.
8. M5: apenas blockers de legibilidade dark corrigidos (se houver); resto documentado POST-RC.

## 10. Plano de testes

| Etapa | Comando / Ação | Esperado |
|---|---|---|
| Typecheck | `npx tsc --noEmit` | exit 0 |
| Build web | `npx expo export --platform web` | exit 0, `dist/` gerado |
| Boot local | `node server.js` (após build) ou `npm run dev` (web) | app sobe |
| Smoke web — onboarding | cadastro → verify-phone → profile → home | **navega sem travar** |
| Smoke web — confirms | recusar convite, reprovar aviso, alterar cargo, recusar termos, export sensível | ação **executa**; cancelar **não** executa |
| Smoke web — erros | forçar erro de API | mensagem **visível** |
| Smoke web — regressão | `admin/approvals` (Modal), logout, remoção de membro | seguem funcionando |
| Dark mode | abrir telas candidatas M5 em dark | sem texto ilegível |
| Mobile sanity (se possível) | `expo start` device/emulador | confirms nativos via `Alert` ok |

---

## Pendências para decisão do responsável — ✅ RESOLVIDAS (2026-06-11)

1. **M4 — trava `IS_DEV_AUTH`:** ✅ implementar fail-fast (Opção B).
2. **INFO alerts:** ✅ migrar todos os 23.
3. **M5:** ✅ só blocker de legibilidade evidente em dark.

*Implementação em andamento na ordem de §5 (CP1→CP5), em checkpoints com `tsc --noEmit` + `expo export` e commits incrementais. Gate de lint dispensado por MAINT-FE-LINT-01.*
