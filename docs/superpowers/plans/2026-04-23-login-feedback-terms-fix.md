# Login Feedback, Recuperação de Senha e Termos de Uso — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Substituir feedbacks silenciosos/Alert.alert no login por mensagens inline, melhorar UX da recuperação de senha, e atualizar email de contato nos Termos de Uso.

**Architecture:** Três mudanças independentes no mesmo arquivo de tela (`login.tsx`), mais uma nova versão de legal_content e sua migration correspondente. Nenhuma mudança em contratos de API, stores ou navegação.

**Tech Stack:** React Native + Expo Router (frontend), Python/Alembic (migrations backend), Firebase Auth (auth provider)

---

## File Map

| Arquivo | Ação | Responsabilidade |
|---------|------|-----------------|
| `lumen_mobile/app/(auth)/login.tsx` | Modify | Substituir Alert.alert por estado inline em login e forgot-password |
| `backend/app/legal_content.py` | Modify | Adicionar `TERMS_V1_3` com email de contato atualizado |
| `backend/alembic/versions/027_terms_v1_3_contato.py` | Create | Publicar Termos v1.3 no banco |

---

## Task 1: Login — Erros inline (substituir Alert.alert)

**Files:**
- Modify: `lumen_mobile/app/(auth)/login.tsx`

### Contexto atual

O `catch` do `handleLogin` chama `Alert.alert(...)` — no Expo Web isso pode ser silencioso ou inconsistente. A validação de formulário já usa estado `errors` inline, mas erros de auth não.

### Estado atual relevante (linhas 40–43)

```tsx
const [email, setEmail] = useState('');
const [password, setPassword] = useState('');
const [errors, setErrors] = useState<Record<string, string>>({});
const [isLoading, setIsLoading] = useState(false);
```

- [ ] **Step 1: Adicionar estado `authError`**

No topo do componente, após a linha `const [isLoading, setIsLoading] = useState(false);`, adicionar:

```tsx
const [authError, setAuthError] = useState('');
```

- [ ] **Step 2: Limpar `authError` ao digitar**

Nos `onChangeText` dos dois `TextInput`, já existe `setErrors(...)`. Adicionar `setAuthError('')` em ambos:

Para o campo email (linha ~146):
```tsx
onChangeText={(text) => {
  setEmail(text);
  setErrors({ ...errors, email: '' });
  setAuthError('');
}}
```

Para o campo password (linha ~165):
```tsx
onChangeText={(text) => {
  setPassword(text);
  setErrors({ ...errors, password: '' });
  setAuthError('');
}}
```

- [ ] **Step 3: Substituir `Alert.alert` no DEV auth (handleLogin)**

No bloco `if (IS_DEV_AUTH)`, substituir `Alert.alert('Erro ao entrar', msg)` por:

```tsx
if (!res.ok) {
  const err = await res.json().catch(() => ({}));
  const msg = err?.detail?.message ?? 'Usuário não encontrado. Crie uma conta primeiro.';
  setAuthError(msg);
  return;
}
```

- [ ] **Step 4: Substituir `Alert.alert` no catch de Firebase**

Substituir o bloco `catch` inteiro (linhas ~79–88):

```tsx
} catch (err: unknown) {
  const code = (err as { code?: string }).code ?? '';
  let message = 'Email ou senha inválidos.';
  if (code === 'auth/user-not-found') message = 'Usuário não encontrado.';
  if (code === 'auth/wrong-password') message = 'Senha incorreta.';
  if (code === 'auth/too-many-requests') message = 'Muitas tentativas. Aguarde e tente novamente.';
  if (code === 'auth/invalid-credential') message = 'Email ou senha inválidos.';
  setAuthError(message);
} finally {
  setIsLoading(false);
}
```

- [ ] **Step 5: Exibir `authError` inline no JSX**

Logo abaixo do `{errors.password ? ... : null}` (após o campo senha, antes do link "Esqueci a senha"), inserir:

```tsx
{authError ? (
  <Text style={styles.authErrorText}>{authError}</Text>
) : null}
```

- [ ] **Step 6: Adicionar estilo `authErrorText`**

No `StyleSheet.create`, adicionar após `errorText`:

```ts
authErrorText: {
  color: '#fecaca',
  fontSize: 14,
  marginBottom: 12,
  marginLeft: 4,
  textAlign: 'center',
},
```

- [ ] **Step 7: Remover `Alert` do import se não for mais usado em login**

Verificar se `Alert` ainda aparece em outro lugar no arquivo. Se não aparecer, remover do import no topo. (Apenas remova se o import ficar unused — não quebre outros usos.)

- [ ] **Step 8: Commit**

```bash
git add lumen_mobile/app/(auth)/login.tsx
git commit -m "fix: substituir Alert.alert por erro inline no login"
```

---

## Task 2: Recuperação de Senha — Feedback inline + loading

**Files:**
- Modify: `lumen_mobile/app/(auth)/login.tsx`

### Contexto atual

`handleForgotPassword` usa `Alert.alert` para sucesso e erro. O link "Esqueci a senha" não tem estado de loading.

- [ ] **Step 1: Adicionar estados de reset**

Após `const [authError, setAuthError] = useState('');`, adicionar:

```tsx
const [resetMessage, setResetMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
const [isSendingReset, setIsSendingReset] = useState(false);
```

- [ ] **Step 2: Substituir `handleForgotPassword` inteiro**

```tsx
const handleForgotPassword = async () => {
  if (IS_DEV_AUTH) {
    setResetMessage({ type: 'error', text: 'Recuperação de senha não disponível em modo de desenvolvimento.' });
    return;
  }
  if (!email.includes('@')) {
    setErrors({ email: 'Digite seu email acima primeiro' });
    return;
  }
  try {
    setIsSendingReset(true);
    setResetMessage(null);
    await sendPasswordResetEmail(auth, email.trim().toLowerCase());
    setResetMessage({
      type: 'success',
      text: `Enviamos um e-mail para ${email.trim().toLowerCase()}. Verifique sua caixa de entrada.`,
    });
  } catch {
    setResetMessage({ type: 'error', text: 'Não foi possível enviar o e-mail. Verifique o endereço e tente novamente.' });
  } finally {
    setIsSendingReset(false);
  }
};
```

- [ ] **Step 3: Atualizar o botão "Esqueci a senha" no JSX**

Substituir o `TouchableOpacity` atual de forgot-password:

```tsx
<TouchableOpacity
  style={[styles.forgotPassword, isSendingReset && { opacity: 0.5 }]}
  onPress={handleForgotPassword}
  disabled={isSendingReset}
>
  {isSendingReset ? (
    <ActivityIndicator size="small" color={colors.white} />
  ) : (
    <Text style={styles.forgotPasswordText}>Esqueci a senha</Text>
  )}
</TouchableOpacity>
```

- [ ] **Step 4: Exibir mensagem de feedback inline**

Logo abaixo do botão "Esqueci a senha", inserir:

```tsx
{resetMessage ? (
  <Text
    style={[
      styles.resetMessageText,
      resetMessage.type === 'success' ? styles.resetSuccess : styles.resetError,
    ]}
  >
    {resetMessage.text}
  </Text>
) : null}
```

- [ ] **Step 5: Adicionar estilos para mensagem de reset**

```ts
resetMessageText: {
  fontSize: 13,
  marginBottom: 12,
  marginLeft: 4,
  lineHeight: 18,
},
resetSuccess: {
  color: '#bbf7d0',
},
resetError: {
  color: '#fecaca',
},
```

- [ ] **Step 6: Documentar customização do e-mail Firebase no código**

No topo de `handleForgotPassword`, adicionar comentário:

```tsx
// Para customizar o e-mail enviado pelo Firebase (idioma, template, link):
// Firebase Console → Authentication → Templates → Password reset
// Assunto sugerido: "Redefinição de senha — Lumen+"
// Corpo: saudação acolhedora em português, botão com cor #1A859B, assinatura "Equipe Lumen+"
```

- [ ] **Step 7: Commit**

```bash
git add lumen_mobile/app/(auth)/login.tsx
git commit -m "fix: feedback inline na recuperação de senha, sem Alert.alert"
```

---

## Task 3: Termos de Uso — Atualizar email de contato (v1.3)

**Files:**
- Modify: `backend/app/legal_content.py`
- Create: `backend/alembic/versions/027_terms_v1_3_contato.py`

### Contexto

`TERMS_V1` (linha ~85): `juridico@obralumen.org.br` → `comunicacao@lumenserfeliz.org`

As versões V1.1, V1.2 derivam de `TERMS_V1` com `.replace("Versão 1.0", ...)`. Para não alterar versões já publicadas (e re-exigir aceitação de todos), criamos `TERMS_V1_3` explicitamente baseado no `TERMS_V1_2` com apenas o email trocado.

A Política de Privacidade NÃO muda — já está em v1.3 com dados corretos.

- [ ] **Step 1: Adicionar `TERMS_V1_3` em `legal_content.py`**

Ao final do arquivo, após a linha `PRIVACY_V1_3 = (...)`, adicionar:

```python
# v1.3 — atualiza email de contato: juridico@obralumen.org.br → comunicacao@lumenserfeliz.org
TERMS_V1_3 = TERMS_V1_2.replace("Versão 1.2", "Versão 1.3").replace(
    "juridico@obralumen.org.br",
    "comunicacao@lumenserfeliz.org",
)
```

- [ ] **Step 2: Verificar substituição manualmente**

```bash
cd backend
python -c "from app.legal_content import TERMS_V1_3; assert 'comunicacao@lumenserfeliz.org' in TERMS_V1_3; assert 'juridico@obralumen.org.br' not in TERMS_V1_3; print('OK')"
```

Saída esperada: `OK`

- [ ] **Step 3: Criar migration `027_terms_v1_3_contato.py`**

```python
"""Termos de Uso v1.3 — atualiza email de contato da seção 15

Revision ID: 027_terms_v1_3_contato
Revises: 026_fix_catalog_items
Create Date: 2026-04-23

Mudança em relação à v1.2:
  - Seção 15 (CONTATO): juridico@obralumen.org.br → comunicacao@lumenserfeliz.org

Apenas os Termos de Uso mudam; a Política de Privacidade permanece em v1.3.
Todos os usuários serão solicitados a aceitar os novos Termos de Uso.
"""

import uuid
from datetime import datetime, timezone
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

from app.legal_content import TERMS_V1_3

revision: str = "027_terms_v1_3_contato"
down_revision: Union[str, None] = "026_fix_catalog_items"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

PUBLISHED_AT = datetime(2026, 4, 23, 0, 0, 0, tzinfo=timezone.utc)


def upgrade() -> None:
    conn = op.get_bind()

    existing = conn.execute(
        sa.text("SELECT id FROM legal_documents WHERE type = 'TERMS' AND version = '1.3'")
    ).fetchone()

    if existing:
        conn.execute(
            sa.text(
                "UPDATE legal_documents SET content = :c WHERE type = 'TERMS' AND version = '1.3'"
            ),
            {"c": TERMS_V1_3},
        )
    else:
        conn.execute(
            sa.text(
                "INSERT INTO legal_documents (id, type, version, content, published_at) "
                "VALUES (:id, :type, :version, :content, :published_at)"
            ),
            {
                "id": str(uuid.uuid4()),
                "type": "TERMS",
                "version": "1.3",
                "content": TERMS_V1_3,
                "published_at": PUBLISHED_AT,
            },
        )


def downgrade() -> None:
    op.execute("DELETE FROM legal_documents WHERE version = '1.3' AND type = 'TERMS'")
```

- [ ] **Step 4: Commit**

```bash
git add backend/app/legal_content.py backend/alembic/versions/027_terms_v1_3_contato.py
git commit -m "feat: Termos v1.3 — email de contato comunicacao@lumenserfeliz.org"
```

---

## Self-Review

### Spec coverage

| Requisito | Tarefa |
|-----------|--------|
| Login mostra erro inline (não silencioso) | Task 1 |
| Limpar erro ao digitar | Task 1, Step 2 |
| Desabilitar botão + loading no login | Já existia no código — mantido |
| Forgot password: loading + sucesso inline | Task 2 |
| Forgot password: erro inline | Task 2 |
| Template Firebase documentado | Task 2, Step 6 |
| Termos: email atualizado sem quebrar versionamento | Task 3 |
| Nenhuma funcionalidade existente quebrada | Sem mudanças em API/stores/navegação |

### Verificações de consistência

- `TERMS_V1_3` é baseado em `TERMS_V1_2` (que é a versão publicada mais recente de Termos), não em `TERMS_V1` diretamente — evita alterar conteúdo já aceito.
- `resetMessage` usa tipo union `{ type: 'success' | 'error'; text: string } | null` — evita dois estados separados que poderiam ficar dessincronizados.
- `authError` é string simples (pode ser `''`) — consistente com `errors` já existente no componente.
- `Alert` import: verificar se ainda é usado em outro lugar do arquivo antes de remover (o `terms.tsx` usa Alert mas é arquivo diferente).
- Migration 027 aponta para `down_revision: "026_fix_catalog_items"` — correto conforme a cadeia atual.
