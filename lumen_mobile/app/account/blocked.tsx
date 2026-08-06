/**
 * Usuários bloqueados
 * ===================
 * Gate das lojas: além de poder bloquear, o usuário precisa conseguir VER e
 * DESFAZER seus bloqueios. Sem isso o bloqueio vira uma via de mão única.
 */

import { useCallback, useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  ActivityIndicator, RefreshControl, Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import moderationService, { type BlockedUser } from '@/services/moderation';
import { useTheme } from '@/theme';
import type { SemanticTokens } from '@/theme';
import { showAlert, showConfirm } from '@/utils/alerts';

export default function BlockedUsersScreen() {
  const { t } = useTheme();
  const s = styles(t);
  const [items, setItems] = useState<BlockedUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await moderationService.listBlocked();
      setItems(data.blocks ?? []);
    } catch {
      showAlert('Não foi possível carregar', 'Verifique sua conexão e tente novamente.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const unblock = useCallback(
    async (user: BlockedUser) => {
      const ok = await showConfirm({
        title: 'Desbloquear',
        message: `Você voltará a ver as publicações de ${user.name || 'este usuário'}, e ele as suas.`,
        confirmText: 'Desbloquear',
      });
      if (!ok) return;
      try {
        await moderationService.unblock(user.user_id);
        setItems((prev) => prev.filter((i) => i.user_id !== user.user_id));
      } catch {
        showAlert('Não foi possível desbloquear', 'Tente novamente em instantes.');
      }
    },
    []
  );

  return (
    <View style={s.container}>
      <View style={s.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={s.backBtn}
          accessibilityRole="button"
          accessibilityLabel="Voltar"
        >
          <Ionicons name="arrow-back" size={24} color={t.text.primary} />
        </TouchableOpacity>
        <Text style={s.title} accessibilityRole="header">Usuários bloqueados</Text>
      </View>

      {loading ? (
        <ActivityIndicator style={{ marginTop: 40 }} color={t.brand.primary} />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(i) => i.user_id}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                load();
              }}
            />
          }
          ListEmptyComponent={
            <View style={s.empty}>
              <Ionicons name="shield-checkmark-outline" size={40} color={t.text.secondary} />
              <Text style={s.emptyTitle}>Nenhum usuário bloqueado</Text>
              <Text style={s.emptyText}>
                Quando você bloquear alguém, as publicações e respostas dessa pessoa deixam de
                aparecer para você — e as suas para ela.
              </Text>
            </View>
          }
          renderItem={({ item }) => (
            <View style={s.row}>
              <View style={s.avatar}>
                <Text style={s.avatarText}>
                  {(item.name || '?').trim().charAt(0).toUpperCase()}
                </Text>
              </View>
              <Text style={s.name} numberOfLines={1}>
                {item.name || 'Usuário'}
              </Text>
              <TouchableOpacity
                onPress={() => unblock(item)}
                style={s.unblockBtn}
                accessibilityRole="button"
                accessibilityLabel={`Desbloquear ${item.name || 'usuário'}`}
              >
                <Text style={s.unblockText}>Desbloquear</Text>
              </TouchableOpacity>
            </View>
          )}
        />
      )}
    </View>
  );
}

const styles = (t: SemanticTokens) => StyleSheet.create({
  container: { flex: 1, backgroundColor: t.bg.screen },
  header: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 16, paddingTop: Platform.OS === 'ios' ? 60 : 24, paddingBottom: 16,
  },
  backBtn: { padding: 4, minWidth: 44, minHeight: 44, justifyContent: 'center' },
  title: { fontSize: 22, fontFamily: 'Nunito-Bold', color: t.text.primary, flex: 1 },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: t.border.subtle,
  },
  avatar: {
    width: 40, height: 40, borderRadius: 20,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: t.brand.primaryDim,
  },
  avatarText: { fontFamily: 'Nunito-Bold', fontSize: 16, color: t.brand.primary },
  name: { flex: 1, fontSize: 16, fontFamily: 'Nunito-Regular', color: t.text.primary },
  unblockBtn: {
    paddingHorizontal: 14, paddingVertical: 9, borderRadius: 999, minHeight: 40,
    justifyContent: 'center',
    borderWidth: 1, borderColor: t.brand.primary,
  },
  unblockText: { fontSize: 13, fontFamily: 'Nunito-Bold', color: t.brand.primary },
  empty: { alignItems: 'center', paddingHorizontal: 32, paddingTop: 60, gap: 10 },
  emptyTitle: { fontSize: 17, fontFamily: 'Nunito-Bold', color: t.text.primary },
  emptyText: {
    fontSize: 14, fontFamily: 'Nunito-Regular', color: t.text.secondary,
    textAlign: 'center', lineHeight: 20,
  },
});
