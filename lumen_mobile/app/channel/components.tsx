// app/channel/components.tsx
import React from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { SemanticTokens } from '@/theme';
import { radius } from '@/theme/tokens';
import type { ChannelPost, ChannelReply } from '@/services/channel';

// ── Avatar ────────────────────────────────────────────────────────────────────

const AVATAR_COLORS = ['#1A859B', '#E6AC00', '#059669', '#5b21b6', '#DC2626', '#2563EB'];

function avatarHue(userId: string): string {
  let h = 0;
  for (const ch of userId) h = (h * 31 + ch.charCodeAt(0)) & 0xffff;
  return AVATAR_COLORS[h % AVATAR_COLORS.length];
}

type AvatarProps = { name: string; userId: string; size?: number; t: SemanticTokens };

export function AvatarInitial({ name, userId, size = 36, t }: AvatarProps) {
  const color = avatarHue(userId);
  const letter = name.trim()[0]?.toUpperCase() ?? '?';
  return (
    <View style={{
      width: size, height: size, borderRadius: size / 2,
      backgroundColor: color,
      alignItems: 'center', justifyContent: 'center',
    }}>
      <Text style={{
        color: t.text.inverse,
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
      <AvatarInitial name={name} userId={userId} size={28} t={t} />
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

// ── PostCardProps (shared type) ───────────────────────────────────────────────

export type PostCardProps = {
  item: ChannelPost;
  onPress: () => void;
  t: SemanticTokens;
};

// ── ReplyItem ─────────────────────────────────────────────────────────────────

export type ReplyItemProps = {
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
        <AvatarInitial name={reply.author_name} userId={reply.author_user_id} size={32} t={t} />
        <View style={{ flex: 1 }}>
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
                  <Text style={{ fontFamily: 'Nunito-SemiBold', fontSize: 12, color: t.text.inverse }}>
                    {submitting ? '...' : 'Salvar'}
                  </Text>
                </Pressable>
              </View>
            </View>
          ) : (
            <View>
              {reply.body?.trim() ? (
                <Text style={{
                  fontFamily: 'Nunito-Regular', fontSize: 14,
                  color: t.text.primary, lineHeight: 21,
                  marginBottom: (canEdit || canModerate) ? 8 : 0,
                }}>
                  {reply.body}
                </Text>
              ) : (
                <Text style={{
                  fontFamily: 'Nunito-Regular', fontSize: 14,
                  color: t.text.tertiary, lineHeight: 21, fontStyle: 'italic',
                  marginBottom: (canEdit || canModerate) ? 8 : 0,
                }}>
                  [mensagem removida]
                </Text>
              )}
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

// ── HighlightCard (Destaque Institucional) ────────────────────────────────────

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
        borderLeftWidth: 3,
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
