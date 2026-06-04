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

const colors = {
  admin: '#7c3aed',
  white: '#ffffff',
  gray: '#6b7280',
  lightGray: '#E8E8E8',
  danger: '#dc2626',
  text: '#171717',
  bg: '#f5f5f5',
  success: '#16a34a',
};

const ROLE_LABELS: Record<string, { label: string; color: string }> = {
  DEV:             { label: 'Dev',            color: '#1d4ed8' },
  ADMIN:           { label: 'Admin',          color: '#7c3aed' },
  SECRETARY:       { label: 'Secretário',     color: '#0891b2' },
  AVISOS:          { label: 'Avisos',         color: '#d97706' },
  COUNCIL_GENERAL: { label: 'Conselho Geral', color: '#7c3aed' },
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
        <ActivityIndicator size="large" color={colors.admin} />
      </View>
    );
  }

  if (error || !profile) {
    return (
      <View style={styles.center}>
        <Ionicons name="alert-circle-outline" size={40} color={colors.danger} />
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
      <Section title="Dados Pessoais">
        <Field label="Telefone" value={profile.phone} />
        <Field label="Data de Nascimento" value={profile.birth_date} />
        <Field label="Cidade" value={profile.city} />
        <Field label="Estado" value={profile.state} />
        <Field label="Instagram" value={profile.instagram} />
        <Field label="Cadastrado em" value={profile.created_at?.slice(0, 10)} />
      </Section>

      {/* Documentos */}
      <Section title="Documentos">
        <SensitiveField
          label="CPF"
          value={profile.cpf}
          visible={cpfVisible}
          onToggle={() => setCpfVisible((v) => !v)}
        />
        <SensitiveField
          label="RG"
          value={profile.rg}
          visible={rgVisible}
          onToggle={() => setRgVisible((v) => !v)}
        />
      </Section>

      {/* Auditoria */}
      <Section title={`Auditoria (${profile.audit_entries.length})`}>
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

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

function Field({ label, value }: { label: string; value: string | null | undefined }) {
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
}: {
  label: string;
  value: string | null;
  visible: boolean;
  onToggle: () => void;
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
              color={colors.gray}
            />
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  content: { paddingBottom: 40 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 24 },
  errorText: { color: colors.danger, fontSize: 14, textAlign: 'center' },
  header: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    backgroundColor: colors.white, padding: 16,
    borderBottomWidth: 1, borderBottomColor: colors.lightGray,
  },
  avatar: {
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: colors.admin, alignItems: 'center', justifyContent: 'center',
  },
  avatarText: { color: colors.white, fontSize: 22, fontWeight: '700' },
  name: { fontSize: 17, fontWeight: '700', color: colors.text },
  email: { fontSize: 13, color: colors.gray, marginTop: 2 },
  roleRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 6 },
  rolePill: { borderWidth: 1, borderRadius: 20, paddingHorizontal: 8, paddingVertical: 3 },
  rolePillText: { fontSize: 11, fontWeight: '700' },
  section: {
    backgroundColor: colors.white, marginTop: 12,
    borderRadius: 12, marginHorizontal: 12, overflow: 'hidden',
  },
  sectionTitle: {
    fontSize: 13, fontWeight: '700', color: colors.admin,
    paddingHorizontal: 16, paddingTop: 14, paddingBottom: 8,
    borderBottomWidth: 1, borderBottomColor: colors.lightGray,
  },
  fieldRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 10,
    borderBottomWidth: 1, borderBottomColor: '#f3f4f6',
  },
  fieldLabel: { fontSize: 13, color: colors.gray, flex: 1 },
  fieldValue: { fontSize: 13, color: colors.text, fontWeight: '500', flexShrink: 1, textAlign: 'right' },
  auditRow: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 10,
    paddingHorizontal: 16, paddingVertical: 10,
    borderBottomWidth: 1, borderBottomColor: '#f3f4f6',
  },
  auditDot: {
    width: 8, height: 8, borderRadius: 4,
    backgroundColor: colors.admin, marginTop: 4,
  },
  auditAction: { fontSize: 13, color: colors.text, fontWeight: '500' },
  auditDate: { fontSize: 11, color: colors.gray, marginTop: 2 },
  emptyText: { fontSize: 13, color: colors.gray, padding: 16, textAlign: 'center' },
});
