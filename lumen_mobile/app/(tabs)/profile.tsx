/**
 * Profile Screen
 * ==============
 * Exibe todos os dados do perfil e permite editar qualquer campo.
 * Inclui: dados pessoais, comunidade, vocacional, ministério,
 * informações extras (instagram, alimentação, saúde, acomodação, missão,
 * encontro Despertar) e contato de emergência.
 */

import { useState, useEffect, useCallback, memo } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Modal, TextInput, ActivityIndicator, FlatList,
  RefreshControl, Image, Switch, Platform, Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router, type Href } from 'expo-router';
import type { IoniconsName } from '@/types/icons';
import { signOut } from 'firebase/auth';
import { auth } from '@/config/firebase';
import { profileService } from '@/services';
import brasilApi, { type Municipio } from '@/services/brasilApi';
import type { CatalogItem, Profile } from '@/types';
import { useTheme } from '@/theme';
import type { SemanticTokens } from '@/theme';

// =============================================================================
// CONSTANTES
// =============================================================================

// Cores tokens — instanciadas em useTokenColors() dentro dos componentes
const PRIMARY = '#1A859B';
const WHITE = '#ffffff';
const GRAY = '#6b7280';
const BG = '#f3f4f6';

const BR_STATES = [
  'AC','AL','AP','AM','BA','CE','DF','ES','GO',
  'MA','MT','MS','MG','PA','PB','PR','PE','PI',
  'RJ','RN','RS','RO','RR','SC','SP','SE','TO',
];

const DESPERTAR_ENCOUNTERS = [
  '1 – Água Viva','2 – Juventude Livre','3 – Fonte de Viver','4 – Mir',
  '5 – Raios de Amor','6 – Chama Viva','7 – Logos','8 – Kyrios',
  '9 – Maria de Deus','10 – Éfeta','11 – Sanctus','12 – Gênesis',
  '13 – Ágape','14 – Elyon','15 – Khesed','16 – Trinitas','17 – Ixyus',
  '18 – Luz do Mundo','19 – Ruah','20 – Mater Dei','21 – Agnus Dei',
  '22 – Kaire','23 – Adonai','24 – Charitas','25 – Ieshuah','26 – Kairós',
  '27 – Seraph','28 – Kenosis','29 – Parresia','30 – Fides',
  '31 – Domus Dei','32 – Magnificat','33 – Gaudium','34 – Atrium',
  '35 – Ignis','36 – Raboni','37 – Pietá','38 – Charis','39 – Emanuel',
  '40 – Totus Tuus','41 – Fraternitas','42 – Lazarus','43 – Filho da Luz',
  '44 – Anawin','45 – Dilext Nos','46 – Franciscus','47 – Kadosh',
];

const ACCOMMODATION_OPTIONS = [
  { value: 'CAMA', label: 'Cama' },
  { value: 'REDE', label: 'Rede' },
  { value: 'COLCHAO_INFLAVEL', label: 'Colchão Inflável' },
];

const INSTRUMENTS = [
  'Violão', 'Guitarra', 'Bateria', 'Teclado', 'Voz',
  'Flauta', 'Saxofone', 'Trompete', 'Piano', 'Contrabaixo', 'Outro',
];

const DAYS = ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado', 'Domingo'];
const TURNS = ['Manhã', 'Tarde', 'Noite'];
const availKey = (day: string, turn: string) => `${day}-${turn}`;

// =============================================================================
// HELPERS
// =============================================================================

const isoToDisplay = (iso: string | null | undefined): string => {
  if (!iso) return '';
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
};

const e164ToDisplay = (e164: string | null | undefined): string => {
  if (!e164) return '';
  const digits = e164.replace(/\D/g, '');
  const local = digits.startsWith('55') ? digits.slice(2) : digits;
  if (local.length === 11) return `(${local.slice(0,2)}) ${local.slice(2,7)}-${local.slice(7)}`;
  if (local.length === 10) return `(${local.slice(0,2)}) ${local.slice(2,6)}-${local.slice(6)}`;
  return e164;
};

const formatPhone = (v: string): string => {
  const d = v.replace(/\D/g, '').slice(0, 11);
  if (d.length <= 2) return d;
  if (d.length <= 6) return `(${d.slice(0,2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0,2)}) ${d.slice(2,6)}-${d.slice(6)}`;
  return `(${d.slice(0,2)}) ${d.slice(2,7)}-${d.slice(7)}`;
};

const formatDate = (v: string): string => {
  const d = v.replace(/\D/g, '').slice(0, 8);
  if (d.length <= 2) return d;
  if (d.length <= 4) return `${d.slice(0,2)}/${d.slice(2)}`;
  return `${d.slice(0,2)}/${d.slice(2,4)}/${d.slice(4)}`;
};

// =============================================================================
// TELA PRINCIPAL
// =============================================================================

export default function ProfileScreen() {
  const { t, isDark, setTheme } = useTheme();
  const styles = makeStyles(t);

  const [profile, setProfile] = useState<Profile | null>(null);
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');

  // Catálogos
  const [lifeStates, setLifeStates] = useState<CatalogItem[]>([]);
  const [maritalStatuses, setMaritalStatuses] = useState<CatalogItem[]>([]);
  const [vocationalRealities, setVocationalRealities] = useState<CatalogItem[]>([]);
  const [realidadeAtualOptions, setRealidadeAtualOptions] = useState<CatalogItem[]>([]);
  const [missions, setMissions] = useState<{ id: string; name: string }[]>([]);
  const [sectors, setSectors] = useState<{ id: string; name: string }[]>([]);

  // BrasilAPI — cidades
  const [municipios, setMunicipios] = useState<Municipio[]>([]);
  const [loadingMunicipios, setLoadingMunicipios] = useState(false);

  // Modal principal de edição
  const [editVisible, setEditVisible] = useState(false);

  // Campos agrupados por seção
  const [editPersonal, setEditPersonal] = useState({ name: '', phone: '', birthDate: '', uf: '', city: '', instagram: '', moraFora: false, paisFora: '' });
  const [editCommunity, setEditCommunity] = useState({
    lifeState: null as CatalogItem | null, marital: null as CatalogItem | null,
    vocational: null as CatalogItem | null, despertar: '', hasAccomp: false,
    accompName: '', interestedMinistry: false, ministryNotes: '',
    isFromMission: false, missionName: '', missionOrgUnitId: null as string | null,
  });
  const [editExtra, setEditExtra] = useState({
    accommodationOptions: [] as string[], dietaryRestriction: false, dietaryNotes: '',
    healthInsurance: false, healthInsuranceName: '',
  });
  const [editMusic, setEditMusic] = useState({
    playsInstrument: false, instrumentNames: [] as string[],
    availableForGroup: false, musicAvailability: [] as string[],
  });
  const [editEmergency, setEditEmergency] = useState({ name: '', relationship: '', phone: '' });

  const [editErrors, setEditErrors] = useState<Record<string, string>>({});

  // Campos extras do modal
  const [editRealidadeAtual, setEditRealidadeAtual] = useState<string[]>([]);
  const [editSpouseInCommunity, setEditSpouseInCommunity] = useState<boolean | null>(null);
  const [editConsecrationYear, setEditConsecrationYear] = useState('');
  const [editSectorIds, setEditSectorIds] = useState<string[]>([]);

  // Sub-modais
  const [ufModalVisible, setUfModalVisible] = useState(false);
  const [cityModalVisible, setCityModalVisible] = useState(false);
  const [missionModalVisible, setMissionModalVisible] = useState(false);
  const [catalogModalVisible, setCatalogModalVisible] = useState(false);
  const [catalogOptions, setCatalogOptions] = useState<CatalogItem[]>([]);
  const [catalogTitle, setCatalogTitle] = useState('');
  const [catalogOnSelect, setCatalogOnSelect] = useState<(item: CatalogItem) => void>(() => () => {});
  const [despertarModalVisible, setDespertarModalVisible] = useState(false);

  useEffect(() => {
    loadProfile();
    loadCatalogs();
  }, []);

  const loadProfile = async () => {
    try {
      await auth.authStateReady();
      setEmail(auth.currentUser?.email ?? '');
      const data = await profileService.getProfile();
      setProfile(data as Profile);
    } catch (e: any) {
      if (e?.response?.status !== 404) console.log('Erro ao carregar perfil:', e);
    } finally {
      setLoading(false);
    }
  };

  const loadCatalogs = async () => {
    try {
      const [catalogs, missionsData, sectorsData] = await Promise.all([
        profileService.getCatalogs(),
        profileService.getMissions().catch(() => [] as { id: string; name: string }[]),
        profileService.getSectors().catch(() => [] as { id: string; name: string }[]),
      ]);
      const find = (code: string) => catalogs.find(c => c.code === code)?.items ?? [];
      setLifeStates(find('LIFE_STATE'));
      setMaritalStatuses(find('MARITAL_STATUS'));
      setVocationalRealities(find('VOCATIONAL_REALITY'));
      setRealidadeAtualOptions(find('REALIDADE_ATUAL'));
      setMissions(missionsData);
      setSectors(sectorsData);
    } catch { /* silencioso */ }
  };

  const loadMunicipios = async (uf: string) => {
    if (!uf) { setMunicipios([]); return; }
    setLoadingMunicipios(true);
    try {
      const data = await brasilApi.getMunicipios(uf);
      setMunicipios(data);
    } catch {
      setMunicipios([]);
    } finally {
      setLoadingMunicipios(false);
    }
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadProfile();
    setRefreshing(false);
  }, []);

  // ---------------------------------------------------------------------------
  // Abre o modal populando todos os campos
  // ---------------------------------------------------------------------------
  const openEditModal = () => {
    if (!profile) return;
    const abroad = !!profile.country && !profile.state;
    setEditPersonal({
      name: profile.full_name ?? '',
      phone: e164ToDisplay(profile.phone_e164),
      birthDate: isoToDisplay(profile.birth_date),
      uf: profile.state ?? '',
      city: profile.city ?? '',
      instagram: profile.instagram ?? '',
      moraFora: abroad,
      paisFora: abroad ? (profile.country ?? '') : '',
    });
    setEditCommunity({
      lifeState: lifeStates.find(i => i.id === profile.life_state_item_id) ?? null,
      marital: maritalStatuses.find(i => i.id === profile.marital_status_item_id) ?? null,
      vocational: vocationalRealities.find(i => i.id === profile.vocational_reality_item_id) ?? null,
      despertar: profile.despertar_encounter ?? '',
      hasAccomp: profile.has_vocational_accompaniment ?? false,
      accompName: profile.vocational_accompanist_name ?? '',
      interestedMinistry: profile.interested_in_ministry ?? false,
      ministryNotes: profile.ministry_interest_notes ?? '',
      isFromMission: profile.is_from_mission ?? false,
      missionName: profile.mission_name ?? '',
      missionOrgUnitId: profile.mission_org_unit_id ?? null,
    });
    setEditSectorIds(profile.ministry_sector_ids ?? []);
    if (profile.state && !abroad) loadMunicipios(profile.state);
    setEditExtra({
      accommodationOptions: profile.accommodation_options ?? [],
      dietaryRestriction: profile.dietary_restriction ?? false,
      dietaryNotes: profile.dietary_restriction_notes ?? '',
      healthInsurance: profile.health_insurance ?? false,
      healthInsuranceName: profile.health_insurance_name ?? '',
    });
    setEditMusic({
      playsInstrument: profile.plays_instrument ?? false,
      instrumentNames: profile.instrument_names ?? [],
      availableForGroup: profile.available_for_group ?? false,
      musicAvailability: profile.music_availability ?? [],
    });
    const ec = profile.emergency_contacts?.[0];
    setEditEmergency({
      name: ec?.name ?? '',
      relationship: ec?.relationship ?? '',
      phone: ec ? e164ToDisplay(ec.phone_e164) : '',
    });
    setEditRealidadeAtual(profile.realidade_atual ?? []);
    setEditSpouseInCommunity(profile.spouse_in_community ?? null);
    setEditConsecrationYear(profile.consecration_year ? String(profile.consecration_year) : '');
    setEditErrors({});
    setSaveError('');
    setEditVisible(true);
  };

  const openCatalogModal = (title: string, options: CatalogItem[], onSelect: (item: CatalogItem) => void) => {
    setCatalogTitle(title);
    setCatalogOptions(options);
    setCatalogOnSelect(() => onSelect);
    setCatalogModalVisible(true);
  };

  // ---------------------------------------------------------------------------
  // Valida e salva
  // ---------------------------------------------------------------------------
  const validateEdit = (): boolean => {
    const e: Record<string, string> = {};
    if (editPersonal.name.trim().length < 2) e.name = 'Nome obrigatório (mín. 2 caracteres)';
    if (editPersonal.phone.replace(/\D/g, '').length < 10) e.phone = 'Telefone inválido';
    const parts = editPersonal.birthDate.split('/');
    if (parts.length !== 3 || (parts[2] ?? '').length !== 4) e.birthDate = 'Data inválida (DD/MM/AAAA)';
    if (!editPersonal.moraFora && !editPersonal.uf) e.uf = 'Selecione o estado';
    if (editPersonal.moraFora && !editPersonal.paisFora.trim()) e.paisFora = 'Informe o país';
    if (editPersonal.city.trim().length < 2) e.city = 'Cidade obrigatória';
    if (editCommunity.interestedMinistry && editSectorIds.length === 0 && !editCommunity.ministryNotes.trim()) {
      e.ministryNotes = 'Selecione ao menos um setor ou descreva o interesse';
    }
    setEditErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSaveProfile = async () => {
    if (!validateEdit()) return;
    setSaving(true);
    setSaveError('');
    try {
      const [dd, mm, yyyy] = editPersonal.birthDate.split('/');
      const phoneDigits = editPersonal.phone.replace(/\D/g, '');
      const isConsagrado = editCommunity.vocational?.code === 'CONSAGRADO_FILHO_DA_LUZ';
      await profileService.updateProfile({
        full_name: editPersonal.name.trim(),
        birth_date: `${yyyy}-${mm}-${dd}`,
        phone_e164: `+55${phoneDigits}`,
        city: editPersonal.city.trim(),
        state: editPersonal.moraFora ? null : editPersonal.uf || null,
        country: editPersonal.moraFora ? editPersonal.paisFora.trim() || null : null,
        photo_url: profile?.photo_url ?? null,
        life_state_item_id: editCommunity.lifeState?.id ?? null,
        marital_status_item_id: editCommunity.marital?.id ?? null,
        vocational_reality_item_id: editCommunity.vocational?.id ?? null,
        consecration_year: isConsagrado && editConsecrationYear ? parseInt(editConsecrationYear) : null,
        spouse_in_community: editSpouseInCommunity,
        has_vocational_accompaniment: editCommunity.hasAccomp,
        interested_in_ministry: editCommunity.interestedMinistry,
        ministry_interest_notes: editCommunity.interestedMinistry ? editCommunity.ministryNotes.trim() || null : null,
        ministry_sector_ids: editCommunity.interestedMinistry && editSectorIds.length > 0 ? editSectorIds : null,
        realidade_atual: editRealidadeAtual.length > 0 ? editRealidadeAtual : null,
        instagram: editPersonal.instagram.trim() || null,
        dietary_restriction: editExtra.dietaryRestriction,
        dietary_restriction_notes: editExtra.dietaryRestriction ? editExtra.dietaryNotes.trim() || null : null,
        health_insurance: editExtra.healthInsurance,
        health_insurance_name: editExtra.healthInsurance ? editExtra.healthInsuranceName.trim() || null : null,
        accommodation_options: editExtra.accommodationOptions.length > 0 ? editExtra.accommodationOptions : null,
        is_from_mission: editCommunity.isFromMission,
        mission_org_unit_id: editCommunity.isFromMission ? editCommunity.missionOrgUnitId : null,
        mission_name: editCommunity.isFromMission && !editCommunity.missionOrgUnitId
          ? editCommunity.missionName.trim() || null
          : null,
        despertar_encounter: editCommunity.despertar || null,
        plays_instrument: editMusic.playsInstrument,
        instrument_names: editMusic.playsInstrument ? editMusic.instrumentNames : null,
        available_for_group: editMusic.playsInstrument ? editMusic.availableForGroup : null,
        music_availability: editMusic.playsInstrument && editMusic.availableForGroup ? editMusic.musicAvailability : null,
      });

      // Salva contato de emergência se nome preenchido
      if (editEmergency.name.trim()) {
        await profileService.addEmergencyContact({
          name: editEmergency.name.trim(),
          phone_e164: `+55${editEmergency.phone.replace(/\D/g, '')}`,
          relationship: editEmergency.relationship.trim() || 'Não informado',
        });
      }

      await loadProfile();
      setEditVisible(false);
    } catch (err: any) {
      // Loga o erro completo para diagnóstico
      console.error('[handleSaveProfile] Erro ao salvar perfil:', JSON.stringify(err?.response?.data ?? err?.message ?? err));
      const status = err?.response?.status;
      const detail = err?.response?.data?.detail;
      let msg = 'Não foi possível salvar. Tente novamente.';
      if (typeof detail === 'string') msg = detail;
      else if (detail?.message) msg = detail.message;
      else if (Array.isArray(detail) && detail[0]?.msg) msg = `Dado inválido: ${detail[0].msg}`;
      else if (status === 409) msg = 'Conflito: telefone ou CPF já cadastrado.';
      else if (status === 503) msg = 'Serviço temporariamente indisponível.';
      setSaveError(msg);
      // Alert popup para garantir visibilidade do erro
      Alert.alert('Erro ao Salvar', msg, [{ text: 'OK' }]);
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = () => {
    if (Platform.OS === 'web') {
      if (window.confirm('Deseja realmente sair da sua conta?')) {
        signOut(auth).then(() => router.replace('/(auth)/login'));
      }
    } else {
      const { Alert } = require('react-native') as typeof import('react-native');
      Alert.alert('Sair', 'Deseja realmente sair da sua conta?', [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Sair', style: 'destructive', onPress: async () => { await signOut(auth); router.replace('/(auth)/login'); } },
      ]);
    }
  };

  if (loading) {
    return <View style={styles.loadingContainer}><ActivityIndicator size="large" color={PRIMARY} /></View>;
  }

  const isComplete = profile?.status === 'COMPLETE';
  const ec = profile?.emergency_contacts?.[0];

  return (
    <View style={{ flex: 1 }}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[PRIMARY]} />}
      >
        {/* ── Header ── */}
        <View style={styles.headerCard}>
          {/* Avatar com anel teal */}
          <View style={styles.avatarContainer}>
            <View style={{
              width: 92, height: 92, borderRadius: 46,
              borderWidth: 2.5, borderColor: t.brand.primary,
              alignItems: 'center', justifyContent: 'center',
              ...t.shadow.sm,
            }}>
              {profile?.photo_url
                ? <Image source={{ uri: profile.photo_url }} style={styles.avatar} />
                : <View style={styles.avatarPlaceholder}>
                    <Ionicons name="person" size={40} color={WHITE} />
                  </View>
              }
            </View>
          </View>

          <Text style={styles.userName}>{profile?.full_name || 'Nome não informado'}</Text>
          <Text style={styles.userEmail}>{email}</Text>

          {/* Faixa de pertencimento comunitário */}
          {(profile?.vocational_reality_label || profile?.life_state_label ||
            (profile?.is_from_mission && profile?.mission_name) ||
            profile?.despertar_encounter) ? (
            <View style={{
              flexDirection: 'row', flexWrap: 'wrap', gap: 8,
              justifyContent: 'center', marginBottom: 12, paddingHorizontal: 8,
            }}>
              {profile?.vocational_reality_label ? (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: t.brand.primaryDim, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 9999 }}>
                  <Ionicons name="star-outline" size={11} color={t.brand.primary} />
                  <Text style={{ fontSize: 11, fontFamily: 'Nunito-SemiBold', color: t.brand.primary }}>{profile.vocational_reality_label}</Text>
                </View>
              ) : null}
              {profile?.life_state_label ? (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: t.brand.primaryDim, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 9999 }}>
                  <Ionicons name="heart-outline" size={11} color={t.brand.primary} />
                  <Text style={{ fontSize: 11, fontFamily: 'Nunito-SemiBold', color: t.brand.primary }}>{profile.life_state_label}</Text>
                </View>
              ) : null}
              {profile?.is_from_mission && profile?.mission_name ? (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: t.brand.primaryDim, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 9999 }}>
                  <Ionicons name="globe-outline" size={11} color={t.brand.primary} />
                  <Text style={{ fontSize: 11, fontFamily: 'Nunito-SemiBold', color: t.brand.primary }}>{profile.mission_name}</Text>
                </View>
              ) : null}
              {profile?.despertar_encounter ? (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: t.brand.primaryDim, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 9999 }}>
                  <Ionicons name="flame-outline" size={11} color={t.brand.primary} />
                  <Text style={{ fontSize: 11, fontFamily: 'Nunito-SemiBold', color: t.brand.primary }}>{profile.despertar_encounter}</Text>
                </View>
              ) : null}
            </View>
          ) : null}

          <View style={[styles.statusChip, isComplete ? styles.statusComplete : styles.statusPending]}>
            <Text style={[styles.statusText, { color: isComplete ? '#16a34a' : '#d97706' }]}>
              {isComplete ? '✓ Perfil Completo' : '⏳ Perfil Incompleto'}
            </Text>
          </View>
          <TouchableOpacity style={styles.editProfileButton} onPress={openEditModal}>
            <Ionicons name="create-outline" size={18} color={PRIMARY} />
            <Text style={styles.editProfileButtonText}>Editar Perfil</Text>
          </TouchableOpacity>
        </View>

        {/* ── Dados Pessoais ── */}
        <SectionTitle t={t}>Dados Pessoais</SectionTitle>
        <View style={styles.card}>
          <InfoRow icon="person-outline" label="Nome" value={profile?.full_name} t={t} />
          <InfoRow icon="calendar-outline" label="Nascimento" value={isoToDisplay(profile?.birth_date) || undefined} t={t} />
          <InfoRow icon="call-outline" label="Telefone" value={e164ToDisplay(profile?.phone_e164) || undefined} t={t} />
          <InfoRow icon="logo-instagram" label="Instagram" value={profile?.instagram} t={t} />
          <InfoRow icon="map-outline" label="Estado / País"
            value={profile?.state ?? (profile?.country ? `${profile.country} (exterior)` : undefined)} t={t} />
          <InfoRow icon="location-outline" label="Cidade" value={profile?.city} last t={t} />
        </View>

        {/* ── Informações da Comunidade ── */}
        <SectionTitle t={t}>Informações da Comunidade</SectionTitle>
        <View style={styles.card}>
          <InfoRow icon="heart-outline" label="Estado de Vida" value={profile?.life_state_label} t={t} />
          <InfoRow icon="people-outline" label="Estado Civil" value={profile?.marital_status_label} t={t} />
          {profile?.spouse_in_community != null ? (
            <InfoRow icon="people-circle-outline" label="Cônjuge na Comunidade"
              value={profile.spouse_in_community ? 'Sim' : 'Não'} t={t} />
          ) : null}
          <InfoRow icon="star-outline" label="Realidade Vocacional" value={profile?.vocational_reality_label} t={t} />
          {profile?.consecration_year ? (
            <InfoRow icon="ribbon-outline" label="Ano de Consagração" value={String(profile.consecration_year)} t={t} />
          ) : null}
          {profile?.realidade_atual?.length ? (
            <InfoRow icon="list-outline" label="Realidade Atual" value={profile.realidade_atual.join(', ')} t={t} />
          ) : null}
          <InfoRow icon="flame-outline" label="Encontro Despertar" value={profile?.despertar_encounter} t={t} />
          <InfoRow icon="globe-outline" label="É de alguma Missão"
            value={profile?.is_from_mission == null ? undefined : profile.is_from_mission ? (profile.mission_name ?? 'Sim') : 'Não'} last t={t} />
        </View>

        {/* ── Retiros e Eventos ── */}
        <SectionTitle sensitive t={t}>Retiros e Eventos</SectionTitle>
        <View style={styles.card}>
          <InfoRow icon="bed-outline" label="Disponibilidade de Acomodação"
            value={profile?.accommodation_options?.length
              ? profile.accommodation_options.map(v => ACCOMMODATION_OPTIONS.find(o => o.value === v)?.label ?? v).join(', ')
              : undefined} t={t} />
          <InfoRow icon="restaurant-outline" label="Restrição Alimentar"
            value={profile?.dietary_restriction == null ? undefined
              : profile.dietary_restriction ? (profile.dietary_restriction_notes ?? 'Sim') : 'Não'} t={t} />
          <InfoRow icon="medkit-outline" label="Plano de Saúde"
            value={profile?.health_insurance == null ? undefined
              : profile.health_insurance ? (profile.health_insurance_name ?? 'Sim') : 'Não'} last t={t} />
        </View>

        {/* ── Acompanhamento Vocacional ── */}
        <SectionTitle t={t}>Acompanhamento Vocacional</SectionTitle>
        <View style={styles.card}>
          <InfoRow icon="hand-left-outline" label="Possui acompanhamento"
            value={profile?.has_vocational_accompaniment == null ? undefined
              : profile.has_vocational_accompaniment ? 'Sim' : 'Não'} last t={t} />
        </View>

        {/* ── Interesse em Ministério ── */}
        <SectionTitle t={t}>Interesse em Ministério</SectionTitle>
        <View style={styles.card}>
          <InfoRow icon="flag-outline" label="Tem interesse"
            value={profile?.interested_in_ministry == null ? undefined
              : profile.interested_in_ministry ? 'Sim' : 'Não'} t={t} />
          {profile?.interested_in_ministry && profile?.ministry_interest_notes
            ? <InfoRow icon="document-text-outline" label="Observações" value={profile.ministry_interest_notes} last t={t} />
            : <View style={{ height: 2 }} />
          }
        </View>

        {/* ── Música e Ministério Musical ── */}
        <SectionTitle t={t}>Música e Ministério Musical</SectionTitle>
        <View style={styles.card}>
          <InfoRow icon="musical-notes-outline" label="Toca instrumento ou canta"
            value={profile?.plays_instrument == null ? undefined
              : profile.plays_instrument ? 'Sim' : 'Não'} t={t} />
          {profile?.plays_instrument && profile.instrument_names?.length ? (
            <InfoRow icon="musical-note-outline" label="Instrumento(s)"
              value={profile.instrument_names.join(', ')} t={t} />
          ) : null}
          {profile?.plays_instrument ? (
            <InfoRow icon="people-outline" label="Disponível para grupo"
              value={profile.available_for_group == null ? undefined
                : profile.available_for_group ? 'Sim' : 'Não'} t={t} />
          ) : null}
          {profile?.plays_instrument && profile.available_for_group && profile.music_availability?.length ? (
            <InfoRow icon="time-outline" label="Disponibilidade"
              value={profile.music_availability.join(', ')} last t={t} />
          ) : (
            <View style={{ height: 2 }} />
          )}
        </View>

        {/* ── Contato de Emergência ── */}
        <SectionTitle sensitive t={t}>Contato de Emergência</SectionTitle>
        <View style={styles.card}>
          <InfoRow icon="person-add-outline" label="Nome" value={ec?.name} t={t} />
          <InfoRow icon="heart-circle-outline" label="Parentesco" value={ec?.relationship} t={t} />
          <InfoRow icon="call-outline" label="Telefone" value={e164ToDisplay(ec?.phone_e164) || undefined} last t={t} />
        </View>

        {/* ── Aparência ── */}
        <View style={styles.appearanceCard}>
          <Text style={styles.appearanceLabel}>
            Aparência
          </Text>
          <View style={styles.appearanceRow}>
            <TouchableOpacity
              style={[
                styles.themeBtn,
                !isDark && styles.themeBtnActive,
                { borderColor: !isDark ? t.brand.primary : t.border.subtle },
              ]}
              onPress={() => setTheme('light')}
              activeOpacity={0.8}
              accessibilityLabel="Tema claro"
              accessibilityRole="button"
            >
              <Text style={[
                styles.themeBtnText,
                { color: !isDark ? t.brand.primary : t.text.secondary },
                !isDark && styles.themeBtnTextActive,
              ]}>
                Claro
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.themeBtn,
                isDark && styles.themeBtnActive,
                { borderColor: isDark ? t.brand.primary : t.border.subtle },
              ]}
              onPress={() => setTheme('dark')}
              activeOpacity={0.8}
              accessibilityLabel="Tema escuro"
              accessibilityRole="button"
            >
              <Text style={[
                styles.themeBtnText,
                { color: isDark ? t.brand.primary : t.text.secondary },
                isDark && styles.themeBtnTextActive,
              ]}>
                Escuro
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* ── Sair ── */}
        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
          <Ionicons name="log-out-outline" size={20} color="#ef4444" />
          <Text style={styles.logoutText}>Sair da Conta</Text>
        </TouchableOpacity>
        <Text style={styles.version}>Lumen+ v1.0.0</Text>
      </ScrollView>

      {/* ══════════════════════════════════════════════════════════
          Modal: Editar Perfil
      ══════════════════════════════════════════════════════════ */}
      <Modal visible={editVisible} animationType="slide" presentationStyle="pageSheet"
        onRequestClose={() => !saving && setEditVisible(false)}>
        <View style={styles.editModal}>
          <View style={styles.editHeader}>
            <TouchableOpacity onPress={() => !saving && setEditVisible(false)} style={styles.editHeaderBack}>
              <Ionicons name="arrow-back" size={24} color="#171717" />
            </TouchableOpacity>
            <Text style={styles.editHeaderTitle}>Editar Perfil</Text>
            <TouchableOpacity
              style={[{
                paddingHorizontal: 16, paddingVertical: 8,
                backgroundColor: PRIMARY, borderRadius: 20,
              }, saving ? { opacity: 0.5 } : null]}
              onPress={handleSaveProfile}
              disabled={saving}
            >
              <Text style={{ color: WHITE, fontSize: 13, fontWeight: '700' }}>Salvar</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.editBody} contentContainerStyle={styles.editBodyContent} keyboardShouldPersistTaps="handled">

            {/* ─ Dados Pessoais ─ */}
            <Text style={styles.editSection}>Dados Pessoais</Text>

            <Text style={styles.editLabel}>Nome completo *</Text>
            <TextInput style={[styles.editInput, editErrors.name ? styles.editInputError : null]}
              value={editPersonal.name} onChangeText={t => { setEditPersonal(p => ({ ...p, name: t })); setEditErrors(p => ({ ...p, name: '' })); }}
              placeholder="Nome completo" autoCapitalize="words" />
            {editErrors.name ? <Text style={styles.editError}>{editErrors.name}</Text> : null}

            <Text style={styles.editLabel}>Telefone (WhatsApp) *</Text>
            <TextInput style={[styles.editInput, editErrors.phone ? styles.editInputError : null]}
              value={editPersonal.phone} onChangeText={t => { setEditPersonal(p => ({ ...p, phone: formatPhone(t) })); setEditErrors(p => ({ ...p, phone: '' })); }}
              placeholder="(11) 99999-9999" keyboardType="phone-pad" />
            {editErrors.phone ? <Text style={styles.editError}>{editErrors.phone}</Text> : null}

            <Text style={styles.editLabel}>Data de nascimento *</Text>
            <TextInput style={[styles.editInput, editErrors.birthDate ? styles.editInputError : null]}
              value={editPersonal.birthDate} onChangeText={t => { setEditPersonal(p => ({ ...p, birthDate: formatDate(t) })); setEditErrors(p => ({ ...p, birthDate: '' })); }}
              placeholder="DD/MM/AAAA" keyboardType="numeric" />
            {editErrors.birthDate ? <Text style={styles.editError}>{editErrors.birthDate}</Text> : null}

            <View style={styles.toggleRow}>
              <Text style={styles.toggleLabel}>Moro fora do Brasil</Text>
              <Switch
                value={editPersonal.moraFora}
                onValueChange={(v) => setEditPersonal(p => ({
                  ...p, moraFora: v, uf: v ? '' : p.uf, paisFora: v ? p.paisFora : '',
                }))}
                trackColor={{ false: '#d1d5db', true: `${PRIMARY}80` }}
                thumbColor={editPersonal.moraFora ? PRIMARY : '#9ca3af'}
              />
            </View>

            {editPersonal.moraFora ? (
              <>
                <Text style={styles.editLabel}>País *</Text>
                <TextInput
                  style={[styles.editInput, editErrors.paisFora ? styles.editInputError : null]}
                  value={editPersonal.paisFora}
                  onChangeText={t => { setEditPersonal(p => ({ ...p, paisFora: t })); setEditErrors(p => ({ ...p, paisFora: '' })); }}
                  placeholder="Ex: Portugal, Estados Unidos..."
                  autoCapitalize="words"
                />
                {editErrors.paisFora ? <Text style={styles.editError}>{editErrors.paisFora}</Text> : null}
              </>
            ) : (
              <>
                <Text style={styles.editLabel}>Estado (UF) *</Text>
                <TouchableOpacity style={[styles.editSelector, editErrors.uf ? styles.editInputError : null]}
                  onPress={() => setUfModalVisible(true)}>
                  <Text style={editPersonal.uf ? styles.editSelectorValue : styles.editSelectorPlaceholder}>
                    {editPersonal.uf || 'Selecione o estado'}
                  </Text>
                  <Ionicons name="chevron-down" size={18} color={GRAY} />
                </TouchableOpacity>
                {editErrors.uf ? <Text style={styles.editError}>{editErrors.uf}</Text> : null}
              </>
            )}

            <Text style={styles.editLabel}>Cidade *</Text>
            {editPersonal.moraFora ? (
              <TextInput
                style={[styles.editInput, editErrors.city ? styles.editInputError : null]}
                value={editPersonal.city}
                onChangeText={t => { setEditPersonal(p => ({ ...p, city: t })); setEditErrors(p => ({ ...p, city: '' })); }}
                placeholder="Sua cidade"
                autoCapitalize="words"
              />
            ) : loadingMunicipios ? (
              <ActivityIndicator size="small" color={PRIMARY} style={{ marginVertical: 12 }} />
            ) : (
              <TouchableOpacity
                style={[styles.editSelector, editErrors.city ? styles.editInputError : null]}
                onPress={() => { if (municipios.length > 0) setCityModalVisible(true); }}
                disabled={municipios.length === 0}
              >
                <Text style={editPersonal.city ? styles.editSelectorValue : styles.editSelectorPlaceholder}>
                  {editPersonal.city || (editPersonal.uf ? 'Selecione a cidade' : 'Selecione o estado primeiro')}
                </Text>
                <Ionicons name="chevron-down" size={18} color={GRAY} />
              </TouchableOpacity>
            )}
            {editErrors.city ? <Text style={styles.editError}>{editErrors.city}</Text> : null}

            <Text style={styles.editLabel}>Instagram</Text>
            <TextInput style={styles.editInput} value={editPersonal.instagram}
              onChangeText={t => setEditPersonal(p => ({ ...p, instagram: t }))}
              placeholder="@usuario" autoCapitalize="none" />

            {/* ─ Informações da Comunidade ─ */}
            <View style={{ height: 1, backgroundColor: '#e5e7eb', marginTop: 24, marginBottom: 4 }} />
            <Text style={styles.editSection}>Informações da Comunidade</Text>

            <Text style={styles.editLabel}>Estado de Vida</Text>
            <TouchableOpacity style={styles.editSelector}
              onPress={() => openCatalogModal('Estado de Vida', lifeStates, item => { setEditCommunity(p => ({ ...p, lifeState: item })); setCatalogModalVisible(false); })}>
              <Text style={editCommunity.lifeState ? styles.editSelectorValue : styles.editSelectorPlaceholder}>
                {editCommunity.lifeState?.label || 'Selecionar'}
              </Text>
              <Ionicons name="chevron-down" size={18} color={GRAY} />
            </TouchableOpacity>

            <Text style={styles.editLabel}>Estado Civil</Text>
            <TouchableOpacity style={styles.editSelector}
              onPress={() => openCatalogModal('Estado Civil', maritalStatuses, item => { setEditCommunity(p => ({ ...p, marital: item })); setCatalogModalVisible(false); })}>
              <Text style={editCommunity.marital ? styles.editSelectorValue : styles.editSelectorPlaceholder}>
                {editCommunity.marital?.label || 'Selecionar'}
              </Text>
              <Ionicons name="chevron-down" size={18} color={GRAY} />
            </TouchableOpacity>

            {['CASADO', 'UNIAO_ESTAVEL'].includes(editCommunity.marital?.code ?? '') && (
              <View style={styles.toggleRow}>
                <Text style={styles.toggleLabel}>Cônjuge faz parte da comunidade?</Text>
                <Switch
                  value={editSpouseInCommunity ?? false}
                  onValueChange={setEditSpouseInCommunity}
                  trackColor={{ false: '#d1d5db', true: `${PRIMARY}80` }}
                  thumbColor={editSpouseInCommunity ? PRIMARY : '#9ca3af'}
                />
              </View>
            )}

            <Text style={styles.editLabel}>Realidade Vocacional</Text>
            <TouchableOpacity style={styles.editSelector}
              onPress={() => openCatalogModal('Realidade Vocacional', vocationalRealities, item => { setEditCommunity(p => ({ ...p, vocational: item })); setCatalogModalVisible(false); })}>
              <Text style={editCommunity.vocational ? styles.editSelectorValue : styles.editSelectorPlaceholder}>
                {editCommunity.vocational?.label || 'Selecionar'}
              </Text>
              <Ionicons name="chevron-down" size={18} color={GRAY} />
            </TouchableOpacity>

            {editCommunity.vocational?.code === 'CONSAGRADO_FILHO_DA_LUZ' && (
              <>
                <Text style={styles.editLabel}>Ano de Consagração</Text>
                <TextInput
                  style={styles.editInput}
                  value={editConsecrationYear}
                  onChangeText={setEditConsecrationYear}
                  placeholder="Ex: 2020"
                  keyboardType="numeric"
                  maxLength={4}
                />
              </>
            )}

            {realidadeAtualOptions.length > 0 && (
              <>
                <Text style={styles.editLabel}>Realidade Atual</Text>
                <View style={styles.chipsContainer}>
                  {realidadeAtualOptions.map((opt) => {
                    const selected = editRealidadeAtual.includes(opt.code);
                    return (
                      <TouchableOpacity
                        key={opt.code}
                        style={[styles.chip, selected && styles.chipSelected]}
                        onPress={() => setEditRealidadeAtual(prev =>
                          selected ? prev.filter(c => c !== opt.code) : [...prev, opt.code]
                        )}
                      >
                        <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{opt.label}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </>
            )}

            <Text style={styles.editLabel}>Encontro Despertar</Text>
            <TouchableOpacity style={styles.editSelector} onPress={() => setDespertarModalVisible(true)}>
              <Text style={editCommunity.despertar ? styles.editSelectorValue : styles.editSelectorPlaceholder}>
                {editCommunity.despertar || 'Selecionar encontro'}
              </Text>
              <Ionicons name="chevron-down" size={18} color={GRAY} />
            </TouchableOpacity>

            <View style={styles.toggleRow}>
              <Text style={styles.toggleLabel}>É de alguma missão?</Text>
              <Switch value={editCommunity.isFromMission}
                onValueChange={v => setEditCommunity(p => ({
                  ...p, isFromMission: v,
                  missionName: v ? p.missionName : '',
                  missionOrgUnitId: v ? p.missionOrgUnitId : null,
                }))}
                trackColor={{ false: '#d1d5db', true: `${PRIMARY}80` }}
                thumbColor={editCommunity.isFromMission ? PRIMARY : '#9ca3af'} />
            </View>
            {editCommunity.isFromMission && (
              <>
                <Text style={styles.editLabel}>Qual missão?</Text>
                {missions.length > 0 && (
                  <TouchableOpacity style={styles.editSelector} onPress={() => setMissionModalVisible(true)}>
                    <Text style={(editCommunity.missionOrgUnitId || editCommunity.missionName) ? styles.editSelectorValue : styles.editSelectorPlaceholder}>
                      {editCommunity.missionOrgUnitId
                        ? (missions.find(m => m.id === editCommunity.missionOrgUnitId)?.name ?? 'Selecionada')
                        : editCommunity.missionName
                          ? `Outros: ${editCommunity.missionName}`
                          : 'Selecionar missão...'}
                    </Text>
                    <Ionicons name="chevron-down" size={18} color={GRAY} />
                  </TouchableOpacity>
                )}
                {!editCommunity.missionOrgUnitId && (
                  <TextInput
                    style={styles.editInput}
                    value={editCommunity.missionName}
                    onChangeText={t => setEditCommunity(p => ({ ...p, missionName: t }))}
                    placeholder={missions.length > 0 ? 'Ou descreva se não listada...' : 'Nome da missão'}
                  />
                )}
              </>
            )}

            {/* ─ Acompanhamento Vocacional ─ */}
            <View style={{ height: 1, backgroundColor: '#e5e7eb', marginTop: 24, marginBottom: 4 }} />
            <Text style={styles.editSection}>Acompanhamento Vocacional</Text>

            <View style={styles.toggleRow}>
              <Text style={styles.toggleLabel}>Possui acompanhamento vocacional?</Text>
              <Switch value={editCommunity.hasAccomp}
                onValueChange={v => setEditCommunity(p => ({ ...p, hasAccomp: v }))}
                trackColor={{ false: '#d1d5db', true: `${PRIMARY}80` }}
                thumbColor={editCommunity.hasAccomp ? PRIMARY : '#9ca3af'} />
            </View>

            {/* ─ Interesse em Ministério ─ */}
            <View style={{ height: 1, backgroundColor: '#e5e7eb', marginTop: 24, marginBottom: 4 }} />
            <Text style={styles.editSection}>Interesse em Ministério</Text>

            <View style={styles.toggleRow}>
              <Text style={styles.toggleLabel}>Tem interesse em ministério?</Text>
              <Switch value={editCommunity.interestedMinistry}
                onValueChange={v => {
                  setEditCommunity(p => ({ ...p, interestedMinistry: v }));
                  if (!v) { setEditErrors(p => ({ ...p, ministryNotes: '' })); setEditSectorIds([]); }
                }}
                trackColor={{ false: '#d1d5db', true: `${PRIMARY}80` }}
                thumbColor={editCommunity.interestedMinistry ? PRIMARY : '#9ca3af'} />
            </View>
            {editCommunity.interestedMinistry && (
              <>
                {sectors.length > 0 && (
                  <>
                    <Text style={styles.editLabel}>Em quais setores você tem interesse?</Text>
                    <View style={styles.chipsContainer}>
                      {sectors.map(sector => {
                        const selected = editSectorIds.includes(sector.id);
                        return (
                          <TouchableOpacity
                            key={sector.id}
                            style={[styles.chip, selected && styles.chipSelected]}
                            onPress={() => setEditSectorIds(prev =>
                              selected ? prev.filter(id => id !== sector.id) : [...prev, sector.id]
                            )}
                          >
                            <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{sector.name}</Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  </>
                )}
                <Text style={styles.editLabel}>Observações (opcional)</Text>
                <TextInput style={[styles.editInput, styles.editInputMultiline, editErrors.ministryNotes ? styles.editInputError : null]}
                  value={editCommunity.ministryNotes}
                  onChangeText={t => { setEditCommunity(p => ({ ...p, ministryNotes: t })); setEditErrors(p => ({ ...p, ministryNotes: '' })); }}
                  placeholder="Conte-nos mais sobre seu interesse..."
                  multiline numberOfLines={3} />
                {editErrors.ministryNotes ? <Text style={styles.editError}>{editErrors.ministryNotes}</Text> : null}
              </>
            )}

            {/* ─ Música e Ministério Musical ─ */}
            <View style={{ height: 1, backgroundColor: '#e5e7eb', marginTop: 24, marginBottom: 4 }} />
            <Text style={styles.editSection}>Música e Ministério Musical</Text>

            <View style={styles.toggleRow}>
              <Text style={styles.toggleLabel}>Toca instrumento ou canta?</Text>
              <Switch value={editMusic.playsInstrument}
                onValueChange={v => setEditMusic(p => ({
                  ...p,
                  playsInstrument: v,
                  instrumentNames: v ? p.instrumentNames : [],
                  availableForGroup: v ? p.availableForGroup : false,
                  musicAvailability: v ? p.musicAvailability : [],
                }))
                }
                trackColor={{ false: '#d1d5db', true: `${PRIMARY}80` }}
                thumbColor={editMusic.playsInstrument ? PRIMARY : '#9ca3af'} />
            </View>

            {editMusic.playsInstrument && (
              <>
                <Text style={styles.editLabel}>Qual(is) instrumento(s)?</Text>
                <View style={styles.chipsContainer}>
                  {INSTRUMENTS.map(inst => {
                    const selected = editMusic.instrumentNames.includes(inst);
                    return (
                      <TouchableOpacity
                        key={inst}
                        style={[styles.chip, selected && styles.chipSelected]}
                        onPress={() => setEditMusic(p => ({
                          ...p,
                          instrumentNames: selected
                            ? p.instrumentNames.filter(i => i !== inst)
                            : [...p.instrumentNames, inst],
                        }))}
                      >
                        <Text style={[styles.chipText, selected && styles.chipTextSelected]}>
                          {inst}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                <View style={[styles.toggleRow, { marginTop: 12 }]}>
                  <Text style={styles.toggleLabel}>Disponível para servir em grupo?</Text>
                  <Switch value={editMusic.availableForGroup}
                    onValueChange={v => setEditMusic(p => ({
                      ...p, availableForGroup: v, musicAvailability: v ? p.musicAvailability : [],
                    }))}
                    trackColor={{ false: '#d1d5db', true: `${PRIMARY}80` }}
                    thumbColor={editMusic.availableForGroup ? PRIMARY : '#9ca3af'} />
                </View>

                {editMusic.availableForGroup && (
                  <>
                    <Text style={styles.editLabel}>Quais dias e turnos?</Text>
                    <View style={styles.availGrid}>
                      <View style={styles.availHeaderRow}>
                        <View style={styles.availDayCell} />
                        {TURNS.map(turn => (
                          <Text key={turn} style={styles.availTurnHeader}>{turn}</Text>
                        ))}
                      </View>
                      {DAYS.map(day => (
                        <View key={day} style={styles.availRow}>
                          <Text style={styles.availDayLabel}>{day}</Text>
                          {TURNS.map(turn => {
                            const key = availKey(day, turn);
                            const checked = editMusic.musicAvailability.includes(key);
                            return (
                              <TouchableOpacity
                                key={turn}
                                style={[styles.availCell, checked && styles.availCellChecked]}
                                onPress={() => setEditMusic(p => ({
                                  ...p,
                                  musicAvailability: checked
                                    ? p.musicAvailability.filter(k => k !== key)
                                    : [...p.musicAvailability, key],
                                }))}
                              >
                                {checked && <Ionicons name="checkmark" size={14} color={WHITE} />}
                              </TouchableOpacity>
                            );
                          })}
                        </View>
                      ))}
                    </View>
                  </>
                )}
              </>
            )}

            {/* ─ Retiros e Eventos ─ */}
            <View style={{ height: 1, backgroundColor: '#e5e7eb', marginTop: 24, marginBottom: 4 }} />
            <Text style={styles.editSection}>Retiros e Eventos</Text>

            <Text style={styles.editLabel}>Disponibilidade de Acomodação</Text>
            <View style={styles.chipsContainer}>
              {ACCOMMODATION_OPTIONS.map((opt) => {
                const sel = editExtra.accommodationOptions.includes(opt.value);
                return (
                  <TouchableOpacity
                    key={opt.value}
                    style={[styles.chip, sel && styles.chipSelected]}
                    onPress={() =>
                      setEditExtra((p) => ({
                        ...p,
                        accommodationOptions: sel
                          ? p.accommodationOptions.filter((v) => v !== opt.value)
                          : [...p.accommodationOptions, opt.value],
                      }))
                    }
                  >
                    <Text style={[styles.chipText, sel && styles.chipTextSelected]}>{opt.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <View style={styles.toggleRow}>
              <Text style={styles.toggleLabel}>Restrição alimentar?</Text>
              <Switch value={editExtra.dietaryRestriction}
                onValueChange={v => setEditExtra(p => ({ ...p, dietaryRestriction: v, dietaryNotes: v ? p.dietaryNotes : '' }))}
                trackColor={{ false: '#d1d5db', true: `${PRIMARY}80` }}
                thumbColor={editExtra.dietaryRestriction ? PRIMARY : '#9ca3af'} />
            </View>
            {editExtra.dietaryRestriction && (
              <>
                <Text style={styles.editLabel}>Quais restrições?</Text>
                <TextInput style={styles.editInput} value={editExtra.dietaryNotes}
                  onChangeText={t => setEditExtra(p => ({ ...p, dietaryNotes: t }))} placeholder="Ex: Vegano, Sem glúten..." />
              </>
            )}

            <View style={styles.toggleRow}>
              <Text style={styles.toggleLabel}>Possui plano de saúde?</Text>
              <Switch value={editExtra.healthInsurance}
                onValueChange={v => setEditExtra(p => ({ ...p, healthInsurance: v, healthInsuranceName: v ? p.healthInsuranceName : '' }))}
                trackColor={{ false: '#d1d5db', true: `${PRIMARY}80` }}
                thumbColor={editExtra.healthInsurance ? PRIMARY : '#9ca3af'} />
            </View>
            {editExtra.healthInsurance && (
              <>
                <Text style={styles.editLabel}>Qual plano?</Text>
                <TextInput style={styles.editInput} value={editExtra.healthInsuranceName}
                  onChangeText={t => setEditExtra(p => ({ ...p, healthInsuranceName: t }))} placeholder="Ex: Unimed, Bradesco Saúde..." />
              </>
            )}

            {/* ─ Contato de Emergência ─ */}
            <View style={{ height: 1, backgroundColor: '#e5e7eb', marginTop: 24, marginBottom: 4 }} />
            <Text style={styles.editSection}>Contato de Emergência</Text>

            <Text style={styles.editLabel}>Nome</Text>
            <TextInput style={styles.editInput} value={editEmergency.name}
              onChangeText={t => setEditEmergency(p => ({ ...p, name: t }))} placeholder="Nome do contato" autoCapitalize="words" />

            <Text style={styles.editLabel}>Parentesco</Text>
            <TextInput style={styles.editInput} value={editEmergency.relationship}
              onChangeText={t => setEditEmergency(p => ({ ...p, relationship: t }))} placeholder="Ex: Mãe, Pai, Cônjuge" autoCapitalize="words" />

            <Text style={styles.editLabel}>Telefone</Text>
            <TextInput style={styles.editInput} value={editEmergency.phone}
              onChangeText={t => setEditEmergency(p => ({ ...p, phone: formatPhone(t) }))}
              placeholder="(11) 99999-9999" keyboardType="phone-pad" />

            {saveError ? (
              <View style={styles.saveErrorBox}>
                <Text style={styles.saveErrorText}>⚠️ {saveError}</Text>
              </View>
            ) : null}

            <TouchableOpacity style={[styles.saveButton, saving ? styles.saveButtonDisabled : null]}
              onPress={handleSaveProfile} disabled={saving}>
              {saving
                ? <ActivityIndicator color={WHITE} />
                : <Text style={styles.saveButtonText}>Salvar Perfil</Text>
              }
            </TouchableOpacity>
          </ScrollView>
        </View>
      </Modal>

      {/* ══ Sub-modal: Cidade ══ */}
      <Modal visible={cityModalVisible} animationType="slide" transparent onRequestClose={() => setCityModalVisible(false)}>
        <View style={styles.subOverlay}>
          <View style={styles.subSheet}>
            <View style={styles.subHeader}>
              <Text style={styles.subTitle}>Cidade</Text>
              <TouchableOpacity onPress={() => setCityModalVisible(false)}>
                <Ionicons name="close" size={24} color={GRAY} />
              </TouchableOpacity>
            </View>
            <FlatList
              data={municipios}
              keyExtractor={item => item.nome}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[styles.subItem, editPersonal.city === item.nome ? styles.subItemSelected : null]}
                  onPress={() => {
                    setEditPersonal(p => ({ ...p, city: item.nome }));
                    setEditErrors(p => ({ ...p, city: '' }));
                    setCityModalVisible(false);
                  }}
                >
                  <Text style={[styles.subItemText, editPersonal.city === item.nome ? styles.subItemTextSelected : null]}>
                    {item.nome}
                  </Text>
                  {editPersonal.city === item.nome && <Ionicons name="checkmark" size={20} color={PRIMARY} />}
                </TouchableOpacity>
              )}
            />
          </View>
        </View>
      </Modal>

      {/* ══ Sub-modal: Missão ══ */}
      <Modal visible={missionModalVisible} animationType="slide" transparent onRequestClose={() => setMissionModalVisible(false)}>
        <View style={styles.subOverlay}>
          <View style={styles.subSheet}>
            <View style={styles.subHeader}>
              <Text style={styles.subTitle}>Missão</Text>
              <TouchableOpacity onPress={() => setMissionModalVisible(false)}>
                <Ionicons name="close" size={24} color={GRAY} />
              </TouchableOpacity>
            </View>
            <FlatList
              data={[...missions, { id: 'OUTROS', name: 'Outros (não listada)' }]}
              keyExtractor={item => item.id}
              renderItem={({ item }) => {
                const isSelected = item.id === 'OUTROS'
                  ? !editCommunity.missionOrgUnitId
                  : editCommunity.missionOrgUnitId === item.id;
                return (
                  <TouchableOpacity
                    style={[styles.subItem, isSelected ? styles.subItemSelected : null]}
                    onPress={() => {
                      if (item.id === 'OUTROS') {
                        setEditCommunity(p => ({ ...p, missionOrgUnitId: null }));
                      } else {
                        setEditCommunity(p => ({ ...p, missionOrgUnitId: item.id, missionName: '' }));
                      }
                      setMissionModalVisible(false);
                    }}
                  >
                    <Text style={[styles.subItemText, isSelected ? styles.subItemTextSelected : null]}>{item.name}</Text>
                    {isSelected && <Ionicons name="checkmark" size={20} color={PRIMARY} />}
                  </TouchableOpacity>
                );
              }}
            />
          </View>
        </View>
      </Modal>

      {/* ══ Sub-modal: UF ══ */}
      <Modal visible={ufModalVisible} animationType="slide" transparent onRequestClose={() => setUfModalVisible(false)}>
        <View style={styles.subOverlay}>
          <View style={styles.subSheet}>
            <View style={styles.subHeader}>
              <Text style={styles.subTitle}>Estado (UF)</Text>
              <TouchableOpacity onPress={() => setUfModalVisible(false)}>
                <Ionicons name="close" size={24} color={GRAY} />
              </TouchableOpacity>
            </View>
            <FlatList data={BR_STATES} keyExtractor={item => item}
              renderItem={({ item }) => (
                <TouchableOpacity style={[styles.subItem, editPersonal.uf === item ? styles.subItemSelected : null]}
                  onPress={() => {
                    setEditPersonal(p => ({ ...p, uf: item, city: '' }));
                    setEditErrors(p => ({ ...p, uf: '' }));
                    setUfModalVisible(false);
                    loadMunicipios(item);
                  }}>
                  <Text style={[styles.subItemText, editPersonal.uf === item ? styles.subItemTextSelected : null]}>{item}</Text>
                  {editPersonal.uf === item && <Ionicons name="checkmark" size={20} color={PRIMARY} />}
                </TouchableOpacity>
              )}
            />
          </View>
        </View>
      </Modal>

      {/* ══ Sub-modal: Catálogo ══ */}
      <Modal visible={catalogModalVisible} animationType="slide" transparent onRequestClose={() => setCatalogModalVisible(false)}>
        <View style={styles.subOverlay}>
          <View style={styles.subSheet}>
            <View style={styles.subHeader}>
              <Text style={styles.subTitle}>{catalogTitle}</Text>
              <TouchableOpacity onPress={() => setCatalogModalVisible(false)}>
                <Ionicons name="close" size={24} color={GRAY} />
              </TouchableOpacity>
            </View>
            <FlatList data={catalogOptions} keyExtractor={item => item.id}
              renderItem={({ item }) => {
                const isSelected =
                  (catalogTitle === 'Estado de Vida' && editCommunity.lifeState?.id === item.id) ||
                  (catalogTitle === 'Estado Civil' && editCommunity.marital?.id === item.id) ||
                  (catalogTitle === 'Realidade Vocacional' && editCommunity.vocational?.id === item.id);
                return (
                  <TouchableOpacity style={[styles.subItem, isSelected ? styles.subItemSelected : null]}
                    onPress={() => catalogOnSelect(item)}>
                    <Text style={[styles.subItemText, isSelected ? styles.subItemTextSelected : null]}>{item.label}</Text>
                    {isSelected && <Ionicons name="checkmark" size={20} color={PRIMARY} />}
                  </TouchableOpacity>
                );
              }}
            />
          </View>
        </View>
      </Modal>

      {/* ══ Sub-modal: Despertar ══ */}
      <Modal visible={despertarModalVisible} animationType="slide" transparent onRequestClose={() => setDespertarModalVisible(false)}>
        <View style={styles.subOverlay}>
          <View style={styles.subSheet}>
            <View style={styles.subHeader}>
              <Text style={styles.subTitle}>Encontro Despertar</Text>
              <TouchableOpacity onPress={() => setDespertarModalVisible(false)}>
                <Ionicons name="close" size={24} color={GRAY} />
              </TouchableOpacity>
            </View>
            <FlatList data={DESPERTAR_ENCOUNTERS} keyExtractor={item => item}
              renderItem={({ item }) => (
                <TouchableOpacity style={[styles.subItem, editCommunity.despertar === item ? styles.subItemSelected : null]}
                  onPress={() => { setEditCommunity(p => ({ ...p, despertar: item })); setDespertarModalVisible(false); }}>
                  <Text style={[styles.subItemText, editCommunity.despertar === item ? styles.subItemTextSelected : null]}>{item}</Text>
                  {editCommunity.despertar === item && <Ionicons name="checkmark" size={20} color={PRIMARY} />}
                </TouchableOpacity>
              )}
            />
          </View>
        </View>
      </Modal>
    </View>
  );
}

// =============================================================================
// SUB-COMPONENTES
// =============================================================================

const SectionTitle = memo(function SectionTitle({
  children, sensitive = false, t,
}: {
  children: string; sensitive?: boolean; t: SemanticTokens;
}) {
  const titleStyle = {
    fontSize: 11 as const,
    fontFamily: 'Nunito-Bold',
    color: t.text.tertiary,
    textTransform: 'uppercase' as const,
    letterSpacing: 1,
  };
  if (sensitive) {
    return (
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 16, marginBottom: 6, paddingHorizontal: 2 }}>
        <Text style={titleStyle}>{children}</Text>
        <Ionicons name="shield-checkmark-outline" size={13} color={t.brand.primary} style={{ opacity: 0.5 }} />
      </View>
    );
  }
  return <Text style={[titleStyle, { marginTop: 16, marginBottom: 6, paddingHorizontal: 2 }]}>{children}</Text>;
});

const InfoRow = memo(function InfoRow({ icon, label, value, last, t }: {
  icon: string; label: string; value?: string | null; last?: boolean; t: SemanticTokens;
}) {
  const isEmpty = !value;
  return (
    <View style={{
      flexDirection: 'row', alignItems: 'center', padding: 14,
      borderBottomWidth: last ? 0 : 1, borderBottomColor: t.border.subtle,
    }}>
      <Ionicons name={icon as IoniconsName} size={18} color={t.brand.primary} style={{ opacity: 0.7 }} />
      <View style={{ flex: 1, marginLeft: 12 }}>
        <Text style={{ fontSize: 11, color: t.text.secondary, fontFamily: 'Nunito-Regular' }}>{label}</Text>
        {isEmpty
          ? <Text style={{ fontSize: 14, color: t.text.tertiary, fontStyle: 'italic', marginTop: 2 }}>—</Text>
          : <Text style={{ fontSize: 15, color: t.text.primary, marginTop: 2, fontFamily: 'Nunito-SemiBold' }}>{value}</Text>
        }
      </View>
    </View>
  );
});

// =============================================================================
// ESTILOS
// =============================================================================

const makeStyles = (t: SemanticTokens) => StyleSheet.create({
  container: { flex: 1, backgroundColor: t.bg.screen },
  content: { padding: 16, paddingBottom: 48 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: t.bg.screen },

  headerCard: { backgroundColor: t.bg.elevated, borderRadius: 16, padding: 24, alignItems: 'center', marginBottom: 12 },
  avatarContainer: { marginBottom: 14 },
  avatar: { width: 88, height: 88, borderRadius: 44 },
  avatarPlaceholder: {
    width: 88, height: 88, borderRadius: 44,
    backgroundColor: t.brand.primary, alignItems: 'center', justifyContent: 'center',
  },
  userName: { fontSize: 22, fontFamily: 'Nunito-Bold', color: t.text.primary, marginBottom: 4 },
  userEmail: { fontSize: 14, color: t.text.secondary, marginBottom: 12, fontFamily: 'Nunito-Regular' },
  statusChip: { paddingHorizontal: 16, paddingVertical: 6, borderRadius: 20, marginBottom: 14 },
  statusComplete: { backgroundColor: t.status.successBg },
  statusPending: { backgroundColor: t.status.warningBg },
  statusText: { fontSize: 13, fontFamily: 'Nunito-SemiBold' },
  editProfileButton: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 20, paddingVertical: 10,
    borderRadius: 20, borderWidth: 1, borderColor: t.border.subtle,
  },
  editProfileButtonText: { color: t.brand.primary, fontSize: 15, fontFamily: 'Nunito-SemiBold' },

  card: { backgroundColor: t.bg.elevated, borderRadius: 12, marginBottom: 4, overflow: 'hidden' },

  logoutButton: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    marginTop: 24, padding: 14, gap: 8,
  },
  logoutText: { color: t.status.error, fontSize: 14, fontFamily: 'Nunito-SemiBold' },
  version: { textAlign: 'center', fontSize: 12, color: t.text.tertiary, marginTop: 16 },

  editModal: { flex: 1, backgroundColor: t.bg.screen },
  editHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: t.bg.elevated, paddingHorizontal: 16, paddingTop: 56, paddingBottom: 16,
    borderBottomWidth: 1, borderBottomColor: t.border.subtle,
  },
  editHeaderBack: { padding: 4 },
  editHeaderTitle: { fontSize: 18, fontFamily: 'Nunito-Bold', color: t.text.primary },
  editBody: { flex: 1 },
  editBodyContent: { padding: 16, paddingBottom: 48 },

  editSection: {
    fontSize: 11, fontFamily: 'Nunito-Bold', color: t.brand.primary,
    marginBottom: 10, marginTop: 4,
    textTransform: 'uppercase', letterSpacing: 0.5,
  },
  editLabel: { fontSize: 13, color: t.text.secondary, marginBottom: 4, marginLeft: 2, fontFamily: 'Nunito-Regular' },
  editInput: {
    backgroundColor: t.bg.elevated, borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 13,
    fontSize: 15, color: t.text.primary, marginBottom: 12,
    borderWidth: 1, borderColor: t.border.subtle,
    fontFamily: 'Nunito-Regular',
  },
  editInputError: { borderColor: t.status.error, marginBottom: 4 },
  editInputMultiline: { height: 110, textAlignVertical: 'top', paddingTop: 12 },
  editSelector: {
    backgroundColor: t.bg.elevated, borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 13,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginBottom: 12, borderWidth: 1, borderColor: t.border.subtle,
  },
  editSelectorValue: { fontSize: 15, color: t.text.primary, flex: 1, fontFamily: 'Nunito-Regular' },
  editSelectorPlaceholder: { fontSize: 15, color: t.text.tertiary, flex: 1, fontFamily: 'Nunito-Regular' },
  editError: { color: t.status.error, fontSize: 12, marginBottom: 10, marginLeft: 4 },
  toggleRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: t.bg.elevated, borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 12,
    marginBottom: 12, borderWidth: 1, borderColor: t.border.subtle,
  },
  toggleLabel: { fontSize: 15, color: t.text.primary, flex: 1, marginRight: 12, fontFamily: 'Nunito-Regular' },
  saveButton: { backgroundColor: t.brand.primary, borderRadius: 12, paddingVertical: 16, alignItems: 'center', marginTop: 20 },
  saveButtonDisabled: { opacity: 0.6 },
  saveButtonText: { color: t.text.inverse, fontSize: 16, fontFamily: 'Nunito-Bold' },
  saveErrorBox: {
    backgroundColor: t.status.errorBg, borderRadius: 8, padding: 12,
    marginTop: 12, borderWidth: 1, borderColor: t.status.error,
  },
  saveErrorText: { color: t.status.error, fontSize: 13, textAlign: 'center' },

  chipsContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  chip: {
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20,
    borderWidth: 1.5, borderColor: t.border.subtle, backgroundColor: t.bg.surface,
  },
  chipSelected: { borderColor: t.brand.primary, backgroundColor: t.brand.primary },
  chipText: { fontSize: 14, color: t.text.secondary, fontFamily: 'Nunito-SemiBold' },
  chipTextSelected: { color: t.text.inverse, fontFamily: 'Nunito-Bold' },

  availGrid: {
    backgroundColor: t.bg.elevated, borderRadius: 10, borderWidth: 1, borderColor: t.border.subtle,
    marginBottom: 12, overflow: 'hidden',
  },
  availHeaderRow: { flexDirection: 'row', backgroundColor: t.bg.surface, paddingVertical: 8, paddingHorizontal: 10 },
  availTurnHeader: { flex: 1, textAlign: 'center', fontSize: 12, fontFamily: 'Nunito-Bold', color: t.text.secondary },
  availRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 6, paddingHorizontal: 10, borderTopWidth: 1, borderTopColor: t.border.subtle },
  availDayCell: { width: 62 },
  availDayLabel: { width: 62, fontSize: 12, color: t.text.primary, fontFamily: 'Nunito-SemiBold' },
  availCell: {
    flex: 1, height: 28, borderRadius: 6, alignItems: 'center', justifyContent: 'center',
    marginHorizontal: 3, borderWidth: 1, borderColor: t.border.subtle, backgroundColor: t.bg.surface,
  },
  availCellChecked: { backgroundColor: t.brand.primary, borderColor: t.brand.primary },

  subOverlay: { flex: 1, backgroundColor: t.bg.overlay, justifyContent: 'flex-end' },
  subSheet: { backgroundColor: t.bg.elevated, borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: '70%' },
  subHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    padding: 16, borderBottomWidth: 1, borderBottomColor: t.border.subtle,
  },
  subTitle: { fontSize: 18, fontFamily: 'Nunito-Bold', color: t.text.primary },
  subItem: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 14, paddingHorizontal: 20,
    borderBottomWidth: 1, borderBottomColor: t.border.subtle,
  },
  subItemSelected: { backgroundColor: t.brand.primaryDim },
  subItemText: { fontSize: 16, color: t.text.primary, fontFamily: 'Nunito-Regular' },
  subItemTextSelected: { color: t.brand.primary, fontFamily: 'Nunito-Bold' },

  appearanceCard: {
    marginHorizontal: 16,
    marginBottom: 16,
    backgroundColor: t.bg.elevated,
    borderRadius: 12,
    padding: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: t.border.subtle,
  },
  appearanceLabel: {
    fontSize: 13,
    fontFamily: 'Nunito-Bold',
    color: t.text.secondary,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 12,
  },
  appearanceRow: {
    flexDirection: 'row',
    gap: 10,
  },
  themeBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    borderWidth: 1,
    backgroundColor: t.bg.surface,
  },
  themeBtnActive: {
    backgroundColor: t.brand.primaryDim,
  },
  themeBtnText: {
    fontFamily: 'Nunito-Regular',
    fontSize: 14,
  },
  themeBtnTextActive: {
    fontFamily: 'Nunito-Bold',
  },
});
