# CP8.1 — Limpeza de Typecheck pré-existente

**Data:** 2026-06-07
**Status:** Aguardando aprovação
**Tipo:** Manutenção TypeScript — sem alteração de comportamento

---

## Contexto

Após deploy do CP8, `npx tsc --noEmit` produz **20 erros** em 8 arquivos. Todos pré-existiam antes do CP7/CP8. Esta spec detalha cada erro, sua causa raiz e a correção mínima segura.

**Meta:** `tsc --noEmit` com zero erros. Sem mudança de comportamento, sem refatoração estética.

> **Nota de revalidação (2026-06-07):** Contagem original era 22 (erro de auditoria manual). Recontagem com `tsc --noEmit` confirmou **20 erros**. O erro `app/(onboarding)/profile.tsx:459` (TS2554 — `api.post` chamado com 3 argumentos) estava presente mas não foi incluído nos grupos de correção. Ver seção "Erro fora de escopo CP8.1" abaixo.

---

## Auditoria completa

### Contagem por arquivo

| Arquivo | Erros | Código TS | Escopo CP8.1 |
|---------|-------|-----------|-------------|
| `src/services/index.ts` | 6 | TS2345 | ✅ Grupo A |
| `src/services/lifePlan.ts` | 4 | TS2352 | ✅ Grupo A |
| `src/services/projetoVidaMensal.ts` | 2 | TS2352 | ✅ Grupo A |
| `src/config/firebase.ts` | 1 | TS2305 | ✅ Grupo C |
| `app/(tabs)/profile.tsx` | 1 | TS1323 | ✅ Grupo D |
| `app/(tabs)/service.tsx` | 2 | TS2339 | ✅ Grupo E |
| `app/retreats/[id].tsx` | 1 | TS2339 | ✅ Grupo F |
| `app/vida/ciclo.tsx` | 2 | TS2339 | ✅ Grupo B |
| `app/(onboarding)/profile.tsx` | 1 | TS2554 | ⚠️ Fora de escopo |
| **Total** | **20** | | **19 corrigidos / 1 fora de escopo** |
| **Total** | **22** | |

---

## Grupos por causa raiz

---

### Grupo A — `api.request` exige `Record<string, unknown>`, DTOs não têm index signature (12 erros)

**Arquivos:** `src/services/index.ts` (6), `src/services/lifePlan.ts` (4), `src/services/projetoVidaMensal.ts` (2)

**Causa raiz:**  
`ApiClient.request()` em `src/services/api.ts` tem assinatura:
```typescript
private async request<T>(
  method: string,
  url: string,
  data?: Record<string, unknown>  // ← exige index signature
): Promise<T>
```

Os DTOs (`ProfileUpdateRequest`, `EmergencyContactRequest`, `AcceptLegalRequest`, `InboxSendRequest`, `StartVerificationRequest`, `ConfirmVerificationRequest`, `DiagnosisUpsert`, `GoalCreate`, `ActionCreate`, `MonthlyReviewCreate`, `CreateProjetoInput`, `ProjetoVidaSemanasCreate`) são interfaces tipadas — não têm `[key: string]: unknown`. TypeScript rejeita a passagem direta (TS2345) ou o cast `as Record<string, unknown>` (TS2352).

**Risco funcional:** Nenhum. O dado é passado a `JSON.stringify(data)` — nenhum acesso por index ocorre. O `Record<string, unknown>` é uma exigência desnecessariamente restritiva na assinatura.

**Classificação:** `typing simples` — contrato interno do cliente HTTP, sem impacto externo.

**Correção mínima (1 linha em 1 arquivo):**

Em `src/services/api.ts`, mudar a assinatura de `request`:
```typescript
// Antes:
private async request<T>(method: string, url: string, data?: Record<string, unknown>): Promise<T>

// Depois:
private async request<T>(method: string, url: string, data?: unknown): Promise<T>
```

O corpo do método permanece igual — `JSON.stringify(data)` aceita `unknown`.  
Isso elimina **todos os 12 erros** dos grupos `index.ts`, `lifePlan.ts` e `projetoVidaMensal.ts` sem tocar nenhum desses arquivos.

---

### Grupo B — `ProjetoVidaMensalFull` TypeScript não tem `intencao` (2 erros)

**Arquivo:** `app/vida/ciclo.tsx` linhas 104 e 118

**Causa raiz:**  
`ciclo.tsx` acessa `projeto.intencao` onde `projeto: ProjetoVidaMensalFull`. O campo existe no backend — `ProjetoVidaMensalFull` Pydantic tem `intencao: Optional[str] = None` (linha 221 do schema). Mas a interface TypeScript `ProjetoVidaMensalFull` em `src/services/projetoVidaMensal.ts` não tem esse campo.

**Risco funcional:** Nenhum. A exibição de intenção do ciclo em `ciclo.tsx` já funciona em produção — só o typecheck reclama.

**Classificação:** `contrato de API` — campo presente no backend, ausente no tipo frontend.

**Correção mínima (1 linha em 1 arquivo):**

Em `src/services/projetoVidaMensal.ts`, dentro de `ProjetoVidaMensalFull`, adicionar após `observacoes_mes`:
```typescript
intencao?: string | null;
```

---

### Grupo C — `firebase/auth` não exporta `getReactNativePersistence` nos tipos (1 erro)

**Arquivo:** `src/config/firebase.ts` linha 19

**Causa raiz:**  
Firebase v10.7 move `getReactNativePersistence` para o bundle react-native via conditional exports. O `tsconfig` usa `moduleResolution: "node"` (herdado do Expo base), que não processa conditional exports — o TypeScript resolve `firebase/auth` para o bundle web, que não exporta `getReactNativePersistence`. A função **existe em runtime** (o Expo bundler usa o bundle correto via Babel/Metro), mas os tipos TypeScript não a encontram.

O código já tem um `try/catch` com fallback a `getAuth()` — nunca quebra em runtime.

**Risco funcional:** Zero. Comportamento de auth inalterado.

**Classificação:** `import/dependência` — discrepância entre tipos e runtime em firebase v10.

**Correção mínima (cirúrgica, sem alterar comportamento):**

Remover `getReactNativePersistence` do import estático e fazer require local dentro do `try` onde já é usado:

```typescript
// Antes (firebase.ts linha 16-21):
import {
  getAuth,
  initializeAuth,
  getReactNativePersistence,  // ← causa o TS2305
  Auth,
} from 'firebase/auth';

// Depois:
import { getAuth, initializeAuth, Auth } from 'firebase/auth';

// E dentro da função createAuth() no try block (linha ~51):
// Antes:
return initializeAuth(app, { persistence: getReactNativePersistence(AsyncStorage) });

// Depois:
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { getReactNativePersistence } = require('firebase/auth');
return initializeAuth(app, { persistence: getReactNativePersistence(AsyncStorage) });
```

O `require` dentro do `try` já é o padrão do arquivo (AsyncStorage também é required). Comportamento idêntico.

---

### Grupo D — dynamic `import()` com module sem suporte (1 erro)

**Arquivo:** `app/(tabs)/profile.tsx` linha 390

**Causa raiz:**  
O Expo tsconfig base define `target: ESNext` mas não define `module` — o TypeScript infere `CommonJS` pelo default de `moduleResolution: node`. Em TypeScript 5.x, `import()` dinâmico em `module: CommonJS` gera TS1323. O código usa `import('react-native')` apenas no branch nativo (`else` de `Platform.OS !== 'web'`).

**Risco funcional:** Zero. Dynamic import de `react-native` em branch nativo funciona perfeitamente em runtime via Metro.

**Classificação:** `import/dependência` — TS strictness vs runtime capabilidade.

**Opções:**

**Opção 1 (recomendada) — Eliminar o dynamic import:**
```typescript
// Antes (linha 390):
import('react-native').then(({ Alert }) => {
  Alert.alert('Sair', 'Deseja realmente sair da sua conta?', [...]);
});

// Depois — require direto (react-native já é carregado na app, sem custo):
const { Alert } = require('react-native') as typeof import('react-native');
Alert.alert('Sair', 'Deseja realmente sair da sua conta?', [...]);
```

**Opção 2 — Adicionar `"module": "ESNext"` no tsconfig.json local:**
```json
"compilerOptions": {
  "module": "ESNext",
  ...
}
```
Esta opção resolve o erro mas pode introduzir outros avisos. Preferir Opção 1.

---

### Grupo E — `readings.psalm.text` não existe no tipo psalm (2 erros)

**Arquivo:** `app/(tabs)/service.tsx` linhas 289–290

**Causa raiz:**  
O tipo inline do psalm é `{ response: string; content_psalm: string[] } | null`. O código usa `.text` como fallback quando não há `content_psalm`, mas `text` não está na definição do tipo. A API de liturgia retorna `text` em leituras normais (`first_reading.text`, `second_reading.text`) — o psalm pode também retornar `text` em alguns casos, mas não está tipado.

**Risco funcional:** Zero — o código está em guard `readings.psalm.text && !readings.psalm.content_psalm`, já funciona em runtime. É só o tipo que está incompleto.

**Classificação:** `contrato de API` — tipo subestimado para o psalm.

**Correção mínima:**

Atualizar o tipo inline do psalm na linha 94:
```typescript
// Antes:
psalm: { response: string; content_psalm: string[] } | null;

// Depois:
psalm: { response: string; content_psalm: string[]; text?: string } | null;
```

---

### Grupo F — `MyRegistration` não tem `retreat_role` (1 erro)

**Arquivo:** `app/retreats/[id].tsx` linha 247

**Causa raiz:**  
`interface MyRegistration` é definida localmente no arquivo (linhas 84-95) sem o campo `retreat_role`. O código na linha 247 faz `reg?.retreat_role === 'EQUIPE_SERVICO'`. Em `app/admin/retreats/[id].tsx` (admin), o campo `retreat_role: string` existe numa interface diferente. O backend retorna `retreat_role` na resposta `my_registration`.

**Risco funcional:** Zero — funciona em runtime, só o tipo está incompleto.

**Classificação:** `contrato de API` — campo presente no backend, ausente no tipo local.

**Correção mínima:**

Adicionar `retreat_role` à interface `MyRegistration` local:
```typescript
interface MyRegistration {
  id: string;
  status: string;
  modality_preference: string | null;
  fee_category: string | null;
  fee_label: string | null;
  notes: string | null;
  payment_proof_url: string | null;
  payment_submitted_at: string | null;
  payment_confirmed_at: string | null;
  payment_rejection_reason: string | null;
  retreat_role?: string | null;  // ← adicionar
}
```

---

## Resumo da classificação

| Grupo | Erros | Classificação | Segurança |
|-------|-------|---------------|-----------|
| A — `api.request` Record<string,unknown> | 12 | typing simples | ✅ Seguro — 1 linha em api.ts |
| B — `intencao` ausente em ProjetoVidaMensalFull | 2 | contrato de API | ✅ Seguro — campo já existe no backend |
| C — `getReactNativePersistence` import | 1 | import/dependência | ✅ Seguro — já funciona em runtime |
| D — dynamic `import()` module flag | 1 | import/dependência | ✅ Seguro — require equivalente |
| E — `psalm.text` ausente no tipo | 2 | contrato de API | ✅ Seguro — campo já existe na API |
| F — `retreat_role` ausente em MyRegistration | 1 | contrato de API | ✅ Seguro — campo já existe no backend |

**Todos os 22 erros são seguros de corrigir.** Nenhum exige refatoração. Nenhum altera comportamento visual ou funcional.

---

## Plano de correção

**Arquivos a modificar (7, cirúrgicos):**

| # | Arquivo | Mudança | Erros eliminados |
|---|---------|---------|-----------------|
| 1 | `src/services/api.ts` | `data?: Record<string, unknown>` → `data?: unknown` | 12 |
| 2 | `src/services/projetoVidaMensal.ts` | Adicionar `intencao?: string \| null` em `ProjetoVidaMensalFull` | 2 |
| 3 | `src/config/firebase.ts` | Mover `getReactNativePersistence` para require dentro do try | 1 |
| 4 | `app/(tabs)/profile.tsx` | Substituir dynamic `import()` por require | 1 |
| 5 | `app/(tabs)/service.tsx` | Adicionar `text?: string` ao tipo psalm | 2 |
| 6 | `app/retreats/[id].tsx` | Adicionar `retreat_role?: string \| null` em `MyRegistration` | 1 |
| 7 | *(não há arquivo 7)* | — | — |

**Total:** 22 erros → 0 erros. 6 arquivos. Sem migration. Sem alteração de backend.

---

---

## Erro fora de escopo CP8.1

**`app/(onboarding)/profile.tsx:459` — TS2554: Expected 1-2 arguments, but got 3**

```typescript
await api.post('/profile/photo', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
```

`ApiClient.post()` aceita 2 argumentos (url + data). O 3º argumento (headers customizados) não existe na assinatura. Corrigir exige ou (a) adicionar suporte a headers opcionais no `ApiClient`, ou (b) extrair o upload de foto para um método separado. Nenhuma das opções é cirúrgica suficiente para CP8.1 — necessita aprovação separada (CP8.2 ou similar).

**Resultado esperado do CP8.1:** `tsc --noEmit` produz **1 erro** (`app/(onboarding)/profile.tsx:459`), não zero. Os outros 19 erros são eliminados.

---

## Restrições

- Não mexer em CP7, CP7.1 ou CP8
- Não mexer em theme/tokens
- Não alterar comportamento visual ou funcional
- Correção cirúrgica — apenas as linhas exatas descritas
- Não corrigir erros fora desta lista
- Não refatorar código adjacente
