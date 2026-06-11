/**
 * Community / Invites Screen
 * ==========================
 * Lista convites pendentes para ministérios/grupos.
 * O usuário pode aceitar ou recusar cada convite.
 *
 * BUG-SEMÂNTICO (não corrigir neste CP): este arquivo é nomeado community.tsx
 * e a tab tem title="Comunidade", mas o conteúdo é inviteService.getMyInvites().
 * Rota, serviço e chamada de API permanecem intocados.
 */

import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { inviteService } from '@/services';
import { Invite } from '@/types';
import { useTheme } from '@/theme';
import type { SemanticTokens } from '@/theme';
import { radius, typography } from '@/theme/tokens';
import { showAlert, showConfirm } from '@/utils/alerts';

// ── Mapa de cores por tipo de unidade organizacional ──────────────────────────

const ORG_TYPE_COLORS: Record<string, { bg: string; text: string }> = {
  MINISTERIO:     { bg: '#e6f4f7', text: '#1A859B' },
  GRUPO:          { bg: '#f3ecfd', text: '#7C3AED' },
  SETOR:          { bg: '#eff6ff', text: '#2563EB' },
  CONSELHO_GERAL: { bg: '#fffbeb', text: '#d97706' },
};

const ORG_UNIT_TYPE_LABEL: Record<string, string> = {
  CONSELHO_GERAL: 'Conselho Geral',
  SETOR: 'Setor',
  MINISTERIO: 'Ministério',
  GRUPO: 'Grupo',
};

const ROLE_LABEL: Record<string, string> = {
  COORDINATOR: 'Coordenador',
  MEMBER: 'Membro',
};

// ── Estilos dinâmicos ─────────────────────────────────────────────────────────

const makeStyles = (t: SemanticTokens) => StyleSheet.create({
  container: { flex: 1, backgroundColor: t.bg.screen },
  list: { padding: 16, gap: 12 },

  centered: {
    flex: 1,
    backgroundColor: t.bg.screen,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  emptyIconContainer: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: t.brand.primaryDim,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  emptyTitle: {
    fontSize: typography.size.xl,
    fontFamily: typography.family.bold,
    color: t.text.primary,
    marginBottom: 8,
    textAlign: 'center',
  },
  emptyDescription: {
    fontSize: typography.size.sm,
    color: t.text.secondary,
    textAlign: 'center',
    lineHeight: 22,
    fontFamily: typography.family.regular,
  },

  card: {
    backgroundColor: t.bg.elevated,
    borderRadius: radius.lg,
    padding: 16,
    gap: 10,
    ...t.shadow.sm,
  },
  cardTypePill: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: radius.full,
  },
  cardTypePillText: {
    fontSize: 10,
    fontFamily: typography.family.bold,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  orgName: {
    fontSize: typography.size.lg,
    fontFamily: typography.family.bold,
    color: t.text.primary,
    marginTop: 2,
  },
  orgMeta: {
    fontSize: typography.size.sm,
    color: t.text.secondary,
    fontFamily: typography.family.regular,
    marginTop: 1,
  },
  invitedByRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  invitedBy: {
    fontSize: typography.size.sm,
    color: t.text.tertiary,
    fontFamily: typography.family.regular,
  },
  invitedByName: {
    fontFamily: typography.family.semibold,
    color: t.text.secondary,
  },
  message: {
    fontSize: typography.size.sm,
    color: t.text.tertiary,
    fontStyle: 'italic',
    lineHeight: 18,
    fontFamily: typography.family.italic,
    borderLeftWidth: 2,
    borderLeftColor: t.border.subtle,
    paddingLeft: 10,
  },
  divider: {
    height: 1,
    backgroundColor: t.border.subtle,
    marginVertical: 2,
  },
  actions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 2,
  },
  btn: {
    flex: 1,
    paddingVertical: 11,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnReject: {
    backgroundColor: 'transparent',
  },
  btnRejectText: {
    color: '#dc2626',
    fontFamily: typography.family.semibold,
    fontSize: typography.size.sm,
  },
  btnAccept: {
    backgroundColor: t.brand.primary,
  },
  btnAcceptText: {
    color: t.text.inverse,
    fontFamily: typography.family.bold,
    fontSize: typography.size.sm,
  },
});

// ── Componente principal ──────────────────────────────────────────────────────

export default function InvitesScreen() {
  const { t } = useTheme();
  const styles = makeStyles(t);

  const [invites, setInvites] = useState<Invite[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const fetchInvites = useCallback(async () => {
    setLoading(true);
    try {
      const data = await inviteService.getMyInvites();
      setInvites(data.filter((i) => i.status === 'PENDING'));
    } catch {
      // Silencioso — lista vazia já comunica o estado
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchInvites();
    }, [fetchInvites])
  );

  const handleAccept = async (invite: Invite) => {
    setActionLoading(invite.id);
    try {
      await inviteService.accept(invite.id);
      setInvites((prev) => prev.filter((i) => i.id !== invite.id));
    } catch {
      showAlert('Erro', 'Não foi possível aceitar o convite. Tente novamente.');
    } finally {
      setActionLoading(null);
    }
  };

  const handleReject = (invite: Invite) => {
    showConfirm({
      title: 'Recusar convite',
      message: `Tem certeza que deseja recusar o convite para ${invite.org_unit_name}?`,
      confirmText: 'Recusar',
      destructive: true,
      onConfirm: async () => {
        setActionLoading(invite.id);
        try {
          await inviteService.reject(invite.id);
          setInvites((prev) => prev.filter((i) => i.id !== invite.id));
        } catch {
          showAlert('Erro', 'Não foi possível recusar o convite. Tente novamente.');
        } finally {
          setActionLoading(null);
        }
      },
    });
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={t.brand.primary} />
      </View>
    );
  }

  if (invites.length === 0) {
    return (
      <View style={styles.centered}>
        <View style={styles.emptyIconContainer}>
          <Ionicons name="mail-open-outline" size={48} color={t.brand.primary} />
        </View>
        <Text style={styles.emptyTitle}>Nenhum convite ainda</Text>
        <Text style={styles.emptyDescription}>
          Quando alguém te convidar para um ministério,{'\n'}
          grupo ou setor, o convite aparecerá aqui.
        </Text>
      </View>
    );
  }

  return (
    <FlatList
      data={invites}
      keyExtractor={(item) => item.id}
      contentContainerStyle={styles.list}
      style={styles.container}
      renderItem={({ item }) => {
        const isActing = actionLoading === item.id;
        const unitTypeLabel = ORG_UNIT_TYPE_LABEL[item.org_unit_type] ?? item.org_unit_type;
        const roleLabel = ROLE_LABEL[item.role] ?? item.role;
        const typeColors = ORG_TYPE_COLORS[item.org_unit_type] ?? { bg: t.brand.primaryDim, text: t.brand.primary };

        return (
          <View style={styles.card}>
            {/* Pill do tipo de unidade */}
            <View style={[styles.cardTypePill, { backgroundColor: typeColors.bg }]}>
              <Text style={[styles.cardTypePillText, { color: typeColors.text }]}>
                {unitTypeLabel}
              </Text>
            </View>

            {/* Nome e papel */}
            <View>
              <Text style={styles.orgName}>{item.org_unit_name}</Text>
              <Text style={styles.orgMeta}>Você seria: {roleLabel}</Text>
            </View>

            {/* Convidado por */}
            <View style={styles.invitedByRow}>
              <Ionicons name="person-outline" size={13} color={t.text.tertiary} />
              <Text style={styles.invitedBy}>
                Convidado por{' '}
                <Text style={styles.invitedByName}>{item.invited_by_name}</Text>
              </Text>
            </View>

            {/* Mensagem opcional */}
            {item.message ? (
              <Text style={styles.message}>"{item.message}"</Text>
            ) : null}

            <View style={styles.divider} />

            {/* Ações */}
            <View style={styles.actions}>
              <TouchableOpacity
                style={[styles.btn, styles.btnReject]}
                onPress={() => handleReject(item)}
                disabled={isActing}
              >
                <Text style={styles.btnRejectText}>Recusar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.btn, styles.btnAccept]}
                onPress={() => handleAccept(item)}
                disabled={isActing}
              >
                {isActing ? (
                  <ActivityIndicator size="small" color={t.text.inverse} />
                ) : (
                  <Text style={styles.btnAcceptText}>Aceitar →</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        );
      }}
    />
  );
}
