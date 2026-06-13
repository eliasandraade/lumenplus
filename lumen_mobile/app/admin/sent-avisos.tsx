/**
 * Sent Avisos Screen
 * ==================
 * Histórico de avisos enviados pelo usuário.
 */

import { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import type { IoniconsName } from '@/types/icons';
import api from '@/services/api';
import { useTheme } from '@/theme';
import type { SemanticTokens } from '@/theme';

const ADMIN_COLOR = '#7c3aed';

interface SentAviso {
  id: string;
  title: string;
  message: string;
  type: string;
  created_at: string;
  expires_at: string;
  recipient_count: number;
  read_count: number;
  filters: Record<string, string[]> | null;
  sent_to_all: boolean;
  target_org_unit_name: string | null;
  created_by_name: string | null;
}

interface SentAvisosResponse {
  messages: SentAviso[];
}

export default function SentAvisosScreen() {
  const { t } = useTheme();
  const styles = makeStyles(t);

  const [avisos, setAvisos] = useState<SentAviso[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadAvisos();
  }, []);

  const loadAvisos = async () => {
    try {
      const response = await api.get<SentAvisosResponse>('/inbox/sent');
      setAvisos(response.messages || []);
    } catch {
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadAvisos();
    setRefreshing(false);
  }, []);

  const getTypeConfig = (type: string) => {
    switch (type) {
      case 'urgent':  return { icon: 'alert-circle',        color: t.status.error,   label: 'Urgente' };
      case 'warning': return { icon: 'warning',             color: t.status.warning, label: 'Atenção' };
      case 'success': return { icon: 'checkmark-circle',    color: t.status.success, label: 'Confirmação' };
      default:        return { icon: 'information-circle',  color: t.status.info,    label: 'Informativo' };
    }
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  };

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getDestinationLabel = (aviso: SentAviso): string => {
    if (aviso.target_org_unit_name) return aviso.target_org_unit_name;
    if (aviso.sent_to_all) return 'Todos os membros';
    if (aviso.filters) {
      const parts: string[] = [];
      if (aviso.filters.vocational_reality_codes?.length) parts.push(`Vocação: ${aviso.filters.vocational_reality_codes.join(', ')}`);
      if (aviso.filters.life_state_codes?.length) parts.push(`Estado de vida: ${aviso.filters.life_state_codes.join(', ')}`);
      if (aviso.filters.marital_status_codes?.length) parts.push(`Estado civil: ${aviso.filters.marital_status_codes.join(', ')}`);
      if (aviso.filters.states?.length) parts.push(`UF: ${aviso.filters.states.join(', ')}`);
      if (aviso.filters.cities?.length) parts.push(`Cidade: ${aviso.filters.cities.join(', ')}`);
      return parts.length > 0 ? parts.join(' • ') : 'Filtros personalizados';
    }
    return '—';
  };

  const getDestinationIcon = (aviso: SentAviso): string => {
    if (aviso.target_org_unit_name) return 'business-outline';
    if (aviso.sent_to_all) return 'globe-outline';
    return 'filter-outline';
  };

  const renderAviso = ({ item }: { item: SentAviso }) => {
    const typeConfig = getTypeConfig(item.type);
    const readPercentage = item.recipient_count > 0
      ? Math.round((item.read_count / item.recipient_count) * 100)
      : 0;

    return (
      <View style={styles.avisoCard}>
        {/* Header: tipo + título + data/hora */}
        <View style={styles.cardHeader}>
          <View style={[styles.typeIconBadge, { backgroundColor: `${typeConfig.color}18` }]}>
            <Ionicons name={typeConfig.icon as IoniconsName} size={22} color={typeConfig.color} />
          </View>
          <View style={styles.headerInfo}>
            <Text style={styles.avisoTitle} numberOfLines={1}>{item.title}</Text>
            <View style={styles.dateRow}>
              <Ionicons name="calendar-outline" size={12} color={t.text.secondary} />
              <Text style={styles.dateMeta}>{formatDate(item.created_at)}</Text>
              <Ionicons name="time-outline" size={12} color={t.text.secondary} style={{ marginLeft: 6 }} />
              <Text style={styles.dateMeta}>{formatTime(item.created_at)}</Text>
            </View>
          </View>
          <View style={[styles.typeBadge, { backgroundColor: `${typeConfig.color}18` }]}>
            <Text style={[styles.typeBadgeText, { color: typeConfig.color }]}>{typeConfig.label}</Text>
          </View>
        </View>

        {/* Texto do aviso */}
        <Text style={styles.avisoMessage} numberOfLines={2}>{item.message}</Text>

        {/* Divisor */}
        <View style={styles.divider} />

        {/* Detalhes: quem enviou, para quem */}
        <View style={styles.detailsGrid}>
          <View style={styles.detailRow}>
            <Ionicons name="person-circle-outline" size={15} color={ADMIN_COLOR} />
            <Text style={styles.detailLabel}>Enviado por</Text>
            <Text style={styles.detailValue} numberOfLines={1}>
              {item.created_by_name || 'Você'}
            </Text>
          </View>
          <View style={styles.detailRow}>
            <Ionicons name={getDestinationIcon(item) as IoniconsName} size={15} color={ADMIN_COLOR} />
            <Text style={styles.detailLabel}>Para</Text>
            <Text style={styles.detailValue} numberOfLines={2}>
              {getDestinationLabel(item)}
            </Text>
          </View>
        </View>

        {/* Divisor */}
        <View style={styles.divider} />

        {/* Stats de leitura */}
        <View style={styles.statsRow}>
          <View style={styles.stat}>
            <Ionicons name="people-outline" size={14} color={t.text.secondary} />
            <Text style={styles.statText}>{item.recipient_count} destinatários</Text>
          </View>
          <View style={styles.stat}>
            <Ionicons name="eye-outline" size={14} color={t.text.secondary} />
            <Text style={styles.statText}>{item.read_count} leram ({readPercentage}%)</Text>
          </View>
        </View>

        {/* Barra de leitura */}
        <View style={styles.progressContainer}>
          <View style={[styles.progressBar, { width: `${readPercentage}%` as any }]} />
        </View>
      </View>
    );
  };

  const renderEmpty = () => (
    <View style={styles.emptyContainer}>
      <View style={styles.emptyIconContainer}>
        <Ionicons name="paper-plane-outline" size={64} color={ADMIN_COLOR} />
      </View>
      <Text style={styles.emptyTitle}>Nenhum aviso enviado</Text>
      <Text style={styles.emptyMessage}>
        Os avisos que você enviar aparecerão aqui.
      </Text>
    </View>
  );

  if (loading) {
    return (
      <>
        <Stack.Screen options={{ title: 'Avisos Enviados' }} />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={ADMIN_COLOR} />
        </View>
      </>
    );
  }

  return (
    <>
      <Stack.Screen options={{ title: 'Avisos Enviados' }} />

      <FlatList
        data={avisos}
        renderItem={renderAviso}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[ADMIN_COLOR]} />
        }
        ListEmptyComponent={renderEmpty}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
      />
    </>
  );
}

const makeStyles = (t: SemanticTokens) => StyleSheet.create({
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: t.bg.elevated },
  listContent: { padding: 16, flexGrow: 1, backgroundColor: t.bg.elevated },
  separator: { height: 12 },

  avisoCard: { backgroundColor: t.bg.screen, borderRadius: 14, padding: 16 },

  // Header
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  typeIconBadge: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  headerInfo: { flex: 1 },
  avisoTitle: { fontSize: 15, fontWeight: '700', color: t.text.primary, marginBottom: 2 },
  dateRow: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  dateMeta: { fontSize: 12, color: t.text.secondary },
  typeBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  typeBadgeText: { fontSize: 11, fontWeight: '600' },

  // Mensagem
  avisoMessage: { fontSize: 13, color: t.text.secondary, lineHeight: 19, marginBottom: 12 },

  // Divisor
  divider: { height: 1, backgroundColor: t.bg.elevated, marginBottom: 10 },

  // Detalhes
  detailsGrid: { gap: 6, marginBottom: 10 },
  detailRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 6 },
  detailLabel: { fontSize: 12, color: t.text.secondary, minWidth: 72 },
  detailValue: { flex: 1, fontSize: 12, color: t.text.primary, fontWeight: '500' },

  // Stats
  statsRow: { flexDirection: 'row', gap: 16, marginBottom: 8 },
  stat: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  statText: { fontSize: 12, color: t.text.secondary },

  // Barra de progresso
  progressContainer: { height: 4, backgroundColor: t.border.subtle, borderRadius: 2, overflow: 'hidden' },
  progressBar: { height: '100%', backgroundColor: t.status.success, borderRadius: 2 },

  // Empty state
  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32, marginTop: 60 },
  emptyIconContainer: { width: 120, height: 120, borderRadius: 60, backgroundColor: `${ADMIN_COLOR}15`, alignItems: 'center', justifyContent: 'center', marginBottom: 24 },
  emptyTitle: { fontSize: 20, fontWeight: '600', color: t.text.primary, marginBottom: 8 },
  emptyMessage: { fontSize: 14, color: t.text.secondary, textAlign: 'center' },
});
