/**
 * Members Screen
 * ==============
 * Tela de gerenciamento de membros de uma unidade organizacional.
 * Permite ver membros, convidar, promover/rebaixar e remover.
 */

import { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Alert,
  Modal,
  TextInput,
  ScrollView,
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import api from '@/services/api';
import { useTheme } from '@/theme';
import type { SemanticTokens } from '@/theme';
import { radius, typography } from '@/theme/tokens';

// ── Helper: máscara de e-mail ─────────────────────────────────────────────────

function maskEmail(email: string): string {
  const atIdx = email.indexOf('@');
  if (atIdx < 2) return email;
  return `${email.slice(0, 2)}***${email.slice(atIdx)}`;
}

// ── Tipos locais ──────────────────────────────────────────────────────────────

interface Member {
  user_id: string;
  user_name: string;
  user_email: string | null;
  role: string;
  status: string;
  joined_at: string;
}

interface UserSearchResult {
  id: string;
  name: string;
  email: string | null;
  photo_url: string | null;
}

interface Permissions {
  can_invite: boolean;
  can_manage_members: boolean;
  is_coordinator: boolean;
}

const ROLE_LABELS: Record<string, string> = {
  COORDINATOR: 'Coordenador',
  MEMBER: 'Membro',
};

// ── Estilos dinâmicos ─────────────────────────────────────────────────────────

const makeStyles = (t: SemanticTokens) => StyleSheet.create({
  container: { flex: 1, backgroundColor: t.bg.screen },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: t.bg.screen },
  loadingText: { marginTop: 12, fontSize: typography.size.md, color: t.text.secondary, fontFamily: typography.family.regular },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: t.bg.elevated,
    borderBottomWidth: 1,
    borderBottomColor: t.border.subtle,
  },
  headerTitle: { flex: 1, marginLeft: 12 },
  headerTitleText: { fontSize: typography.size.lg, fontFamily: typography.family.bold, color: t.text.primary },
  headerSubtitle: { fontSize: typography.size.sm, color: t.text.secondary, marginTop: 2, fontFamily: typography.family.regular },

  canalButton: {
    backgroundColor: t.brand.primaryDim,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radius.full,
    marginRight: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  canalButtonText: { color: t.brand.primary, fontFamily: typography.family.bold, fontSize: 13 },
  inviteButton: { backgroundColor: t.brand.primary, padding: 10, borderRadius: radius.md },

  listContent: { padding: 16 },

  sectionChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: radius.full,
    marginBottom: 12,
  },
  sectionChipCoord: { backgroundColor: '#fffbeb' },
  sectionChipMember: { backgroundColor: t.brand.primaryDim, marginTop: 16 },
  sectionChipText: { fontSize: typography.size.xs, fontFamily: typography.family.bold },
  sectionChipTextCoord: { color: '#d97706' },
  sectionChipTextMember: { color: t.brand.primary },
  sectionChipCount: {
    fontSize: typography.size.xs,
    fontFamily: typography.family.bold,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: radius.full,
  },
  sectionChipCountCoord: { backgroundColor: '#fef9c3', color: '#a16207' },
  sectionChipCountMember: { backgroundColor: t.brand.primary, color: t.text.inverse },

  memberCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: t.bg.elevated,
    padding: 14,
    borderRadius: radius.lg,
    marginBottom: 10,
    ...t.shadow.sm,
  },
  memberAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: t.brand.primary,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: t.brand.primaryDim,
  },
  memberAvatarCoord: {
    borderColor: '#fde68a',
    backgroundColor: '#d97706',
  },
  avatarText: { fontSize: 18, fontFamily: typography.family.bold, color: t.text.inverse },
  memberInfo: { flex: 1, marginLeft: 12 },
  memberName: { fontSize: typography.size.md, fontFamily: typography.family.bold, color: t.text.primary },
  memberEmailMasked: { fontSize: typography.size.xs, color: t.text.tertiary, marginTop: 2, fontFamily: typography.family.regular },
  memberJoined: { fontSize: typography.size.xs, color: t.text.tertiary, marginTop: 2, fontFamily: typography.family.regular },
  coordBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.full,
    backgroundColor: '#fffbeb',
  },
  coordBadgeText: { fontSize: 11, fontFamily: typography.family.bold, color: '#d97706' },

  emptyContainer: { alignItems: 'center', paddingVertical: 40 },
  emptyText: { fontSize: typography.size.sm, color: t.text.secondary, marginTop: 12, fontFamily: typography.family.regular },

  // Modais
  modalOverlay: { flex: 1, backgroundColor: t.bg.overlay, justifyContent: 'flex-end' },
  modalContent: {
    backgroundColor: t.bg.elevated,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    padding: 24,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
    gap: 8,
  },
  modalTitle: { fontSize: typography.size.xl, fontFamily: typography.family.bold, color: t.text.primary },
  label: { fontSize: typography.size.sm, fontFamily: typography.family.bold, color: t.text.primary, marginBottom: 8, marginTop: 16 },

  searchInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: t.bg.surface,
    borderRadius: radius.full,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: t.border.subtle,
    marginBottom: 12,
  },
  searchInput: {
    flex: 1,
    fontSize: typography.size.md,
    color: t.text.primary,
    marginLeft: 8,
    fontFamily: typography.family.regular,
  },
  input: {
    backgroundColor: t.bg.surface,
    borderRadius: radius.md,
    padding: 14,
    fontSize: typography.size.md,
    borderWidth: 1,
    borderColor: t.border.subtle,
    color: t.text.primary,
    fontFamily: typography.family.regular,
  },
  textArea: { minHeight: 80, textAlignVertical: 'top' },
  searchLoader: { marginTop: 12 },
  searchResults: { marginTop: 4, maxHeight: 200 },
  searchResultItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: t.border.subtle,
  },
  searchResultAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: t.brand.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  searchResultInfo: { flex: 1, marginLeft: 12 },
  searchResultName: { fontSize: typography.size.md, fontFamily: typography.family.semibold, color: t.text.primary },
  roleOptions: { flexDirection: 'row', gap: 12 },
  roleOption: {
    flex: 1,
    padding: 14,
    borderRadius: radius.md,
    borderWidth: 2,
    borderColor: t.border.subtle,
    alignItems: 'center',
    backgroundColor: t.bg.surface,
  },
  roleOptionActive: { borderColor: t.brand.primary, backgroundColor: t.brand.primaryDim },
  roleOptionText: { fontSize: typography.size.md, fontFamily: typography.family.semibold, color: t.text.secondary },
  roleOptionTextActive: { color: t.brand.primary },

  confirmContainer: { alignItems: 'center', paddingVertical: 16, gap: 16 },
  confirmAvatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: t.brand.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  confirmAvatarText: { fontSize: 28, fontFamily: typography.family.bold, color: t.text.inverse },
  confirmQuestion: {
    fontSize: typography.size.lg,
    color: t.text.secondary,
    textAlign: 'center',
    lineHeight: 26,
    fontFamily: typography.family.regular,
  },
  confirmHighlight: { fontFamily: typography.family.bold, color: t.brand.primary },
  confirmMessage: {
    fontSize: typography.size.sm,
    color: t.text.tertiary,
    fontStyle: 'italic',
    textAlign: 'center',
    fontFamily: typography.family.italic,
  },
  confirmButton: {
    width: '100%',
    backgroundColor: t.brand.primary,
    borderRadius: radius.lg,
    padding: 16,
    alignItems: 'center',
  },
  confirmButtonText: { color: t.text.inverse, fontSize: typography.size.lg, fontFamily: typography.family.bold },
  cancelConfirmButton: { padding: 12, alignItems: 'center' },
  cancelConfirmText: { color: t.text.secondary, fontSize: typography.size.md, fontFamily: typography.family.regular },

  actionsModal: {
    backgroundColor: t.bg.elevated,
    margin: 20,
    borderRadius: radius.xl,
    padding: 20,
  },
  actionsTitle: { fontSize: typography.size.lg, fontFamily: typography.family.bold, color: t.text.primary, textAlign: 'center' },
  actionsSubtitle: { fontSize: typography.size.sm, color: t.text.secondary, textAlign: 'center', marginBottom: 20, fontFamily: typography.family.regular },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 16,
    borderRadius: radius.lg,
    backgroundColor: t.bg.surface,
    marginBottom: 10,
  },
  actionButtonText: { fontSize: typography.size.md, fontFamily: typography.family.semibold, color: t.brand.primary },
  actionButtonDanger: { backgroundColor: '#fef2f2' },
  actionButtonTextDanger: { color: '#ef4444' },
  cancelButton: { padding: 16, alignItems: 'center' },
  cancelButtonText: { fontSize: typography.size.md, color: t.text.secondary, fontFamily: typography.family.regular },
});

// ── Componente principal ──────────────────────────────────────────────────────

export default function MembersScreen() {
  const { t } = useTheme();
  const styles = makeStyles(t);

  const params = useLocalSearchParams<{
    org_unit_id: string;
    org_unit_name: string;
  }>();

  const [members, setMembers] = useState<Member[]>([]);
  const [permissions, setPermissions] = useState<Permissions | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Modal de convite
  const [showInvite, setShowInvite] = useState(false);
  const [inviteStep, setInviteStep] = useState<'search' | 'confirm'>('search');
  const [pendingUser, setPendingUser] = useState<UserSearchResult | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<UserSearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [inviteRole, setInviteRole] = useState<'MEMBER' | 'COORDINATOR'>('MEMBER');
  const [inviteMessage, setInviteMessage] = useState('');
  const [isSendingInvite, setIsSendingInvite] = useState(false);

  // Modal de ações do membro
  const [selectedMember, setSelectedMember] = useState<Member | null>(null);
  const [showMemberActions, setShowMemberActions] = useState(false);
  const [showRemoveConfirm, setShowRemoveConfirm] = useState(false);
  const [memberToRemove, setMemberToRemove] = useState<Member | null>(null);
  const [isRemoving, setIsRemoving] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const [membersData, permissionsData] = await Promise.all([
        api.get<{ members: Member[] }>(`/org/units/${params.org_unit_id}/members`),
        api.get<Permissions>(`/org/units/${params.org_unit_id}/permissions`),
      ]);

      setMembers(membersData.members);
      setPermissions(permissionsData);
    } catch (err) {
      console.error('Erro ao carregar membros:', err);
      Alert.alert('Erro', 'Não foi possível carregar os membros');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [params.org_unit_id]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleRefresh = () => {
    setIsRefreshing(true);
    loadData();
  };

  // Busca de usuários para convidar
  useEffect(() => {
    const searchUsers = async () => {
      if (searchQuery.length < 2) {
        setSearchResults([]);
        return;
      }

      try {
        setIsSearching(true);
        const results = await api.get<UserSearchResult[]>(
          `/org/units/${params.org_unit_id}/search-users?q=${encodeURIComponent(searchQuery)}`
        );
        setSearchResults(results);
      } catch (err) {
        console.error('Erro na busca:', err);
      } finally {
        setIsSearching(false);
      }
    };

    const debounce = setTimeout(searchUsers, 300);
    return () => clearTimeout(debounce);
  }, [searchQuery, params.org_unit_id]);

  const handleSelectUser = (user: UserSearchResult) => {
    setPendingUser(user);
    setInviteStep('confirm');
  };

  const handleConfirmInvite = async () => {
    if (!pendingUser) return;
    try {
      setIsSendingInvite(true);
      await api.post(`/org/units/${params.org_unit_id}/invites`, {
        user_id: pendingUser.id,
        role: inviteRole,
        message: inviteMessage || null,
      });
      setShowInvite(false);
      setInviteStep('search');
      setPendingUser(null);
      setSearchQuery('');
      setSearchResults([]);
      setInviteMessage('');
      Alert.alert('Sucesso!', `Convite enviado para ${pendingUser.name}!`);
    } catch (err: any) {
      const message = err.response?.data?.detail?.message || 'Erro ao enviar convite';
      Alert.alert('Erro', message);
    } finally {
      setIsSendingInvite(false);
    }
  };

  const handleCancelConfirm = () => {
    setInviteStep('search');
    setPendingUser(null);
  };

  const handlePromote = async (member: Member) => {
    const newRole = member.role === 'COORDINATOR' ? 'MEMBER' : 'COORDINATOR';
    const action = member.role === 'COORDINATOR' ? 'rebaixar' : 'promover';

    Alert.alert(
      `${action.charAt(0).toUpperCase() + action.slice(1)} Membro`,
      `Deseja ${action} ${member.user_name} para ${ROLE_LABELS[newRole]}?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Confirmar',
          onPress: async () => {
            try {
              await api.put(
                `/org/units/${params.org_unit_id}/members/${member.user_id}/role?role=${newRole}`
              );
              Alert.alert('Sucesso!', `${member.user_name} agora é ${ROLE_LABELS[newRole]}`);
              setShowMemberActions(false);
              loadData();
            } catch (err: any) {
              const message = err.response?.data?.detail?.message || 'Erro ao atualizar papel';
              Alert.alert('Erro', message);
            }
          },
        },
      ]
    );
  };

  const handleRemovePress = (member: Member) => {
    setMemberToRemove(member);
    setShowMemberActions(false);
    setShowRemoveConfirm(true);
  };

  const handleConfirmRemove = async () => {
    if (!memberToRemove) return;
    try {
      setIsRemoving(true);
      await api.delete(`/org/units/${params.org_unit_id}/members/${memberToRemove.user_id}`);
      setShowRemoveConfirm(false);
      setMemberToRemove(null);
      loadData();
    } catch (err: any) {
      const message = err.response?.data?.detail?.message || 'Erro ao remover membro';
      Alert.alert('Erro', message);
    } finally {
      setIsRemoving(false);
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  };

  const coordinators = members.filter(m => m.role === 'COORDINATOR');
  const regularMembers = members.filter(m => m.role === 'MEMBER');

  // Lista com sentinela para separar coordenadores de membros
  type SentinelItem = { __separator: true; user_id: string };
  const listData: (Member | SentinelItem)[] = [
    ...coordinators,
    ...(regularMembers.length > 0 ? [{ __separator: true as const, user_id: '__sep__' }] : []),
    ...regularMembers,
  ];

  const renderMember = ({ item }: { item: Member | SentinelItem }) => {
    if ('__separator' in item) {
      return (
        <View style={[styles.sectionChip, styles.sectionChipMember]}>
          <Text style={[styles.sectionChipText, styles.sectionChipTextMember]}>Membros</Text>
          <Text style={[styles.sectionChipCount, styles.sectionChipCountMember]}>{regularMembers.length}</Text>
        </View>
      );
    }

    const member = item as Member;
    const isCoord = member.role === 'COORDINATOR';

    return (
      <TouchableOpacity
        style={styles.memberCard}
        onPress={() => {
          if (permissions?.can_manage_members) {
            setSelectedMember(member);
            setShowMemberActions(true);
          }
        }}
        disabled={!permissions?.can_manage_members}
      >
        <View style={[styles.memberAvatar, isCoord ? styles.memberAvatarCoord : null]}>
          <Text style={styles.avatarText}>
            {member.user_name.charAt(0).toUpperCase()}
          </Text>
        </View>

        <View style={styles.memberInfo}>
          <Text style={styles.memberName}>{member.user_name}</Text>
          {member.user_email ? (
            <Text style={styles.memberEmailMasked}>{maskEmail(member.user_email)}</Text>
          ) : null}
          <Text style={styles.memberJoined}>
            Desde {formatDate(member.joined_at)}
          </Text>
        </View>

        {isCoord && (
          <View style={styles.coordBadge}>
            <Text style={styles.coordBadgeText}>Coord.</Text>
          </View>
        )}
      </TouchableOpacity>
    );
  };

  const renderInviteModal = () => (
    <Modal
      visible={showInvite}
      animationType="slide"
      transparent
      onRequestClose={() => { setShowInvite(false); setInviteStep('search'); setPendingUser(null); }}
    >
      <View style={styles.modalOverlay}>
        <ScrollView
          style={styles.modalContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={inviteStep === 'confirm' ? handleCancelConfirm : () => setShowInvite(false)}>
              <Ionicons name={inviteStep === 'confirm' ? 'arrow-back' : 'close'} size={24} color={t.text.secondary} />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>
              {inviteStep === 'confirm' ? 'Confirmar Convite' : 'Convidar Membro'}
            </Text>
            <View style={{ width: 24 }} />
          </View>

          {inviteStep === 'confirm' && pendingUser ? (
            <View style={styles.confirmContainer}>
              <View style={styles.confirmAvatar}>
                <Text style={styles.confirmAvatarText}>
                  {pendingUser.name.charAt(0).toUpperCase()}
                </Text>
              </View>
              <Text style={styles.confirmQuestion}>
                Convidar{'\n'}
                <Text style={styles.confirmHighlight}>{pendingUser.name}</Text>
                {'\n'}como{' '}
                <Text style={styles.confirmHighlight}>{ROLE_LABELS[inviteRole]}</Text>
                {'\n'}em{' '}
                <Text style={styles.confirmHighlight}>{params.org_unit_name}</Text>?
              </Text>
              {inviteMessage ? (
                <Text style={styles.confirmMessage}>"{inviteMessage}"</Text>
              ) : null}
              <TouchableOpacity
                style={styles.confirmButton}
                onPress={handleConfirmInvite}
                disabled={isSendingInvite}
              >
                {isSendingInvite
                  ? <ActivityIndicator color={t.text.inverse} />
                  : <Text style={styles.confirmButtonText}>Confirmar</Text>
                }
              </TouchableOpacity>
              <TouchableOpacity style={styles.cancelConfirmButton} onPress={handleCancelConfirm}>
                <Text style={styles.cancelConfirmText}>Voltar</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <>
              <Text style={styles.label}>Buscar usuário</Text>
              <View style={styles.searchInputWrapper}>
                <Ionicons name="search-outline" size={18} color={t.text.tertiary} />
                <TextInput
                  style={styles.searchInput}
                  placeholder="Digite o nome..."
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  placeholderTextColor={t.text.tertiary}
                />
              </View>

              {isSearching && (
                <ActivityIndicator style={styles.searchLoader} color={t.brand.primary} />
              )}

              {searchResults.length > 0 && (
                <View style={styles.searchResults}>
                  {searchResults.map(user => (
                    <TouchableOpacity
                      key={user.id}
                      style={styles.searchResultItem}
                      onPress={() => handleSelectUser(user)}
                      disabled={isSendingInvite}
                    >
                      <View style={styles.searchResultAvatar}>
                        <Text style={styles.avatarText}>
                          {user.name.charAt(0).toUpperCase()}
                        </Text>
                      </View>
                      <View style={styles.searchResultInfo}>
                        <Text style={styles.searchResultName}>{user.name}</Text>
                      </View>
                      <Ionicons name="add-circle" size={24} color={t.brand.primary} />
                    </TouchableOpacity>
                  ))}
                </View>
              )}

              <Text style={styles.label}>Convidar como</Text>
              <View style={styles.roleOptions}>
                <TouchableOpacity
                  style={[styles.roleOption, inviteRole === 'MEMBER' && styles.roleOptionActive]}
                  onPress={() => setInviteRole('MEMBER')}
                >
                  <Text style={[styles.roleOptionText, inviteRole === 'MEMBER' && styles.roleOptionTextActive]}>
                    Membro
                  </Text>
                </TouchableOpacity>
                {!permissions?.is_coordinator && (
                  <TouchableOpacity
                    style={[styles.roleOption, inviteRole === 'COORDINATOR' && styles.roleOptionActive]}
                    onPress={() => setInviteRole('COORDINATOR')}
                  >
                    <Text style={[styles.roleOptionText, inviteRole === 'COORDINATOR' && styles.roleOptionTextActive]}>
                      Coordenador
                    </Text>
                  </TouchableOpacity>
                )}
              </View>

              <Text style={styles.label}>Mensagem (opcional)</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                placeholder="Adicione uma mensagem ao convite..."
                value={inviteMessage}
                onChangeText={setInviteMessage}
                multiline
                numberOfLines={3}
                placeholderTextColor={t.text.tertiary}
              />
            </>
          )}
        </ScrollView>
      </View>
    </Modal>
  );

  const renderMemberActionsModal = () => {
    if (!selectedMember) return null;
    const isCoord = selectedMember.role === 'COORDINATOR';

    return (
      <Modal
        visible={showMemberActions}
        animationType="fade"
        transparent
        onRequestClose={() => setShowMemberActions(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowMemberActions(false)}
        >
          <View style={styles.actionsModal}>
            <Text style={styles.actionsTitle}>{selectedMember.user_name}</Text>
            <Text style={styles.actionsSubtitle}>{ROLE_LABELS[selectedMember.role]}</Text>

            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => handlePromote(selectedMember)}
            >
              <Ionicons
                name={isCoord ? 'arrow-down' : 'arrow-up'}
                size={20}
                color={t.brand.primary}
              />
              <Text style={styles.actionButtonText}>
                {isCoord ? 'Rebaixar para Membro' : 'Promover a Coordenador'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.actionButton, styles.actionButtonDanger]}
              onPress={() => handleRemovePress(selectedMember)}
            >
              <Ionicons name="person-remove" size={20} color="#ef4444" />
              <Text style={[styles.actionButtonText, styles.actionButtonTextDanger]}>
                Remover da Unidade
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.cancelButton}
              onPress={() => setShowMemberActions(false)}
            >
              <Text style={styles.cancelButtonText}>Cancelar</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    );
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={t.brand.primary} />
        <Text style={styles.loadingText}>Carregando membros...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={t.brand.primary} />
        </TouchableOpacity>
        <View style={styles.headerTitle}>
          <Text style={styles.headerTitleText}>{params.org_unit_name}</Text>
          <Text style={styles.headerSubtitle}>{members.length} membros</Text>
        </View>
        <TouchableOpacity
          onPress={() => router.push(`/channel/${params.org_unit_id}` as any)}
          style={styles.canalButton}
        >
          <Ionicons name="chatbubble-outline" size={13} color={t.brand.primary} />
          <Text style={styles.canalButtonText}>Canal</Text>
        </TouchableOpacity>
        {permissions?.can_invite && (
          <TouchableOpacity
            style={styles.inviteButton}
            onPress={() => setShowInvite(true)}
          >
            <Ionicons name="person-add" size={20} color={t.text.inverse} />
          </TouchableOpacity>
        )}
      </View>

      <FlatList
        data={listData}
        renderItem={renderMember}
        keyExtractor={(item) => item.user_id}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            colors={[t.brand.primary]}
          />
        }
        ListHeaderComponent={
          coordinators.length > 0 ? (
            <View style={[styles.sectionChip, styles.sectionChipCoord]}>
              <Text style={[styles.sectionChipText, styles.sectionChipTextCoord]}>Coordenadores</Text>
              <Text style={[styles.sectionChipCount, styles.sectionChipCountCoord]}>{coordinators.length}</Text>
            </View>
          ) : null
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="people-outline" size={48} color={t.text.tertiary} />
            <Text style={styles.emptyText}>Nenhum membro encontrado</Text>
          </View>
        }
      />

      {renderInviteModal()}
      {renderMemberActionsModal()}

      {/* Modal de confirmação de remoção */}
      <Modal
        visible={showRemoveConfirm}
        animationType="fade"
        transparent
        onRequestClose={() => { setShowRemoveConfirm(false); setMemberToRemove(null); }}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.actionsModal}>
            <View style={[styles.confirmAvatar, { backgroundColor: '#fef2f2', width: 64, height: 64, borderRadius: 32 }]}>
              <Ionicons name="person-remove" size={28} color="#ef4444" />
            </View>
            <Text style={[styles.actionsTitle, { marginTop: 12 }]}>Remover Membro</Text>
            <Text style={{
              textAlign: 'center',
              color: t.text.secondary,
              marginTop: 8,
              marginBottom: 20,
              lineHeight: 22,
              fontFamily: typography.family.regular,
            }}>
              Remover{' '}
              <Text style={{ fontFamily: typography.family.bold, color: t.text.primary }}>{memberToRemove?.user_name}</Text>
              {' '}de{' '}
              <Text style={{ fontFamily: typography.family.bold, color: t.text.primary }}>{params.org_unit_name}</Text>?
            </Text>
            <TouchableOpacity
              style={[styles.confirmButton, { backgroundColor: '#ef4444' }]}
              onPress={handleConfirmRemove}
              disabled={isRemoving}
            >
              {isRemoving
                ? <ActivityIndicator color={t.text.inverse} />
                : <Text style={styles.confirmButtonText}>Sim, remover</Text>
              }
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.cancelConfirmButton}
              onPress={() => { setShowRemoveConfirm(false); setMemberToRemove(null); }}
            >
              <Text style={styles.cancelConfirmText}>Cancelar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}
