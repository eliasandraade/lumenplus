/**
 * Projeto de Vida — Histórico de Ciclos
 * Lógica intacta. Redesign "Caderno de Oração".
 */

import { useState, useCallback } from 'react';
import {
  View, Text, FlatList,
  TouchableOpacity, ActivityIndicator, RefreshControl, StyleSheet,
} from 'react-native';
import type { Href } from 'expo-router';
import { router, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import projetoVidaMensalApi, {
  type ProjetoVidaMensalSummary,
  MESES,
} from '@/services/projetoVidaMensal';
import { useTheme } from '@/theme';

export default function HistoricoScreen() {
  const { t, r } = useTheme();
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
      <View style={[styles.centered, { backgroundColor: t.bg.screen }]}>
        <ActivityIndicator size="large" color={t.brand.primary} />
      </View>
    );
  }

  if (projetos.length === 0) {
    return (
      <View style={[styles.centered, { backgroundColor: t.bg.screen }]}>
        <Ionicons name="compass-outline" size={48} color={t.text.tertiary} />
        <Text style={[styles.emptyTitle, { color: t.text.primary }]}>
          Nenhum ciclo ainda
        </Text>
        <Text style={[styles.emptySubtitle, { color: t.text.secondary }]}>
          O primeiro passo é sempre o mais sagrado.
        </Text>
        <TouchableOpacity
          style={[styles.startButton, { backgroundColor: t.brand.primary, borderRadius: r.lg }]}
          onPress={() => router.replace('/vida' as Href)}
          accessibilityLabel="Ir para Projeto de Vida"
          accessibilityRole="button"
        >
          <Text style={styles.startButtonText}>Ir para Projeto de Vida</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <FlatList
      style={{ flex: 1, backgroundColor: t.bg.screen }}
      contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
      data={projetos}
      keyExtractor={(item) => item.id}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          colors={[t.brand.primary]}
        />
      }
      ListHeaderComponent={
        <Text style={[styles.headerTitle, { color: t.text.tertiary }]}>
          {projetos.length} ciclo{projetos.length !== 1 ? 's' : ''} registrado{projetos.length !== 1 ? 's' : ''}
        </Text>
      }
      renderItem={({ item }) => (
        <TouchableOpacity
          style={[
            styles.cycleCard,
            {
              backgroundColor: t.bg.elevated,
              borderColor: t.border.subtle,
              borderRadius: r.lg,
              ...t.shadow.sm,
            },
          ]}
          onPress={() => handleOpen(item)}
          activeOpacity={0.8}
          accessibilityLabel={`Ciclo de ${MESES[item.mes - 1]} ${item.ano}`}
          accessibilityRole="button"
        >
          <View style={styles.cardTop}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.cardMonth, { color: t.text.primary }]}>
                {MESES[item.mes - 1]}
              </Text>
              <Text style={[styles.cardYear, { color: t.text.tertiary }]}>
                {item.ano}
              </Text>
            </View>
            <View style={styles.badges}>
              {item.has_pin && (
                <Ionicons name="lock-closed" size={14} color={t.text.tertiary} />
              )}
              {item.concluido && (
                <View style={[styles.badge, { backgroundColor: t.brand.primaryDim, borderRadius: r.full }]}>
                  <Ionicons name="checkmark-circle" size={12} color={t.brand.primary} />
                  <Text style={[styles.badgeText, { color: t.brand.primary }]}>Concluído</Text>
                </View>
              )}
            </View>
            <Ionicons name="chevron-forward" size={16} color={t.text.tertiary} />
          </View>
        </TouchableOpacity>
      )}
    />
  );
}

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    gap: 12,
  },
  emptyTitle: {
    fontSize: 18,
    fontFamily: 'Nunito-Bold',
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 14,
    fontFamily: 'Nunito-Italic',
    textAlign: 'center',
    lineHeight: 22,
  },
  startButton: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    marginTop: 8,
  },
  startButtonText: {
    color: '#ffffff',
    fontSize: 15,
    fontFamily: 'Nunito-SemiBold',
  },
  headerTitle: {
    fontSize: 12,
    fontFamily: 'Nunito-Regular',
    marginBottom: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  cycleCard: {
    padding: 16,
    marginBottom: 10,
    borderWidth: StyleSheet.hairlineWidth,
  },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  cardMonth: {
    fontSize: 16,
    fontFamily: 'Nunito-Bold',
  },
  cardYear: {
    fontSize: 13,
    fontFamily: 'Nunito-Regular',
    marginTop: 1,
  },
  badges: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 3,
    gap: 4,
  },
  badgeText: {
    fontSize: 11,
    fontFamily: 'Nunito-SemiBold',
  },
});
