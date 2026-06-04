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

const colors = { admin: '#7c3aed', white: '#fff', gray: '#6b7280', lightGray: '#E8E8E8', text: '#171717', danger: '#dc2626', success: '#16a34a', warning: '#d97706' };

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  PENDING:   { label: 'Pendente',  color: colors.warning },
  APPROVED:  { label: 'Aprovado',  color: colors.success },
  REJECTED:  { label: 'Rejeitado', color: colors.danger  },
  GENERATED: { label: 'Pronto',    color: colors.success },
  EXPIRED:   { label: 'Expirado',  color: colors.gray    },
};

export default function ApprovalsScreen() {
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
    const status = STATUS_CONFIG[item.status] ?? { label: item.status, color: colors.gray };
    return (
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={[styles.statusBadge, { borderColor: status.color }]}>
            <Text style={[styles.statusText, { color: status.color }]}>{status.label}</Text>
          </View>
          {item.has_sensitive && (
            <View style={styles.sensitiveBadge}>
              <Ionicons name="lock-closed-outline" size={12} color={colors.danger} />
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
    return <View style={styles.center}><ActivityIndicator size="large" color={colors.admin} /></View>;
  }

  const pending = requests.filter((r) => r.status === 'PENDING');

  return (
    <View style={{ flex: 1, backgroundColor: '#f5f5f5' }}>
      {pending.length > 0 && (
        <View style={styles.banner}>
          <Ionicons name="alert-circle-outline" size={18} color={colors.warning} />
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
            <Ionicons name="checkmark-circle-outline" size={40} color={colors.gray} />
            <Text style={{ color: colors.gray, marginTop: 8 }}>Nenhuma solicitação</Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40 },
  banner: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#fffbeb', padding: 12,
    borderBottomWidth: 1, borderBottomColor: '#fcd34d',
  },
  bannerText: { fontSize: 13, color: colors.warning, fontWeight: '600' },
  card: { backgroundColor: colors.white, borderRadius: 12, padding: 14, marginBottom: 10 },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  statusBadge: { borderWidth: 1, borderRadius: 20, paddingHorizontal: 8, paddingVertical: 3 },
  statusText: { fontSize: 11, fontWeight: '700' },
  sensitiveBadge: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  sensitiveText: { fontSize: 11, color: colors.danger },
  date: { marginLeft: 'auto', fontSize: 11, color: colors.gray },
  fields: { fontSize: 13, color: colors.gray, marginBottom: 10 },
  actions: { flexDirection: 'row', gap: 10 },
  rejectBtn: {
    flex: 1, borderWidth: 2, borderColor: colors.danger,
    borderRadius: 8, paddingVertical: 10, alignItems: 'center',
  },
  rejectBtnText: { color: colors.danger, fontWeight: '700' },
  approveBtn: {
    flex: 1, backgroundColor: colors.admin,
    borderRadius: 8, paddingVertical: 10, alignItems: 'center',
  },
  approveBtnText: { color: colors.white, fontWeight: '700' },
});
