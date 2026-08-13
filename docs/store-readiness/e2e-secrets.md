# E2E — secrets e variáveis que o CI precisa

O pipeline `maestro-e2e.yml` autentica **de verdade**. Não usa mock, por
decisão explícita: com `AUTH_MODE=DEV` o fluxo `01-excluir-conta` testaria
quase nada, já que os três fluxos dependem de sessão autenticada.

Isso significa que o CI precisa de um **projeto Firebase de staging/teste** e
de usuários sintéticos. Nada aqui deve apontar para produção.

> ⚠️ O fluxo `01-excluir-conta` **exclui uma conta de verdade**. Não há desfazer.
> É por isso que os guards do workflow recusam produção em vez de apenas avisar.

## 1. Variables (não secrets) — servem para conferência

Ficam em **Settings → Secrets and variables → Actions → Variables**. São
públicas de propósito: existem para que o guard possa comparar e imprimir o
valor no log sem vazar nada.

| Variable | Conteúdo |
|---|---|
| `E2E_FIREBASE_PROJECT_ID` | o `projectId` do projeto de **staging** que o E2E deve usar |
| `PROD_FIREBASE_PROJECT_ID` | o `projectId` de **produção** — o guard recusa se o E2E cair nele |
| `PROD_API_URL` | URL do backend de **produção** — mesma lógica |

Sem `E2E_FIREBASE_PROJECT_ID` o build para. Ela é a prova de que o secret
aponta para o projeto certo: se alguém trocar o conteúdo do secret sem trocar
a variable, o guard percebe.

## 2. Secrets — configuração do cliente Firebase

Em **Settings → Secrets and variables → Actions → Secrets**.

| Secret | Onde obter |
|---|---|
| `EXPO_PUBLIC_FIREBASE_API_KEY` | Firebase Console → Configurações do projeto → Seus apps |
| `EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN` | idem |
| `EXPO_PUBLIC_FIREBASE_PROJECT_ID` | idem |
| `EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET` | idem |
| `EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` | idem |
| `EXPO_PUBLIC_FIREBASE_APP_ID` | idem |
| `E2E_API_URL` | backend de staging |

**Nota honesta sobre a natureza destes valores:** a configuração do cliente
Firebase é pública — ela vai embutida em qualquer app distribuído, e não é
segredo criptográfico. Guardá-la como *secret* aqui não é sobre sigilo, é sobre
**separação por ambiente**: reduz a chance de alguém colar a config errada e o
CI acabar escrevendo em produção. O que é segredo de verdade está no item 3.

## 3. Secrets — usuários sintéticos

Estes **são** segredo de verdade e nunca podem sair do secret manager.

| Secret | Uso |
|---|---|
| `E2E_USER_EMAIL` / `E2E_USER_PASSWORD` | usuário principal: login e navegação |
| `E2E_USER2_EMAIL` / `E2E_USER2_PASSWORD` | segundo usuário: alvo de denúncia e bloqueio |
| `E2E_THROWAWAY_EMAIL` / `E2E_THROWAWAY_PASSWORD` | conta descartável para o fluxo de exclusão |

### Como criar

No **projeto Firebase de staging**, em Authentication → Users, criar três
contas com e-mails que não existam de verdade (ex.: `e2e-1@<dominio-teste>`).
Depois, no backend de staging, garantir que tenham perfil e pertençam à mesma
unidade — o fluxo de denúncia exige que os dois primeiros vejam o mesmo canal.

**A terceira é descartável por natureza:** o fluxo `01-excluir-conta` a apaga.
Ela precisa ser recriada antes de cada execução completa, ou o fluxo passa a
falhar por conta inexistente — o que é comportamento correto, não bug.

Nada de service account, private key ou token administrativo entra neste
pipeline. O E2E exercita o app como um usuário comum.

## 4. O que os guards recusam

O job de build para **antes de compilar** se:

- qualquer secret ou variable obrigatória estiver ausente;
- o `projectId` do secret divergir de `E2E_FIREBASE_PROJECT_ID`;
- o `projectId` for igual ao de produção;
- a `E2E_API_URL` for igual à de produção;
- o `projectId` não parecer de ambiente de teste (`staging`, `test`, `dev`,
  `homolog`, `qa` no nome).

A última é heurística e **soma-se** às outras, não as substitui. Se a
convenção de nomes do projeto for legítima e diferente, ajuste-a
conscientemente no workflow — não a remova por incômodo.

**Nunca há fallback silencioso.** Faltando configuração, o pipeline falha
dizendo o que falta. Não cai em mock nem em produção.
