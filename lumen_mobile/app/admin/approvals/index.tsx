/**
 * Admin — Fila de Aprovações
 * ===========================
 * Exibe exportações pendentes de aprovação.
 * Acessível para DEV, ADMIN e COUNCIL_GENERAL.
 */

import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  ActivityIndicator, RefreshControl, Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { adminExportService, ExportRequest } from '@/services';
import { useTheme } from '@/theme';
import type { SemanticTokens } from '@/theme';

const ADMIN_COLOR = '#7c3aed';

export default function ApprovalsScreen() {
  const { t } = useTheme();
  const styles = makeStyles(t);

  const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
    PENDING:   { label: 'Pendente',  color: t.status.warning },
    APPROVED:  { label: 'Aprovado',  color: t.status.success },
    REJECTED:  { label: 'Rejeitado', color: t.status.error   },
    GENERATED: { label: 'Pronto',    color: t.status.success },
    EXPIRED:   { label: 'Expirado',  color: t.text.secondary },
  };

  const [requests, setRequests] = useState<ExportRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchRequests = useCallback(async () => {
    try {
      const data = await adminExportService.listRequests();
      setRequests(data);
    } catch {
      // silently fail
    }
  }, []);

  useEffect(() => {
    fetchRequests().finally(() => setLoading(false));
  }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchRequests();
    setRefreshing(false);
  }, [fetchRequests]);

  const handleApprove = (req: ExportRequest) => {
    Alert.alert(
      'Aprovar exportação?',
      `Campos: ${req.fields_requested.join(', ')}`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Aprovar',
          onPress: async () => {
            try {
              await adminExportService.approve(req.id);
              await fetchRequests();
            } catch (e: any) {
              Alert.alert('Erro', e?.response?.data?.detail?.message ?? 'Erro ao aprovar');
            }
          },
        },
      ]
    );
  };

  const handleReject = (req: ExportRequest) => {
    Alert.alert(
      'Rejeitar exportação?',
      'Esta ação não pode ser desfeita.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Rejeitar',
          style: 'destructive',
          onPress: async () => {
            try {
              await adminExportService.reject(req.id);
              await fetchRequests();
            } catch (e: any) {
              Alert.alert('Erro', e?.response?.data?.detail?.message ?? 'Erro ao rejeitar');
            }
          },
        },
      ]
    );
  };

  const renderItem = ({ item }: { item: ExportRequest }) => {
    const status = STATUS_CONFIG[item.status] ?? { label: item.status, color: t.text.secondary };
    return (
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={[styles.statusBadge, { borderColor: status.color }]}>
            <Text style={[styles.statusText, { color: status.color }]}>{status.label}</Text>
          </View>
          {item.has_sensitive && (
            <View style={styles.sensitiveBadge}>
              <Ionicons name="lock-closed-outline" size={12} color={t.status.error} />
              <Text style={styles.sensitiveText}>Dados sensíveis</Text>
            </View>
          )}
          <Text style={styles.date}>{new Date(item.created_at).toLocaleDateString('pt-BR')}</Text>
        </View>
        <Text style={styles.fields}>Campos: {item.fields_requested.join(', ')}</Text>
        {item.status === 'PENDING' && (
          <View style={styles.actions}>
            <TouchableOpacity style={styles.rejectBtn} onPress={() => handleReject(item)}>
              <Text style={styles.rejectBtnText}>Rejeitar</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.approveBtn} onPress={() => handleApprove(item)}>
              <Text style={styles.approveBtnText}>Aprovar</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    );
  };

  if (loading) {
    return <View style={styles.center}><ActivityIndicator size="large" color={ADMIN_COLOR} /></View>;
  }

  const pending = requests.filter((r) => r.status === 'PENDING');

  return (
    <View style={styles.container}>
      {pending.length > 0 && (
        <View style={styles.banner}>
          <Ionicons name="alert-circle-outline" size={18} color={t.status.warning} />
          <Text style={styles.bannerText}>
            {pending.length} exportação{pending.length !== 1 ? 'ões' : ''} aguardando aprovação
          </Text>
        </View>
      )}
      <FlatList
        data={requests}
        keyExtractor={(r) => r.id}
        renderItem={renderItem}
        contentContainerStyle={{ padding: 12, paddingBottom: 32 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        ListEmptyComponent={
          <View style={styles.center}>
            <Ionicons name="checkmark-circle-outline" size={40} color={t.text.secondary} />
            <Text style={{ color: t.text.secondary, marginTop: 8 }}>Nenhuma solicitação</Text>
          </View>
        }
      />
    </View>
  );
}

const makeStyles = (t: SemanticTokens) => StyleSheet.create({
  container: { flex: 1, backgroundColor: t.bg.elevated },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40 },
  banner: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: t.status.warningBg, padding: 12,
    borderBottomWidth: 1, borderBottomColor: t.border.subtle,
  },
  bannerText: { fontSize: 13, color: t.status.warning, fontWeight: '600' },
  card: { backgroundColor: t.bg.screen, borderRadius: 12, padding: 14, marginBottom: 10 },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  statusBadge: { borderWidth: 1, borderRadius: 20, paddingHorizontal: 8, paddingVertical: 3 },
  statusText: { fontSize: 11, fontWeight: '700' },
  sensitiveBadge: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  sensitiveText: { fontSize: 11, color: t.status.error },
  date: { marginLeft: 'auto', fontSize: 11, color: t.text.secondary },
  fields: { fontSize: 13, color: t.text.secondary, marginBottom: 10 },
  actions: { flexDirection: 'row', gap: 10 },
  rejectBtn: {
    flex: 1, borderWidth: 2, borderColor: t.status.error,
    borderRadius: 8, paddingVertical: 10, alignItems: 'center',
  },
  rejectBtnText: { color: t.status.error, fontWeight: '700' },
  approveBtn: {
    flex: 1, backgroundColor: ADMIN_COLOR,
    borderRadius: 8, paddingVertical: 10, alignItems: 'center',
  },
  approveBtnText: { color: t.text.inverse, fontWeight: '700' },
});
