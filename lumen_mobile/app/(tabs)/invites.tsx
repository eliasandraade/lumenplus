/**
 * Inbox Screen
 * ============
 * Tela de avisos e comunicações do app.
 * - Recebidos: mensagens do usuário (30 dias)
 * - Pendentes: avisos aguardando aprovação (apenas aprovadores)
 */

import { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  Modal,
  ScrollView,
  ActivityIndicator,
  TextInput,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import type { IoniconsName } from '@/types/icons';
import { auth } from '@/config/firebase';
import { inboxService } from '@/services';
import type { InboxListResponse, PendingApproval, AuditEntry } from '@/types';
import { useTheme } from '@/theme';
import type { SemanticTokens } from '@/theme';
import { showAlert, showConfirm } from '@/utils/alerts';

const colors = {
  primary: '#1A859B',
  white: '#ffffff',
  gray: '#6b7280',
  lightGray: '#E8E8E8',
  success: '#22c55e',
  warning: '#f59e0b',
  error: '#ef4444',
  info: '#3b82f6',
  purple: '#7c3aed',
};

interface Aviso {
  id: string;
  message_id: string;
  title: string;
  message: string;
  type: 'info' | 'warning' | 'success' | 'urgent';
  read: boolean;
  created_at: string;
  expires_at: string;
  sender_name?: string;
}

type TabType = 'recebidos' | 'pendentes';

export default function InboxScreen() {
  const { t } = useTheme();
  const styles = makeStyles(t);

  // Tab state
  const [activeTab, setActiveTab] = useState<TabType>('recebidos');
  const [hasAdminAccess, setHasAdminAccess] = useState(false);
  const [canSend, setCanSend] = useState(false);

  // Recebidos
  const [avisos, setAvisos] = useState<Aviso[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedAviso, setSelectedAviso] = useState<Aviso | null>(null);
  const [avisoModalVisible, setAvisoModalVisible] = useState(false);

  // Pendentes
  const [pendentes, setPendentes] = useState<PendingApproval[]>([]);
  const [loadingPendentes, setLoadingPendentes] = useState(false);
  const [selectedPendente, setSelectedPendente] = useState<PendingApproval | null>(null);
  const [pendenteModalVisible, setPendenteModalVisible] = useState(false);
  const [approvalNote, setApprovalNote] = useState('');
  const [processingApproval, setProcessingApproval] = useState(false);

  // Audit
  const [auditEntries, setAuditEntries] = useState<AuditEntry[]>([]);
  const [auditModalVisible, setAuditModalVisible] = useState(false);
  const [loadingAudit, setLoadingAudit] = useState(false);

  useEffect(() => {
    loadAvisos();
    checkPermissions();
  }, []);

  useEffect(() => {
    if (activeTab === 'pendentes' && hasAdminAccess) {
      loadPendentes();
    }
  }, [activeTab, hasAdminAccess]);

  const checkPermissions = async () => {
    try {
      await auth.authStateReady();
      const [scopesData, permsData] = await Promise.all([
        inboxService.getSendableScopes(),
        inboxService.getMyPermissions(),
      ]);
      setCanSend(scopesData.can_send_to_all || scopesData.scopes.length > 0);
      setHasAdminAccess(permsData.has_admin_access);
    } catch {
      setCanSend(false);
      setHasAdminAccess(false);
    }
  };

  const loadAvisos = async () => {
    try {
      const response = await inboxService.getInbox();
      setAvisos((response.messages || []) as Aviso[]);
    } catch {
      setAvisos([]);
    } finally {
      setLoading(false);
    }
  };

  const loadPendentes = async () => {
    setLoadingPendentes(true);
    try {
      const data = await inboxService.getPendingApprovals();
      setPendentes(data.messages || []);
    } catch {
      setPendentes([]);
    } finally {
      setLoadingPendentes(false);
    }
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    if (activeTab === 'recebidos') {
      await loadAvisos();
    } else {
      await loadPendentes();
    }
    setRefreshing(false);
  }, [activeTab]);

  const handleOpenAviso = async (aviso: Aviso) => {
    setSelectedAviso(aviso);
    setAvisoModalVisible(true);
    if (!aviso.read) {
      try {
        await inboxService.markAsRead(aviso.id);
        setAvisos(prev => prev.map(a => a.id === aviso.id ? { ...a, read: true } : a));
      } catch { /* silencioso */ }
    }
  };

  const handleOpenPendente = (item: PendingApproval) => {
    setSelectedPendente(item);
    setApprovalNote('');
    setPendenteModalVisible(true);
  };

  const handleApprove = async () => {
    if (!selectedPendente) return;
    setProcessingApproval(true);
    try {
      const result = await inboxService.approveMessage(selectedPendente.id, approvalNote || undefined);
      showAlert('Aprovado!', `Aviso enviado para ${result.recipient_count} destinatário(s).`);
      setPendenteModalVisible(false);
      await loadPendentes();
    } catch {
      showAlert('Erro', 'Não foi possível aprovar o aviso.');
    } finally {
      setProcessingApproval(false);
    }
  };

  const handleReject = () => {
    if (!selectedPendente) return;
    showConfirm({
      title: 'Reprovar aviso',
      message: 'Tem certeza? O aviso não será enviado.',
      confirmText: 'Reprovar',
      destructive: true,
      onConfirm: async () => {
        setProcessingApproval(true);
        try {
          await inboxService.rejectMessage(selectedPendente.id, approvalNote || undefined);
          showAlert('Reprovado', 'O aviso foi reprovado.');
          setPendenteModalVisible(false);
          await loadPendentes();
        } catch {
          showAlert('Erro', 'Não foi possível reprovar o aviso.');
        } finally {
          setProcessingApproval(false);
        }
      },
    });
  };

  const handleViewAudit = async (messageId: string) => {
    setLoadingAudit(true);
    setAuditModalVisible(true);
    try {
      const data = await inboxService.getMessageAudit(messageId);
      setAuditEntries(data.entries || []);
    } catch {
      setAuditEntries([]);
    } finally {
      setLoadingAudit(false);
    }
  };

  const getAvisoIcon = (type: string) => {
    switch (type) {
      case 'urgent': return { name: 'alert-circle', color: colors.error };
      case 'warning': return { name: 'warning', color: colors.warning };
      case 'success': return { name: 'checkmark-circle', color: colors.success };
      default: return { name: 'information-circle', color: colors.info };
    }
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'urgent': return 'Urgente';
      case 'warning': return 'Atenção';
      case 'success': return 'Confirmação';
      default: return 'Informativo';
    }
  };

  const getActionLabel = (action: string) => {
    switch (action) {
      case 'CREATED': return 'Criado';
      case 'APPROVED': return 'Aprovado';
      case 'REJECTED': return 'Reprovado';
      case 'DELETED': return 'Excluído';
      case 'MODIFIED': return 'Modificado';
      default: return action;
    }
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('pt-BR', {
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  };

  const formatRelativeDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    if (diffHours < 1) return 'Agora';
    if (diffHours < 24) return `Há ${diffHours}h`;
    if (diffDays === 1) return 'Ontem';
    if (diffDays < 7) return `Há ${diffDays} dias`;
    return date.toLocaleDateString('pt-BR');
  };

  const unreadCount = avisos.filter(a => !a.read).length;

  // === RENDERS ===

  const renderAviso = ({ item }: { item: Aviso }) => {
    const icon = getAvisoIcon(item.type);
    return (
      <TouchableOpacity
        style={[styles.avisoCard, !item.read && styles.avisoUnread]}
        onPress={() => handleOpenAviso(item)}
        activeOpacity={0.7}
      >
        <View style={[styles.avisoIconContainer, { backgroundColor: `${icon.color}15` }]}>
          <Ionicons name={icon.name as IoniconsName} size={24} color={icon.color} />
        </View>
        <View style={styles.avisoContent}>
          <View style={styles.avisoHeader}>
            <Text style={[styles.avisoTitle, !item.read && styles.avisoTitleUnread]} numberOfLines={1}>
              {item.title}
            </Text>
            {!item.read && <View style={styles.unreadDot} />}
          </View>
          <Text style={styles.avisoMessage} numberOfLines={2}>{item.message}</Text>
          <Text style={styles.avisoDate}>{formatRelativeDate(item.created_at)}</Text>
        </View>
        <Ionicons name="chevron-forward" size={20} color={t.text.secondary} />
      </TouchableOpacity>
    );
  };

  const renderPendente = ({ item }: { item: PendingApproval }) => {
    return (
      <TouchableOpacity
        style={styles.avisoCard}
        onPress={() => handleOpenPendente(item)}
        activeOpacity={0.7}
      >
        <View style={[styles.avisoIconContainer, { backgroundColor: t.status.warningBg }]}>
          <Ionicons name="time-outline" size={24} color={t.status.warning} />
        </View>
        <View style={styles.avisoContent}>
          <Text style={styles.avisoTitle} numberOfLines={1}>{item.title}</Text>
          {item.target_org_unit_name && (
            <Text style={styles.orgUnitTag}>→ {item.target_org_unit_name}</Text>
          )}
          <Text style={styles.avisoMessage} numberOfLines={1}>{item.message}</Text>
          <Text style={styles.avisoDate}>
            {item.created_by_name ? `Por ${item.created_by_name} · ` : ''}
            {formatRelativeDate(item.created_at)}
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={20} color={t.text.secondary} />
      </TouchableOpacity>
    );
  };

  const renderEmpty = (message: string) => (
    <View style={styles.emptyContainer}>
      <View style={styles.emptyIconContainer}>
        <Ionicons name="mail-open-outline" size={64} color={t.brand.primary} />
      </View>
      <Text style={styles.emptyTitle}>Nenhum item</Text>
      <Text style={styles.emptyMessage}>{message}</Text>
    </View>
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={t.brand.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Tab Bar */}
      {hasAdminAccess && (
        <View style={styles.tabBar}>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'recebidos' && styles.tabActive]}
            onPress={() => setActiveTab('recebidos')}
          >
            <Text style={[styles.tabText, activeTab === 'recebidos' && styles.tabTextActive]}>
              Recebidos
            </Text>
            {unreadCount > 0 && activeTab !== 'recebidos' && (
              <View style={styles.tabBadge}>
                <Text style={styles.tabBadgeText}>{unreadCount}</Text>
              </View>
            )}
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'pendentes' && styles.tabActive]}
            onPress={() => setActiveTab('pendentes')}
          >
            <Text style={[styles.tabText, activeTab === 'pendentes' && styles.tabTextActive]}>
              Pendentes
            </Text>
            {pendentes.length > 0 && (
              <View style={[styles.tabBadge, { backgroundColor: colors.warning }]}>
                <Text style={styles.tabBadgeText}>{pendentes.length}</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>
      )}

      {/* RECEBIDOS TAB */}
      {activeTab === 'recebidos' && (
        <>
          {avisos.length > 0 && (
            <View style={styles.headerInfo}>
              <Text style={styles.headerText}>
                {unreadCount > 0
                  ? `${unreadCount} aviso${unreadCount > 1 ? 's' : ''} não lido${unreadCount > 1 ? 's' : ''}`
                  : 'Todos os avisos lidos'}
              </Text>
              <Text style={styles.headerSubtext}>Avisos expiram em 30 dias</Text>
            </View>
          )}
          <FlatList
            data={avisos}
            renderItem={renderAviso}
            keyExtractor={item => item.id}
            contentContainerStyle={styles.listContent}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.primary]} />
            }
            ListEmptyComponent={() => renderEmpty('Você não tem avisos no momento.\nOs avisos ficam disponíveis por 30 dias.')}
            ItemSeparatorComponent={() => <View style={styles.separator} />}
          />
        </>
      )}

      {/* PENDENTES TAB */}
      {activeTab === 'pendentes' && (
        <>
          {loadingPendentes ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={t.status.warning} />
            </View>
          ) : (
            <FlatList
              data={pendentes}
              renderItem={renderPendente}
              keyExtractor={item => item.id}
              contentContainerStyle={styles.listContent}
              refreshControl={
                <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.warning]} />
              }
              ListEmptyComponent={() => renderEmpty('Nenhum aviso aguardando aprovação.')}
              ItemSeparatorComponent={() => <View style={styles.separator} />}
            />
          )}
        </>
      )}

      {/* FAB Enviar Aviso */}
      {canSend && (
        <TouchableOpacity
          style={styles.fab}
          onPress={() => router.push('/admin/create-aviso')}
          activeOpacity={0.85}
        >
          <Ionicons name="megaphone" size={22} color="#ffffff" />
          <Text style={styles.fabText}>Enviar Aviso</Text>
        </TouchableOpacity>
      )}

      {/* Modal: Detalhe Aviso Recebido */}
      <Modal
        visible={avisoModalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setAvisoModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            {selectedAviso && (
              <>
                <View style={styles.modalHeader}>
                  <View style={[
                    styles.modalTypeChip,
                    { backgroundColor: `${getAvisoIcon(selectedAviso.type).color}15` }
                  ]}>
                    <Ionicons
                      name={getAvisoIcon(selectedAviso.type).name as IoniconsName}
                      size={16}
                      color={getAvisoIcon(selectedAviso.type).color}
                    />
                    <Text style={[styles.modalTypeText, { color: getAvisoIcon(selectedAviso.type).color }]}>
                      {getTypeLabel(selectedAviso.type)}
                    </Text>
                  </View>
                  <TouchableOpacity style={styles.modalCloseButton} onPress={() => setAvisoModalVisible(false)}>
                    <Ionicons name="close" size={24} color={t.text.secondary} />
                  </TouchableOpacity>
                </View>
                <ScrollView style={styles.modalBody}>
                  <Text style={styles.modalTitle}>{selectedAviso.title}</Text>
                  <Text style={styles.modalDate}>{formatDate(selectedAviso.created_at)}</Text>
                  <Text style={styles.modalMessage}>{selectedAviso.message}</Text>
                  {selectedAviso.sender_name && (
                    <Text style={styles.modalSender}>De: {selectedAviso.sender_name}</Text>
                  )}
                </ScrollView>
                <View style={styles.modalFooterRow}>
                  <TouchableOpacity style={styles.modalButton} onPress={() => setAvisoModalVisible(false)}>
                    <Text style={styles.modalButtonText}>Fechar</Text>
                  </TouchableOpacity>
                  {hasAdminAccess && (
                    <TouchableOpacity
                      style={[styles.modalButton, styles.modalButtonSecondary]}
                      onPress={() => {
                        setAvisoModalVisible(false);
                        handleViewAudit(selectedAviso.message_id);
                      }}
                    >
                      <Text style={[styles.modalButtonText, { color: colors.primary }]}>Auditoria</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </>
            )}
          </View>
        </View>
      </Modal>

      {/* Modal: Aprovação de Pendente */}
      <Modal
        visible={pendenteModalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setPendenteModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            {selectedPendente && (
              <>
                <View style={styles.modalHeader}>
                  <View style={[styles.modalTypeChip, { backgroundColor: t.status.warningBg }]}>
                    <Ionicons name="time-outline" size={16} color={t.status.warning} />
                    <Text style={[styles.modalTypeText, { color: colors.warning }]}>Aguardando Aprovação</Text>
                  </View>
                  <TouchableOpacity style={styles.modalCloseButton} onPress={() => setPendenteModalVisible(false)}>
                    <Ionicons name="close" size={24} color={t.text.secondary} />
                  </TouchableOpacity>
                </View>
                <ScrollView style={styles.modalBody}>
                  <Text style={styles.modalTitle}>{selectedPendente.title}</Text>
                  {selectedPendente.target_org_unit_name && (
                    <Text style={styles.orgUnitTag}>Setor: {selectedPendente.target_org_unit_name}</Text>
                  )}
                  {selectedPendente.created_by_name && (
                    <Text style={styles.modalDate}>Por {selectedPendente.created_by_name} · {formatDate(selectedPendente.created_at)}</Text>
                  )}
                  <Text style={styles.modalMessage}>{selectedPendente.message}</Text>

                  <Text style={styles.noteLabel}>Observação (opcional)</Text>
                  <TextInput
                    style={styles.noteInput}
                    placeholder="Adicione uma observação..."
                    placeholderTextColor={colors.gray}
                    multiline
                    numberOfLines={3}
                    value={approvalNote}
                    onChangeText={setApprovalNote}
                    editable={!processingApproval}
                  />
                </ScrollView>
                <View style={styles.approvalFooter}>
                  <TouchableOpacity
                    style={[styles.approvalBtn, styles.approvalBtnReject, processingApproval && styles.btnDisabled]}
                    onPress={handleReject}
                    disabled={processingApproval}
                  >
                    <Ionicons name="close-circle-outline" size={18} color={t.status.error} />
                    <Text style={[styles.approvalBtnText, { color: colors.error }]}>Reprovar</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.approvalBtn, styles.approvalBtnApprove, processingApproval && styles.btnDisabled]}
                    onPress={handleApprove}
                    disabled={processingApproval}
                  >
                    {processingApproval
                      ? <ActivityIndicator size="small" color={t.text.inverse} />
                      : <>
                          <Ionicons name="checkmark-circle-outline" size={18} color={t.text.inverse} />
                          <Text style={[styles.approvalBtnText, { color: colors.white }]}>Aprovar</Text>
                        </>
                    }
                  </TouchableOpacity>
                </View>
              </>
            )}
          </View>
        </View>
      </Modal>

      {/* Modal: Auditoria */}
      <Modal
        visible={auditModalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setAuditModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Auditoria do Aviso</Text>
              <TouchableOpacity style={styles.modalCloseButton} onPress={() => setAuditModalVisible(false)}>
                <Ionicons name="close" size={24} color={t.text.secondary} />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.modalBody}>
              {loadingAudit ? (
                <ActivityIndicator color={t.brand.primary} style={{ marginTop: 32 }} />
              ) : auditEntries.length === 0 ? (
                <Text style={styles.modalDate}>Nenhum registro de auditoria.</Text>
              ) : (
                auditEntries.map(entry => (
                  <View key={entry.id} style={styles.auditEntry}>
                    <View style={styles.auditEntryHeader}>
                      <Text style={styles.auditAction}>{getActionLabel(entry.action)}</Text>
                      <Text style={styles.auditDate}>{formatDate(entry.created_at)}</Text>
                    </View>
                    {entry.actor_name && (
                      <Text style={styles.auditActor}>Por: {entry.actor_name}</Text>
                    )}
                    {entry.note && (
                      <Text style={styles.auditNote}>Obs: {entry.note}</Text>
                    )}
                    {entry.old_title && (
                      <Text style={styles.auditOld}>Título anterior: {entry.old_title}</Text>
                    )}
                    {entry.new_title && (
                      <Text style={styles.auditNew}>Novo título: {entry.new_title}</Text>
                    )}
                  </View>
                ))
              )}
            </ScrollView>
            <TouchableOpacity style={[styles.modalButton, { margin: 16 }]} onPress={() => setAuditModalVisible(false)}>
              <Text style={styles.modalButtonText}>Fechar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const makeStyles = (t: SemanticTokens) => StyleSheet.create({
  container: { flex: 1, backgroundColor: t.bg.screen },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: t.bg.screen },

  // Tab bar
  tabBar: {
    flexDirection: 'row',
    backgroundColor: t.bg.elevated,
    borderBottomWidth: 1,
    borderBottomColor: t.border.subtle,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    gap: 6,
  },
  tabActive: { borderBottomWidth: 2, borderBottomColor: t.brand.primary },
  tabText: { fontSize: 14, fontWeight: '500', color: t.text.secondary },
  tabTextActive: { color: t.brand.primary, fontWeight: '600' },
  tabBadge: {
    backgroundColor: t.brand.primary,
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 1,
    minWidth: 20,
    alignItems: 'center',
  },
  tabBadgeText: { color: t.text.inverse, fontSize: 11, fontWeight: '700' },

  headerInfo: {
    backgroundColor: t.bg.elevated,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: t.border.subtle,
  },
  headerText: { fontSize: 15, fontWeight: '600', color: t.text.primary },
  headerSubtext: { fontSize: 12, color: t.text.secondary, marginTop: 2 },

  listContent: { padding: 16, flexGrow: 1 },
  separator: { height: 10 },

  avisoCard: {
    backgroundColor: t.bg.elevated,
    borderRadius: 12,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
  },
  avisoUnread: { borderLeftWidth: 3, borderLeftColor: t.brand.primary },
  avisoIconContainer: {
    width: 44, height: 44, borderRadius: 22,
    alignItems: 'center', justifyContent: 'center', marginRight: 12,
  },
  avisoContent: { flex: 1 },
  avisoHeader: { flexDirection: 'row', alignItems: 'center' },
  avisoTitle: { fontSize: 15, fontWeight: '500', color: t.text.primary, flex: 1 },
  avisoTitleUnread: { fontWeight: '600' },
  unreadDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: t.brand.primary, marginLeft: 8 },
  avisoMessage: { fontSize: 13, color: t.text.secondary, lineHeight: 18, marginTop: 2 },
  avisoDate: { fontSize: 11, color: t.text.tertiary, marginTop: 4 },
  orgUnitTag: { fontSize: 12, color: t.brand.primary, fontWeight: '500', marginTop: 2 },

  emptyContainer: {
    flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32, marginTop: 60,
  },
  emptyIconContainer: {
    width: 120, height: 120, borderRadius: 60,
    backgroundColor: t.brand.primaryDim,
    alignItems: 'center', justifyContent: 'center', marginBottom: 24,
  },
  emptyTitle: { fontSize: 20, fontWeight: '600', color: t.text.primary, marginBottom: 8 },
  emptyMessage: { fontSize: 14, color: t.text.secondary, textAlign: 'center', lineHeight: 20 },

  // Modal
  modalOverlay: { flex: 1, backgroundColor: t.bg.overlay, justifyContent: 'flex-end' },
  modalContent: { backgroundColor: t.bg.elevated, borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: '85%' },
  modalHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    padding: 16, borderBottomWidth: 1, borderBottomColor: t.border.subtle,
  },
  modalTypeChip: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, gap: 6,
  },
  modalTypeText: { fontSize: 13, fontWeight: '600' },
  modalCloseButton: { padding: 4 },
  modalBody: { padding: 20 },
  modalTitle: { fontSize: 18, fontWeight: 'bold', color: t.text.primary, marginBottom: 6 },
  modalDate: { fontSize: 13, color: t.text.secondary, marginBottom: 12 },
  modalMessage: { fontSize: 15, color: t.text.primary, lineHeight: 24 },
  modalSender: { fontSize: 13, color: t.text.secondary, marginTop: 12, fontStyle: 'italic' },
  modalFooterRow: { flexDirection: 'row', gap: 12, margin: 16 },
  modalButton: {
    flex: 1, padding: 14, backgroundColor: t.brand.primary, borderRadius: 12, alignItems: 'center',
  },
  modalButtonSecondary: { backgroundColor: t.brand.primaryDim },
  modalButtonText: { color: t.text.inverse, fontSize: 15, fontWeight: '600' },

  // Approval
  noteLabel: { fontSize: 13, fontWeight: '600', color: t.text.primary, marginTop: 16, marginBottom: 6 },
  noteInput: {
    borderWidth: 1, borderColor: t.border.subtle, borderRadius: 8,
    padding: 10, fontSize: 14, color: t.text.primary, minHeight: 72, textAlignVertical: 'top',
    backgroundColor: t.bg.surface,
  },
  approvalFooter: { flexDirection: 'row', padding: 16, gap: 12 },
  approvalBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    paddingVertical: 14, borderRadius: 12, gap: 6,
  },
  approvalBtnReject: { backgroundColor: t.status.errorBg, borderWidth: 1, borderColor: t.status.error },
  approvalBtnApprove: { backgroundColor: t.status.success },
  approvalBtnText: { fontSize: 15, fontWeight: '600' },
  btnDisabled: { opacity: 0.5 },

  // Audit
  auditEntry: {
    borderBottomWidth: 1, borderBottomColor: t.border.subtle, paddingVertical: 10, marginBottom: 4,
  },
  auditEntryHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  auditAction: { fontSize: 13, fontWeight: '700', color: t.text.primary },
  auditDate: { fontSize: 11, color: t.text.tertiary },
  auditActor: { fontSize: 12, color: t.text.secondary, marginTop: 2 },
  auditNote: { fontSize: 12, color: t.brand.primary, marginTop: 2, fontStyle: 'italic' },
  auditOld: { fontSize: 12, color: t.status.error, marginTop: 2 },
  auditNew: { fontSize: 12, color: t.status.success, marginTop: 2 },

  fab: {
    position: 'absolute', bottom: 24, right: 20,
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#7C3AED',
    paddingHorizontal: 20, paddingVertical: 14, borderRadius: 28,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2, shadowRadius: 8, elevation: 6,
  },
  fabText: { color: '#ffffff', fontSize: 15, fontWeight: '600' },
});
