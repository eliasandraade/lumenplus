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
} from '@/services/channel';
import { authService } from '@/services';
import { useTheme } from '@/theme';
import { radius } from '@/theme/tokens';
import {
  AvatarInitial,
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
  const { t } = useTheme();
  const [currentUserId, setCurrentUserId] = useState('');

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

  // ── Data loading ─────────────────────────────────────────────────────────────

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

  useEffect(() => {
    authService.getMe()
      .then((me) => setCurrentUserId(me.user_id))
      .catch(() => setCurrentUserId(''));
  }, []);

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

  // ── Loading ───────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: t.bg.screen }}>
        <ChannelSkeleton t={t} />
      </View>
    );
  }

  // ── Erro ──────────────────────────────────────────────────────────────────────

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
          <Text style={{ fontFamily: 'Nunito-SemiBold', fontSize: 14, color: t.text.inverse }}>
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
            <Text style={{ fontFamily: 'Nunito-SemiBold', fontSize: 14, color: t.text.inverse }}>
              {submitting ? 'Publicando...' : 'Publicar'}
            </Text>
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={{ padding: 20, gap: 16 }}>
          {formError && (
            <View style={{ backgroundColor: t.status.errorBg, borderRadius: radius.md, padding: 12 }}>
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

          <Pressable
            onPress={() => { setScreen('list'); setSelectedPost(null); }}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 16 }}
          >
            <Ionicons name="chevron-back" size={18} color={t.brand.primary} />
            <Text style={{ fontFamily: 'Nunito-SemiBold', fontSize: 14, color: t.brand.primary }}>
              Voltar
            </Text>
          </Pressable>

          {(selectedPost.is_institutional_highlight || selectedPost.is_pinned) && (
            <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12 }}>
              {selectedPost.is_institutional_highlight && <StatusBadge kind="highlight" t={t} />}
              {selectedPost.is_pinned && !selectedPost.is_institutional_highlight && (
                <StatusBadge kind="pinned" t={t} />
              )}
            </View>
          )}

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
                  <Text style={{ fontFamily: 'Nunito-SemiBold', fontSize: 14, color: t.text.inverse }}>
                    {submitting ? 'Salvando...' : 'Salvar'}
                  </Text>
                </Pressable>
              </View>
            </View>
          ) : (
            <View style={{ marginBottom: 16 }}>
              <Text style={{
                fontFamily: 'Nunito-Bold', fontSize: 22,
                color: t.text.primary, marginBottom: 14, lineHeight: 30,
              }}>
                {selectedPost.title}
              </Text>

              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 18 }}>
                <AvatarInitial
                  name={selectedPost.author_name}
                  userId={selectedPost.author_user_id}
                  size={38}
                  t={t}
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

              <Text style={{
                fontFamily: 'Nunito-Regular', fontSize: 16,
                color: t.text.primary, lineHeight: 26, marginBottom: 20,
              }}>
                {selectedPost.body}
              </Text>

              {(canEditPost || (settings?.can_moderate ?? false)) && (
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 }}>
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

          <View style={{ height: 1, backgroundColor: t.border.subtle, marginBottom: 14 }} />

          <Text style={{
            fontFamily: 'Nunito-SemiBold', fontSize: 14,
            color: t.text.secondary, marginBottom: 10,
          }}>
            {selectedPost.replies.length === 0
              ? 'Nenhuma resposta ainda'
              : `${selectedPost.replies.length} ${selectedPost.replies.length === 1 ? 'resposta' : 'respostas'}`}
          </Text>

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
            <Text style={{ fontFamily: 'Nunito-SemiBold', fontSize: 15, color: t.text.inverse }}>
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
          <Ionicons name="create-outline" size={18} color={t.text.inverse} />
          <Text style={{ fontFamily: 'Nunito-Bold', fontSize: 14, color: t.text.inverse }}>
            Publicar
          </Text>
        </Pressable>
      )}
    </View>
  );
}
