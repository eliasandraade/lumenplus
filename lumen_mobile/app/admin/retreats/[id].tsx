/**
 * Admin — Retreat Detail & Management
 * ====================================
 * Gerencia retiro: casas, taxas, inscrições (papéis, casa atribuída, pagamentos), ações de status.
 */

import { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, RefreshControl, Modal, TextInput, Linking,
} from 'react-native';
import { router, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import api from '@/services/api';
import { adminUserService, type AdminUserItem } from '@/services';
import { useTheme } from '@/theme';
import type { SemanticTokens } from '@/theme';

const ADMIN_COLOR = '#7c3aed';
const ADMIN_TEXT_LIGHT = 'rgba(196, 181, 253, 0.9)'; // light purple for selected/active state

// Static status colors kept as constants (not theme-dependent — semantic status colors)
const STATUS_META: Record<string, { label: string; color: string }> = {
  DRAFT:     { label: 'Rascunho',  color: '#6b7280' },
  PUBLISHED: { label: 'Publicado', color: '#059669' },
  CLOSED:    { label: 'Encerrado', color: '#2563eb' },
  CANCELLED: { label: 'Cancelado', color: '#dc2626' },
};

const REG_STATUS_META: Record<string, { label: string; color: string }> = {
  PENDING_PAYMENT:   { label: 'Ag. pagamento',     color: '#d97706' },
  PAYMENT_SUBMITTED: { label: 'Comprovante enviado', color: '#2563eb' },
  CONFIRMED:         { label: 'Confirmado',          color: '#059669' },
  CANCELLED:         { label: 'Cancelado',           color: '#6b7280' },
  WAITLIST:          { label: 'Espera',              color: '#7c3aed' },
};

const TYPE_LABEL: Record<string, string> = {
  WEEKEND: 'Fim de semana',
  DAY: 'Dia único',
  FORMATION: 'Formação',
};

const MODALITY_LABEL: Record<string, string> = {
  PRESENCIAL: 'Presencial',
  HIBRIDO: 'Híbrido',
};

const FEE_ALL_CATEGORIES = [
  { key: 'PARTICIPANTE',          label: 'Participante' },
  { key: 'PARTICIPANTE_MISSAO',   label: 'Participante de Missão' },
  { key: 'PARTICIPANTE_CASAS',    label: 'Participante de Casas' },
  { key: 'PARTICIPANTE_CV',       label: 'Participante da CV' },
  { key: 'EQUIPE_SERVICO',        label: 'Equipe de Serviço' },
  { key: 'EQUIPE_SERVICO_MISSAO', label: 'ES de Missão' },
  { key: 'EQUIPE_SERVICO_CASAS',  label: 'ES de Casas' },
  { key: 'EQUIPE_SERVICO_CV',     label: 'ES da CV' },
  { key: 'HIBRIDO',               label: 'Híbrido (taxa única)' },
];

interface House {
  id: string;
  name: string;
  modality: string;
  max_participants: number | null;
}

interface FeeType {
  fee_category: string;
  label: string;
  amount_brl: string;
}

interface Registration {
  id: string;
  user_id: string;
  user_name: string | null;
  status: string;
  modality_preference: string | null;
  retreat_role: string;
  fee_category: string | null;
  fee_label: string | null;
  assigned_house_id: string | null;
  assigned_house_name: string | null;
  notes: string | null;
  payment_proof_url: string | null;
  payment_submitted_at: string | null;
  payment_confirmed_at: string | null;
  payment_rejection_reason: string | null;
  created_at: string;
  team_preferences: { team_id: string; preference_order: number }[];
  team_assignments: { member_id: string; team_id: string; role: string; house_id: string | null }[];
}

interface EligibilityRule {
  id: string;
  rule_type: string;       // ORG_UNIT | VOCATIONAL_REALITY
  org_unit_id: string | null;
  org_unit_name: string | null;
  vocational_reality_code: string | null;
  rule_group: string;      // PARTICIPANT | SERVICE
}

interface OrgUnit {
  id: string;
  name: string;
  unit_type: string;
}

interface VocRealityItem {
  id: string;
  code: string;
  label: string;
}

interface OrgTreeNode {
  id: string;
  name: string;
  type: string;
  children?: OrgTreeNode[];
}

interface ServiceTeamMember {
  id: string;
  registration_id: string;
  user_id: string | null;
  user_name: string | null;
  role: string;
  house_id: string | null;
  house_name: string | null;
}

interface ServiceTeam {
  id: string;
  name: string;
  description: string | null;
  members: ServiceTeamMember[];
}

interface RetreatCoordinator {
  id: string;
  user_id: string;
  user_name: string | null;
  created_at: string;
}

interface RetreatDetail {
  id: string;
  title: string;
  description: string | null;
  retreat_type: string;
  status: string;
  start_date: string;
  end_date: string;
  location: string | null;
  address: string | null;
  max_participants: number | null;
  visibility_type: string;
  registrations_count: number;
  houses: House[];
  fee_types: FeeType[];
  participant_eligibility_rules: EligibilityRule[];
  service_eligibility_rules: EligibilityRule[];
  service_teams: ServiceTeam[];
  coordinators: RetreatCoordinator[];
}

export default function AdminRetreatDetailScreen() {
  const { t } = useTheme();
  const styles = makeStyles(t);

  const { id } = useLocalSearchParams<{ id: string }>();
  const [retreat, setRetreat]       = useState<RetreatDetail | null>(null);
  const [regs, setRegs]             = useState<Registration[]>([]);
  const [loading, setLoading]       = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError]           = useState<string | null>(null);
  const [actionMsg, setActionMsg]   = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);

  // Status change confirm modal
  const [confirmModal, setConfirmModal] = useState<{
    title: string; body: string; action: () => Promise<void>;
  } | null>(null);

  // Reject payment modal
  const [rejectModal, setRejectModal]     = useState<{ regId: string } | null>(null);
  const [rejectReason, setRejectReason]   = useState('');

  // Add/Edit house modal
  const [houseModal, setHouseModal] = useState<{
    mode: 'add' | 'edit';
    house?: House;
  } | null>(null);
  const [houseName, setHouseName]               = useState('');
  const [houseModality, setHouseModality]       = useState<'PRESENCIAL' | 'HIBRIDO'>('PRESENCIAL');
  const [houseCapacity, setHouseCapacity]       = useState('');

  // Fee types modal
  const [showFeeModal, setShowFeeModal] = useState(false);
  const [feeValues, setFeeValues]       = useState<Record<string, string>>({});

  // Assign house modal
  const [assignHouseModal, setAssignHouseModal] = useState<{ regId: string } | null>(null);

  // Change role modal
  const [roleModal, setRoleModal] = useState<{ regId: string; currentRole: string } | null>(null);

  // Eligibility rule modal
  const [eligibilityModal, setEligibilityModal] = useState<{ group: 'PARTICIPANT' | 'SERVICE' } | null>(null);
  const [ruleType, setRuleType]               = useState<'ORG_UNIT' | 'VOCATIONAL_REALITY'>('ORG_UNIT');
  const [orgUnits, setOrgUnits]               = useState<OrgUnit[]>([]);
  const [selectedOrgUnit, setSelectedOrgUnit] = useState<OrgUnit | null>(null);
  const [orgUnitsLoaded, setOrgUnitsLoaded]   = useState(false);
  const [vocRealityItems, setVocRealityItems] = useState<VocRealityItem[]>([]);
  const [selectedVocItem, setSelectedVocItem] = useState<VocRealityItem | null>(null);
  const [catalogLoaded, setCatalogLoaded]     = useState(false);

  // Service team modal
  const [teamModal, setTeamModal] = useState<{ mode: 'create' } | { mode: 'assign'; team: ServiceTeam } | null>(null);
  const [teamName, setTeamName]   = useState('');
  const [teamDesc, setTeamDesc]   = useState('');
  // Assign member to team
  const [assignTeamRegId, setAssignTeamRegId]     = useState('');
  const [assignTeamRole, setAssignTeamRole]       = useState<'COORDENADOR' | 'MEMBRO' | 'APOIO'>('MEMBRO');
  const [assignTeamHouseId, setAssignTeamHouseId] = useState<string | null>(null);

  // Coordinator modal
  const [coordModal, setCoordModal]   = useState(false);
  const [coordUserId, setCoordUserId] = useState('');
  const [coordSearch, setCoordSearch] = useState('');
  // Busca de membros gerais (coordenador que não é inscrito do retiro)
  const [memberQuery, setMemberQuery]     = useState('');
  const [memberResults, setMemberResults] = useState<AdminUserItem[]>([]);
  const [memberLoading, setMemberLoading] = useState(false);
  const [coordName, setCoordName]         = useState('');

  const fetchData = async () => {
    try {
      const [retreatRes, regsRes] = await Promise.all([
        api.get<RetreatDetail>(`/admin/retreats/${id}`),
        api.get<{ registrations: Registration[] }>(`/admin/retreats/${id}/registrations`),
      ]);
      setRetreat(retreatRes);
      setRegs(regsRes.registrations || []);
      setError(null);
    } catch (err: any) {
      setError(err?.response?.data?.detail?.message || 'Erro ao carregar retiro');
    }
  };

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      fetchData().finally(() => setLoading(false));
    }, [id])
  );

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchData();
    setRefreshing(false);
  };

  const doAction = async (endpoint: string, msg: string) => {
    setProcessing(true);
    setConfirmModal(null);
    try {
      await api.post(endpoint, {});
      setActionMsg(msg);
      await fetchData();
    } catch (err: any) {
      setActionMsg(err?.response?.data?.detail?.message || 'Erro ao executar ação');
    } finally {
      setProcessing(false);
    }
  };

  // ---- Houses ----
  const openAddHouse = () => {
    setHouseName('');
    setHouseModality('PRESENCIAL');
    setHouseCapacity('');
    setHouseModal({ mode: 'add' });
  };

  const openEditHouse = (house: House) => {
    setHouseName(house.name);
    setHouseModality(house.modality as 'PRESENCIAL' | 'HIBRIDO');
    setHouseCapacity(house.max_participants?.toString() ?? '');
    setHouseModal({ mode: 'edit', house });
  };

  const handleSaveHouse = async () => {
    if (!houseName.trim()) { setActionMsg('Informe o nome da casa'); return; }
    setProcessing(true);
    const body = {
      name: houseName.trim(),
      modality: houseModality,
      max_participants: houseCapacity ? parseInt(houseCapacity) : null,
    };
    try {
      if (houseModal?.mode === 'edit' && houseModal.house) {
        await api.put(`/admin/retreats/${id}/houses/${houseModal.house.id}`, body);
        setActionMsg('Casa atualizada');
      } else {
        await api.post(`/admin/retreats/${id}/houses`, body);
        setActionMsg('Casa adicionada');
      }
      setHouseModal(null);
      await fetchData();
    } catch (err: any) {
      setActionMsg(err?.response?.data?.detail?.message || 'Erro ao salvar casa');
    } finally {
      setProcessing(false);
    }
  };

  const handleDeleteHouse = async (houseId: string) => {
    setProcessing(true);
    try {
      await api.delete(`/admin/retreats/${id}/houses/${houseId}`);
      setActionMsg('Casa removida');
      await fetchData();
    } catch (err: any) {
      setActionMsg(err?.response?.data?.detail?.message || 'Erro ao remover casa');
    } finally {
      setProcessing(false);
    }
  };

  // ---- Fee types ----
  const openFeeModal = () => {
    if (!retreat) return;
    const existing: Record<string, string> = {};
    retreat.fee_types.forEach(ft => { existing[ft.fee_category] = ft.amount_brl; });
    setFeeValues(existing);
    setShowFeeModal(true);
  };

  const handleSaveFees = async () => {
    const feeTypes = Object.entries(feeValues)
      .filter(([, v]) => v.trim() !== '')
      .map(([fee_category, amount_brl]) => ({ fee_category, amount_brl: amount_brl.trim() }));
    setProcessing(true);
    try {
      await api.post(`/admin/retreats/${id}/fee-types`, { fee_types: feeTypes });
      setActionMsg('Taxas salvas');
      setShowFeeModal(false);
      await fetchData();
    } catch (err: any) {
      setActionMsg(err?.response?.data?.detail?.message || 'Erro ao salvar taxas');
    } finally {
      setProcessing(false);
    }
  };

  // ---- Assign house ----
  const handleAssignHouse = async (houseId: string | null) => {
    if (!assignHouseModal) return;
    setProcessing(true);
    try {
      await api.patch(`/admin/retreats/${id}/registrations/${assignHouseModal.regId}/house`, {
        house_id: houseId,
      });
      setActionMsg(houseId ? 'Casa atribuída' : 'Atribuição removida');
      setAssignHouseModal(null);
      await fetchData();
    } catch (err: any) {
      setActionMsg(err?.response?.data?.detail?.message || 'Erro ao atribuir casa');
    } finally {
      setProcessing(false);
    }
  };

  // ---- Change role ----
  const handleSetRole = async (role: string) => {
    if (!roleModal) return;
    setProcessing(true);
    try {
      await api.patch(`/admin/retreats/${id}/registrations/${roleModal.regId}/role`, {
        retreat_role: role,
      });
      setActionMsg('Papel atualizado');
      setRoleModal(null);
      await fetchData();
    } catch (err: any) {
      setActionMsg(err?.response?.data?.detail?.message || 'Erro ao mudar papel');
    } finally {
      setProcessing(false);
    }
  };

  // ---- Eligibility rules ----
  const openEligibilityModal = async (group: 'PARTICIPANT' | 'SERVICE') => {
    setRuleType('ORG_UNIT');
    setSelectedOrgUnit(null);
    setSelectedVocItem(null);
    setEligibilityModal({ group });

    // Fetch org units (flattened from tree) — once
    if (!orgUnitsLoaded) {
      try {
        const treeRes = await api.get<{ root: OrgTreeNode | null }>('/org/tree');
        const flat: OrgUnit[] = [];
        const flattenTree = (node: OrgTreeNode | null) => {
          if (!node) return;
          // Skip the root CONSELHO_GERAL in the list (too broad)
          if (node.type !== 'CONSELHO_GERAL') {
            flat.push({ id: node.id, name: node.name, unit_type: node.type });
          }
          node.children?.forEach(flattenTree);
        };
        flattenTree(treeRes.root);
        setOrgUnits(flat);
        setOrgUnitsLoaded(true);
      } catch {
        setOrgUnits([]);
      }
    }

    // Fetch vocational reality catalog items — once
    if (!catalogLoaded) {
      try {
        const catalogs = await api.get<{ code: string; name: string; items: VocRealityItem[] }[]>('/profile/catalogs');
        const vocCatalog = catalogs.find(c => c.code === 'VOCATIONAL_REALITY');
        setVocRealityItems(vocCatalog?.items || []);
        setCatalogLoaded(true);
      } catch {
        setVocRealityItems([]);
      }
    }
  };

  const handleAddEligibilityRule = async () => {
    if (!eligibilityModal) return;
    if (ruleType === 'ORG_UNIT' && !selectedOrgUnit) {
      setActionMsg('Selecione uma unidade'); return;
    }
    if (ruleType === 'VOCATIONAL_REALITY' && !selectedVocItem) {
      setActionMsg('Selecione uma realidade vocacional'); return;
    }
    setProcessing(true);
    try {
      await api.post(`/admin/retreats/${id}/eligibility-rules`, {
        rule_type: ruleType,
        org_unit_id: ruleType === 'ORG_UNIT' ? selectedOrgUnit!.id : null,
        vocational_reality_code: ruleType === 'VOCATIONAL_REALITY' ? selectedVocItem!.code : null,
        rule_group: eligibilityModal.group,
      });
      setActionMsg('Regra adicionada');
      setEligibilityModal(null);
      await fetchData();
    } catch (err: any) {
      setActionMsg(err?.response?.data?.detail?.message || 'Erro ao adicionar regra');
    } finally {
      setProcessing(false);
    }
  };

  const handleDeleteEligibilityRule = async (ruleId: string) => {
    setProcessing(true);
    try {
      await api.delete(`/admin/retreats/${id}/eligibility-rules/${ruleId}`);
      setActionMsg('Regra removida');
      await fetchData();
    } catch (err: any) {
      setActionMsg(err?.response?.data?.detail?.message || 'Erro ao remover regra');
    } finally {
      setProcessing(false);
    }
  };

  // ---- Service teams ----
  const handleCreateTeam = async () => {
    if (!teamName.trim()) { setActionMsg('Informe o nome da equipe'); return; }
    setProcessing(true);
    try {
      await api.post(`/admin/retreats/${id}/service-teams`, { name: teamName.trim(), description: teamDesc.trim() || null });
      setActionMsg('Equipe criada');
      setTeamModal(null);
      await fetchData();
    } catch (err: any) {
      setActionMsg(err?.response?.data?.detail?.message || 'Erro ao criar equipe');
    } finally {
      setProcessing(false);
    }
  };

  const handleDeleteTeam = async (teamId: string) => {
    setProcessing(true);
    try {
      await api.delete(`/admin/retreats/${id}/service-teams/${teamId}`);
      setActionMsg('Equipe removida');
      await fetchData();
    } catch (err: any) {
      setActionMsg(err?.response?.data?.detail?.message || 'Erro ao remover equipe');
    } finally {
      setProcessing(false);
    }
  };

  const handleAssignTeamMember = async (teamId: string) => {
    if (!assignTeamRegId.trim()) { setActionMsg('Selecione uma inscrição'); return; }
    setProcessing(true);
    try {
      await api.post(`/admin/retreats/${id}/service-teams/${teamId}/members`, {
        registration_id: assignTeamRegId,
        role: assignTeamRole,
        house_id: assignTeamHouseId || null,
      });
      setActionMsg('Membro atribuído');
      setTeamModal(null);
      await fetchData();
    } catch (err: any) {
      setActionMsg(err?.response?.data?.detail?.message || 'Erro ao atribuir membro');
    } finally {
      setProcessing(false);
    }
  };

  const handleRemoveTeamMember = async (teamId: string, memberId: string) => {
    setProcessing(true);
    try {
      await api.delete(`/admin/retreats/${id}/service-teams/${teamId}/members/${memberId}`);
      setActionMsg('Membro removido');
      await fetchData();
    } catch (err: any) {
      setActionMsg(err?.response?.data?.detail?.message || 'Erro ao remover membro');
    } finally {
      setProcessing(false);
    }
  };

  // ---- Coordinators ----
  const resetCoordModal = () => {
    setCoordUserId(''); setCoordSearch(''); setCoordName('');
    setMemberQuery(''); setMemberResults([]);
  };

  const searchMembers = async () => {
    const q = memberQuery.trim();
    if (q.length < 2) { setMemberResults([]); return; }
    setMemberLoading(true);
    try {
      const res = await adminUserService.listUsers({ search: q, limit: 10 });
      setMemberResults(res.users);
    } catch {
      setMemberResults([]);
    } finally {
      setMemberLoading(false);
    }
  };

  const handleAddCoordinator = async () => {
    const uid = coordUserId.trim();
    if (!uid) { setActionMsg('Selecione um coordenador'); return; }
    setProcessing(true);
    try {
      await api.post(`/admin/retreats/${id}/coordinators`, { user_id: uid });
      setActionMsg('Coordenador adicionado');
      setCoordModal(false);
      resetCoordModal();
      await fetchData();
    } catch (err: any) {
      setActionMsg(err?.response?.data?.detail?.message || 'Erro ao adicionar coordenador');
    } finally {
      setProcessing(false);
    }
  };

  const handleRemoveCoordinator = async (coordId: string) => {
    setProcessing(true);
    try {
      await api.delete(`/admin/retreats/${id}/coordinators/${coordId}`);
      setActionMsg('Coordenador removido');
      await fetchData();
    } catch (err: any) {
      setActionMsg(err?.response?.data?.detail?.message || 'Erro ao remover coordenador');
    } finally {
      setProcessing(false);
    }
  };

  // ---- Payment actions ----
  const handleConfirmPayment = async (regId: string) => {
    setProcessing(true);
    try {
      await api.post(`/admin/retreats/${id}/registrations/${regId}/confirm`, {});
      setActionMsg('Pagamento confirmado');
      await fetchData();
    } catch (err: any) {
      setActionMsg(err?.response?.data?.detail?.message || 'Erro ao confirmar');
    } finally {
      setProcessing(false);
    }
  };

  const handleRejectPayment = async () => {
    if (!rejectModal) return;
    setProcessing(true);
    setRejectModal(null);
    try {
      await api.post(`/admin/retreats/${id}/registrations/${rejectModal.regId}/reject`, {
        reason: rejectReason || null,
      });
      setActionMsg('Comprovante rejeitado');
      setRejectReason('');
      await fetchData();
    } catch (err: any) {
      setActionMsg(err?.response?.data?.detail?.message || 'Erro ao rejeitar');
    } finally {
      setProcessing(false);
    }
  };

  if (loading) {
    return <View style={styles.center}><ActivityIndicator size="large" color={ADMIN_COLOR} /></View>;
  }

  if (error || !retreat) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>{error || 'Retiro não encontrado'}</Text>
        <TouchableOpacity onPress={() => router.back()} style={styles.btn}>
          <Text style={styles.btnText}>Voltar</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const statusMeta = STATUS_META[retreat.status] ?? { label: retreat.status, color: t.text.secondary };
  const fmt = (iso: string) =>
    new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' });

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} colors={[ADMIN_COLOR]} />}
    >
      {/* ── Cabeçalho ── */}
      <View style={styles.card}>
        <View style={styles.row}>
          <Text style={styles.typeLabel}>{TYPE_LABEL[retreat.retreat_type]}</Text>
          <View style={[styles.statusBadge, { backgroundColor: `${statusMeta.color}18` }]}>
            <Text style={[styles.statusText, { color: statusMeta.color }]}>{statusMeta.label}</Text>
          </View>
        </View>
        <Text style={styles.title}>{retreat.title}</Text>
        {retreat.description && <Text style={styles.desc}>{retreat.description}</Text>}
        <View style={styles.metaGrid}>
          <MetaRow icon="calendar-outline" text={`${fmt(retreat.start_date)} → ${fmt(retreat.end_date)}`} t={t} styles={styles} />
          {retreat.location && <MetaRow icon="location-outline" text={retreat.location} t={t} styles={styles} />}
          {retreat.max_participants != null && (
            <MetaRow icon="people-outline" text={`${retreat.registrations_count}/${retreat.max_participants} inscritos`} t={t} styles={styles} />
          )}
          <MetaRow icon="eye-outline" text={retreat.visibility_type === 'ALL' ? 'Todos os membros' : 'Específico'} t={t} styles={styles} />
        </View>
      </View>

      {/* ── Mensagem de ação ── */}
      {actionMsg && (
        <View style={styles.actionMsg}>
          <Text style={styles.actionMsgText}>{actionMsg}</Text>
          <TouchableOpacity onPress={() => setActionMsg(null)}>
            <Ionicons name="close" size={16} color={t.text.secondary} />
          </TouchableOpacity>
        </View>
      )}

      {/* ── Ações de status ── */}
      <View style={styles.actionsRow}>
        {retreat.status === 'DRAFT' && (
          <TouchableOpacity
            style={[styles.actionBtn, { backgroundColor: t.status.success }]}
            onPress={() => setConfirmModal({
              title: 'Publicar retiro?',
              body: 'Um aviso será enviado para todos os membros elegíveis.',
              action: () => doAction(`/admin/retreats/${id}/publish`, 'Retiro publicado!'),
            })}
            disabled={processing}
          >
            <Ionicons name="megaphone-outline" size={16} color={t.text.inverse} />
            <Text style={styles.actionBtnText}>Publicar</Text>
          </TouchableOpacity>
        )}
        {retreat.status === 'PUBLISHED' && (
          <TouchableOpacity
            style={[styles.actionBtn, { backgroundColor: t.status.info }]}
            onPress={() => setConfirmModal({
              title: 'Fechar inscrições?',
              body: 'Novos membros não poderão se inscrever após fechar.',
              action: () => doAction(`/admin/retreats/${id}/close`, 'Inscrições encerradas'),
            })}
            disabled={processing}
          >
            <Ionicons name="lock-closed-outline" size={16} color={t.text.inverse} />
            <Text style={styles.actionBtnText}>Fechar inscrições</Text>
          </TouchableOpacity>
        )}
        {['DRAFT', 'PUBLISHED'].includes(retreat.status) && (
          <TouchableOpacity
            style={[styles.actionBtn, { backgroundColor: t.status.error }]}
            onPress={() => setConfirmModal({
              title: 'Cancelar retiro?',
              body: 'Esta ação não pode ser desfeita.',
              action: () => doAction(`/admin/retreats/${id}/cancel`, 'Retiro cancelado'),
            })}
            disabled={processing}
          >
            <Ionicons name="close-circle-outline" size={16} color={t.text.inverse} />
            <Text style={styles.actionBtnText}>Cancelar</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity
          style={[styles.actionBtn, { backgroundColor: t.text.secondary }]}
          onPress={() => Linking.openURL(`${api.baseUrl}/admin/retreats/${id}/export`)}
        >
          <Ionicons name="download-outline" size={16} color={t.text.inverse} />
          <Text style={styles.actionBtnText}>CSV</Text>
        </TouchableOpacity>
      </View>

      {/* ── Casas ── */}
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Casas ({retreat.houses.length})</Text>
        <TouchableOpacity style={styles.addBtn} onPress={openAddHouse}>
          <Ionicons name="add" size={16} color={ADMIN_COLOR} />
          <Text style={styles.addBtnText}>Adicionar</Text>
        </TouchableOpacity>
      </View>

      {retreat.houses.length === 0 ? (
        <View style={styles.emptyBox}>
          <Text style={styles.emptyText}>Nenhuma casa cadastrada</Text>
        </View>
      ) : (
        retreat.houses.map(house => (
          <View key={house.id} style={styles.houseCard}>
            <View style={styles.row}>
              <View style={{ flex: 1 }}>
                <Text style={styles.houseName}>{house.name}</Text>
                <View style={styles.houseInfo}>
                  <View style={[styles.modalityPill, { backgroundColor: house.modality === 'PRESENCIAL' ? t.status.infoBg : t.status.warningBg }]}>
                    <Text style={[styles.modalityPillText, { color: house.modality === 'PRESENCIAL' ? t.status.info : t.status.warning }]}>
                      {MODALITY_LABEL[house.modality] ?? house.modality}
                    </Text>
                  </View>
                  {house.max_participants != null && (
                    <Text style={styles.houseCapacity}>{house.max_participants} vagas</Text>
                  )}
                </View>
              </View>
              <View style={styles.houseActions}>
                <TouchableOpacity onPress={() => openEditHouse(house)} style={styles.iconBtn}>
                  <Ionicons name="pencil-outline" size={16} color={t.text.secondary} />
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => setConfirmModal({
                    title: 'Remover casa?',
                    body: `A casa "${house.name}" será removida.`,
                    action: async () => { setConfirmModal(null); await handleDeleteHouse(house.id); },
                  })}
                  style={styles.iconBtn}
                >
                  <Ionicons name="trash-outline" size={16} color={t.status.error} />
                </TouchableOpacity>
              </View>
            </View>
          </View>
        ))
      )}

      {/* ── Taxas ── */}
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Taxas ({retreat.fee_types.length}/{FEE_ALL_CATEGORIES.length})</Text>
        <TouchableOpacity style={styles.addBtn} onPress={openFeeModal}>
          <Ionicons name="pencil-outline" size={16} color={ADMIN_COLOR} />
          <Text style={styles.addBtnText}>Editar</Text>
        </TouchableOpacity>
      </View>

      {retreat.fee_types.length === 0 ? (
        <View style={styles.emptyBox}>
          <Text style={styles.emptyText}>Nenhuma taxa definida</Text>
        </View>
      ) : (
        <View style={styles.feeGrid}>
          {retreat.fee_types.map(ft => (
            <View key={ft.fee_category} style={styles.feePill}>
              <Text style={styles.feePillLabel}>{ft.label}</Text>
              <Text style={styles.feePillAmount}>R$ {ft.amount_brl}</Text>
            </View>
          ))}
        </View>
      )}

      {/* ── Elegibilidade — Participantes ── */}
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>
          Quem pode participar ({retreat.participant_eligibility_rules.length})
        </Text>
        <TouchableOpacity style={styles.addBtn} onPress={() => openEligibilityModal('PARTICIPANT')}>
          <Ionicons name="add" size={16} color={ADMIN_COLOR} />
          <Text style={styles.addBtnText}>Adicionar</Text>
        </TouchableOpacity>
      </View>
      {retreat.participant_eligibility_rules.length === 0 ? (
        <View style={styles.emptyBox}>
          <Text style={styles.emptyText}>Todos os membros podem participar</Text>
        </View>
      ) : (
        retreat.participant_eligibility_rules.map(rule => (
          <EligibilityRuleRow key={rule.id} rule={rule} onDelete={() => handleDeleteEligibilityRule(rule.id)} t={t} styles={styles} />
        ))
      )}

      {/* ── Elegibilidade — Equipe de Serviço ── */}
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>
          Quem pode servir ({retreat.service_eligibility_rules.length})
        </Text>
        <TouchableOpacity style={styles.addBtn} onPress={() => openEligibilityModal('SERVICE')}>
          <Ionicons name="add" size={16} color={ADMIN_COLOR} />
          <Text style={styles.addBtnText}>Adicionar</Text>
        </TouchableOpacity>
      </View>
      {retreat.service_eligibility_rules.length === 0 ? (
        <View style={styles.emptyBox}>
          <Text style={styles.emptyText}>Qualquer membro elegível pode servir</Text>
        </View>
      ) : (
        retreat.service_eligibility_rules.map(rule => (
          <EligibilityRuleRow key={rule.id} rule={rule} onDelete={() => handleDeleteEligibilityRule(rule.id)} t={t} styles={styles} />
        ))
      )}

      {/* ── Coordenadores do Retiro ── */}
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>
          Coordenadores ({(retreat.coordinators || []).length})
        </Text>
        <TouchableOpacity
          style={styles.addBtn}
          onPress={() => { resetCoordModal(); setCoordModal(true); }}
        >
          <Ionicons name="person-add-outline" size={16} color={ADMIN_COLOR} />
          <Text style={styles.addBtnText}>Adicionar</Text>
        </TouchableOpacity>
      </View>

      {(retreat.coordinators || []).length === 0 ? (
        <View style={styles.emptyBox}>
          <Text style={styles.emptyText}>Nenhum coordenador atribuído</Text>
        </View>
      ) : (
        (retreat.coordinators || []).map(coord => (
          <View key={coord.id} style={styles.houseCard}>
            <View style={styles.row}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}>
                <View style={{
                  width: 36, height: 36, borderRadius: 18,
                  backgroundColor: `${ADMIN_COLOR}18`,
                  alignItems: 'center', justifyContent: 'center',
                }}>
                  <Ionicons name="person-outline" size={18} color={ADMIN_COLOR} />
                </View>
                <View>
                  <Text style={styles.houseName}>{coord.user_name || 'Usuário'}</Text>
                  <Text style={styles.houseCapacity}>Coordenador de Retiro</Text>
                </View>
              </View>
              <TouchableOpacity
                style={styles.iconBtn}
                onPress={() => setConfirmModal({
                  title: 'Remover coordenador?',
                  body: `${coord.user_name || 'Este usuário'} perderá acesso à gestão deste retiro.`,
                  action: async () => { setConfirmModal(null); await handleRemoveCoordinator(coord.id); },
                })}
              >
                <Ionicons name="trash-outline" size={16} color={t.status.error} />
              </TouchableOpacity>
            </View>
          </View>
        ))
      )}

      {/* ── Equipes de Serviço ── */}
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>
          Equipes de Serviço ({(retreat.service_teams || []).length})
        </Text>
        <TouchableOpacity
          style={styles.addBtn}
          onPress={() => { setTeamName(''); setTeamDesc(''); setTeamModal({ mode: 'create' }); }}
        >
          <Ionicons name="add" size={16} color={ADMIN_COLOR} />
          <Text style={styles.addBtnText}>Nova equipe</Text>
        </TouchableOpacity>
      </View>

      {(retreat.service_teams || []).length === 0 ? (
        <View style={styles.emptyBox}>
          <Text style={styles.emptyText}>Nenhuma equipe cadastrada</Text>
        </View>
      ) : (
        (retreat.service_teams || []).map(team => (
          <View key={team.id} style={styles.houseCard}>
            <View style={styles.row}>
              <View style={{ flex: 1 }}>
                <Text style={styles.houseName}>{team.name}</Text>
                {team.description ? (
                  <Text style={styles.houseCapacity}>{team.description}</Text>
                ) : null}
                <Text style={[styles.houseCapacity, { marginTop: 4 }]}>
                  {team.members.length} membro{team.members.length !== 1 ? 's' : ''}
                </Text>
              </View>
              <View style={styles.houseActions}>
                <TouchableOpacity
                  style={styles.iconBtn}
                  onPress={() => {
                    setAssignTeamRegId('');
                    setAssignTeamRole('MEMBRO');
                    setAssignTeamHouseId(null);
                    setTeamModal({ mode: 'assign', team });
                  }}
                >
                  <Ionicons name="person-add-outline" size={16} color={ADMIN_COLOR} />
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.iconBtn}
                  onPress={() => setConfirmModal({
                    title: `Remover equipe "${team.name}"?`,
                    body: 'Todos os membros desta equipe serão desatribuídos.',
                    action: async () => { setConfirmModal(null); await handleDeleteTeam(team.id); },
                  })}
                >
                  <Ionicons name="trash-outline" size={16} color={t.status.error} />
                </TouchableOpacity>
              </View>
            </View>

            {/* Membros da equipe */}
            {team.members.length > 0 && (
              <View style={{ marginTop: 8, gap: 4 }}>
                {team.members.map(m => (
                  <View key={m.id} style={[styles.row, { paddingVertical: 4, borderTopWidth: 1, borderTopColor: t.bg.elevated }]}>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 13, color: t.text.primary, fontWeight: '600' }}>
                        {m.user_name || 'Membro'}
                      </Text>
                      <Text style={{ fontSize: 11, color: t.text.secondary }}>
                        {m.role}{m.house_name ? ` · ${m.house_name}` : ''}
                      </Text>
                    </View>
                    <TouchableOpacity
                      style={styles.iconBtn}
                      onPress={() => handleRemoveTeamMember(team.id, m.id)}
                    >
                      <Ionicons name="close-circle-outline" size={16} color={t.status.error} />
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            )}
          </View>
        ))
      )}

      {/* ── Inscrições ── */}
      <Text style={styles.sectionTitle}>
        Inscrições ({regs.filter(r => r.status !== 'CANCELLED').length})
      </Text>

      {regs.length === 0 ? (
        <View style={styles.emptyBox}>
          <Text style={styles.emptyText}>Nenhuma inscrição ainda</Text>
        </View>
      ) : (
        regs.map(reg => {
          const regMeta = REG_STATUS_META[reg.status] ?? { label: reg.status, color: t.text.secondary };
          return (
            <View key={reg.id} style={styles.regCard}>
              <View style={styles.row}>
                <Text style={styles.regName}>{reg.user_name || 'Membro'}</Text>
                <View style={[styles.regBadge, { backgroundColor: `${regMeta.color}18` }]}>
                  <Text style={[styles.regBadgeText, { color: regMeta.color }]}>{regMeta.label}</Text>
                </View>
              </View>

              {/* Tags de info */}
              <View style={styles.regTags}>
                {reg.modality_preference && (
                  <View style={styles.tag}>
                    <Text style={styles.tagText}>{MODALITY_LABEL[reg.modality_preference] ?? reg.modality_preference}</Text>
                  </View>
                )}
                {reg.fee_label && (
                  <View style={[styles.tag, { backgroundColor: 'rgba(124, 58, 237, 0.12)' }]}>
                    <Text style={[styles.tagText, { color: ADMIN_COLOR }]}>{reg.fee_label}</Text>
                  </View>
                )}
                {reg.assigned_house_name && (
                  <View style={[styles.tag, { backgroundColor: t.status.successBg }]}>
                    <Ionicons name="home-outline" size={11} color={t.status.success} />
                    <Text style={[styles.tagText, { color: t.status.success }]}>{reg.assigned_house_name}</Text>
                  </View>
                )}
              </View>

              {reg.notes && <Text style={styles.regNotes}>📝 {reg.notes}</Text>}
              {reg.payment_rejection_reason && (
                <Text style={styles.rejectionText}>Rejeitado: {reg.payment_rejection_reason}</Text>
              )}

              {/* Ações da inscrição */}
              <View style={styles.regActions}>
                {/* Atribuir casa */}
                {retreat.houses.length > 0 && (
                  <TouchableOpacity
                    style={styles.smallBtn}
                    onPress={() => setAssignHouseModal({ regId: reg.id })}
                  >
                    <Ionicons name="home-outline" size={13} color={ADMIN_COLOR} />
                    <Text style={styles.smallBtnText}>
                      {reg.assigned_house_name ? 'Mudar casa' : 'Atribuir casa'}
                    </Text>
                  </TouchableOpacity>
                )}
                {/* Mudar papel */}
                <TouchableOpacity
                  style={[styles.smallBtn, { borderColor: ADMIN_COLOR }]}
                  onPress={() => setRoleModal({ regId: reg.id, currentRole: reg.retreat_role })}
                >
                  <Ionicons name="person-outline" size={13} color={ADMIN_COLOR} />
                  <Text style={[styles.smallBtnText, { color: ADMIN_COLOR }]}>
                    {reg.retreat_role === 'EQUIPE_SERVICO' ? 'ES' : 'Part.'}
                  </Text>
                </TouchableOpacity>
                {/* Ver comprovante */}
                {reg.payment_proof_url && (
                  <TouchableOpacity
                    style={styles.smallBtn}
                    onPress={() => Linking.openURL(reg.payment_proof_url!)}
                  >
                    <Ionicons name="image-outline" size={13} color={ADMIN_COLOR} />
                    <Text style={styles.smallBtnText}>Comprovante</Text>
                  </TouchableOpacity>
                )}
                {/* Confirmar/Rejeitar pagamento */}
                {reg.status === 'PAYMENT_SUBMITTED' && (
                  <>
                    <TouchableOpacity
                      style={[styles.smallBtn, { borderColor: t.status.success }]}
                      onPress={() => handleConfirmPayment(reg.id)}
                      disabled={processing}
                    >
                      <Ionicons name="checkmark" size={13} color={t.status.success} />
                      <Text style={[styles.smallBtnText, { color: t.status.success }]}>Confirmar</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.smallBtn, { borderColor: t.status.error }]}
                      onPress={() => setRejectModal({ regId: reg.id })}
                      disabled={processing}
                    >
                      <Ionicons name="close" size={13} color={t.status.error} />
                      <Text style={[styles.smallBtnText, { color: t.status.error }]}>Rejeitar</Text>
                    </TouchableOpacity>
                  </>
                )}
              </View>
            </View>
          );
        })
      )}

      {/* ── Modal: confirmação genérica ── */}
      <Modal visible={!!confirmModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>{confirmModal?.title}</Text>
            <Text style={styles.modalBody}>{confirmModal?.body}</Text>
            <View style={styles.modalRow}>
              <TouchableOpacity style={styles.outlineBtn} onPress={() => setConfirmModal(null)}>
                <Text style={styles.outlineBtnText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.confirmBtn} onPress={() => confirmModal?.action()} disabled={processing}>
                {processing
                  ? <ActivityIndicator color={t.text.inverse} size="small" />
                  : <Text style={styles.confirmBtnText}>Confirmar</Text>
                }
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ── Modal: rejeitar comprovante ── */}
      <Modal visible={!!rejectModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>Rejeitar comprovante?</Text>
            <Text style={styles.modalBody}>Informe o motivo para o membro reenviar.</Text>
            <TextInput
              style={styles.textArea}
              value={rejectReason}
              onChangeText={setRejectReason}
              placeholder="Motivo (opcional)..."
              placeholderTextColor={t.text.tertiary}
              multiline
            />
            <View style={styles.modalRow}>
              <TouchableOpacity style={styles.outlineBtn} onPress={() => { setRejectModal(null); setRejectReason(''); }}>
                <Text style={styles.outlineBtnText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.confirmBtn, { backgroundColor: t.status.error }]} onPress={handleRejectPayment} disabled={processing}>
                <Text style={styles.confirmBtnText}>Rejeitar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ── Modal: add/edit casa ── */}
      <Modal visible={!!houseModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>{houseModal?.mode === 'edit' ? 'Editar Casa' : 'Nova Casa'}</Text>
            <Text style={styles.fieldLabel}>Nome da casa</Text>
            <TextInput
              style={styles.input}
              value={houseName}
              onChangeText={setHouseName}
              placeholder="Ex: Casa São João"
              placeholderTextColor={t.text.tertiary}
            />
            <Text style={styles.fieldLabel}>Modalidade</Text>
            <View style={styles.modalitySelector}>
              {(['PRESENCIAL', 'HIBRIDO'] as const).map(m => (
                <TouchableOpacity
                  key={m}
                  style={[styles.modalityOption, houseModality === m && styles.modalityOptionSelected]}
                  onPress={() => setHouseModality(m)}
                >
                  <Text style={[styles.modalityOptionText, houseModality === m && { color: t.text.inverse }]}>
                    {m === 'PRESENCIAL' ? 'Presencial' : 'Híbrido'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            <Text style={styles.fieldLabel}>Vagas (opcional)</Text>
            <TextInput
              style={styles.input}
              value={houseCapacity}
              onChangeText={setHouseCapacity}
              placeholder="Sem limite"
              placeholderTextColor={t.text.tertiary}
              keyboardType="number-pad"
            />
            <View style={styles.modalRow}>
              <TouchableOpacity style={styles.outlineBtn} onPress={() => setHouseModal(null)}>
                <Text style={styles.outlineBtnText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.confirmBtn} onPress={handleSaveHouse} disabled={processing}>
                {processing
                  ? <ActivityIndicator color={t.text.inverse} size="small" />
                  : <Text style={styles.confirmBtnText}>Salvar</Text>
                }
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ── Modal: definir taxas ── */}
      <Modal visible={showFeeModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <ScrollView style={{ width: '100%' }} contentContainerStyle={{ paddingVertical: 20, paddingHorizontal: 4 }}>
            <View style={[styles.modalBox, { marginHorizontal: 0 }]}>
              <Text style={styles.modalTitle}>Definir Taxas</Text>
              <Text style={styles.modalBody}>Deixe em branco para não definir um valor para aquela categoria.</Text>
              {FEE_ALL_CATEGORIES.map(cat => (
                <View key={cat.key}>
                  <Text style={styles.fieldLabel}>{cat.label}</Text>
                  <TextInput
                    style={styles.input}
                    value={feeValues[cat.key] ?? ''}
                    onChangeText={v => setFeeValues(prev => ({ ...prev, [cat.key]: v }))}
                    placeholder="Ex: 150,00"
                    placeholderTextColor={t.text.tertiary}
                    keyboardType="decimal-pad"
                  />
                </View>
              ))}
              <View style={styles.modalRow}>
                <TouchableOpacity style={styles.outlineBtn} onPress={() => setShowFeeModal(false)}>
                  <Text style={styles.outlineBtnText}>Cancelar</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.confirmBtn} onPress={handleSaveFees} disabled={processing}>
                  {processing
                    ? <ActivityIndicator color={t.text.inverse} size="small" />
                    : <Text style={styles.confirmBtnText}>Salvar</Text>
                  }
                </TouchableOpacity>
              </View>
            </View>
          </ScrollView>
        </View>
      </Modal>

      {/* ── Modal: atribuir casa ── */}
      <Modal visible={!!assignHouseModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>Atribuir Casa</Text>
            <TouchableOpacity
              style={[styles.houseOption, { borderColor: t.status.error }]}
              onPress={() => handleAssignHouse(null)}
            >
              <Ionicons name="close-circle-outline" size={18} color={t.status.error} />
              <Text style={[styles.houseOptionText, { color: t.status.error }]}>Remover atribuição</Text>
            </TouchableOpacity>
            {retreat.houses.map(house => (
              <TouchableOpacity
                key={house.id}
                style={styles.houseOption}
                onPress={() => handleAssignHouse(house.id)}
              >
                <Ionicons name="home-outline" size={18} color={ADMIN_COLOR} />
                <View>
                  <Text style={styles.houseOptionText}>{house.name}</Text>
                  <Text style={styles.houseOptionSub}>
                    {MODALITY_LABEL[house.modality] ?? house.modality}
                    {house.max_participants != null ? ` · ${house.max_participants} vagas` : ''}
                  </Text>
                </View>
              </TouchableOpacity>
            ))}
            <TouchableOpacity style={styles.outlineBtn} onPress={() => setAssignHouseModal(null)}>
              <Text style={styles.outlineBtnText}>Cancelar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ── Modal: adicionar regra de elegibilidade ── */}
      <Modal visible={!!eligibilityModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>
              {eligibilityModal?.group === 'SERVICE' ? 'Quem pode servir' : 'Quem pode participar'}
            </Text>
            <Text style={styles.fieldLabel}>Tipo de regra</Text>
            <View style={styles.modalitySelector}>
              <TouchableOpacity
                style={[styles.modalityOption, ruleType === 'ORG_UNIT' && styles.modalityOptionSelected]}
                onPress={() => setRuleType('ORG_UNIT')}
              >
                <Text style={[styles.modalityOptionText, ruleType === 'ORG_UNIT' && { color: t.text.inverse }]}>
                  Unidade org.
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalityOption, ruleType === 'VOCATIONAL_REALITY' && styles.modalityOptionSelected]}
                onPress={() => setRuleType('VOCATIONAL_REALITY')}
              >
                <Text style={[styles.modalityOptionText, ruleType === 'VOCATIONAL_REALITY' && { color: t.text.inverse }]}>
                  Real. vocacional
                </Text>
              </TouchableOpacity>
            </View>

            {ruleType === 'ORG_UNIT' ? (
              <View>
                <Text style={styles.fieldLabel}>Selecione a unidade</Text>
                {orgUnits.length === 0 ? (
                  <Text style={styles.emptyText}>Carregando unidades...</Text>
                ) : (
                  <ScrollView style={{ maxHeight: 180 }} nestedScrollEnabled>
                    {orgUnits.map(ou => (
                      <TouchableOpacity
                        key={ou.id}
                        style={[styles.houseOption, selectedOrgUnit?.id === ou.id && styles.houseOptionActive]}
                        onPress={() => setSelectedOrgUnit(ou)}
                      >
                        <Text style={[styles.houseOptionText, selectedOrgUnit?.id === ou.id && { color: t.text.inverse }]}>
                          {ou.name}
                        </Text>
                        <Text style={[styles.houseOptionSub, selectedOrgUnit?.id === ou.id && { color: ADMIN_TEXT_LIGHT }]}>
                          {ou.unit_type}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                )}
              </View>
            ) : (
              <View>
                <Text style={styles.fieldLabel}>Realidade vocacional</Text>
                {vocRealityItems.length === 0 ? (
                  <Text style={styles.emptyText}>Carregando realidades vocacionais...</Text>
                ) : (
                  <ScrollView style={{ maxHeight: 200 }} nestedScrollEnabled>
                    {vocRealityItems.map(item => (
                      <TouchableOpacity
                        key={item.id}
                        style={[styles.houseOption, selectedVocItem?.code === item.code && styles.houseOptionActive]}
                        onPress={() => setSelectedVocItem(item)}
                      >
                        <Text style={[styles.houseOptionText, selectedVocItem?.code === item.code && { color: t.text.inverse }]}>
                          {item.label}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                )}
              </View>
            )}

            <View style={styles.modalRow}>
              <TouchableOpacity style={styles.outlineBtn} onPress={() => setEligibilityModal(null)}>
                <Text style={styles.outlineBtnText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.confirmBtn} onPress={handleAddEligibilityRule} disabled={processing}>
                {processing
                  ? <ActivityIndicator color={t.text.inverse} size="small" />
                  : <Text style={styles.confirmBtnText}>Adicionar</Text>
                }
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ── Modal: adicionar coordenador ── */}
      <Modal visible={coordModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>Adicionar Coordenador</Text>
            <Text style={styles.modalBody}>
              O coordenador terá acesso completo à gestão deste retiro.
            </Text>

            <Text style={styles.fieldLabel}>Selecionar da lista de inscritos</Text>
            <TextInput
              style={styles.input}
              value={coordSearch}
              onChangeText={setCoordSearch}
              placeholder="Filtrar por nome..."
              placeholderTextColor={t.text.tertiary}
            />
            <ScrollView style={{ maxHeight: 200 }} nestedScrollEnabled>
              {regs
                .filter(r =>
                  r.status !== 'CANCELLED' &&
                  (coordSearch === '' || (r.user_name || '').toLowerCase().includes(coordSearch.toLowerCase()))
                )
                .map(r => (
                  <TouchableOpacity
                    key={r.id}
                    style={[styles.houseOption, coordUserId === r.user_id && styles.houseOptionActive]}
                    onPress={() => setCoordUserId(r.user_id)}
                  >
                    <Ionicons
                      name="person-outline"
                      size={16}
                      color={coordUserId === r.user_id ? t.text.inverse : ADMIN_COLOR}
                    />
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.houseOptionText, coordUserId === r.user_id && { color: t.text.inverse }]}>
                        {r.user_name || 'Membro'}
                      </Text>
                      <Text style={[styles.houseOptionSub, coordUserId === r.user_id && { color: ADMIN_TEXT_LIGHT }]}>
                        {r.retreat_role === 'EQUIPE_SERVICO' ? 'Equipe de Serviço' : 'Participante'}
                      </Text>
                    </View>
                    {coordUserId === r.user_id && (
                      <Ionicons name="checkmark-circle" size={18} color={t.text.inverse} />
                    )}
                  </TouchableOpacity>
                ))}
              {regs.filter(r => r.status !== 'CANCELLED').length === 0 && (
                <Text style={styles.emptyText}>Nenhum inscrito encontrado</Text>
              )}
            </ScrollView>

            <Text style={[styles.fieldLabel, { marginTop: 8 }]}>Ou buscar em todos os membros</Text>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <TextInput
                style={[styles.input, { flex: 1 }]}
                value={memberQuery}
                onChangeText={setMemberQuery}
                onSubmitEditing={searchMembers}
                placeholder="Nome do membro..."
                placeholderTextColor={t.text.tertiary}
                autoCapitalize="words"
                returnKeyType="search"
              />
              <TouchableOpacity style={styles.searchBtn} onPress={searchMembers} disabled={memberLoading}>
                {memberLoading
                  ? <ActivityIndicator color={t.text.inverse} size="small" />
                  : <Ionicons name="search" size={18} color={t.text.inverse} />}
              </TouchableOpacity>
            </View>
            {memberResults.length > 0 && (
              <ScrollView style={{ maxHeight: 160 }} nestedScrollEnabled>
                {memberResults.map(u => (
                  <TouchableOpacity
                    key={u.id}
                    style={[styles.houseOption, coordUserId === u.id && styles.houseOptionActive]}
                    onPress={() => { setCoordUserId(u.id); setCoordName(u.name || u.email || ''); setCoordSearch(''); }}
                  >
                    <Ionicons
                      name="person-circle-outline"
                      size={16}
                      color={coordUserId === u.id ? ADMIN_COLOR : t.text.secondary}
                    />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.houseOptionText}>{u.name || 'Sem nome'}</Text>
                      {u.email ? <Text style={styles.houseOptionSub}>{u.email}</Text> : null}
                    </View>
                    {coordUserId === u.id && (
                      <Ionicons name="checkmark-circle" size={18} color={ADMIN_COLOR} />
                    )}
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}
            {coordName ? (
              <Text style={[styles.fieldLabel, { color: t.brand.primary, marginTop: 6 }]}>
                Selecionado: {coordName}
              </Text>
            ) : null}

            <View style={styles.modalRow}>
              <TouchableOpacity style={styles.outlineBtn} onPress={() => setCoordModal(false)}>
                <Text style={styles.outlineBtnText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.confirmBtn, !coordUserId.trim() && { opacity: 0.5 }]}
                onPress={handleAddCoordinator}
                disabled={!coordUserId.trim() || processing}
              >
                {processing
                  ? <ActivityIndicator color={t.text.inverse} size="small" />
                  : <Text style={styles.confirmBtnText}>Adicionar</Text>
                }
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ── Modal: criar equipe ── */}
      <Modal visible={teamModal?.mode === 'create'} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>Nova Equipe de Serviço</Text>
            <Text style={styles.fieldLabel}>Nome da equipe *</Text>
            <TextInput
              style={styles.input}
              value={teamName}
              onChangeText={setTeamName}
              placeholder="Ex: Louvor, Acolhida, Cozinha..."
              placeholderTextColor={t.text.tertiary}
            />
            <Text style={styles.fieldLabel}>Descrição (opcional)</Text>
            <TextInput
              style={[styles.input, { minHeight: 70, textAlignVertical: 'top' }]}
              value={teamDesc}
              onChangeText={setTeamDesc}
              placeholder="Responsabilidades desta equipe..."
              placeholderTextColor={t.text.tertiary}
              multiline
            />
            <View style={styles.modalRow}>
              <TouchableOpacity style={styles.outlineBtn} onPress={() => setTeamModal(null)}>
                <Text style={styles.outlineBtnText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.confirmBtn} onPress={handleCreateTeam} disabled={processing}>
                {processing
                  ? <ActivityIndicator color={t.text.inverse} size="small" />
                  : <Text style={styles.confirmBtnText}>Criar</Text>
                }
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ── Modal: atribuir membro à equipe ── */}
      <Modal visible={teamModal?.mode === 'assign'} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <ScrollView style={{ width: '100%' }} contentContainerStyle={{ paddingVertical: 20, paddingHorizontal: 4 }}>
            <View style={[styles.modalBox, { marginHorizontal: 0 }]}>
              {teamModal?.mode === 'assign' && (
                <Text style={styles.modalTitle}>Atribuir a "{teamModal.team.name}"</Text>
              )}

              <Text style={styles.fieldLabel}>Papel na equipe</Text>
              <View style={styles.modalitySelector}>
                {(['COORDENADOR', 'MEMBRO', 'APOIO'] as const).map(r => (
                  <TouchableOpacity
                    key={r}
                    style={[styles.modalityOption, assignTeamRole === r && styles.modalityOptionSelected]}
                    onPress={() => setAssignTeamRole(r)}
                  >
                    <Text style={[styles.modalityOptionText, assignTeamRole === r && { color: t.text.inverse }]}>
                      {r === 'COORDENADOR' ? 'Coord.' : r === 'MEMBRO' ? 'Membro' : 'Apoio'}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.fieldLabel}>Sub-equipe (casa — opcional)</Text>
              <TouchableOpacity
                style={[styles.houseOption, assignTeamHouseId === null && { borderColor: t.text.tertiary }]}
                onPress={() => setAssignTeamHouseId(null)}
              >
                <Text style={[styles.houseOptionText, assignTeamHouseId === null && { color: t.text.tertiary }]}>
                  Sem casa específica
                </Text>
              </TouchableOpacity>
              {retreat.houses.map(house => (
                <TouchableOpacity
                  key={house.id}
                  style={[styles.houseOption, assignTeamHouseId === house.id && styles.houseOptionActive]}
                  onPress={() => setAssignTeamHouseId(house.id)}
                >
                  <Ionicons name="home-outline" size={16} color={assignTeamHouseId === house.id ? t.text.inverse : ADMIN_COLOR} />
                  <Text style={[styles.houseOptionText, assignTeamHouseId === house.id && { color: t.text.inverse }]}>
                    {house.name}
                  </Text>
                </TouchableOpacity>
              ))}

              <Text style={styles.fieldLabel}>Inscrição (escolha da lista)</Text>
              <ScrollView style={{ maxHeight: 180 }} nestedScrollEnabled>
                {regs
                  .filter(r => r.status !== 'CANCELLED' && r.retreat_role === 'EQUIPE_SERVICO')
                  .map(r => (
                    <TouchableOpacity
                      key={r.id}
                      style={[styles.houseOption, assignTeamRegId === r.id && styles.houseOptionActive]}
                      onPress={() => setAssignTeamRegId(r.id)}
                    >
                      <Text style={[styles.houseOptionText, assignTeamRegId === r.id && { color: t.text.inverse }]}>
                        {r.user_name || 'Membro'}
                      </Text>
                      {r.team_preferences && r.team_preferences.length > 0 && (
                        <Text style={[styles.houseOptionSub, assignTeamRegId === r.id && { color: ADMIN_TEXT_LIGHT }]}>
                          Preferências: {r.team_preferences.map((p: any) => p.preference_order).join(', ')}
                        </Text>
                      )}
                    </TouchableOpacity>
                  ))}
              </ScrollView>
              {regs.filter(r => r.status !== 'CANCELLED' && r.retreat_role === 'EQUIPE_SERVICO').length === 0 && (
                <Text style={styles.emptyText}>Nenhuma inscrição de Equipe de Serviço</Text>
              )}

              <View style={styles.modalRow}>
                <TouchableOpacity style={styles.outlineBtn} onPress={() => setTeamModal(null)}>
                  <Text style={styles.outlineBtnText}>Cancelar</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.confirmBtn}
                  onPress={() => teamModal?.mode === 'assign' && handleAssignTeamMember(teamModal.team.id)}
                  disabled={processing}
                >
                  {processing
                    ? <ActivityIndicator color={t.text.inverse} size="small" />
                    : <Text style={styles.confirmBtnText}>Atribuir</Text>
                  }
                </TouchableOpacity>
              </View>
            </View>
          </ScrollView>
        </View>
      </Modal>

      {/* ── Modal: mudar papel ── */}
      <Modal visible={!!roleModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>Papel no Retiro</Text>
            <TouchableOpacity
              style={[styles.houseOption, roleModal?.currentRole === 'PARTICIPANTE' && styles.houseOptionActive]}
              onPress={() => handleSetRole('PARTICIPANTE')}
            >
              <Ionicons name="person-outline" size={18} color={ADMIN_COLOR} />
              <View>
                <Text style={styles.houseOptionText}>Participante</Text>
                <Text style={styles.houseOptionSub}>Taxa de participante</Text>
              </View>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.houseOption, roleModal?.currentRole === 'EQUIPE_SERVICO' && styles.houseOptionActive]}
              onPress={() => handleSetRole('EQUIPE_SERVICO')}
            >
              <Ionicons name="hammer-outline" size={18} color={ADMIN_COLOR} />
              <View>
                <Text style={styles.houseOptionText}>Equipe de Serviço</Text>
                <Text style={styles.houseOptionSub}>Taxa de equipe — recalculada automaticamente</Text>
              </View>
            </TouchableOpacity>
            <TouchableOpacity style={styles.outlineBtn} onPress={() => setRoleModal(null)}>
              <Text style={styles.outlineBtnText}>Cancelar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

type Styles = ReturnType<typeof makeStyles>;

function MetaRow({ icon, text, t, styles }: { icon: string; text: string; t: SemanticTokens; styles: Styles }) {
  return (
    <View style={styles.metaRow}>
      <Ionicons name={icon as any} size={13} color={t.text.secondary} />
      <Text style={styles.metaText}>{text}</Text>
    </View>
  );
}

function EligibilityRuleRow({ rule, onDelete, t, styles }: { rule: EligibilityRule; onDelete: () => void; t: SemanticTokens; styles: Styles }) {
  const vocLabel = rule.vocational_reality_code
    ? rule.vocational_reality_code.toLowerCase().replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())
    : '—';
  const label = rule.rule_type === 'ORG_UNIT'
    ? rule.org_unit_name ?? rule.org_unit_id ?? '—'
    : vocLabel;
  const icon = rule.rule_type === 'ORG_UNIT' ? 'git-network-outline' : 'ribbon-outline';
  return (
    <View style={styles.houseCard}>
      <View style={styles.row}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 }}>
          <Ionicons name={icon as any} size={16} color={ADMIN_COLOR} />
          <Text style={styles.houseName}>{label}</Text>
        </View>
        <TouchableOpacity onPress={onDelete} style={styles.iconBtn}>
          <Ionicons name="trash-outline" size={16} color={t.status.error} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const makeStyles = (t: SemanticTokens) => StyleSheet.create({
  container: { flex: 1, backgroundColor: t.bg.elevated },
  content: { padding: 14, paddingBottom: 48, gap: 12 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 12 },
  card: {
    backgroundColor: t.bg.screen, borderRadius: 16, padding: 16, gap: 6,
    shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 4, elevation: 1,
  },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  typeLabel: { fontSize: 11, color: t.text.secondary, textTransform: 'uppercase', fontWeight: '600' },
  statusBadge: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  statusText: { fontSize: 11, fontWeight: '700' },
  title: { fontSize: 19, fontWeight: '800', color: t.text.primary },
  desc: { fontSize: 13, color: t.text.secondary, lineHeight: 18 },
  metaGrid: { gap: 4, marginTop: 4 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  metaText: { fontSize: 12, color: t.text.secondary },
  actionMsg: {
    backgroundColor: t.status.successBg, borderRadius: 10, padding: 12,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  actionMsgText: { fontSize: 13, color: t.status.success, flex: 1 },
  actionsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  actionBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    borderRadius: 10, paddingHorizontal: 12, paddingVertical: 9,
  },
  actionBtnText: { color: t.text.inverse, fontWeight: '700', fontSize: 13 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: t.text.primary },
  addBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    borderWidth: 1.5, borderColor: ADMIN_COLOR, borderRadius: 8,
    paddingHorizontal: 10, paddingVertical: 5,
  },
  addBtnText: { fontSize: 13, fontWeight: '600', color: ADMIN_COLOR },
  emptyBox: { backgroundColor: t.bg.screen, borderRadius: 12, padding: 18, alignItems: 'center' },
  emptyText: { color: t.text.secondary, fontSize: 14 },
  houseCard: {
    backgroundColor: t.bg.screen, borderRadius: 12, padding: 14,
    shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 3, elevation: 1,
  },
  houseName: { fontSize: 15, fontWeight: '700', color: t.text.primary },
  houseInfo: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 },
  modalityPill: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  modalityPillText: { fontSize: 11, fontWeight: '700' },
  houseCapacity: { fontSize: 12, color: t.text.secondary },
  houseActions: { flexDirection: 'row', gap: 8 },
  iconBtn: { padding: 4 },
  feeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  feePill: {
    backgroundColor: t.bg.screen, borderRadius: 10, padding: 10,
    minWidth: '47%', flexGrow: 1,
    shadowColor: '#000', shadowOpacity: 0.03, shadowRadius: 2, elevation: 1,
  },
  feePillLabel: { fontSize: 11, color: t.text.secondary, marginBottom: 2 },
  feePillAmount: { fontSize: 16, fontWeight: '800', color: ADMIN_COLOR },
  regCard: {
    backgroundColor: t.bg.screen, borderRadius: 14, padding: 14, gap: 6,
    shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 3, elevation: 1,
  },
  regName: { fontSize: 15, fontWeight: '700', color: t.text.primary },
  regBadge: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  regBadgeText: { fontSize: 11, fontWeight: '700' },
  regTags: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  tag: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    backgroundColor: t.bg.surface, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3,
  },
  tagText: { fontSize: 11, fontWeight: '600', color: t.text.primary },
  regNotes: { fontSize: 12, color: t.text.secondary },
  rejectionText: { fontSize: 12, color: t.status.error },
  regActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 4 },
  smallBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    borderWidth: 1, borderColor: ADMIN_COLOR, borderRadius: 8,
    paddingHorizontal: 8, paddingVertical: 5,
  },
  smallBtnText: { fontSize: 12, fontWeight: '600', color: ADMIN_COLOR },
  errorText: { color: t.status.error, textAlign: 'center' },
  btn: { backgroundColor: ADMIN_COLOR, borderRadius: 8, paddingHorizontal: 24, paddingVertical: 10 },
  btnText: { color: t.text.inverse, fontWeight: '600' },
  // Modal shared
  modalOverlay: {
    flex: 1, backgroundColor: t.bg.overlay,
    alignItems: 'center', justifyContent: 'center', padding: 20,
  },
  modalBox: {
    backgroundColor: t.bg.screen, borderRadius: 20, padding: 22,
    width: '100%', gap: 10,
  },
  modalTitle: { fontSize: 17, fontWeight: '700', color: t.text.primary, textAlign: 'center' },
  modalBody: { fontSize: 13, color: t.text.secondary, textAlign: 'center' },
  fieldLabel: { fontSize: 12, fontWeight: '600', color: t.text.primary },
  input: {
    borderWidth: 1, borderColor: t.border.subtle, borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 9, fontSize: 14, color: t.text.primary,
    backgroundColor: t.bg.surface,
  },
  textArea: {
    borderWidth: 1, borderColor: t.border.subtle, borderRadius: 10,
    padding: 10, minHeight: 60, textAlignVertical: 'top', fontSize: 14, color: t.text.primary,
    backgroundColor: t.bg.surface,
  },
  modalitySelector: { flexDirection: 'row', gap: 8 },
  modalityOption: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1.5, borderColor: ADMIN_COLOR, borderRadius: 10, paddingVertical: 9,
  },
  modalityOptionSelected: { backgroundColor: ADMIN_COLOR },
  modalityOptionText: { fontSize: 13, fontWeight: '600', color: ADMIN_COLOR },
  modalRow: { flexDirection: 'row', gap: 10 },
  outlineBtn: {
    flex: 1, borderWidth: 1.5, borderColor: t.border.subtle, borderRadius: 12,
    padding: 12, alignItems: 'center',
  },
  outlineBtnText: { fontSize: 14, fontWeight: '600', color: t.text.primary },
  confirmBtn: {
    flex: 1, backgroundColor: ADMIN_COLOR, borderRadius: 12,
    padding: 12, alignItems: 'center', justifyContent: 'center',
  },
  confirmBtnText: { fontSize: 14, fontWeight: '700', color: t.text.inverse },
  searchBtn: {
    backgroundColor: ADMIN_COLOR, borderRadius: 10, paddingHorizontal: 14,
    alignItems: 'center', justifyContent: 'center', minWidth: 48,
  },
  houseOption: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    borderWidth: 1.5, borderColor: t.border.subtle, borderRadius: 12, padding: 12,
  },
  houseOptionActive: { borderColor: ADMIN_COLOR, backgroundColor: `${ADMIN_COLOR}0A` },
  houseOptionText: { fontSize: 14, fontWeight: '600', color: t.text.primary },
  houseOptionSub: { fontSize: 12, color: t.text.secondary },
});
