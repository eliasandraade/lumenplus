/**
 * Projeto de Vida — Histórico de Ciclos
 * =======================================
 * Lista todos os ciclos mensais do usuário.
 */

import { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList,
  TouchableOpacity, ActivityIndicator, RefreshControl,
} from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import projetoVidaMensalApi, {
  type ProjetoVidaMensalSummary,
  MESES,
} from '@/services/projetoVidaMensal';

const colors = {
  primary: '#1A859B',
  primaryLight: '#E8F4F7',
  white: '#ffffff',
  gray: '#6b7280',
  lightGray: '#f3f4f6',
  dark: '#171717',
  border: '#e5e7eb',
};

export default function HistoricoScreen() {
  const [projetos, setProjetos] = useState<ProjetoVidaMensalSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchHistorico = async () => {
    try {
      const result = await projetoVidaMensalApi.getHistorico();
      setProjetos(result);
    } catch {
      setProjetos([]);
    }
  };

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      fetchHistorico().finally(() => setLoading(false));
    }, [])
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchHistorico();
    setRefreshing(false);
  }, []);

  const handleOpen = (item: ProjetoVidaMensalSummary) => {
    if (item.has_pin) {
      router.push({ pathname: '/vida/unlock', params: { projetoId: item.id } });
    } else {
      router.push({ pathname: '/vida/ciclo', params: { projetoId: item.id } });
    }
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (projetos.length === 0) {
    return (
      <View style={styles.centered}>
        <Ionicons name="time-outline" size={48} color={colors.gray} />
        <Text style={styles.emptyTitle}>Nenhum ciclo encontrado</Text>
        <Text style={styles.emptySubtitle}>Crie seu primeiro Projeto de Vida Mensal</Text>
        <TouchableOpacity style={styles.startButton} onPress={() => router.replace('/vida')}>
          <Text style={styles.startButtonText}>Ir para Projeto de Vida</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <FlatList
      style={styles.container}
      contentContainerStyle={styles.content}
      data={projetos}
      keyExtractor={(item) => item.id}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.primary]} />
      }
      ListHeaderComponent={
        <Text style={styles.headerTitle}>
          {projetos.length} ciclo{projetos.length !== 1 ? 's' : ''} registrado{projetos.length !== 1 ? 's' : ''}
        </Text>
      }
      renderItem={({ item }) => (
        <TouchableOpacity
          style={styles.cycleCard}
          onPress={() => handleOpen(item)}
          activeOpacity={0.8}
        >
          <View style={styles.cardTop}>
            <Text style={styles.cardMonth}>
              {MESES[item.mes - 1]} {item.ano}
            </Text>
            <View style={styles.badges}>
              {item.has_pin && (
                <Ionicons name="lock-closed" size={14} color={colors.gray} />
              )}
              {item.concluido && (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>Concluído</Text>
                </View>
              )}
            </View>
          </View>

          <Ionicons name="chevron-forward" size={16} color={colors.gray} style={styles.chevron} />
        </TouchableOpacity>
      )}
    />
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.lightGray },
  content: { padding: 16, paddingBottom: 32 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  headerTitle: { fontSize: 13, color: colors.gray, marginBottom: 12 },
  emptyTitle: { fontSize: 18, fontWeight: '600', color: colors.dark, marginTop: 12 },
  emptySubtitle: { fontSize: 14, color: colors.gray, marginTop: 4, marginBottom: 20 },
  startButton: { backgroundColor: colors.primary, borderRadius: 10, paddingVertical: 12, paddingHorizontal: 24 },
  startButtonText: { color: colors.white, fontSize: 15, fontWeight: '600' },
  cycleCard: { backgroundColor: colors.white, borderRadius: 12, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: colors.border },
  cardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 },
  cardMonth: { fontSize: 16, fontWeight: '700', color: colors.dark },
  badges: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  badge: { backgroundColor: colors.primaryLight, borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2 },
  badgeText: { fontSize: 11, color: colors.primary, fontWeight: '600' },
  chevron: { position: 'absolute', right: 14, top: 20 },
});
