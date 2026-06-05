/**
 * Admin — Perfil Completo do Usuário
 * ===================================
 * Exibe todos os dados do perfil, incluindo RG/CPF com toggle de visibilidade.
 * Acessível apenas para DEV, ADMIN e SECRETARY.
 * Todo acesso é auditado automaticamente pelo backend.
 */

import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
} from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { adminUserProfileService, UserFullProfile } from '@/services';
import { useTheme } from '@/theme';
import type { SemanticTokens } from '@/theme';

const ADMIN_COLOR = '#7c3aed';

const ROLE_LABELS: Record<string, { label: string; color: string }> = {
  DEV:             { label: 'Dev',            color: '#1d4ed8' },
  ADMIN:           { label: 'Admin',          color: ADMIN_COLOR },
  SECRETARY:       { label: 'Secretário',     color: '#0891b2' },
  AVISOS:          { label: 'Avisos',         color: '#d97706' },
  COUNCIL_GENERAL: { label: 'Conselho Geral', color: ADMIN_COLOR },
  ANALISTA:        { label: 'Analista',       color: '#059669' },
};

const ACTION_LABELS: Record<string, string> = {
  VIEW_FULL_PROFILE:    'Visualizou perfil completo',
  VIEW_SENSITIVE_FIELD: 'Visualizou campo sensível',
  ROLE_GRANTED:         'Cargo concedido',
  ROLE_REVOKED:         'Cargo revogado',
  EXPORT_REQUESTED:     'Solicitou exportação',
  EXPORT_APPROVED:      'Aprovou exportação',
  EXPORT_DOWNLOADED:    'Baixou exportação',
};

export default function UserFullProfileScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t } = useTheme();
  const styles = makeStyles(t);

  const [profile, setProfile] = useState<UserFullProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cpfVisible, setCpfVisible] = useState(false);
  const [rgVisible, setRgVisible] = useState(false);

  useEffect(() => {
    if (!id) return;
    adminUserProfileService
      .getFullProfile(id)
      .then(setProfile)
      .catch((e: any) => {
        const msg = e?.response?.data?.detail?.message ?? 'Erro ao carregar perfil';
        setError(msg);
      })
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={ADMIN_COLOR} />
      </View>
    );
  }

  if (error || !profile) {
    return (
      <View style={styles.center}>
        <Ionicons name="alert-circle-outline" size={40} color={t.status.error} />
        <Text style={styles.errorText}>{error ?? 'Perfil não encontrado'}</Text>
      </View>
    );
  }

  const initial = (profile.name ?? profile.email ?? '?')[0].toUpperCase();

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Cabeçalho */}
      <View style={styles.header}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{initial}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.name}>{profile.name ?? '—'}</Text>
          <Text style={styles.email}>{profile.email ?? '—'}</Text>
          <View style={styles.roleRow}>
            {profile.global_roles.map((r) => {
              const info = ROLE_LABELS[r];
              if (!info) return null;
              return (
                <View key={r} style={[styles.rolePill, { backgroundColor: info.color + '18', borderColor: info.color }]}>
                  <Text style={[styles.rolePillText, { color: info.color }]}>{info.label}</Text>
                </View>
              );
            })}
          </View>
        </View>
      </View>

      {/* Dados Pessoais */}
      <Section title="Dados Pessoais" styles={styles}>
        <Field label="Telefone" value={profile.phone} styles={styles} />
        <Field label="Data de Nascimento" value={profile.birth_date} styles={styles} />
        <Field label="Cidade" value={profile.city} styles={styles} />
        <Field label="Estado" value={profile.state} styles={styles} />
        <Field label="Instagram" value={profile.instagram} styles={styles} />
        <Field label="Cadastrado em" value={profile.created_at?.slice(0, 10)} styles={styles} />
      </Section>

      {/* Documentos */}
      <Section title="Documentos" styles={styles}>
        <SensitiveField
          label="CPF"
          value={profile.cpf}
          visible={cpfVisible}
          onToggle={() => setCpfVisible((v) => !v)}
          styles={styles}
          t={t}
        />
        <SensitiveField
          label="RG"
          value={profile.rg}
          visible={rgVisible}
          onToggle={() => setRgVisible((v) => !v)}
          styles={styles}
          t={t}
        />
      </Section>

      {/* Auditoria */}
      <Section title={`Auditoria (${profile.audit_entries.length})`} styles={styles}>
        {profile.audit_entries.length === 0 ? (
          <Text style={styles.emptyText}>Nenhuma ação registrada</Text>
        ) : (
          profile.audit_entries.map((entry) => (
            <View key={entry.id} style={styles.auditRow}>
              <View style={styles.auditDot} />
              <View style={{ flex: 1 }}>
                <Text style={styles.auditAction}>
                  {ACTION_LABELS[entry.action] ?? entry.action}
                </Text>
                <Text style={styles.auditDate}>
                  {new Date(entry.created_at).toLocaleString('pt-BR')}
                </Text>
              </View>
            </View>
          ))
        )}
      </Section>
    </ScrollView>
  );
}

type Styles = ReturnType<typeof makeStyles>;

function Section({ title, children, styles }: { title: string; children: React.ReactNode; styles: Styles }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

function Field({ label, value, styles }: { label: string; value: string | null | undefined; styles: Styles }) {
  return (
    <View style={styles.fieldRow}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <Text style={styles.fieldValue}>{value ?? '—'}</Text>
    </View>
  );
}

function SensitiveField({
  label,
  value,
  visible,
  onToggle,
  styles,
  t,
}: {
  label: string;
  value: string | null;
  visible: boolean;
  onToggle: () => void;
  styles: Styles;
  t: SemanticTokens;
}) {
  return (
    <View style={styles.fieldRow}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <Text style={styles.fieldValue}>
          {value ? (visible ? value : '•••••••••') : '—'}
        </Text>
        {value && (
          <TouchableOpacity onPress={onToggle}>
            <Ionicons
              name={visible ? 'eye-off-outline' : 'eye-outline'}
              size={18}
              color={t.text.secondary}
            />
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const makeStyles = (t: SemanticTokens) => StyleSheet.create({
  container: { flex: 1, backgroundColor: t.bg.elevated },
  content: { paddingBottom: 40 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 24 },
  errorText: { color: t.status.error, fontSize: 14, textAlign: 'center' },
  header: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    backgroundColor: t.bg.screen, padding: 16,
    borderBottomWidth: 1, borderBottomColor: t.border.subtle,
  },
  avatar: {
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: ADMIN_COLOR, alignItems: 'center', justifyContent: 'center',
  },
  avatarText: { color: '#ffffff', fontSize: 22, fontWeight: '700' },
  name: { fontSize: 17, fontWeight: '700', color: t.text.primary },
  email: { fontSize: 13, color: t.text.secondary, marginTop: 2 },
  roleRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 6 },
  rolePill: { borderWidth: 1, borderRadius: 20, paddingHorizontal: 8, paddingVertical: 3 },
  rolePillText: { fontSize: 11, fontWeight: '700' },
  section: {
    backgroundColor: t.bg.screen, marginTop: 12,
    borderRadius: 12, marginHorizontal: 12, overflow: 'hidden',
  },
  sectionTitle: {
    fontSize: 13, fontWeight: '700', color: ADMIN_COLOR,
    paddingHorizontal: 16, paddingTop: 14, paddingBottom: 8,
    borderBottomWidth: 1, borderBottomColor: t.border.subtle,
  },
  fieldRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 10,
    borderBottomWidth: 1, borderBottomColor: t.border.subtle,
  },
  fieldLabel: { fontSize: 13, color: t.text.secondary, flex: 1 },
  fieldValue: { fontSize: 13, color: t.text.primary, fontWeight: '500', flexShrink: 1, textAlign: 'right' },
  auditRow: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 10,
    paddingHorizontal: 16, paddingVertical: 10,
    borderBottomWidth: 1, borderBottomColor: t.border.subtle,
  },
  auditDot: {
    width: 8, height: 8, borderRadius: 4,
    backgroundColor: ADMIN_COLOR, marginTop: 4,
  },
  auditAction: { fontSize: 13, color: t.text.primary, fontWeight: '500' },
  auditDate: { fontSize: 11, color: t.text.secondary, marginTop: 2 },
  emptyText: { fontSize: 13, color: t.text.secondary, padding: 16, textAlign: 'center' },
});
