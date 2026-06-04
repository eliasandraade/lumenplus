import { useLocalSearchParams } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
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
import {
  ChannelPost,
  ChannelPostDetail,
  ChannelSettings,
  channelService,
} from '@/src/services/channel';
import { useAuthStore } from '@/src/stores/authStore';

type Screen = 'list' | 'post';

export default function ChannelScreen() {
  const { unitId } = useLocalSearchParams<{ unitId: string }>();
  const { user } = useAuthStore();
  const currentUserId = user?.id ?? '';

  const [screen, setScreen] = useState<Screen>('list');
  const [posts, setPosts] = useState<ChannelPost[]>([]);
  const [totalPosts, setTotalPosts] = useState(0);
  const [selectedPost, setSelectedPost] = useState<ChannelPostDetail | null>(null);
  const [settings, setSettings] = useState<ChannelSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [showNewPost, setShowNewPost] = useState(false);
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

  const loadList = useCallback(async () => {
    try {
      const [list, cfg] = await Promise.all([
        channelService.listPosts(unitId),
        channelService.getSettings(unitId),
      ]);
      setPosts(list.posts);
      setTotalPosts(list.total);
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
      setError('Não foi possível carregar o post.');
      setScreen('list');
    }
  };

  const openPost = (post: ChannelPost) => {
    setScreen('post');
    setSelectedPost(null);
    loadPost(post.id);
  };

  const handleCreatePost = async () => {
    setFormError(null);
    if (!postTitle.trim() || postTitle.trim().length < 3) {
      setFormError('Título deve ter pelo menos 3 caracteres.');
      return;
    }
    if (!postBody.trim()) {
      setFormError('O corpo do post não pode estar vazio.');
      return;
    }
    setSubmitting(true);
    try {
      await channelService.createPost(unitId, postTitle.trim(), postBody.trim());
      setPostTitle(''); setPostBody(''); setShowNewPost(false);
      await loadList();
    } catch (e: any) {
      setFormError(e?.response?.data?.detail?.message || 'Erro ao publicar post.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSaveEditPost = async () => {
    if (!editingPostId) return;
    setSubmitting(true);
    try {
      await channelService.editPost(unitId, editingPostId, editTitle || undefined, editBody || undefined);
      setEditingPostId(null);
      if (screen === 'list') await loadList();
      else if (selectedPost) await loadPost(selectedPost.id);
    } catch (e: any) {
      setFormError(e?.response?.data?.detail?.message || 'Erro ao editar post.');
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
        .catch((e: any) => setError(e?.response?.data?.detail?.message || 'Erro ao remover post.'));
    }
  };

  const handleCreateReply = async () => {
    if (!selectedPost) return;
    setReplyError(null);
    if (!replyBody.trim()) { setReplyError('A resposta não pode estar vazia.'); return; }
    setSubmitting(true);
    try {
      await channelService.createReply(unitId, selectedPost.id, replyBody.trim());
      setReplyBody('');
      await loadPost(selectedPost.id);
    } catch (e: any) {
      setReplyError(e?.response?.data?.detail?.message || 'Erro ao enviar resposta.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSaveEditReply = async () => {
    if (!editingReplyId || !selectedPost) return;
    setSubmitting(true);
    try {
      await channelService.editReply(unitId, selectedPost.id, editingReplyId, editReplyBody.trim());
      setEditingReplyId(null);
      await loadPost(selectedPost.id);
    } catch (e: any) {
      setReplyError(e?.response?.data?.detail?.message || 'Erro ao editar resposta.');
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
        .catch((e: any) => setReplyError(e?.response?.data?.detail?.message || 'Erro ao remover resposta.'));
    }
  };

  const handleTogglePin = async (postId: string) => {
    try { await channelService.togglePin(unitId, postId); await loadList(); }
    catch (e: any) { setError(e?.response?.data?.detail?.message || 'Erro ao alterar pin.'); }
  };

  const handleToggleHighlight = async (postId: string) => {
    try { await channelService.toggleHighlight(unitId, postId); await loadList(); }
    catch (e: any) { setError(e?.response?.data?.detail?.message || 'Erro ao alterar destaque.'); }
  };

  if (loading) {
    return <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}><ActivityIndicator color="#7C3AED" /></View>;
  }

  if (error && screen === 'list') {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 }}>
        <Text style={{ color: '#DC2626', textAlign: 'center', marginBottom: 16 }}>{error}</Text>
        <Pressable onPress={loadList}><Text style={{ color: '#7C3AED' }}>Tentar novamente</Text></Pressable>
      </View>
    );
  }

  // ── POST DETAIL ──────────────────────────────────────────────────────────────
  if (screen === 'post') {
    if (!selectedPost) {
      return <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}><ActivityIndicator color="#7C3AED" /></View>;
    }
    const isAuthorPost = selectedPost.author_user_id === currentUserId;
    const canEditPost = isAuthorPost || (settings?.can_moderate ?? false);

    return (
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={{ padding: 16 }}>
          <Pressable onPress={() => { setScreen('list'); setSelectedPost(null); }} style={{ marginBottom: 12 }}>
            <Text style={{ color: '#7C3AED' }}>← Voltar</Text>
          </Pressable>

          {selectedPost.is_institutional_highlight && (
            <View style={{ backgroundColor: '#DBEAFE', borderRadius: 6, padding: 6, marginBottom: 6 }}>
              <Text style={{ color: '#1D4ED8', fontSize: 12, fontWeight: '600' }}>⭐ Destaque Institucional</Text>
            </View>
          )}
          {selectedPost.is_pinned && !selectedPost.is_institutional_highlight && (
            <View style={{ backgroundColor: '#FEF9C3', borderRadius: 6, padding: 6, marginBottom: 6 }}>
              <Text style={{ color: '#92400E', fontSize: 12 }}>📌 Fixado</Text>
            </View>
          )}

          {editingPostId === selectedPost.id ? (
            <View>
              <TextInput value={editTitle} onChangeText={setEditTitle}
                style={{ borderWidth: 1, borderColor: '#D1D5DB', borderRadius: 8, padding: 8, marginBottom: 6, fontSize: 16, fontWeight: '600' }} />
              <TextInput value={editBody} onChangeText={setEditBody} multiline
                style={{ borderWidth: 1, borderColor: '#D1D5DB', borderRadius: 8, padding: 8, minHeight: 80, marginBottom: 8 }} />
              {formError && <Text style={{ color: '#DC2626', fontSize: 12, marginBottom: 6 }}>{formError}</Text>}
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <Pressable onPress={() => { setEditingPostId(null); setFormError(null); }}
                  style={{ flex: 1, padding: 10, borderRadius: 8, borderWidth: 1, borderColor: '#D1D5DB', alignItems: 'center' }}>
                  <Text>Cancelar</Text>
                </Pressable>
                <Pressable onPress={handleSaveEditPost} disabled={submitting}
                  style={{ flex: 1, padding: 10, borderRadius: 8, backgroundColor: submitting ? '#C4B5FD' : '#7C3AED', alignItems: 'center' }}>
                  <Text style={{ color: '#fff' }}>{submitting ? 'Salvando...' : 'Salvar'}</Text>
                </Pressable>
              </View>
            </View>
          ) : (
            <View>
              <Text style={{ fontSize: 20, fontWeight: '700', marginBottom: 4 }}>{selectedPost.title}</Text>
              <Text style={{ color: '#6B7280', fontSize: 12, marginBottom: 4 }}>
                {selectedPost.author_name} · {new Date(selectedPost.created_at).toLocaleDateString('pt-BR')}
                {selectedPost.edited_at ? ' · editado' : ''}
              </Text>
              <Text style={{ fontSize: 15, lineHeight: 22, marginBottom: 8 }}>{selectedPost.body}</Text>
              <View style={{ flexDirection: 'row', gap: 6, marginBottom: 16, flexWrap: 'wrap' }}>
                {canEditPost && (
                  <Pressable onPress={() => { setEditingPostId(selectedPost.id); setEditTitle(selectedPost.title); setEditBody(selectedPost.body); }}
                    style={{ paddingHorizontal: 10, paddingVertical: 4, backgroundColor: '#EDE9FE', borderRadius: 12 }}>
                    <Text style={{ color: '#7C3AED', fontSize: 12 }}>Editar</Text>
                  </Pressable>
                )}
                {settings?.can_moderate && (
                  <>
                    <Pressable onPress={() => handleTogglePin(selectedPost.id)}
                      style={{ paddingHorizontal: 10, paddingVertical: 4, backgroundColor: '#FEF9C3', borderRadius: 12 }}>
                      <Text style={{ color: '#92400E', fontSize: 12 }}>{selectedPost.is_pinned ? 'Desafixar' : 'Fixar'}</Text>
                    </Pressable>
                    <Pressable onPress={() => handleToggleHighlight(selectedPost.id)}
                      style={{ paddingHorizontal: 10, paddingVertical: 4, backgroundColor: '#DBEAFE', borderRadius: 12 }}>
                      <Text style={{ color: '#1D4ED8', fontSize: 12 }}>{selectedPost.is_institutional_highlight ? 'Remover destaque' : 'Destacar'}</Text>
                    </Pressable>
                    <Pressable onPress={() => handleDeletePost(selectedPost.id)}
                      style={{ paddingHorizontal: 10, paddingVertical: 4, backgroundColor: '#FEE2E2', borderRadius: 12 }}>
                      <Text style={{ color: '#DC2626', fontSize: 12 }}>Remover</Text>
                    </Pressable>
                  </>
                )}
              </View>
            </View>
          )}

          <View style={{ height: 1, backgroundColor: '#E5E7EB', marginVertical: 12 }} />
          <Text style={{ fontWeight: '600', marginBottom: 12 }}>
            {selectedPost.replies.length} resposta{selectedPost.replies.length !== 1 ? 's' : ''}
          </Text>

          {selectedPost.replies.map((r) => {
            const isAuthorReply = r.author_user_id === currentUserId;
            const canEditReply = isAuthorReply || (settings?.can_moderate ?? false);
            return (
              <View key={r.id} style={{ borderLeftWidth: 3, borderLeftColor: '#7C3AED', paddingLeft: 12, marginBottom: 16 }}>
                {editingReplyId === r.id ? (
                  <View>
                    <TextInput value={editReplyBody} onChangeText={setEditReplyBody} multiline
                      style={{ borderWidth: 1, borderColor: '#D1D5DB', borderRadius: 8, padding: 8, minHeight: 60, marginBottom: 6 }} />
                    <View style={{ flexDirection: 'row', gap: 6 }}>
                      <Pressable onPress={() => setEditingReplyId(null)} style={{ padding: 6, borderRadius: 6, borderWidth: 1, borderColor: '#D1D5DB' }}>
                        <Text style={{ fontSize: 12 }}>Cancelar</Text>
                      </Pressable>
                      <Pressable onPress={handleSaveEditReply} disabled={submitting} style={{ padding: 6, borderRadius: 6, backgroundColor: '#7C3AED' }}>
                        <Text style={{ color: '#fff', fontSize: 12 }}>{submitting ? '...' : 'Salvar'}</Text>
                      </Pressable>
                    </View>
                  </View>
                ) : (
                  <View>
                    <Text style={{ fontWeight: '600', fontSize: 13 }}>{r.author_name}</Text>
                    <Text style={{ color: '#6B7280', fontSize: 11, marginBottom: 2 }}>
                      {new Date(r.created_at).toLocaleDateString('pt-BR')}{r.edited_at ? ' · editado' : ''}
                    </Text>
                    <Text style={{ fontSize: 14, marginBottom: 4 }}>{r.body}</Text>
                    <View style={{ flexDirection: 'row', gap: 6 }}>
                      {canEditReply && (
                        <Pressable onPress={() => { setEditingReplyId(r.id); setEditReplyBody(r.body); }}
                          style={{ paddingHorizontal: 8, paddingVertical: 2, backgroundColor: '#EDE9FE', borderRadius: 10 }}>
                          <Text style={{ color: '#7C3AED', fontSize: 11 }}>Editar</Text>
                        </Pressable>
                      )}
                      {settings?.can_moderate && (
                        <Pressable onPress={() => handleDeleteReply(r.id)}
                          style={{ paddingHorizontal: 8, paddingVertical: 2, backgroundColor: '#FEE2E2', borderRadius: 10 }}>
                          <Text style={{ color: '#DC2626', fontSize: 11 }}>Remover</Text>
                        </Pressable>
                      )}
                    </View>
                  </View>
                )}
              </View>
            );
          })}

          {replyError && (
            <View style={{ backgroundColor: '#FEE2E2', padding: 8, borderRadius: 6, marginBottom: 8 }}>
              <Text style={{ color: '#DC2626', fontSize: 13 }}>{replyError}</Text>
            </View>
          )}
          <TextInput value={replyBody} onChangeText={setReplyBody} placeholder="Escreva uma resposta..." multiline
            style={{ borderWidth: 1, borderColor: '#D1D5DB', borderRadius: 8, padding: 10, minHeight: 80, fontSize: 14, marginBottom: 8 }} />
          <Pressable onPress={handleCreateReply} disabled={submitting}
            style={{ backgroundColor: submitting ? '#C4B5FD' : '#7C3AED', padding: 12, borderRadius: 8, alignItems: 'center', marginBottom: 32 }}>
            <Text style={{ color: '#fff', fontWeight: '600' }}>{submitting ? 'Enviando...' : 'Responder'}</Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    );
  }

  // ── POST LIST ────────────────────────────────────────────────────────────────
  return (
    <View style={{ flex: 1, backgroundColor: '#F9FAFB' }}>
      <FlatList
        data={posts}
        keyExtractor={(item) => item.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadList(); }} />}
        contentContainerStyle={{ padding: 16 }}
        ListEmptyComponent={
          <Text style={{ textAlign: 'center', color: '#9CA3AF', marginTop: 40 }}>Nenhum post ainda.</Text>
        }
        renderItem={({ item }) => (
          <Pressable onPress={() => openPost(item)}
            style={{
              backgroundColor: '#fff', borderRadius: 12, padding: 16, marginBottom: 12,
              shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 4, elevation: 2,
              borderLeftWidth: item.is_institutional_highlight ? 4 : 0,
              borderLeftColor: '#7C3AED',
            }}>
            {item.is_institutional_highlight && (
              <Text style={{ color: '#1D4ED8', fontSize: 11, fontWeight: '600', marginBottom: 4 }}>⭐ Destaque Institucional</Text>
            )}
            {item.is_pinned && !item.is_institutional_highlight && (
              <Text style={{ color: '#92400E', fontSize: 11, marginBottom: 4 }}>📌 Fixado</Text>
            )}
            <Text style={{ fontSize: 16, fontWeight: '600', marginBottom: 4 }}>{item.title}</Text>
            <Text style={{ color: '#6B7280', fontSize: 12 }}>
              {item.author_name} · {new Date(item.created_at).toLocaleDateString('pt-BR')} · {item.reply_count} resposta{item.reply_count !== 1 ? 's' : ''}
              {item.edited_at ? ' · editado' : ''}
            </Text>
          </Pressable>
        )}
      />

      {showNewPost && (
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={{ padding: 16, backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#E5E7EB' }}>
            {formError && (
              <View style={{ backgroundColor: '#FEE2E2', padding: 8, borderRadius: 6, marginBottom: 8 }}>
                <Text style={{ color: '#DC2626', fontSize: 13 }}>{formError}</Text>
              </View>
            )}
            <TextInput value={postTitle} onChangeText={setPostTitle} placeholder="Título"
              style={{ borderWidth: 1, borderColor: '#D1D5DB', borderRadius: 8, padding: 10, marginBottom: 8 }} />
            <TextInput value={postBody} onChangeText={setPostBody} placeholder="Mensagem..." multiline
              style={{ borderWidth: 1, borderColor: '#D1D5DB', borderRadius: 8, padding: 10, minHeight: 80, marginBottom: 8 }} />
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <Pressable onPress={() => { setShowNewPost(false); setFormError(null); setPostTitle(''); setPostBody(''); }}
                style={{ flex: 1, padding: 12, borderRadius: 8, borderWidth: 1, borderColor: '#D1D5DB', alignItems: 'center' }}>
                <Text>Cancelar</Text>
              </Pressable>
              <Pressable onPress={handleCreatePost} disabled={submitting}
                style={{ flex: 1, backgroundColor: submitting ? '#C4B5FD' : '#7C3AED', padding: 12, borderRadius: 8, alignItems: 'center' }}>
                <Text style={{ color: '#fff', fontWeight: '600' }}>{submitting ? 'Publicando...' : 'Publicar'}</Text>
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      )}

      {!showNewPost && settings?.can_post && (
        <Pressable onPress={() => setShowNewPost(true)}
          style={{
            position: 'absolute', bottom: 24, right: 24,
            backgroundColor: '#7C3AED', width: 56, height: 56,
            borderRadius: 28, alignItems: 'center', justifyContent: 'center',
            shadowColor: '#7C3AED', shadowOpacity: 0.4, shadowRadius: 8, elevation: 6,
          }}>
          <Text style={{ color: '#fff', fontSize: 28, lineHeight: 32 }}>+</Text>
        </Pressable>
      )}
    </View>
  );
}
