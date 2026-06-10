/**
 * Admin — Fila de Aprovações
 * ===========================
 * Exibe exportações pendentes de aprovação.
 * Acessível para DEV, ADMIN e COUNCIL_GENERAL.
 */

import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  ActivityIndicator, RefreshControl, Modal,
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
  // Confirmação inline (Alert.alert é silenciosamente bloqueado na web)
  const [confirm, setConfirm] = useState<{ req: ExportRequest; mode: 'approve' | 'reject' } | null>(null);
  const [confirmLoading, setConfirmLoading] = useState(false);
  const [confirmError, setConfirmError] = useState<string | null>(null);

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
    setConfirmError(null);
    setConfirm({ req, mode: 'approve' });
  };

  const handleReject = (req: ExportRequest) => {
    setConfirmError(null);
    setConfirm({ req, mode: 'reject' });
  };

  const handleConfirm = async () => {
    if (!confirm) return;
    setConfirmLoading(true);
    setConfirmError(null);
    try {
      if (confirm.mode === 'approve') {
        await adminExportService.approve(confirm.req.id);
      } else {
        await adminExportService.reject(confirm.req.id);
      }
      await fetchRequests();
      setConfirm(null);
    } catch (e: any) {
      const fallback = confirm.mode === 'approve' ? 'Erro ao aprovar' : 'Erro ao rejeitar';
      setConfirmError(e?.response?.data?.detail?.message ?? fallback);
    } finally {
      setConfirmLoading(false);
    }
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

      {/* Confirmação inline — funciona na web (Alert.alert é bloqueado) */}
      <Modal
        visible={!!confirm}
        transparent
        animationType="fade"
        onRequestClose={() => { if (!confirmLoading) setConfirm(null); }}
      >
        <View style={styles.confirmOverlay}>
          <View style={styles.confirmBox}>
            <View
              style={[
                styles.confirmIcon,
                { backgroundColor: confirm?.mode === 'approve' ? t.status.successBg : t.status.errorBg },
              ]}
            >
              <Ionicons
                name={confirm?.mode === 'approve' ? 'checkmark-circle-outline' : 'close-circle-outline'}
                size={28}
                color={confirm?.mode === 'approve' ? t.status.success : t.status.error}
              />
            </View>
            <Text style={styles.confirmTitle}>
              {confirm?.mode === 'approve' ? 'Aprovar exportação?' : 'Rejeitar exportação?'}
            </Text>
            <Text style={styles.confirmMsg}>
              {confirm?.mode === 'approve'
                ? `Campos: ${confirm?.req.fields_requested.join(', ')}`
                : 'Esta ação não pode ser desfeita.'}
            </Text>
            {confirmError && <Text style={styles.confirmError}>{confirmError}</Text>}
            <View style={styles.confirmActions}>
              <TouchableOpacity
                style={[styles.confirmBtn, styles.confirmBtnCancel]}
                onPress={() => setConfirm(null)}
                disabled={confirmLoading}
              >
                <Text style={styles.confirmBtnCancelText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.confirmBtn,
                  { backgroundColor: confirm?.mode === 'approve' ? ADMIN_COLOR : t.status.error },
                ]}
                onPress={handleConfirm}
                disabled={confirmLoading}
              >
                {confirmLoading ? (
                  <ActivityIndicator size="small" color="#ffffff" />
                ) : (
                  <Text style={styles.confirmBtnText}>
                    {confirm?.mode === 'approve' ? 'Aprovar' : 'Rejeitar'}
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
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

  // Modal de confirmação inline (substitui Alert.alert, bloqueado na web)
  confirmOverlay: {
    flex: 1, backgroundColor: t.bg.overlay,
    alignItems: 'center', justifyContent: 'center', padding: 24,
  },
  confirmBox: {
    backgroundColor: t.bg.elevated, borderRadius: 16,
    padding: 24, width: '100%', maxWidth: 340, alignItems: 'center',
  },
  confirmIcon: {
    width: 56, height: 56, borderRadius: 28,
    alignItems: 'center', justifyContent: 'center', marginBottom: 14,
  },
  confirmTitle: { fontSize: 17, fontWeight: '700', color: t.text.primary, marginBottom: 8 },
  confirmMsg: {
    fontSize: 14, color: t.text.secondary, textAlign: 'center',
    marginBottom: 20, lineHeight: 20,
  },
  confirmError: { color: t.status.error, fontSize: 13, textAlign: 'center', marginBottom: 12 },
  confirmActions: { flexDirection: 'row', gap: 12, width: '100%' },
  confirmBtn: { flex: 1, borderRadius: 10, paddingVertical: 13, alignItems: 'center' },
  confirmBtnCancel: { borderWidth: 1.5, borderColor: t.border.subtle },
  confirmBtnCancelText: { color: t.text.primary, fontWeight: '600', fontSize: 14 },
  confirmBtnText: { color: '#ffffff', fontWeight: '700', fontSize: 14 },
});
