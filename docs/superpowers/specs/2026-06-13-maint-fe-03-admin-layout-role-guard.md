# Spec: MAINT-FE-03 — Role Guard em admin/_layout.tsx

**Data:** 2026-06-13  
**Ciclo:** POST-RC / Ciclo 1 — Fundamentos técnicos  
**Prioridade:** P0  
**Estimativa:** 2–4 horas

---

## Problema

O arquivo `lumen_mobile/app/admin/_layout.tsx` não possui um guard de role no nível do layout. Isso significa:

- Um usuário autenticado sem role admin pode tentar acessar rotas admin diretamente (por URL ou deep link)
- A proteção atual depende de cada rota individual chamando a API e recebendo 403 do backend
- Não há redirecionamento proativo para usuários sem permissão
- O comportamento é inconsistente: algumas telas admin retornam 403 com mensagem de erro, outras podem carregar parcialmente

O padrão canônico identificado na auditoria RC (`2026-06-11-rc-fe-auth-store-audit.md`) é: não checar roles do store (frágil) — chamar a API e deixar o backend retornar 403. Porém, o `_layout.tsx` deve ter uma camada adicional de proteção para redirecionar usuários claramente não-admin antes de qualquer request.

---

## Objetivo

Adicionar um role guard no `admin/_layout.tsx` que:
1. Verifica se o usuário autenticado tem role admin (DEV, ADMIN ou ANALISTA)
2. Redireciona para home (`/(tabs)/home`) se não tiver role
3. Não quebra o padrão existente de "API retorna 403" para roles insuficientes dentro da área admin
4. Não usa `authStore.isLoading` (que nunca vira `false`)

---

## Escopo

**Dentro do escopo:**
- Modificar `lumen_mobile/app/admin/_layout.tsx`
- Adicionar chamada de verificação de permissão ao montar o layout
- Redirecionar usuários não-admin para fora da área admin

**Fora do escopo:**
- Alterar lógica de permissão nas telas individuais (`admin/index.tsx`, `admin/dashboard.tsx`, etc.)
- Implementar UI de "acesso negado" elaborada
- Alterar o backend
- Verificação de sub-roles dentro do admin (ANALISTA vs ADMIN vs DEV) — isso já está nas telas individuais

---

## Arquivos Prováveis

```
lumen_mobile/app/admin/_layout.tsx    ← modificar
lumen_mobile/src/services/api.ts      ← endpoint de permissões (leitura)
```

Endpoint canônico de permissão: `GET /auth/me/permissions` ou similar — verificar o endpoint correto no código atual.

---

## Abordagem Recomendada

### Padrão atual (não usar)
```ts
// ERRADO — authStore.isLoading nunca vira false
const { user, isLoading } = useAuthStore();
if (isLoading) return <Loading />;
if (!user) router.replace('/(auth)/login');
```

### Padrão canônico (usar)
Chamar a API de permissões diretamente e redirecionar baseado na resposta:

```tsx
// lumen_mobile/app/admin/_layout.tsx
import { useEffect, useState } from 'react';
import { router, Stack } from 'expo-router';
import { api } from '@/src/services/api';

export default function AdminLayout() {
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    api.get('/auth/me/permissions')
      .then((perms: any) => {
        const hasAdminAccess =
          perms?.global_role &&
          ['DEV', 'ADMIN', 'ANALISTA'].includes(perms.global_role);
        if (!hasAdminAccess) {
          router.replace('/(tabs)/home');
        }
      })
      .catch(() => {
        // 401 ou 403 — redirecionar para home
        router.replace('/(tabs)/home');
      })
      .finally(() => setChecked(true));
  }, []);

  if (!checked) return null; // ou <LoadingScreen />

  return (
    <Stack>
      {/* rotas admin existentes */}
    </Stack>
  );
}
```

**Importante:** verificar o shape real da resposta de `/auth/me/permissions` antes de implementar. Adaptar conforme o contrato real da API.

---

## Riscos

| Risco | Mitigação |
|---|---|
| Endpoint de permissões retorna shape diferente do esperado | Ler `app/api/routes/auth.py` para confirmar o contrato antes de implementar |
| Guard causar flash de tela em branco | Usar `<LoadingScreen />` ou spinner enquanto `checked === false` |
| `authStore` já faz verificação em outro lugar que conflita | Verificar se há guard no `app/_layout.tsx` raiz — não duplicar |
| ANALISTA redirecionado incorretamente (só vê Dashboard) | ANALISTA deve passar pelo guard — a restrição de tela é dentro do admin, não no guard |
| Race condition: token não carregado antes do request | Verificar se `api.get` já inclui token automaticamente (ver `api.ts`) |

---

## Plano de Implementação

1. Ler `lumen_mobile/app/admin/_layout.tsx` atual — entender estrutura existente
2. Ler `lumen_mobile/src/services/api.ts` — confirmar como o token é incluído
3. Verificar endpoint de permissões: `grep -n "permissions\|global_role\|me/perm" backend/app/api/routes/auth.py`
4. Confirmar shape da resposta (field `global_role` ou similar)
5. Implementar o guard conforme padrão canônico
6. Testar:
   - Usuário DEV/ADMIN/ANALISTA → deve entrar normalmente
   - Usuário sem role admin → deve ser redirecionado para home
   - Usuário não autenticado → deve ser redirecionado (401 catch)
7. Executar `npx tsc --noEmit` — sem erros
8. Executar `npm run lint` — sem novos warnings

---

## Plano de Testes

### Manual (web)
- Login com conta DEV ou ADMIN → navegar para `/admin` → deve abrir normalmente
- Login com conta sem role admin → navegar para `/admin` → deve redirecionar para `/home`
- Sem login → navegar para `/admin` → deve redirecionar (para login ou home conforme o guard raiz)

### TypeScript
- `npx tsc --noEmit` passa sem erros

---

## Critérios de Aceite

- [ ] `admin/_layout.tsx` possui guard de role que chama a API
- [ ] Usuário sem role admin é redirecionado para `/(tabs)/home`
- [ ] Usuário com role DEV/ADMIN/ANALISTA acessa normalmente
- [ ] Nenhum uso de `authStore.isLoading` no guard
- [ ] `npx tsc --noEmit` passa
- [ ] `npm run lint` passa
- [ ] Comportamento validado manualmente na web (login + navegação)

---

## Rollback

Reverter `admin/_layout.tsx` para o estado anterior via `git revert`. O backend não é alterado.

---

## Estimativa de Esforço

**2–4 horas** (diagnóstico do endpoint + implementação + teste manual + checks)

---

## Dependências

- Nenhuma dependência de outros itens POST-RC
- **Recomendado:** executar após MAINT-FE-01 (lint configurado)
- Não bloqueia outros itens
