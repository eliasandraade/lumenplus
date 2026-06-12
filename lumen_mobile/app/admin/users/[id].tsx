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
  TextInput,
  Modal,
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { adminUserProfileService, UserFullProfile, adminUserService, authService } from '@/services';
import { showAlert } from '@/utils/alerts';
import { parseApiError } from '@/utils/error';
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

  // Papéis do admin logado — busca direta via /auth/me (o authStore pode não
  // estar populado fora do fluxo de onboarding).
  const [me, setMe] = useState<{ user_id: string; global_roles: string[] } | null>(null);
  const [deleteModal, setDeleteModal] = useState(false);
  const [confirmName, setConfirmName] = useState('');
  const [deleteReason, setDeleteReason] = useState('');
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    authService
      .getMe()
      .then((u) => setMe({ user_id: u.user_id, global_roles: u.global_roles }))
      .catch(() => {});
  }, []);

  const handleDelete = async () => {
    if (!id) return;
    setDeleting(true);
    try {
      await adminUserService.deleteUser(id, deleteReason.trim() || undefined);
      setDeleteModal(false);
      showAlert('Conta excluída', 'A conta foi anonimizada com sucesso.', () => router.back());
    } catch (e) {
      showAlert('Erro', parseApiError(e, 'Não foi possível excluir a conta'));
    } finally {
      setDeleting(false);
    }
  };

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

  // Quem pode excluir (espelha o backend): DEV exclui qualquer um exceto si e DEV;
  // ADMIN exclui apenas não-DEV/não-ADMIN; ninguém exclui a si mesmo por aqui.
  const myRoles = me?.global_roles ?? [];
  const iAmDev = myRoles.includes('DEV');
  const iAmAdmin = myRoles.includes('ADMIN');
  const targetIsDev = profile.global_roles.includes('DEV');
  const targetIsAdmin = profile.global_roles.includes('ADMIN');
  const isSelf = me?.user_id === profile.id;
  const canDelete =
    (iAmDev || iAmAdmin) && !isSelf && !targetIsDev && (iAmDev || !targetIsAdmin);

  const confirmTarget = profile.name || profile.email || 'EXCLUIR';

  return (
    <>
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

      {/* Zona de perigo — exclusão de conta */}
      {canDelete && (
        <View style={styles.dangerZone}>
          <Text style={styles.dangerTitle}>Zona de perigo</Text>
          <Text style={styles.dangerDesc}>
            Excluir anonimiza permanentemente os dados pessoais desta conta (LGPD).
            Logs de auditoria e consentimentos são retidos por obrigação legal.
          </Text>
          <TouchableOpacity
            style={styles.dangerBtn}
            onPress={() => { setConfirmName(''); setDeleteReason(''); setDeleteModal(true); }}
          >
            <Ionicons name="trash-outline" size={18} color="#ffffff" />
            <Text style={styles.dangerBtnText}>Excluir conta</Text>
          </TouchableOpacity>
        </View>
      )}
    </ScrollView>

    <Modal
      visible={deleteModal}
      transparent
      animationType="fade"
      onRequestClose={() => { if (!deleting) setDeleteModal(false); }}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalBox}>
          <Ionicons name="warning-outline" size={28} color={t.status.error} style={{ alignSelf: 'center' }} />
          <Text style={styles.modalTitle}>Excluir conta</Text>
          <Text style={styles.modalText}>
            Esta ação é irreversível. Para confirmar, digite o nome do usuário:
          </Text>
          <Text style={styles.modalTargetName}>{confirmTarget}</Text>
          <TextInput
            style={styles.modalInput}
            value={confirmName}
            onChangeText={setConfirmName}
            placeholder="Digite para confirmar"
            placeholderTextColor={t.text.tertiary}
            autoCapitalize="none"
          />
          <TextInput
            style={[styles.modalInput, { marginTop: 8 }]}
            value={deleteReason}
            onChangeText={setDeleteReason}
            placeholder="Motivo (opcional)"
            placeholderTextColor={t.text.tertiary}
          />
          <View style={styles.modalRow}>
            <TouchableOpacity
              style={styles.modalCancel}
              onPress={() => setDeleteModal(false)}
              disabled={deleting}
            >
              <Text style={styles.modalCancelText}>Cancelar</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.modalDelete,
                (confirmName.trim() !== confirmTarget || deleting) && { opacity: 0.5 },
              ]}
              onPress={handleDelete}
              disabled={confirmName.trim() !== confirmTarget || deleting}
            >
              {deleting
                ? <ActivityIndicator color="#ffffff" size="small" />
                : <Text style={styles.modalDeleteText}>Excluir</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
    </>
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
  dangerZone: {
    marginTop: 16, marginHorizontal: 12, padding: 16, borderRadius: 12,
    borderWidth: 1, borderColor: t.status.error, backgroundColor: t.status.errorBg,
  },
  dangerTitle: {
    fontSize: 13, fontWeight: '800', color: t.status.error, marginBottom: 6,
    textTransform: 'uppercase', letterSpacing: 0.5,
  },
  dangerDesc: { fontSize: 12, color: t.text.secondary, lineHeight: 17, marginBottom: 12 },
  dangerBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: t.status.error, borderRadius: 10, paddingVertical: 12,
  },
  dangerBtnText: { color: '#ffffff', fontSize: 14, fontWeight: '700' },
  modalOverlay: {
    flex: 1, backgroundColor: t.bg.overlay,
    alignItems: 'center', justifyContent: 'center', padding: 24,
  },
  modalBox: {
    backgroundColor: t.bg.elevated, borderRadius: 16, padding: 20,
    width: '100%', maxWidth: 360, gap: 6,
  },
  modalTitle: { fontSize: 17, fontWeight: '700', color: t.text.primary, textAlign: 'center', marginTop: 4 },
  modalText: { fontSize: 13, color: t.text.secondary, textAlign: 'center', lineHeight: 18 },
  modalTargetName: { fontSize: 14, fontWeight: '700', color: t.text.primary, textAlign: 'center', marginBottom: 6 },
  modalInput: {
    backgroundColor: t.bg.surface, borderRadius: 10, borderWidth: 1,
    borderColor: t.border.subtle, padding: 12, fontSize: 14, color: t.text.primary,
  },
  modalRow: { flexDirection: 'row', gap: 10, marginTop: 12 },
  modalCancel: {
    flex: 1, borderWidth: 1.5, borderColor: t.border.subtle, borderRadius: 12,
    padding: 12, alignItems: 'center',
  },
  modalCancelText: { fontSize: 14, fontWeight: '600', color: t.text.primary },
  modalDelete: {
    flex: 1, backgroundColor: t.status.error, borderRadius: 12,
    padding: 12, alignItems: 'center', justifyContent: 'center',
  },
  modalDeleteText: { fontSize: 14, fontWeight: '700', color: '#ffffff' },
});
