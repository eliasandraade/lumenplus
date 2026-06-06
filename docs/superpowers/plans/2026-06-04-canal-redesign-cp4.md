# Canal de Grupos — Redesign Visual (Checkpoint 4)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign visual completo do Canal de Grupos — hierarquia clara no feed, Destaque Institucional visualmente distinto, replies organizadas sem aparência de chat, dark mode e Nunito, sem alterar backend, serviços ou permissões.

**Architecture:** Extrair todos os sub-componentes visuais para um arquivo `app/channel/components.tsx` co-localizado, depois reescrever `[unitId].tsx` para consumir esses componentes com o design system (`useTheme`, `SemanticTokens`, `radius`). Nenhuma lógica de dados ou permissões é alterada — apenas a camada visual.

**Tech Stack:** React Native, Expo Router, TypeScript, design system Lumen+ (`src/theme/tokens.ts`, `useTheme()`), Nunito (já carregada no projeto), Ionicons (já disponível via `@expo/vector-icons`).

---

## Arquivo Map

| Ação | Arquivo | Responsabilidade |
|---|---|---|
| Criar | `app/channel/components.tsx` | Todos os sub-componentes visuais do Canal |
| Reescrever | `app/channel/[unitId].tsx` | Tela principal consumindo os novos componentes |
| Atualizar | `app/channel/_layout.tsx` | Header com título limpo |

**Sem alterações:** `src/services/channel.ts`, `src/stores/authStore.ts`, `src/types/`, qualquer arquivo de backend.

---

## Nota sobre imports de tema

Seguir o padrão de `app/(tabs)/home.tsx`:
- Tema: `import { useTheme } from '@/theme';` e `import type { SemanticTokens } from '@/theme';`
- Radius: `import { radius } from '@/src/theme/tokens';`
- Serviços do canal: `import { ... } from '@/src/services/channel';` (padrão já em uso em `[unitId].tsx`)

---

## Task 1: Criar `app/channel/components.tsx` — primitivos visuais

**Files:**
- Create: `app/channel/components.tsx`

- [ ] **Step 1: Criar o arquivo com AvatarInitial, StatusBadge, AuthorRow, SectionHeader, EmptyFeed, ChannelSkeleton**

```tsx
// app/channel/components.tsx
import React from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { SemanticTokens } from '@/theme';
import { radius } from '@/src/theme/tokens';
import type { ChannelReply } from '@/src/services/channel';

// ── Avatar ────────────────────────────────────────────────────────────────────

const AVATAR_COLORS = ['#1A859B', '#E6AC00', '#059669', '#5b21b6', '#DC2626', '#2563EB'];

function avatarHue(userId: string): string {
  let h = 0;
  for (const ch of userId) h = (h * 31 + ch.charCodeAt(0)) & 0xffff;
  return AVATAR_COLORS[h % AVATAR_COLORS.length];
}

type AvatarProps = { name: string; userId: string; size?: number };

export function AvatarInitial({ name, userId, size = 36 }: AvatarProps) {
  const color = avatarHue(userId);
  const letter = name.trim()[0]?.toUpperCase() ?? '?';
  return (
    <View style={{
      width: size, height: size, borderRadius: size / 2,
      backgroundColor: color,
      alignItems: 'center', justifyContent: 'center',
    }}>
      <Text style={{
        color: '#fff',
        fontSize: size * 0.42,
        fontFamily: 'Nunito-Bold',
        lineHeight: size * 0.55,
      }}>
        {letter}
      </Text>
    </View>
  );
}

// ── StatusBadge ───────────────────────────────────────────────────────────────

type BadgeKind = 'pinned' | 'highlight';

export function StatusBadge({ kind, t }: { kind: BadgeKind; t: SemanticTokens }) {
  const isPinned = kind === 'pinned';
  return (
    <View style={{
      alignSelf: 'flex-start',
      paddingHorizontal: 10,
      paddingVertical: 3,
      borderRadius: radius.full,
      backgroundColor: isPinned ? t.brand.secondaryDim : t.brand.primaryDim,
    }}>
      <Text style={{
        fontFamily: 'Nunito-SemiBold',
        fontSize: 11,
        color: isPinned ? t.brand.secondary : t.brand.primary,
        letterSpacing: 0.3,
      }}>
        {isPinned ? 'Fixado' : 'Destaque'}
      </Text>
    </View>
  );
}

// ── AuthorRow ─────────────────────────────────────────────────────────────────

type AuthorRowProps = {
  name: string;
  userId: string;
  date: string;
  edited: boolean;
  replyCount: number;
  t: SemanticTokens;
};

export function AuthorRow({ name, userId, date, edited, replyCount, t }: AuthorRowProps) {
  const dateStr = new Date(date).toLocaleDateString('pt-BR', {
    day: '2-digit', month: 'short', year: 'numeric',
  });
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
      <AvatarInitial name={name} userId={userId} size={28} />
      <View style={{ flex: 1 }}>
        <Text style={{ fontFamily: 'Nunito-SemiBold', fontSize: 12, color: t.text.primary }}>
          {name}
        </Text>
        <Text style={{ fontFamily: 'Nunito-Regular', fontSize: 11, color: t.text.tertiary }}>
          {dateStr}{edited ? ' · editado' : ''} · {replyCount} resposta{replyCount !== 1 ? 's' : ''}
        </Text>
      </View>
    </View>
  );
}

// ── SectionHeader ─────────────────────────────────────────────────────────────

export function SectionHeader({ label, t }: { label: string; t: SemanticTokens }) {
  return (
    <Text style={{
      fontFamily: 'Nunito-SemiBold',
      fontSize: 11,
      color: t.text.tertiary,
      letterSpacing: 1.2,
      textTransform: 'uppercase',
      marginBottom: 10,
      marginTop: 4,
    }}>
      {label}
    </Text>
  );
}

// ── EmptyFeed ─────────────────────────────────────────────────────────────────

export function EmptyFeed({ t }: { t: SemanticTokens }) {
  return (
    <View style={{
      alignItems: 'center', justifyContent: 'center',
      paddingHorizontal: 40, paddingTop: 80,
    }}>
      <View style={{
        width: 80, height: 80, borderRadius: 40,
        backgroundColor: t.brand.primaryDim,
        alignItems: 'center', justifyContent: 'center',
        marginBottom: 20,
      }}>
        <Ionicons name="megaphone-outline" size={36} color={t.brand.primary} />
      </View>
      <Text style={{
        fontFamily: 'Nunito-Bold', fontSize: 18,
        color: t.text.primary, marginBottom: 8, textAlign: 'center',
      }}>
        Nenhuma publicação por aqui
      </Text>
      <Text style={{
        fontFamily: 'Nunito-Regular', fontSize: 14,
        color: t.text.secondary, textAlign: 'center', lineHeight: 22,
      }}>
        Este é o canal do seu grupo. Quando alguém publicar algo, aparecerá aqui.
      </Text>
    </View>
  );
}

// ── ChannelSkeleton ───────────────────────────────────────────────────────────

export function ChannelSkeleton({ t }: { t: SemanticTokens }) {
  const box = (h: number, w: `${number}%`, mb: number = 8) => (
    <View style={{ height: h, width: w, backgroundColor: t.bg.surface, borderRadius: radius.sm, marginBottom: mb }} />
  );
  const card = (i: number) => (
    <View key={i} style={{
      backgroundColor: t.bg.elevated, borderRadius: radius.lg,
      padding: 16, marginBottom: 10,
    }}>
      {box(12, '35%', 10)}
      {box(17, '88%', 6)}
      {box(13, '68%', 12)}
      {box(11, '50%')}
    </View>
  );
  return (
    <View style={{ padding: 16 }}>
      {[0, 1, 2].map(card)}
    </View>
  );
}
```

- [ ] **Step 2: Verificar que o arquivo compila**

```bash
cd lumen_mobile && npx tsc --noEmit 2>&1 | head -40
```

Esperado: zero erros relacionados a `app/channel/components.tsx`. (Outros erros pré-existentes podem aparecer — ignorar.)

---

## Task 2: Adicionar HighlightCard e PostCard ao `components.tsx`

**Files:**
- Modify: `app/channel/components.tsx`

O HighlightCard precisa de tratamento visual **claramente superior** aos posts normais: barra dourada horizontal no topo, borda lateral teal, sombra mais elevada, título maior, preview com 3 linhas.

- [ ] **Step 1: Adicionar imports necessários no topo de `components.tsx`**

No topo do arquivo, adicionar o import de `ChannelPost`:

```tsx
import type { ChannelPost, ChannelReply } from '@/src/services/channel';
```

(Substituir a linha existente `import type { ChannelReply } from '@/src/services/channel';`)

- [ ] **Step 2: Adicionar HighlightCard ao final de `components.tsx`**

```tsx
// ── HighlightCard (Destaque Institucional) ────────────────────────────────────

type PostCardProps = {
  item: ChannelPost;
  onPress: () => void;
  t: SemanticTokens;
};

export function HighlightCard({ item, onPress, t }: PostCardProps) {
  return (
    <Pressable
      onPress={onPress}
      style={{
        backgroundColor: t.bg.elevated,
        borderRadius: radius.lg,
        marginBottom: 14,
        overflow: 'hidden',
        shadowColor: t.shadow.lg.shadowColor,
        shadowOffset: t.shadow.lg.shadowOffset,
        shadowOpacity: t.shadow.lg.shadowOpacity,
        shadowRadius: t.shadow.lg.shadowRadius,
        elevation: t.shadow.lg.elevation,
      }}
    >
      {/* Barra dourada horizontal — distingue destaque de qualquer outro post */}
      <View style={{ height: 4, backgroundColor: t.brand.secondary }} />

      {/* Borda teal esquerda + conteúdo */}
      <View style={{ flexDirection: 'row' }}>
        <View style={{ width: 4, backgroundColor: t.brand.primary }} />
        <View style={{ flex: 1, padding: 18 }}>
          <StatusBadge kind="highlight" t={t} />
          <Text style={{
            fontFamily: 'Nunito-Bold', fontSize: 19,
            color: t.text.primary,
            marginTop: 10, marginBottom: 8, lineHeight: 28,
          }}>
            {item.title}
          </Text>
          <Text
            style={{
              fontFamily: 'Nunito-Regular', fontSize: 14,
              color: t.text.secondary, lineHeight: 21, marginBottom: 14,
            }}
            numberOfLines={3}
          >
            {item.body}
          </Text>
          <AuthorRow
            name={item.author_name}
            userId={item.author_user_id}
            date={item.created_at}
            edited={!!item.edited_at}
            replyCount={item.reply_count}
            t={t}
          />
        </View>
      </View>
    </Pressable>
  );
}
```

- [ ] **Step 3: Adicionar PostCard (normal + fixado) ao final de `components.tsx`**

```tsx
// ── PostCard (normal e fixado) ────────────────────────────────────────────────

export function PostCard({ item, onPress, t }: PostCardProps) {
  const isPinned = item.is_pinned && !item.is_institutional_highlight;
  return (
    <Pressable
      onPress={onPress}
      style={{
        backgroundColor: t.bg.elevated,
        borderRadius: radius.md,
        marginBottom: 10,
        borderLeftWidth: isPinned ? 3 : 0,
        borderLeftColor: isPinned ? t.brand.secondary : 'transparent',
        shadowColor: t.shadow.sm.shadowColor,
        shadowOffset: t.shadow.sm.shadowOffset,
        shadowOpacity: t.shadow.sm.shadowOpacity,
        shadowRadius: t.shadow.sm.shadowRadius,
        elevation: t.shadow.sm.elevation,
      }}
    >
      <View style={{ padding: 16 }}>
        {isPinned && (
          <View style={{ marginBottom: 8 }}>
            <StatusBadge kind="pinned" t={t} />
          </View>
        )}
        <Text style={{
          fontFamily: 'Nunito-SemiBold', fontSize: 16,
          color: t.text.primary, marginBottom: 5, lineHeight: 23,
        }}>
          {item.title}
        </Text>
        <Text
          style={{
            fontFamily: 'Nunito-Regular', fontSize: 13,
            color: t.text.secondary, lineHeight: 19, marginBottom: 12,
          }}
          numberOfLines={2}
        >
          {item.body}
        </Text>
        <AuthorRow
          name={item.author_name}
          userId={item.author_user_id}
          date={item.created_at}
          edited={!!item.edited_at}
          replyCount={item.reply_count}
          t={t}
        />
      </View>
    </Pressable>
  );
}
```

- [ ] **Step 4: Verificar compilação**

```bash
cd lumen_mobile && npx tsc --noEmit 2>&1 | head -40
```

---

## Task 3: Adicionar ReplyItem ao `components.tsx`

**Files:**
- Modify: `app/channel/components.tsx`

O ReplyItem deve parecer contribuição organizada — avatar + nome + data na mesma linha, corpo abaixo, separador entre replies. **Sem borda esquerda de chat.**

- [ ] **Step 1: Adicionar ReplyItem ao final de `components.tsx`**

```tsx
// ── ReplyItem ─────────────────────────────────────────────────────────────────

type ReplyItemProps = {
  reply: ChannelReply;
  canEdit: boolean;
  canModerate: boolean;
  isEditing: boolean;
  editBody: string;
  onEditBodyChange: (v: string) => void;
  onStartEdit: () => void;
  onSaveEdit: () => void;
  onCancelEdit: () => void;
  onDelete: () => void;
  submitting: boolean;
  t: SemanticTokens;
  isLast: boolean;
};

export function ReplyItem({
  reply, canEdit, canModerate, isEditing, editBody,
  onEditBodyChange, onStartEdit, onSaveEdit, onCancelEdit,
  onDelete, submitting, t, isLast,
}: ReplyItemProps) {
  const dateStr = new Date(reply.created_at).toLocaleDateString('pt-BR', {
    day: '2-digit', month: 'short', year: 'numeric',
  });
  return (
    <View>
      <View style={{ flexDirection: 'row', gap: 12, paddingVertical: 16 }}>
        <AvatarInitial name={reply.author_name} userId={reply.author_user_id} size={32} />
        <View style={{ flex: 1 }}>
          {/* Cabeçalho: nome + data */}
          <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6, marginBottom: 5 }}>
            <Text style={{ fontFamily: 'Nunito-SemiBold', fontSize: 13, color: t.text.primary }}>
              {reply.author_name}
            </Text>
            <Text style={{ fontFamily: 'Nunito-Regular', fontSize: 11, color: t.text.tertiary }}>
              {dateStr}{reply.edited_at ? ' · editado' : ''}
            </Text>
          </View>

          {isEditing ? (
            <View>
              <TextInput
                value={editBody}
                onChangeText={onEditBodyChange}
                multiline
                style={{
                  borderWidth: 1, borderColor: t.border.default,
                  borderRadius: radius.md, padding: 10,
                  minHeight: 60, marginBottom: 8,
                  fontFamily: 'Nunito-Regular', fontSize: 14,
                  color: t.text.primary, backgroundColor: t.bg.surface,
                  textAlignVertical: 'top',
                }}
              />
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <Pressable
                  onPress={onCancelEdit}
                  style={{
                    paddingHorizontal: 14, paddingVertical: 7,
                    borderRadius: radius.md, borderWidth: 1, borderColor: t.border.default,
                  }}
                >
                  <Text style={{ fontFamily: 'Nunito-SemiBold', fontSize: 12, color: t.text.secondary }}>
                    Cancelar
                  </Text>
                </Pressable>
                <Pressable
                  onPress={onSaveEdit}
                  disabled={submitting}
                  style={{
                    paddingHorizontal: 14, paddingVertical: 7,
                    borderRadius: radius.md,
                    backgroundColor: submitting ? t.brand.primaryDim : t.brand.primary,
                  }}
                >
                  <Text style={{ fontFamily: 'Nunito-SemiBold', fontSize: 12, color: '#fff' }}>
                    {submitting ? '...' : 'Salvar'}
                  </Text>
                </Pressable>
              </View>
            </View>
          ) : (
            <View>
              <Text style={{
                fontFamily: 'Nunito-Regular', fontSize: 14,
                color: t.text.primary, lineHeight: 21,
                marginBottom: (canEdit || canModerate) ? 8 : 0,
              }}>
                {reply.body}
              </Text>
              {(canEdit || canModerate) && (
                <View style={{ flexDirection: 'row', gap: 6 }}>
                  {canEdit && (
                    <Pressable
                      onPress={onStartEdit}
                      style={{
                        paddingHorizontal: 10, paddingVertical: 3,
                        backgroundColor: t.brand.adminDim, borderRadius: radius.full,
                      }}
                    >
                      <Text style={{ fontFamily: 'Nunito-SemiBold', fontSize: 11, color: t.brand.admin }}>
                        Editar
                      </Text>
                    </Pressable>
                  )}
                  {canModerate && (
                    <Pressable
                      onPress={onDelete}
                      style={{
                        paddingHorizontal: 10, paddingVertical: 3,
                        backgroundColor: t.status.errorBg, borderRadius: radius.full,
                      }}
                    >
                      <Text style={{ fontFamily: 'Nunito-SemiBold', fontSize: 11, color: t.status.error }}>
                        Remover
                      </Text>
                    </Pressable>
                  )}
                </View>
              )}
            </View>
          )}
        </View>
      </View>
      {!isLast && (
        <View style={{ height: 1, backgroundColor: t.border.subtle, marginLeft: 44 }} />
      )}
    </View>
  );
}
```

- [ ] **Step 2: Verificar compilação**

```bash
cd lumen_mobile && npx tsc --noEmit 2>&1 | head -40
```

---

## Task 4: Reescrever `app/channel/[unitId].tsx`

**Files:**
- Rewrite: `app/channel/[unitId].tsx`

Toda a lógica de dados permanece **inalterada**. Somente a camada de renderização é substituída. A tela de composição (`Screen = 'compose'`) substitui o bottom panel existente.

- [ ] **Step 1: Substituir o conteúdo completo de `[unitId].tsx`**

```tsx
import { useLocalSearchParams } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import {
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  ChannelPost,
  ChannelPostDetail,
  ChannelSettings,
  channelService,
} from '@/src/services/channel';
import { useAuthStore } from '@/src/stores/authStore';
import { useTheme } from '@/theme';
import { radius } from '@/src/theme/tokens';
import {
  AvatarInitial,
  AuthorRow,
  StatusBadge,
  SectionHeader,
  HighlightCard,
  PostCard,
  EmptyFeed,
  ChannelSkeleton,
  ReplyItem,
} from './components';

type Screen = 'list' | 'post' | 'compose';

type FeedItem =
  | { kind: 'section'; label: string; id: string }
  | { kind: 'highlight'; post: ChannelPost }
  | { kind: 'post'; post: ChannelPost };

export default function ChannelScreen() {
  const { unitId } = useLocalSearchParams<{ unitId: string }>();
  const { user } = useAuthStore();
  const { t } = useTheme();
  const currentUserId = user?.id ?? '';

  const [screen, setScreen] = useState<Screen>('list');
  const [posts, setPosts] = useState<ChannelPost[]>([]);
  const [selectedPost, setSelectedPost] = useState<ChannelPostDetail | null>(null);
  const [settings, setSettings] = useState<ChannelSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [postTitle, setPostTitle] = useState('');
  const [postBody, setPostBody] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [replyBody, setReplyBody] = useState('');
  const [replyError, setReplyError] = useState<string | null>(null);

  const [editingPostId, setEditingPostId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editBody, setEditBody] = useState('');
  const [editingReplyId, setEditingReplyId] = useState<string | null>(null);
  const [editReplyBody, setEditReplyBody] = useState('');

  // ── Data loading ────────────────────────────────────────────────────────────

  const loadList = useCallback(async () => {
    try {
      const [list, cfg] = await Promise.all([
        channelService.listPosts(unitId),
        channelService.getSettings(unitId),
      ]);
      setPosts(list.posts);
      setSettings(cfg);
      setError(null);
    } catch {
      setError('Não foi possível carregar o canal.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [unitId]);

  useEffect(() => { loadList(); }, [loadList]);

  const loadPost = async (postId: string) => {
    try {
      const detail = await channelService.getPost(unitId, postId);
      setSelectedPost(detail);
    } catch {
      setError('Não foi possível carregar a publicação.');
      setScreen('list');
    }
  };

  const openPost = (post: ChannelPost) => {
    setScreen('post');
    setSelectedPost(null);
    loadPost(post.id);
  };

  // ── Handlers (lógica inalterada) ─────────────────────────────────────────────

  const handleCreatePost = async () => {
    setFormError(null);
    if (!postTitle.trim() || postTitle.trim().length < 3) {
      setFormError('O título deve ter pelo menos 3 caracteres.');
      return;
    }
    if (!postBody.trim()) {
      setFormError('O conteúdo não pode estar vazio.');
      return;
    }
    setSubmitting(true);
    try {
      await channelService.createPost(unitId, postTitle.trim(), postBody.trim());
      setPostTitle('');
      setPostBody('');
      setScreen('list');
      await loadList();
    } catch (e: any) {
      setFormError(e?.response?.data?.detail?.message || 'Erro ao publicar.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSaveEditPost = async () => {
    if (!editingPostId) return;
    setSubmitting(true);
    try {
      await channelService.editPost(
        unitId, editingPostId,
        editTitle || undefined, editBody || undefined,
      );
      setEditingPostId(null);
      if (screen === 'list') await loadList();
      else if (selectedPost) await loadPost(selectedPost.id);
    } catch (e: any) {
      setFormError(e?.response?.data?.detail?.message || 'Erro ao editar.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeletePost = (postId: string) => {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      const reason = window.prompt('Motivo da remoção (mínimo 3 caracteres):');
      if (!reason || reason.trim().length < 3) return;
      channelService.deletePost(unitId, postId, reason.trim())
        .then(() => { if (screen === 'post') setScreen('list'); loadList(); })
        .catch((e: any) => setError(e?.response?.data?.detail?.message || 'Erro ao remover.'));
    }
  };

  const handleCreateReply = async () => {
    if (!selectedPost) return;
    setReplyError(null);
    if (!replyBody.trim()) {
      setReplyError('A contribuição não pode estar vazia.');
      return;
    }
    setSubmitting(true);
    try {
      await channelService.createReply(unitId, selectedPost.id, replyBody.trim());
      setReplyBody('');
      await loadPost(selectedPost.id);
    } catch (e: any) {
      setReplyError(e?.response?.data?.detail?.message || 'Erro ao enviar.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSaveEditReply = async () => {
    if (!editingReplyId || !selectedPost) return;
    setSubmitting(true);
    try {
      await channelService.editReply(
        unitId, selectedPost.id, editingReplyId, editReplyBody.trim(),
      );
      setEditingReplyId(null);
      await loadPost(selectedPost.id);
    } catch (e: any) {
      setReplyError(e?.response?.data?.detail?.message || 'Erro ao editar.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteReply = (replyId: string) => {
    if (!selectedPost) return;
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      const reason = window.prompt('Motivo da remoção (mínimo 3 caracteres):');
      if (!reason || reason.trim().length < 3) return;
      channelService.deleteReply(unitId, selectedPost.id, replyId, reason.trim())
        .then(() => loadPost(selectedPost.id))
        .catch((e: any) => setReplyError(e?.response?.data?.detail?.message || 'Erro ao remover.'));
    }
  };

  const handleTogglePin = async (postId: string) => {
    try { await channelService.togglePin(unitId, postId); await loadList(); }
    catch (e: any) { setError(e?.response?.data?.detail?.message || 'Erro ao alterar.'); }
  };

  const handleToggleHighlight = async (postId: string) => {
    try { await channelService.toggleHighlight(unitId, postId); await loadList(); }
    catch (e: any) { setError(e?.response?.data?.detail?.message || 'Erro ao alterar.'); }
  };

  // ── Loading ──────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: t.bg.screen }}>
        <ChannelSkeleton t={t} />
      </View>
    );
  }

  // ── Erro ─────────────────────────────────────────────────────────────────────

  if (error && screen === 'list') {
    return (
      <View style={{
        flex: 1, backgroundColor: t.bg.screen,
        justifyContent: 'center', alignItems: 'center', padding: 32,
      }}>
        <Ionicons name="cloud-offline-outline" size={48} color={t.status.error} style={{ marginBottom: 16 }} />
        <Text style={{
          fontFamily: 'Nunito-SemiBold', fontSize: 16,
          color: t.text.primary, textAlign: 'center', marginBottom: 8,
        }}>
          Não foi possível carregar
        </Text>
        <Text style={{
          fontFamily: 'Nunito-Regular', fontSize: 14,
          color: t.text.secondary, textAlign: 'center', marginBottom: 24,
        }}>
          {error}
        </Text>
        <Pressable
          onPress={loadList}
          style={{
            paddingHorizontal: 24, paddingVertical: 12,
            backgroundColor: t.brand.primary, borderRadius: radius.md,
          }}
        >
          <Text style={{ fontFamily: 'Nunito-SemiBold', fontSize: 14, color: '#fff' }}>
            Tentar novamente
          </Text>
        </Pressable>
      </View>
    );
  }

  // ── Compose (nova publicação) ─────────────────────────────────────────────────

  if (screen === 'compose') {
    return (
      <KeyboardAvoidingView
        style={{ flex: 1, backgroundColor: t.bg.screen }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* Header da tela de composição */}
        <View style={{
          flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
          paddingHorizontal: 16, paddingVertical: 14,
          borderBottomWidth: 1, borderBottomColor: t.border.subtle,
        }}>
          <Pressable onPress={() => { setScreen('list'); setFormError(null); setPostTitle(''); setPostBody(''); }}>
            <Text style={{ fontFamily: 'Nunito-Regular', fontSize: 15, color: t.text.secondary }}>
              Cancelar
            </Text>
          </Pressable>
          <Text style={{ fontFamily: 'Nunito-Bold', fontSize: 16, color: t.text.primary }}>
            Nova publicação
          </Text>
          <Pressable
            onPress={handleCreatePost}
            disabled={submitting}
            style={{
              paddingHorizontal: 18, paddingVertical: 8,
              backgroundColor: submitting ? t.brand.primaryDim : t.brand.primary,
              borderRadius: radius.full,
            }}
          >
            <Text style={{ fontFamily: 'Nunito-SemiBold', fontSize: 14, color: '#fff' }}>
              {submitting ? 'Publicando...' : 'Publicar'}
            </Text>
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={{ padding: 20, gap: 16 }}>
          {formError && (
            <View style={{
              backgroundColor: t.status.errorBg,
              borderRadius: radius.md, padding: 12,
            }}>
              <Text style={{ fontFamily: 'Nunito-Regular', fontSize: 13, color: t.status.error }}>
                {formError}
              </Text>
            </View>
          )}

          <View style={{ gap: 6 }}>
            <Text style={{ fontFamily: 'Nunito-SemiBold', fontSize: 13, color: t.text.secondary }}>
              Título
            </Text>
            <TextInput
              value={postTitle}
              onChangeText={setPostTitle}
              placeholder="Dê um título claro à sua publicação"
              placeholderTextColor={t.text.tertiary}
              style={{
                borderWidth: 1, borderColor: t.border.default,
                borderRadius: radius.md, padding: 14,
                fontFamily: 'Nunito-Regular', fontSize: 16,
                color: t.text.primary, backgroundColor: t.bg.surface,
              }}
            />
          </View>

          <View style={{ gap: 6 }}>
            <Text style={{ fontFamily: 'Nunito-SemiBold', fontSize: 13, color: t.text.secondary }}>
              Conteúdo
            </Text>
            <TextInput
              value={postBody}
              onChangeText={setPostBody}
              placeholder="Escreva o conteúdo da publicação..."
              placeholderTextColor={t.text.tertiary}
              multiline
              style={{
                borderWidth: 1, borderColor: t.border.default,
                borderRadius: radius.md, padding: 14,
                minHeight: 180, fontFamily: 'Nunito-Regular', fontSize: 15,
                color: t.text.primary, backgroundColor: t.bg.surface,
                textAlignVertical: 'top',
              }}
            />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    );
  }

  // ── Post Detail ───────────────────────────────────────────────────────────────

  if (screen === 'post') {
    if (!selectedPost) {
      return (
        <View style={{ flex: 1, backgroundColor: t.bg.screen }}>
          <ChannelSkeleton t={t} />
        </View>
      );
    }

    const isAuthorPost = selectedPost.author_user_id === currentUserId;
    const canEditPost = isAuthorPost || (settings?.can_moderate ?? false);

    return (
      <KeyboardAvoidingView
        style={{ flex: 1, backgroundColor: t.bg.screen }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 48 }}>

          {/* Voltar */}
          <Pressable
            onPress={() => { setScreen('list'); setSelectedPost(null); }}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 16 }}
          >
            <Ionicons name="chevron-back" size={18} color={t.brand.primary} />
            <Text style={{ fontFamily: 'Nunito-SemiBold', fontSize: 14, color: t.brand.primary }}>
              Voltar
            </Text>
          </Pressable>

          {/* Badges de status */}
          {(selectedPost.is_institutional_highlight || selectedPost.is_pinned) && (
            <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12 }}>
              {selectedPost.is_institutional_highlight && (
                <StatusBadge kind="highlight" t={t} />
              )}
              {selectedPost.is_pinned && !selectedPost.is_institutional_highlight && (
                <StatusBadge kind="pinned" t={t} />
              )}
            </View>
          )}

          {/* Conteúdo do post ou formulário de edição */}
          {editingPostId === selectedPost.id ? (
            <View style={{ gap: 10, marginBottom: 16 }}>
              <TextInput
                value={editTitle}
                onChangeText={setEditTitle}
                style={{
                  borderWidth: 1, borderColor: t.border.default,
                  borderRadius: radius.md, padding: 14,
                  fontFamily: 'Nunito-Bold', fontSize: 20,
                  color: t.text.primary, backgroundColor: t.bg.surface,
                }}
              />
              <TextInput
                value={editBody}
                onChangeText={setEditBody}
                multiline
                style={{
                  borderWidth: 1, borderColor: t.border.default,
                  borderRadius: radius.md, padding: 14, minHeight: 120,
                  fontFamily: 'Nunito-Regular', fontSize: 15,
                  color: t.text.primary, backgroundColor: t.bg.surface,
                  textAlignVertical: 'top',
                }}
              />
              {formError && (
                <Text style={{ fontFamily: 'Nunito-Regular', fontSize: 13, color: t.status.error }}>
                  {formError}
                </Text>
              )}
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <Pressable
                  onPress={() => { setEditingPostId(null); setFormError(null); }}
                  style={{
                    flex: 1, padding: 12, borderRadius: radius.md,
                    borderWidth: 1, borderColor: t.border.default, alignItems: 'center',
                  }}
                >
                  <Text style={{ fontFamily: 'Nunito-SemiBold', fontSize: 14, color: t.text.secondary }}>
                    Cancelar
                  </Text>
                </Pressable>
                <Pressable
                  onPress={handleSaveEditPost}
                  disabled={submitting}
                  style={{
                    flex: 1, padding: 12, borderRadius: radius.md, alignItems: 'center',
                    backgroundColor: submitting ? t.brand.primaryDim : t.brand.primary,
                  }}
                >
                  <Text style={{ fontFamily: 'Nunito-SemiBold', fontSize: 14, color: '#fff' }}>
                    {submitting ? 'Salvando...' : 'Salvar'}
                  </Text>
                </Pressable>
              </View>
            </View>
          ) : (
            <View style={{ marginBottom: 16 }}>
              {/* Título */}
              <Text style={{
                fontFamily: 'Nunito-Bold', fontSize: 22,
                color: t.text.primary, marginBottom: 14, lineHeight: 30,
              }}>
                {selectedPost.title}
              </Text>

              {/* Autor */}
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 18 }}>
                <AvatarInitial
                  name={selectedPost.author_name}
                  userId={selectedPost.author_user_id}
                  size={38}
                />
                <View>
                  <Text style={{ fontFamily: 'Nunito-SemiBold', fontSize: 14, color: t.text.primary }}>
                    {selectedPost.author_name}
                  </Text>
                  <Text style={{ fontFamily: 'Nunito-Regular', fontSize: 12, color: t.text.tertiary }}>
                    {new Date(selectedPost.created_at).toLocaleDateString('pt-BR', {
                      day: '2-digit', month: 'long', year: 'numeric',
                    })}
                    {selectedPost.edited_at ? ' · editado' : ''}
                  </Text>
                </View>
              </View>

              {/* Corpo */}
              <Text style={{
                fontFamily: 'Nunito-Regular', fontSize: 16,
                color: t.text.primary, lineHeight: 26, marginBottom: 20,
              }}>
                {selectedPost.body}
              </Text>

              {/* Ações de moderação */}
              {(canEditPost || (settings?.can_moderate ?? false)) && (
                <View style={{
                  flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8,
                }}>
                  {canEditPost && (
                    <Pressable
                      onPress={() => {
                        setEditingPostId(selectedPost.id);
                        setEditTitle(selectedPost.title);
                        setEditBody(selectedPost.body);
                      }}
                      style={{
                        paddingHorizontal: 14, paddingVertical: 7,
                        backgroundColor: t.brand.adminDim, borderRadius: radius.full,
                      }}
                    >
                      <Text style={{ fontFamily: 'Nunito-SemiBold', fontSize: 12, color: t.brand.admin }}>
                        Editar
                      </Text>
                    </Pressable>
                  )}
                  {settings?.can_moderate && (
                    <>
                      <Pressable
                        onPress={() => handleTogglePin(selectedPost.id)}
                        style={{
                          paddingHorizontal: 14, paddingVertical: 7,
                          backgroundColor: t.brand.secondaryDim, borderRadius: radius.full,
                        }}
                      >
                        <Text style={{ fontFamily: 'Nunito-SemiBold', fontSize: 12, color: t.brand.secondary }}>
                          {selectedPost.is_pinned ? 'Desafixar' : 'Fixar'}
                        </Text>
                      </Pressable>
                      <Pressable
                        onPress={() => handleToggleHighlight(selectedPost.id)}
                        style={{
                          paddingHorizontal: 14, paddingVertical: 7,
                          backgroundColor: t.brand.primaryDim, borderRadius: radius.full,
                        }}
                      >
                        <Text style={{ fontFamily: 'Nunito-SemiBold', fontSize: 12, color: t.brand.primary }}>
                          {selectedPost.is_institutional_highlight ? 'Remover destaque' : 'Destacar'}
                        </Text>
                      </Pressable>
                      <Pressable
                        onPress={() => handleDeletePost(selectedPost.id)}
                        style={{
                          paddingHorizontal: 14, paddingVertical: 7,
                          backgroundColor: t.status.errorBg, borderRadius: radius.full,
                        }}
                      >
                        <Text style={{ fontFamily: 'Nunito-SemiBold', fontSize: 12, color: t.status.error }}>
                          Remover
                        </Text>
                      </Pressable>
                    </>
                  )}
                </View>
              )}
            </View>
          )}

          {/* Divisor */}
          <View style={{ height: 1, backgroundColor: t.border.subtle, marginBottom: 14 }} />

          {/* Cabeçalho de respostas */}
          <Text style={{
            fontFamily: 'Nunito-SemiBold', fontSize: 14,
            color: t.text.secondary, marginBottom: 10,
          }}>
            {selectedPost.replies.length === 0
              ? 'Nenhuma resposta ainda'
              : `${selectedPost.replies.length} ${selectedPost.replies.length === 1 ? 'resposta' : 'respostas'}`}
          </Text>

          {/* Lista de respostas */}
          {selectedPost.replies.length > 0 && (
            <View style={{
              backgroundColor: t.bg.elevated,
              borderRadius: radius.lg,
              paddingHorizontal: 16,
              marginBottom: 20,
              shadowColor: t.shadow.sm.shadowColor,
              shadowOffset: t.shadow.sm.shadowOffset,
              shadowOpacity: t.shadow.sm.shadowOpacity,
              shadowRadius: t.shadow.sm.shadowRadius,
              elevation: t.shadow.sm.elevation,
            }}>
              {selectedPost.replies.map((reply, idx) => (
                <ReplyItem
                  key={reply.id}
                  reply={reply}
                  canEdit={reply.author_user_id === currentUserId}
                  canModerate={settings?.can_moderate ?? false}
                  isEditing={editingReplyId === reply.id}
                  editBody={editReplyBody}
                  onEditBodyChange={setEditReplyBody}
                  onStartEdit={() => { setEditingReplyId(reply.id); setEditReplyBody(reply.body); }}
                  onSaveEdit={handleSaveEditReply}
                  onCancelEdit={() => setEditingReplyId(null)}
                  onDelete={() => handleDeleteReply(reply.id)}
                  submitting={submitting}
                  t={t}
                  isLast={idx === selectedPost.replies.length - 1}
                />
              ))}
            </View>
          )}

          {/* Erro de reply */}
          {replyError && (
            <View style={{
              backgroundColor: t.status.errorBg,
              borderRadius: radius.md, padding: 12, marginBottom: 12,
            }}>
              <Text style={{ fontFamily: 'Nunito-Regular', fontSize: 13, color: t.status.error }}>
                {replyError}
              </Text>
            </View>
          )}

          {/* Campo de nova resposta */}
          <Text style={{ fontFamily: 'Nunito-SemiBold', fontSize: 13, color: t.text.secondary, marginBottom: 6 }}>
            Sua contribuição
          </Text>
          <TextInput
            value={replyBody}
            onChangeText={setReplyBody}
            placeholder="Escreva sua contribuição..."
            placeholderTextColor={t.text.tertiary}
            multiline
            style={{
              borderWidth: 1, borderColor: t.border.default,
              borderRadius: radius.md, padding: 14, minHeight: 90,
              fontFamily: 'Nunito-Regular', fontSize: 15,
              color: t.text.primary, backgroundColor: t.bg.surface,
              textAlignVertical: 'top', marginBottom: 10,
            }}
          />
          <Pressable
            onPress={handleCreateReply}
            disabled={submitting}
            style={{
              backgroundColor: submitting ? t.brand.primaryDim : t.brand.primary,
              padding: 14, borderRadius: radius.md, alignItems: 'center',
            }}
          >
            <Text style={{ fontFamily: 'Nunito-SemiBold', fontSize: 15, color: '#fff' }}>
              {submitting ? 'Enviando...' : 'Responder'}
            </Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    );
  }

  // ── Feed (list) ───────────────────────────────────────────────────────────────

  const highlightPosts = posts.filter(p => p.is_institutional_highlight);
  const pinnedPosts = posts.filter(p => p.is_pinned && !p.is_institutional_highlight);
  const normalPosts = posts.filter(p => !p.is_pinned && !p.is_institutional_highlight);

  const feedItems: FeedItem[] = [];
  if (highlightPosts.length > 0) {
    feedItems.push({ kind: 'section', label: 'Destaques', id: 'sec-highlights' });
    highlightPosts.forEach(p => feedItems.push({ kind: 'highlight', post: p }));
  }
  if (pinnedPosts.length > 0) {
    feedItems.push({ kind: 'section', label: 'Fixados', id: 'sec-pinned' });
    pinnedPosts.forEach(p => feedItems.push({ kind: 'post', post: p }));
  }
  if (normalPosts.length > 0) {
    if (highlightPosts.length > 0 || pinnedPosts.length > 0) {
      feedItems.push({ kind: 'section', label: 'Publicações', id: 'sec-normal' });
    }
    normalPosts.forEach(p => feedItems.push({ kind: 'post', post: p }));
  }

  return (
    <View style={{ flex: 1, backgroundColor: t.bg.screen }}>
      {posts.length === 0 ? (
        <EmptyFeed t={t} />
      ) : (
        <FlatList
          data={feedItems}
          keyExtractor={(item) => item.kind === 'section' ? item.id : item.post.id}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => { setRefreshing(true); loadList(); }}
              tintColor={t.brand.primary}
            />
          }
          contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
          renderItem={({ item }) => {
            if (item.kind === 'section') {
              return <SectionHeader label={item.label} t={t} />;
            }
            if (item.kind === 'highlight') {
              return <HighlightCard item={item.post} onPress={() => openPost(item.post)} t={t} />;
            }
            return <PostCard item={item.post} onPress={() => openPost(item.post)} t={t} />;
          }}
        />
      )}

      {settings?.can_post && (
        <Pressable
          onPress={() => setScreen('compose')}
          style={{
            position: 'absolute', bottom: 28, right: 20,
            flexDirection: 'row', alignItems: 'center', gap: 8,
            backgroundColor: t.brand.primary,
            paddingHorizontal: 20, paddingVertical: 14,
            borderRadius: radius.full,
            shadowColor: t.shadow.lg.shadowColor,
            shadowOffset: t.shadow.lg.shadowOffset,
            shadowOpacity: t.shadow.lg.shadowOpacity,
            shadowRadius: t.shadow.lg.shadowRadius,
            elevation: t.shadow.lg.elevation,
          }}
        >
          <Ionicons name="create-outline" size={18} color="#fff" />
          <Text style={{ fontFamily: 'Nunito-Bold', fontSize: 14, color: '#fff' }}>
            Publicar
          </Text>
        </Pressable>
      )}
    </View>
  );
}
```

- [ ] **Step 2: Verificar compilação**

```bash
cd lumen_mobile && npx tsc --noEmit 2>&1 | head -60
```

Esperado: zero erros em `app/channel/[unitId].tsx` e `app/channel/components.tsx`.

---

## Task 5: Atualizar `app/channel/_layout.tsx`

**Files:**
- Modify: `app/channel/_layout.tsx`

O header deve herdar o estilo do sistema (sem título hardcoded).

- [ ] **Step 1: Substituir o conteúdo de `_layout.tsx`**

```tsx
import { Stack } from 'expo-router';

export default function ChannelLayout() {
  return (
    <Stack screenOptions={{ headerShown: true }}>
      <Stack.Screen name="[unitId]" options={{ title: 'Canal' }} />
    </Stack>
  );
}
```

> Nenhuma mudança funcional — o arquivo já está assim. Confirmar que o conteúdo é idêntico e pular se sim.

- [ ] **Step 2: Verificação final de compilação**

```bash
cd lumen_mobile && npx tsc --noEmit 2>&1 | head -60
```

---

## Task 6: Commit do Checkpoint 4

- [ ] **Step 1: Verificar arquivos alterados**

```bash
cd lumen_mobile && git status
```

Esperado: `app/channel/components.tsx` (novo), `app/channel/[unitId].tsx` (modificado).

- [ ] **Step 2: Commit**

```bash
cd lumen_mobile && git add app/channel/components.tsx app/channel/[unitId].tsx && git commit -m "$(cat <<'EOF'
feat(canal): Checkpoint 4 — redesign visual Canal de Grupos

- Hierarquia de feed em seções: Destaques > Fixados > Publicações
- HighlightCard com barra dourada + borda teal — impossível confundir com post normal
- PostCard com preview de corpo e AuthorRow com avatar inicial
- ReplyItem sem visual de chat — avatar + cabeçalho + corpo + separador
- Tela de composição substitui bottom panel; FAB com label "Publicar"
- Estados vazios e de erro com linguagem humana
- Dark mode e Nunito via design system (useTheme, SemanticTokens)
- Zero alterações em serviços, stores, tipos ou permissões

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## Self-Review — Cobertura do Spec

| Requisito | Task |
|---|---|
| Hierarquia feed: Destaques > Fixados > Publicações | Task 4 (FeedItem sections) |
| Destaque Institucional visualmente superior (não só badge) | Task 2 (HighlightCard: barra dourada + borda teal + sombra lg) |
| Posts fixados com badge pill sem emoji | Task 2 (PostCard + StatusBadge) |
| Preview do corpo no feed | Tasks 2 e 3 (numberOfLines) |
| AuthorRow com avatar inicial | Task 1 (AuthorRow + AvatarInitial) |
| Estado vazio com linguagem humana | Task 1 (EmptyFeed) |
| Loading com skeleton | Task 1 (ChannelSkeleton) |
| Erro de rede com botão de retry | Task 4 ([unitId].tsx erro state) |
| Replies sem visual de chat | Task 3 (ReplyItem sem borderLeft) |
| Formulário novo post como tela de composição | Task 4 (screen 'compose') |
| FAB com label "Publicar" | Task 4 |
| Moderação como pills pill de ação | Task 4 (detail — ações de moderação) |
| Dark mode via useTheme() | Tasks 1–4 (todos os tokens via `t`) |
| Nunito em toda a tipografia | Tasks 1–4 (fontFamily: 'Nunito-*') |
| "Canal" como nome visível | Task 5 (_layout title: 'Canal') |
| Sem alterações em services/stores | — (verificado: nenhum import alterado) |
