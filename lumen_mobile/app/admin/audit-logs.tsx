/**
 * Audit Logs Screen
 * =================
 * Lista todos os eventos de auditoria do sistema.
 * Acesso restrito a ADMIN e DEV (backend valida via require_admin_or_analista).
 */

import { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  TextInput,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import type { IoniconsName } from '@/types/icons';
import { api } from '@/services/api';
import { useTheme } from '@/theme';
import type { SemanticTokens } from '@/theme';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface AuditLogItem {
  id: string;
  action: string;
  actor_name: string | null;
  entity_type: string | null;
  entity_id: string | null;
  extra_data: Record<string, any> | null;
  created_at: string;
}

interface AuditLogsResponse {
  total: number;
  page: number;
  page_size: number;
  items: AuditLogItem[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Mapeia as ações REALMENTE emitidas pelo backend para rótulos amigáveis.
 * Fonte: grep de AuditLog/create_audit_log em backend/app (Fase 1 do Admin 2.0).
 */
const ACTION_META: Record<string, { label: string; color: string; icon: string }> = {
  // Organização / membros
  member_removed:       { label: 'Membro removido',          color: '#dc2626', icon: 'person-remove-outline' },
  member_role_updated:  { label: 'Cargo de membro alterado', color: '#7c3aed', icon: 'swap-horizontal-outline' },
  org_unit_created:     { label: 'Entidade criada',          color: '#059669', icon: 'git-network-outline' },
  membership_requested: { label: 'Participação solicitada',  color: '#0891b2', icon: 'person-add-outline' },
  membership_approved:  { label: 'Participação aprovada',    color: '#059669', icon: 'checkmark-circle-outline' },
  membership_rejected:  { label: 'Participação recusada',    color: '#d97706', icon: 'close-circle-outline' },

  // Acesso a dados pessoais (segurança)
  VIEW_FULL_PROFILE:          { label: 'Perfil completo visualizado',     color: '#7c3aed', icon: 'eye-outline' },
  VIEW_CPF_RG:                { label: 'CPF/RG visualizados',             color: '#dc2626', icon: 'lock-open-outline' },
  sensitive_access_requested: { label: 'Acesso sensível solicitado',      color: '#d97706', icon: 'key-outline' },
  sensitive_access_approved:  { label: 'Acesso sensível aprovado',        color: '#059669', icon: 'key-outline' },
  sensitive_access_rejected:  { label: 'Acesso sensível rejeitado',       color: '#dc2626', icon: 'key-outline' },
  sensitive_documents_viewed: { label: 'Documentos sensíveis visualizados', color: '#dc2626', icon: 'document-lock-outline' },

  // Exportações
  EXPORT_REQUESTED:  { label: 'Exportação solicitada', color: '#d97706', icon: 'download-outline' },
  EXPORT_APPROVED:   { label: 'Exportação aprovada',   color: '#059669', icon: 'download-outline' },
  EXPORT_REJECTED:   { label: 'Exportação rejeitada',  color: '#dc2626', icon: 'download-outline' },
  EXPORT_DOWNLOADED: { label: 'Exportação baixada',    color: '#0891b2', icon: 'download-outline' },

  // Conta e perfil
  user_provisioned: { label: 'Primeiro acesso (conta criada)', color: '#059669', icon: 'person-add-outline' },
  account_deleted:  { label: 'Conta excluída',                 color: '#dc2626', icon: 'trash-outline' },
  profile_created:  { label: 'Perfil criado',                  color: '#0891b2', icon: 'create-outline' },
  profile_updated:  { label: 'Perfil atualizado',              color: '#0891b2', icon: 'create-outline' },
  legal_accepted:   { label: 'Termos aceitos',                 color: '#6b7280', icon: 'document-text-outline' },

  // Verificações
  phone_verification_started: { label: 'Verificação de telefone iniciada', color: '#6b7280', icon: 'call-outline' },
  phone_verified:             { label: 'Telefone verificado',              color: '#059669', icon: 'call-outline' },
  email_verification_started: { label: 'Verificação de e-mail iniciada',   color: '#6b7280', icon: 'mail-outline' },
  email_verified:             { label: 'E-mail verificado',                color: '#059669', icon: 'mail-outline' },

  // Comunicação / canais
  inbox_critical_sent:            { label: 'Aviso crítico enviado',      color: '#dc2626', icon: 'megaphone-outline' },
  channel_post_created:           { label: 'Post criado no canal',       color: '#059669', icon: 'chatbox-outline' },
  channel_post_edited:            { label: 'Post editado',               color: '#0891b2', icon: 'chatbox-outline' },
  channel_post_deleted:           { label: 'Post excluído',              color: '#dc2626', icon: 'chatbox-outline' },
  channel_post_highlight_toggled: { label: 'Destaque de post alterado',  color: '#7c3aed', icon: 'star-outline' },
  channel_reply_created:          { label: 'Resposta criada',            color: '#059669', icon: 'chatbubble-outline' },
  channel_reply_edited:           { label: 'Resposta editada',           color: '#0891b2', icon: 'chatbubble-outline' },
  channel_reply_deleted:          { label: 'Resposta excluída',          color: '#dc2626', icon: 'chatbubble-outline' },
};

function getActionMeta(action: string) {
  return ACTION_META[action] ?? { label: action, color: '#6b7280', icon: 'document-text-outline' };
}

function formatDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function buildExtraSummary(extra: Record<string, any> | null): string {
  if (!extra) return '';
  const parts: string[] = [];
  if (extra.removed_role)          parts.push(`Cargo: ${extra.removed_role}`);
  if (extra.new_role)              parts.push(`Novo cargo: ${extra.new_role}`);
  if (extra.old_role)              parts.push(`Cargo anterior: ${extra.old_role}`);
  if (extra.is_self_removal)       parts.push('Auto-remoção');
  if (extra.removed_by_parent_coord) parts.push('Por coord. pai');
  return parts.join(' · ');
}

const ADMIN_COLOR = '#7c3aed';

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

const PAGE_SIZE = 25;

export default function AuditLogsScreen() {
  const { t } = useTheme();
  const styles = makeStyles(t);

  const [items, setItems]           = useState<AuditLogItem[]>([]);
  const [total, setTotal]           = useState(0);
  const [page, setPage]             = useState(1);
  const [loading, setLoading]       = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError]           = useState<string | null>(null);
  const [filterAction, setFilterAction] = useState('');

  const fetchPage = useCallback(async (p: number, replace: boolean) => {
    try {
      const params = new URLSearchParams({
        page: String(p),
        page_size: String(PAGE_SIZE),
      });
      if (filterAction.trim()) params.set('action', filterAction.trim());

      const result = await api.get<AuditLogsResponse>(`/admin/audit-logs?${params}`);
      setTotal(result.total);
      setPage(p);
      setItems(prev => replace ? result.items : [...prev, ...result.items]);
      setError(null);
    } catch (err: any) {
      const msg =
        err?.response?.data?.detail?.message ||
        err?.message ||
        'Erro ao carregar logs';
      setError(msg);
    }
  }, [filterAction]);

  // Reload whenever screen is focused
  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      fetchPage(1, true).finally(() => setLoading(false));
    }, [fetchPage])
  );

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchPage(1, true);
    setRefreshing(false);
  };

  const handleLoadMore = async () => {
    if (loadingMore || items.length >= total) return;
    setLoadingMore(true);
    await fetchPage(page + 1, false);
    setLoadingMore(false);
  };

  const handleSearch = () => {
    setLoading(true);
    fetchPage(1, true).finally(() => setLoading(false));
  };

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  const renderItem = ({ item }: { item: AuditLogItem }) => {
    const meta    = getActionMeta(item.action);
    const extra   = buildExtraSummary(item.extra_data);
    const entity  = item.entity_type
      ? `${item.entity_type}${item.entity_id ? ` #${item.entity_id.slice(0, 8)}` : ''}`
      : null;

    return (
      <View style={styles.card}>
        {/* Icon + action */}
        <View style={styles.cardHeader}>
          <View style={[styles.iconBadge, { backgroundColor: `${meta.color}18` }]}>
            <Ionicons name={meta.icon as IoniconsName} size={18} color={meta.color} />
          </View>
          <View style={styles.cardHeaderText}>
            <Text style={[styles.actionLabel, { color: meta.color }]}>{meta.label}</Text>
            <Text style={styles.dateText}>{formatDate(item.created_at)}</Text>
          </View>
        </View>

        {/* Actor */}
        {item.actor_name && (
          <View style={styles.rowMeta}>
            <Ionicons name="person-outline" size={13} color={t.text.secondary} />
            <Text style={styles.metaText}>{item.actor_name}</Text>
          </View>
        )}

        {/* Entity */}
        {entity && (
          <View style={styles.rowMeta}>
            <Ionicons name="cube-outline" size={13} color={t.text.secondary} />
            <Text style={styles.metaText}>{entity}</Text>
          </View>
        )}

        {/* Extra summary */}
        {extra !== '' && (
          <View style={styles.rowMeta}>
            <Ionicons name="information-circle-outline" size={13} color={t.text.secondary} />
            <Text style={styles.metaText}>{extra}</Text>
          </View>
        )}
      </View>
    );
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={ADMIN_COLOR} />
        <Text style={styles.loadingText}>Carregando logs…</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.center}>
        <Ionicons name="alert-circle-outline" size={48} color={t.status.error} />
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity style={styles.retryBtn} onPress={handleRefresh}>
          <Text style={styles.retryBtnText}>Tentar novamente</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Filter bar */}
      <View style={styles.filterBar}>
        <TextInput
          style={styles.filterInput}
          placeholder="Filtrar por ação (ex: member_removed)"
          placeholderTextColor={t.text.tertiary}
          value={filterAction}
          onChangeText={setFilterAction}
          onSubmitEditing={handleSearch}
          returnKeyType="search"
          autoCapitalize="none"
        />
        <TouchableOpacity style={styles.searchBtn} onPress={handleSearch}>
          <Ionicons name="search" size={18} color={t.text.inverse} />
        </TouchableOpacity>
        {filterAction !== '' && (
          <TouchableOpacity
            style={styles.clearBtn}
            onPress={() => { setFilterAction(''); handleSearch(); }}
          >
            <Ionicons name="close" size={18} color={t.text.secondary} />
          </TouchableOpacity>
        )}
      </View>

      {/* Total count */}
      <Text style={styles.totalText}>
        {total} {total === 1 ? 'registro' : 'registros'}
      </Text>

      <FlatList
        data={items}
        keyExtractor={item => item.id}
        renderItem={renderItem}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            colors={[ADMIN_COLOR]}
            tintColor={ADMIN_COLOR}
          />
        }
        onEndReached={handleLoadMore}
        onEndReachedThreshold={0.3}
        ListFooterComponent={
          loadingMore
            ? <ActivityIndicator style={{ marginVertical: 16 }} color={ADMIN_COLOR} />
            : items.length >= total && items.length > 0
              ? <Text style={styles.endText}>Todos os registros carregados</Text>
              : null
        }
        ListEmptyComponent={
          <View style={styles.center}>
            <Ionicons name="document-text-outline" size={48} color={t.border.default} />
            <Text style={styles.emptyText}>Nenhum log encontrado</Text>
          </View>
        }
      />
    </View>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const makeStyles = (t: SemanticTokens) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: t.bg.elevated,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    gap: 12,
  },
  loadingText: {
    color: t.text.secondary,
    marginTop: 8,
  },
  errorText: {
    color: t.status.error,
    textAlign: 'center',
    fontSize: 14,
  },
  retryBtn: {
    marginTop: 8,
    paddingHorizontal: 24,
    paddingVertical: 10,
    backgroundColor: ADMIN_COLOR,
    borderRadius: 8,
  },
  retryBtnText: {
    color: t.text.inverse,
    fontWeight: '600',
  },
  filterBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: t.bg.screen,
    margin: 12,
    borderRadius: 10,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: t.border.subtle,
  },
  filterInput: {
    flex: 1,
    height: 42,
    fontSize: 13,
    color: t.text.primary,
  },
  searchBtn: {
    backgroundColor: ADMIN_COLOR,
    borderRadius: 6,
    padding: 6,
    marginLeft: 6,
  },
  clearBtn: {
    padding: 6,
    marginLeft: 2,
  },
  totalText: {
    fontSize: 12,
    color: t.text.secondary,
    marginLeft: 16,
    marginBottom: 4,
  },
  list: {
    paddingHorizontal: 12,
    paddingBottom: 32,
  },
  card: {
    backgroundColor: t.bg.screen,
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    gap: 6,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 4,
  },
  iconBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardHeaderText: {
    flex: 1,
  },
  actionLabel: {
    fontSize: 14,
    fontWeight: '700',
  },
  dateText: {
    fontSize: 11,
    color: t.text.tertiary,
    marginTop: 1,
  },
  rowMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  metaText: {
    fontSize: 12,
    color: t.text.secondary,
    flexShrink: 1,
  },
  endText: {
    textAlign: 'center',
    color: t.text.tertiary,
    fontSize: 12,
    marginVertical: 16,
  },
  emptyText: {
    color: t.text.tertiary,
    fontSize: 14,
    marginTop: 8,
  },
});
