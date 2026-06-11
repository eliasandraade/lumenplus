/**
 * Profile Screen (Onboarding / Edição)
 * =====================================
 * Formulário completo de preenchimento do perfil.
 * Alinhado com os campos coletados em register.tsx.
 *
 * Seções:
 * - Foto de perfil
 * - Dados pessoais (nome, nascimento, CPF, RG, telefone)
 * - Localização (moraFora → Brasil: estado+cidade via BrasilAPI; exterior: país+cidade livre)
 * - Informações da comunidade (estado de vida, civil, cônjuge, vocacional, consagração)
 * - Realidade Atual (multi-select chips)
 * - Missão (switch + picker de missões + texto livre)
 * - Interesse em Ministério (switch + chips de setores + notas)
 * - Disponibilidade de Acomodação (multi-select chips)
 * - Informações Extras (instagram, alimentação, saúde, instrumentos, Despertar)
 */

import { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  TouchableOpacity,
  Image,
  TextInput,
  Switch,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { router, useLocalSearchParams } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { useTheme } from '@/theme';
import type { SemanticTokens } from '@/theme';
import { Ionicons } from '@expo/vector-icons';
import api from '@/services/api';
import { profileService } from '@/services';
import { parseApiError } from '@/utils/error';
import { showAlert } from '@/utils/alerts';
import brasilApi, { type Estado, type Municipio } from '@/services/brasilApi';

// ─── Encontros Despertar numerados (1–47) ─────────────────────────────────────
const DESPERTAR_NAMES = [
  'Água Viva', 'Juventude Livre', 'Fonte de Viver', 'Mir', 'Raios de Amor',
  'Chama Viva', 'Logos', 'Kyrios', 'Maria de Deus', 'Éfeta', 'Sanctus',
  'Gênesis', 'Ágape', 'Elyon', 'Khesed', 'Trinitas', 'Ixyus', 'Luz do Mundo',
  'Ruah', 'Mater Dei', 'Agnus Dei', 'Kaire', 'Adonai', 'Charitas', 'Ieshuah',
  'Kairós', 'Seraph', 'Kenosis', 'Parresia', 'Fides', 'Domus Dei', 'Magnificat',
  'Gaudium', 'Atrium', 'Ignis', 'Raboni', 'Pietá', 'Charis', 'Emanuel',
  'Totus Tuus', 'Fraternitas', 'Lazarus', 'Filho da Luz', 'Anawin',
  'Dilext Nos', 'Franciscus', 'Kadosh',
];
const DESPERTAR_ENCOUNTERS = ['', ...DESPERTAR_NAMES.map((name, i) => `${i + 1} – ${name}`)];

// ─── Instrumentos ─────────────────────────────────────────────────────────────
const INSTRUMENTS = [
  'Voz / Canto', 'Violão', 'Guitarra', 'Teclado', 'Piano',
  'Bateria', 'Percussão', 'Flauta', 'Saxofone', 'Trompete',
  'Contrabaixo', 'Violino', 'Outro',
];

const colors = {
  primary: '#1A859B',
  primaryLight: '#5cc8de',
  white: '#ffffff',
  gray: '#6b7280',
  lightGray: '#f3f4f6',
  error: '#ef4444',
  success: '#22c55e',
  border: '#e5e7eb',
  background: '#f3f4f6',
};

interface CatalogItem {
  id: string;
  code: string;
  label: string;
  sort_order?: number;
}

interface CatalogResponse {
  code: string;
  name: string;
  items: CatalogItem[];
}

interface ExistingProfile {
  full_name?: string;
  birth_date?: string;
  cpf?: string;
  rg?: string;
  phone_e164?: string;
  city?: string;
  state?: string;
  country?: string;
  life_state_item_id?: string;
  marital_status_item_id?: string;
  vocational_reality_item_id?: string;
  consecration_year?: number;
  interested_in_ministry?: boolean;
  ministry_interest_notes?: string;
  realidade_atual?: string[];
  spouse_in_community?: boolean | null;
  accommodation_options?: string[];
  is_from_mission?: boolean | null;
  mission_name?: string;
  mission_org_unit_id?: string | null;
  ministry_sector_ids?: string[];
  // Extras — alinhados com register.tsx
  instagram?: string;
  dietary_restriction?: boolean | null;
  dietary_restriction_notes?: string;
  health_insurance?: boolean | null;
  health_insurance_name?: string;
  despertar_encounter?: string;
  plays_instrument?: boolean | null;
  instrument_names?: string[];
}

export default function ProfileScreen() {
  const { t } = useTheme();
  const styles = makeStyles(t);
  const params = useLocalSearchParams<{ fullName?: string; phone?: string }>();
  const phoneVerified = !!params.phone;
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Catálogos
  const [lifeStates, setLifeStates] = useState<CatalogItem[]>([]);
  const [maritalStatuses, setMaritalStatuses] = useState<CatalogItem[]>([]);
  const [vocationalRealities, setVocationalRealities] = useState<CatalogItem[]>([]);
  const [realidadeAtualOptions, setRealidadeAtualOptions] = useState<CatalogItem[]>([]);

  // BrasilAPI
  const [estados, setEstados] = useState<Estado[]>([]);
  const [municipios, setMunicipios] = useState<Municipio[]>([]);
  const [loadingMunicipios, setLoadingMunicipios] = useState(false);

  // Missões / Setores
  const [missions, setMissions] = useState<{ id: string; name: string }[]>([]);
  const [sectors, setSectors] = useState<{ id: string; name: string }[]>([]);

  // ── Dados pessoais ──────────────────────────────────────────────────────────
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [fullName, setFullName] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [cpf, setCpf] = useState('');
  const [rg, setRg] = useState('');
  const [phone, setPhone] = useState('');

  // ── Localização ─────────────────────────────────────────────────────────────
  // moraFora = true → usuário reside fora do Brasil
  const [moraFora, setMoraFora] = useState(false);
  const [paisFora, setPaisFora] = useState('');   // país quando moraFora = true
  const [state, setState] = useState('');          // UF quando moraFora = false
  const [city, setCity] = useState('');

  // ── Catálogos selecionados ──────────────────────────────────────────────────
  const [lifeState, setLifeState] = useState('');
  const [maritalStatus, setMaritalStatus] = useState('');
  const [vocationalReality, setVocationalReality] = useState('');

  // ── Campos condicionais vocacionais ────────────────────────────────────────
  const [consecrationYear, setConsecrationYear] = useState('');
  const [spouseInCommunity, setSpouseInCommunity] = useState<boolean | null>(null);
  const [realidadeAtual, setRealidadeAtual] = useState<string[]>([]);
  const [interestedInMinistry, setInterestedInMinistry] = useState(false);
  const [ministryNotes, setMinistryNotes] = useState('');
  const [selectedSectorIds, setSelectedSectorIds] = useState<string[]>([]);

  // ── Missão ──────────────────────────────────────────────────────────────────
  const [isFromMission, setIsFromMission] = useState(false);
  const [missionName, setMissionName] = useState('');
  const [missionOrgUnitId, setMissionOrgUnitId] = useState<string | null>(null);

  // ── Acomodação ──────────────────────────────────────────────────────────────
  const [accommodationOptions, setAccommodationOptions] = useState<string[]>([]);

  // ── Informações extras (alinhadas com register.tsx) ─────────────────────────
  const [instagram, setInstagram] = useState('');
  const [dietaryRestriction, setDietaryRestriction] = useState(false);
  const [dietaryNotes, setDietaryNotes] = useState('');
  const [healthInsurance, setHealthInsurance] = useState(false);
  const [healthInsuranceName, setHealthInsuranceName] = useState('');
  const [despertarEncounter, setDespertarEncounter] = useState('');
  const [playsInstrument, setPlaysInstrument] = useState(false);
  const [instrumentNames, setInstrumentNames] = useState<string[]>([]);

  // ── Derivados ────────────────────────────────────────────────────────────────
  const isConsagrado =
    vocationalRealities.find((i) => i.id === vocationalReality)?.code ===
    'CONSAGRADO_FILHO_DA_LUZ';
  const showSpouseField = ['CASADO', 'UNIAO_ESTAVEL'].includes(
    maritalStatuses.find((i) => i.id === maritalStatus)?.code ?? ''
  );

  useEffect(() => {
    loadData();
  }, []);

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

  const loadData = async () => {
    try {
      const [estadosBrasil, catalogs, profile, sectorsData, missionsData] = await Promise.all([
        brasilApi.getEstados(),
        api.get<CatalogResponse[]>('/profile/catalogs'),
        api.get<ExistingProfile>('/profile').catch(() => null),
        profileService.getSectors().catch(() => [] as { id: string; name: string }[]),
        profileService.getMissions().catch(() => [] as { id: string; name: string }[]),
      ]);

      setEstados(estadosBrasil);
      setSectors(sectorsData);
      setMissions(missionsData);

      const find = (code: string): CatalogItem[] =>
        catalogs.find((c) => c.code === code)?.items ?? [];

      setLifeStates(find('LIFE_STATE'));
      setMaritalStatuses(find('MARITAL_STATUS'));
      setVocationalRealities(find('VOCATIONAL_REALITY'));
      setRealidadeAtualOptions(find('REALIDADE_ATUAL'));

      if (profile) {
        // Dados pessoais
        if (profile.full_name) setFullName(profile.full_name);
        if (profile.birth_date) {
          const parts = profile.birth_date.split('-');
          if (parts.length === 3) setBirthDate(`${parts[2]}/${parts[1]}/${parts[0]}`);
        }
        if (profile.cpf) setCpf(formatCPF(profile.cpf));
        if (profile.rg) setRg(profile.rg);
        if (profile.phone_e164) {
          const digits = profile.phone_e164.replace(/\D/g, '').slice(2);
          setPhone(formatPhone(digits));
        }

        // Localização — detecta se mora fora do Brasil
        // country é o país de residência para não-brasileiros (alinhado com register.tsx)
        if (profile.country && !profile.state) {
          setMoraFora(true);
          setPaisFora(profile.country);
        }
        if (profile.city) setCity(profile.city);
        if (profile.state) {
          setState(profile.state);
          loadMunicipios(profile.state);
        }

        // Catálogos
        if (profile.life_state_item_id) setLifeState(profile.life_state_item_id);
        if (profile.marital_status_item_id) setMaritalStatus(profile.marital_status_item_id);
        if (profile.vocational_reality_item_id) setVocationalReality(profile.vocational_reality_item_id);
        if (profile.consecration_year) setConsecrationYear(String(profile.consecration_year));
        if (profile.interested_in_ministry != null) setInterestedInMinistry(profile.interested_in_ministry);
        if (profile.ministry_interest_notes) setMinistryNotes(profile.ministry_interest_notes);
        if (profile.realidade_atual) setRealidadeAtual(profile.realidade_atual);
        if (profile.spouse_in_community != null) setSpouseInCommunity(profile.spouse_in_community);

        // Missão
        if (profile.is_from_mission != null) setIsFromMission(!!profile.is_from_mission);
        if (profile.mission_name) setMissionName(profile.mission_name);
        if (profile.mission_org_unit_id) setMissionOrgUnitId(profile.mission_org_unit_id);

        // Acomodação / setor
        if (profile.accommodation_options) setAccommodationOptions(profile.accommodation_options);
        if (profile.ministry_sector_ids) setSelectedSectorIds(profile.ministry_sector_ids);

        // Extras
        if (profile.instagram) setInstagram(profile.instagram);
        if (profile.dietary_restriction != null) setDietaryRestriction(!!profile.dietary_restriction);
        if (profile.dietary_restriction_notes) setDietaryNotes(profile.dietary_restriction_notes);
        if (profile.health_insurance != null) setHealthInsurance(!!profile.health_insurance);
        if (profile.health_insurance_name) setHealthInsuranceName(profile.health_insurance_name);
        if (profile.despertar_encounter) setDespertarEncounter(profile.despertar_encounter);
        if (profile.plays_instrument != null) setPlaysInstrument(!!profile.plays_instrument);
        if (profile.instrument_names) setInstrumentNames(profile.instrument_names);
      }

      // Params da rota têm prioridade
      if (params.fullName) setFullName(params.fullName);
      if (params.phone) {
        const digits = params.phone.replace(/\D/g, '').slice(2);
        if (digits) setPhone(formatPhone(digits));
      }
    } catch {
      showAlert('Erro', 'Não foi possível carregar os dados');
    } finally {
      setIsLoading(false);
    }
  };

  const pickImage = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      showAlert('Permissão necessária', 'Precisamos de acesso às suas fotos');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (!result.canceled && result.assets[0]) setPhotoUri(result.assets[0].uri);
  };

  const takePhoto = async () => {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      showAlert('Permissão necessária', 'Precisamos de acesso à câmera');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (!result.canceled && result.assets[0]) setPhotoUri(result.assets[0].uri);
  };

  const showPhotoOptions = () => {
    if (Platform.OS === 'web') {
      // Web: a câmera nativa não se aplica; o seletor de arquivos cobre a galeria.
      pickImage();
      return;
    }
    Alert.alert('Foto de Perfil', 'Escolha uma opção', [
      { text: 'Câmera', onPress: takePhoto },
      { text: 'Galeria', onPress: pickImage },
      { text: 'Cancelar', style: 'cancel' },
    ]);
  };

  // ── Formatadores ─────────────────────────────────────────────────────────────
  const formatCPF = (value: string) => {
    const d = value.replace(/\D/g, '').slice(0, 11);
    if (d.length <= 3) return d;
    if (d.length <= 6) return `${d.slice(0, 3)}.${d.slice(3)}`;
    if (d.length <= 9) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6)}`;
    return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
  };

  const formatPhone = (value: string) => {
    const d = value.replace(/\D/g, '').slice(0, 11);
    if (d.length <= 2) return d;
    if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
    if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
    return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  };

  const formatDate = (value: string) => {
    const d = value.replace(/\D/g, '').slice(0, 8);
    if (d.length <= 2) return d;
    if (d.length <= 4) return `${d.slice(0, 2)}/${d.slice(2)}`;
    return `${d.slice(0, 2)}/${d.slice(2, 4)}/${d.slice(4)}`;
  };

  const parseDate = (formatted: string): string => {
    const parts = formatted.split('/');
    if (parts.length === 3) return `${parts[2]}-${parts[1]}-${parts[0]}`;
    return '';
  };

  // ── Validação ─────────────────────────────────────────────────────────────────
  const validate = () => {
    const newErrors: Record<string, string> = {};

    if (!fullName.trim() || fullName.length < 3) newErrors.fullName = 'Nome deve ter pelo menos 3 caracteres';
    if (!birthDate || birthDate.length < 10) newErrors.birthDate = 'Data de nascimento obrigatória';
    if (cpf.replace(/\D/g, '').length !== 11) newErrors.cpf = 'CPF inválido';
    if (!rg.trim()) newErrors.rg = 'RG obrigatório';
    if (phone.replace(/\D/g, '').length < 10) newErrors.phone = 'Telefone inválido';

    // Estado só obrigatório para Brasil
    if (!moraFora && !state) newErrors.state = 'Estado obrigatório';
    if (!city.trim()) newErrors.city = 'Cidade obrigatória';
    if (moraFora && !paisFora.trim()) newErrors.paisFora = 'Informe o país';

    if (!lifeState) newErrors.lifeState = 'Selecione o estado de vida';
    if (!maritalStatus) newErrors.maritalStatus = 'Selecione o estado civil';
    if (!vocationalReality) newErrors.vocationalReality = 'Selecione a realidade vocacional';

    if (isConsagrado && !consecrationYear) newErrors.consecrationYear = 'Ano de consagração obrigatório';
    if (interestedInMinistry && selectedSectorIds.length === 0 && !ministryNotes.trim()) {
      newErrors.ministry = 'Selecione ao menos um setor ou descreva seu interesse';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // ── Envio ─────────────────────────────────────────────────────────────────────
  const handleSubmit = async () => {
    if (!validate()) {
      showAlert('Atenção', 'Preencha todos os campos obrigatórios');
      return;
    }

    try {
      setIsSaving(true);

      const phoneDigits = phone.replace(/\D/g, '');
      const phoneE164 = `+55${phoneDigits}`;

      const data = {
        full_name: fullName.trim(),
        birth_date: parseDate(birthDate),
        cpf: cpf.replace(/\D/g, ''),
        rg: rg.trim(),
        phone_e164: phoneE164,
        city: city.trim(),
        // Localização: state/country mutuamente exclusivos (alinhado com register.tsx)
        state: moraFora ? null : state,
        country: moraFora ? paisFora.trim() || null : null,
        // Catálogos
        life_state_item_id: lifeState,
        marital_status_item_id: maritalStatus,
        vocational_reality_item_id: vocationalReality,
        consecration_year: isConsagrado ? parseInt(consecrationYear) : null,
        spouse_in_community: spouseInCommunity,
        realidade_atual: realidadeAtual.length > 0 ? realidadeAtual : null,
        interested_in_ministry: interestedInMinistry,
        ministry_interest_notes: interestedInMinistry ? ministryNotes.trim() : null,
        ministry_sector_ids: interestedInMinistry && selectedSectorIds.length > 0 ? selectedSectorIds : null,
        // Missão
        is_from_mission: isFromMission,
        mission_org_unit_id: isFromMission ? missionOrgUnitId : null,
        mission_name: isFromMission && !missionOrgUnitId ? missionName.trim() || null : null,
        // Acomodação
        accommodation_options: accommodationOptions.length > 0 ? accommodationOptions : null,
        // Extras
        instagram: instagram.trim() || null,
        dietary_restriction: dietaryRestriction,
        dietary_restriction_notes: dietaryRestriction ? dietaryNotes.trim() || null : null,
        health_insurance: healthInsurance,
        health_insurance_name: healthInsurance ? healthInsuranceName.trim() || null : null,
        despertar_encounter: despertarEncounter || null,
        plays_instrument: playsInstrument,
        instrument_names: playsInstrument && instrumentNames.length > 0 ? instrumentNames : null,
      };

      await api.put('/profile', data);

      if (photoUri) {
        const formData = new FormData();
        formData.append('file', { uri: photoUri, type: 'image/jpeg', name: 'profile.jpg' } as any);
        try {
          await api.postForm('/profile/photo', formData);
        } catch {
          console.warn('Erro ao enviar foto');
        }
      }

      // onClose garante a navegação para a home também na web.
      showAlert('Sucesso!', 'Perfil salvo com sucesso!', () => router.replace('/(tabs)/home'));
    } catch (err: any) {
      const message = parseApiError(err, 'Erro ao salvar perfil');
      showAlert('Erro', message);
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={t.brand.primary} />
        <Text style={styles.loadingText}>Carregando...</Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        {/* Barra de progresso decorativa */}
        <View style={{ paddingTop: 20, paddingBottom: 8 }}>
          <Text style={{
            fontSize: 14, color: t.text.secondary,
            marginBottom: 10, textAlign: 'center', lineHeight: 20,
          }}>
            Não se preocupe — você poderá editar depois.
          </Text>
          <View style={{ height: 4, backgroundColor: '#e5e7eb', borderRadius: 9999 }}>
            <View style={{
              height: 4, width: '40%',
              backgroundColor: t.brand.primary,
              borderRadius: 9999,
            }} />
          </View>
        </View>

        <Text style={styles.title}>Vamos te conhecer</Text>
        <Text style={styles.subtitle}>
          Algumas informações para personalizar sua experiência na comunidade.
        </Text>

        {/* ============================================ */}
        {/* FOTO DE PERFIL */}
        {/* ============================================ */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Uma foto sua</Text>
          <TouchableOpacity style={styles.photoContainer} onPress={showPhotoOptions}>
            {photoUri ? (
              <Image source={{ uri: photoUri }} style={styles.photo} />
            ) : (
              <View style={styles.photoPlaceholder}>
                <Text style={styles.photoPlaceholderText}>+</Text>
              </View>
            )}
          </TouchableOpacity>
          <Text style={styles.photoHint}>Toque para adicionar uma foto</Text>
        </View>

        {/* ============================================ */}
        {/* DADOS PESSOAIS */}
        {/* ============================================ */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Sobre você</Text>

          <Text style={styles.label}>Nome completo *</Text>
          <TextInput
            style={[styles.input, errors.fullName && styles.inputError]}
            placeholder="Seu nome completo"
            value={fullName}
            onChangeText={setFullName}
            autoCapitalize="words"
            placeholderTextColor={t.text.tertiary}
          />
          {errors.fullName && <Text style={styles.errorText}>{errors.fullName}</Text>}

          <Text style={styles.label}>Data de nascimento *</Text>
          <TextInput
            style={[styles.input, errors.birthDate && styles.inputError]}
            placeholder="DD/MM/AAAA"
            value={birthDate}
            onChangeText={(v) => setBirthDate(formatDate(v))}
            keyboardType="numeric"
            maxLength={10}
            placeholderTextColor={t.text.tertiary}
          />
          {errors.birthDate && <Text style={styles.errorText}>{errors.birthDate}</Text>}

          <Text style={styles.label}>CPF *</Text>
          <TextInput
            style={[styles.input, errors.cpf && styles.inputError]}
            placeholder="000.000.000-00"
            value={cpf}
            onChangeText={(v) => setCpf(formatCPF(v))}
            keyboardType="numeric"
            maxLength={14}
            placeholderTextColor={t.text.tertiary}
          />
          {errors.cpf && <Text style={styles.errorText}>{errors.cpf}</Text>}

          <Text style={styles.label}>RG *</Text>
          <TextInput
            style={[styles.input, errors.rg && styles.inputError]}
            placeholder="Seu RG"
            value={rg}
            onChangeText={setRg}
            placeholderTextColor={t.text.tertiary}
          />
          {errors.rg && <Text style={styles.errorText}>{errors.rg}</Text>}

          <Text style={styles.label}>Telefone (WhatsApp) *</Text>
          {phoneVerified ? (
            <View style={styles.lockedField}>
              <TextInput
                style={[styles.input, styles.inputLocked]}
                value={phone}
                editable={false}
                placeholderTextColor={t.text.tertiary}
              />
              <View style={styles.lockedBadge}>
                <Ionicons name="lock-closed" size={14} color={t.status.success} />
                <Text style={styles.lockedText}>Verificado</Text>
              </View>
            </View>
          ) : (
            <TextInput
              style={[styles.input, errors.phone && styles.inputError]}
              placeholder="(00) 00000-0000"
              value={phone}
              onChangeText={(v) => setPhone(formatPhone(v))}
              keyboardType="phone-pad"
              maxLength={15}
              placeholderTextColor={t.text.tertiary}
            />
          )}
          {!phoneVerified && errors.phone && <Text style={styles.errorText}>{errors.phone}</Text>}
          {phoneVerified && (
            <Text style={styles.lockedHint}>Para alterar o telefone é necessário uma nova verificação.</Text>
          )}
        </View>

        {/* ============================================ */}
        {/* LOCALIZAÇÃO */}
        {/* ============================================ */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Onde você mora</Text>

          {/* Toggle: mora fora do Brasil */}
          <View style={styles.switchRow}>
            <Text style={styles.switchLabel}>Moro fora do Brasil</Text>
            <Switch
              value={moraFora}
              onValueChange={(v) => {
                setMoraFora(v);
                if (v) {
                  setState('');
                  setCity('');
                  setMunicipios([]);
                } else {
                  setPaisFora('');
                  setCity('');
                }
              }}
              trackColor={{ false: t.border.subtle, true: t.brand.primaryLight }}
              thumbColor={moraFora ? t.brand.primary : t.bg.surface}
            />
          </View>

          {moraFora ? (
            <>
              <Text style={styles.label}>País *</Text>
              <TextInput
                style={[styles.input, errors.paisFora && styles.inputError]}
                placeholder="Ex: Portugal, Estados Unidos..."
                value={paisFora}
                onChangeText={setPaisFora}
                autoCapitalize="words"
                placeholderTextColor={t.text.tertiary}
              />
              {errors.paisFora && <Text style={styles.errorText}>{errors.paisFora}</Text>}

              <Text style={styles.label}>Cidade *</Text>
              <TextInput
                style={[styles.input, errors.city && styles.inputError]}
                placeholder="Sua cidade"
                value={city}
                onChangeText={setCity}
                autoCapitalize="words"
                placeholderTextColor={t.text.tertiary}
              />
              {errors.city && <Text style={styles.errorText}>{errors.city}</Text>}
            </>
          ) : (
            <>
              <Text style={styles.label}>Estado *</Text>
              <View style={[styles.picker, errors.state && styles.pickerError]}>
                <Picker
                  selectedValue={state}
                  onValueChange={(uf) => {
                    setState(uf);
                    setCity('');
                    loadMunicipios(uf);
                  }}
                >
                  <Picker.Item label="Selecione..." value="" />
                  {estados.map((e) => (
                    <Picker.Item key={e.sigla} label={`${e.sigla} – ${e.nome}`} value={e.sigla} />
                  ))}
                </Picker>
              </View>
              {errors.state && <Text style={styles.errorText}>{errors.state}</Text>}

              <Text style={styles.label}>Cidade *</Text>
              {loadingMunicipios ? (
                <ActivityIndicator size="small" color={t.brand.primary} style={{ marginVertical: 8 }} />
              ) : (
                <View style={[styles.picker, errors.city && styles.pickerError]}>
                  <Picker
                    selectedValue={city}
                    onValueChange={setCity}
                    enabled={municipios.length > 0}
                  >
                    <Picker.Item
                      label={state ? 'Selecione a cidade...' : 'Selecione o estado primeiro'}
                      value=""
                    />
                    {municipios.map((m) => (
                      <Picker.Item key={m.nome} label={m.nome} value={m.nome} />
                    ))}
                  </Picker>
                </View>
              )}
              {errors.city && <Text style={styles.errorText}>{errors.city}</Text>}
            </>
          )}
        </View>

        {/* ============================================ */}
        {/* INFORMAÇÕES DA COMUNIDADE */}
        {/* ============================================ */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Sua jornada na comunidade</Text>

          <Text style={styles.label}>Estado de Vida *</Text>
          <View style={[styles.picker, errors.lifeState && styles.pickerError]}>
            <Picker selectedValue={lifeState} onValueChange={setLifeState}>
              <Picker.Item label="Selecione..." value="" />
              {lifeStates.map((item) => (
                <Picker.Item key={item.id} label={item.label} value={item.id} />
              ))}
            </Picker>
          </View>
          {errors.lifeState && <Text style={styles.errorText}>{errors.lifeState}</Text>}

          <Text style={styles.label}>Estado Civil *</Text>
          <View style={[styles.picker, errors.maritalStatus && styles.pickerError]}>
            <Picker
              selectedValue={maritalStatus}
              onValueChange={(v) => {
                setMaritalStatus(v);
                if (!['CASADO', 'UNIAO_ESTAVEL'].includes(
                  maritalStatuses.find((i) => i.id === v)?.code ?? ''
                )) setSpouseInCommunity(null);
              }}
            >
              <Picker.Item label="Selecione..." value="" />
              {maritalStatuses.map((item) => (
                <Picker.Item key={item.id} label={item.label} value={item.id} />
              ))}
            </Picker>
          </View>
          {errors.maritalStatus && <Text style={styles.errorText}>{errors.maritalStatus}</Text>}

          {showSpouseField && (
            <View style={styles.switchRow}>
              <Text style={styles.switchLabel}>Seu cônjuge faz parte da comunidade de vida?</Text>
              <Switch
                value={spouseInCommunity ?? false}
                onValueChange={setSpouseInCommunity}
                trackColor={{ false: t.border.subtle, true: t.brand.primaryLight }}
                thumbColor={spouseInCommunity ? t.brand.primary : t.bg.surface}
              />
            </View>
          )}

          <Text style={styles.label}>Realidade Vocacional *</Text>
          <View style={[styles.picker, errors.vocationalReality && styles.pickerError]}>
            <Picker selectedValue={vocationalReality} onValueChange={setVocationalReality}>
              <Picker.Item label="Selecione..." value="" />
              {vocationalRealities.map((item) => (
                <Picker.Item key={item.id} label={item.label} value={item.id} />
              ))}
            </Picker>
          </View>
          {errors.vocationalReality && <Text style={styles.errorText}>{errors.vocationalReality}</Text>}

          {isConsagrado && (
            <>
              <Text style={styles.label}>Ano de Consagração *</Text>
              <TextInput
                style={[styles.input, errors.consecrationYear && styles.inputError]}
                placeholder="Ex: 2020"
                value={consecrationYear}
                onChangeText={setConsecrationYear}
                keyboardType="numeric"
                maxLength={4}
                placeholderTextColor={t.text.tertiary}
              />
              {errors.consecrationYear && <Text style={styles.errorText}>{errors.consecrationYear}</Text>}
            </>
          )}
        </View>

        {/* ============================================ */}
        {/* REALIDADE ATUAL */}
        {/* ============================================ */}
        {realidadeAtualOptions.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Onde você está agora</Text>
            <Text style={styles.label}>Selecione todas que se aplicam:</Text>
            <View style={styles.chipsRow}>
              {realidadeAtualOptions.map((opt) => {
                const selected = realidadeAtual.includes(opt.code);
                return (
                  <TouchableOpacity
                    key={opt.code}
                    style={[styles.chip, selected && styles.chipSelected]}
                    onPress={() =>
                      setRealidadeAtual((prev) =>
                        selected ? prev.filter((c) => c !== opt.code) : [...prev, opt.code]
                      )
                    }
                  >
                    <Text style={[styles.chipText, selected && styles.chipTextSelected]}>
                      {opt.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        )}

        {/* ============================================ */}
        {/* MISSÃO */}
        {/* ============================================ */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Missão</Text>

          <View style={styles.switchRow}>
            <Text style={styles.switchLabel}>
              Você faz parte de alguma missão da Obra Lumen fora de Fortaleza?
            </Text>
            <Switch
              value={isFromMission}
              onValueChange={(v) => {
                setIsFromMission(v);
                if (!v) { setMissionOrgUnitId(null); setMissionName(''); }
              }}
              trackColor={{ false: t.border.subtle, true: t.brand.primaryLight }}
              thumbColor={isFromMission ? t.brand.primary : t.bg.surface}
            />
          </View>

          {isFromMission && (
            <>
              <Text style={styles.label}>Missão</Text>
              {missions.length > 0 && (
                <View style={styles.picker}>
                  <Picker
                    selectedValue={missionOrgUnitId ?? ''}
                    onValueChange={(v) => {
                      setMissionOrgUnitId(v === 'OUTROS' ? null : v || null);
                      if (v && v !== 'OUTROS') setMissionName('');
                    }}
                  >
                    <Picker.Item label="Selecione..." value="" />
                    {missions.map((m) => (
                      <Picker.Item key={m.id} label={m.name} value={m.id} />
                    ))}
                    <Picker.Item label="Outros" value="OUTROS" />
                  </Picker>
                </View>
              )}

              {!missionOrgUnitId && (
                <TextInput
                  style={styles.input}
                  placeholder="Nome da missão (se não listada)"
                  value={missionName}
                  onChangeText={setMissionName}
                  placeholderTextColor={t.text.tertiary}
                />
              )}
            </>
          )}
        </View>

        {/* ============================================ */}
        {/* INTERESSE EM MINISTÉRIO */}
        {/* ============================================ */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Como você quer servir</Text>

          <View style={styles.switchRow}>
            <Text style={styles.switchLabel}>Você se sente chamado a servir em um ministério?</Text>
            <Switch
              value={interestedInMinistry}
              onValueChange={(v) => {
                setInterestedInMinistry(v);
                if (!v) { setSelectedSectorIds([]); setMinistryNotes(''); }
              }}
              trackColor={{ false: t.border.subtle, true: t.brand.primaryLight }}
              thumbColor={interestedInMinistry ? t.brand.primary : t.bg.surface}
            />
          </View>

          {interestedInMinistry && sectors.length > 0 && (
            <>
              <Text style={styles.label}>Em quais setores você tem interesse?</Text>
              <View style={styles.chipsRow}>
                {sectors.map((sector) => {
                  const selected = selectedSectorIds.includes(sector.id);
                  return (
                    <TouchableOpacity
                      key={sector.id}
                      style={[styles.chip, selected && styles.chipSelected]}
                      onPress={() =>
                        setSelectedSectorIds((prev) =>
                          selected ? prev.filter((id) => id !== sector.id) : [...prev, sector.id]
                        )
                      }
                    >
                      <Text style={[styles.chipText, selected && styles.chipTextSelected]}>
                        {sector.name}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </>
          )}

          {interestedInMinistry && (
            <>
              <Text style={styles.label}>Descreva seu interesse (opcional)</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                placeholder="Conte-nos mais sobre seu interesse..."
                value={ministryNotes}
                onChangeText={setMinistryNotes}
                multiline
                numberOfLines={3}
                placeholderTextColor={t.text.tertiary}
              />
              {errors.ministry && <Text style={styles.errorText}>{errors.ministry}</Text>}
            </>
          )}
        </View>

        {/* ============================================ */}
        {/* DISPONIBILIDADE DE ACOMODAÇÃO */}
        {/* ============================================ */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Para cuidar de você</Text>
          <Text style={styles.label}>Selecione todas as formas que você aceita:</Text>
          <View style={styles.chipsRow}>
            {[
              { value: 'CAMA', label: 'Cama' },
              { value: 'REDE', label: 'Rede' },
              { value: 'COLCHAO_INFLAVEL', label: 'Colchão Inflável' },
            ].map((opt) => {
              const selected = accommodationOptions.includes(opt.value);
              return (
                <TouchableOpacity
                  key={opt.value}
                  style={[styles.chip, selected && styles.chipSelected]}
                  onPress={() =>
                    setAccommodationOptions((prev) =>
                      selected ? prev.filter((v) => v !== opt.value) : [...prev, opt.value]
                    )
                  }
                >
                  <Text style={[styles.chipText, selected && styles.chipTextSelected]}>
                    {opt.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* ============================================ */}
        {/* INFORMAÇÕES EXTRAS */}
        {/* ============================================ */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Últimos detalhes</Text>
          <Text style={styles.sectionHint}>Todos os campos abaixo são opcionais.</Text>

          {/* Instagram */}
          <Text style={styles.label}>Instagram</Text>
          <TextInput
            style={styles.input}
            placeholder="@usuario"
            value={instagram}
            onChangeText={setInstagram}
            autoCapitalize="none"
            placeholderTextColor={t.text.tertiary}
          />

          {/* Restrição alimentar */}
          <View style={styles.switchRow}>
            <Text style={styles.switchLabel}>Possui restrição alimentar?</Text>
            <Switch
              value={dietaryRestriction}
              onValueChange={(v) => { setDietaryRestriction(v); if (!v) setDietaryNotes(''); }}
              trackColor={{ false: t.border.subtle, true: t.brand.primaryLight }}
              thumbColor={dietaryRestriction ? t.brand.primary : t.bg.surface}
            />
          </View>
          {dietaryRestriction && (
            <TextInput
              style={styles.input}
              placeholder="Quais restrições alimentares?"
              value={dietaryNotes}
              onChangeText={setDietaryNotes}
              placeholderTextColor={t.text.tertiary}
            />
          )}

          {/* Plano de saúde */}
          <View style={styles.switchRow}>
            <Text style={styles.switchLabel}>Possui plano de saúde?</Text>
            <Switch
              value={healthInsurance}
              onValueChange={(v) => { setHealthInsurance(v); if (!v) setHealthInsuranceName(''); }}
              trackColor={{ false: t.border.subtle, true: t.brand.primaryLight }}
              thumbColor={healthInsurance ? t.brand.primary : t.bg.surface}
            />
          </View>
          {healthInsurance && (
            <TextInput
              style={styles.input}
              placeholder="Qual plano de saúde?"
              value={healthInsuranceName}
              onChangeText={setHealthInsuranceName}
              placeholderTextColor={t.text.tertiary}
            />
          )}

          {/* Instrumentos */}
          <View style={styles.switchRow}>
            <Text style={styles.switchLabel}>Toca algum instrumento ou canta?</Text>
            <Switch
              value={playsInstrument}
              onValueChange={(v) => { setPlaysInstrument(v); if (!v) setInstrumentNames([]); }}
              trackColor={{ false: t.border.subtle, true: t.brand.primaryLight }}
              thumbColor={playsInstrument ? t.brand.primary : t.bg.surface}
            />
          </View>
          {playsInstrument && (
            <>
              <Text style={styles.label}>Selecione os instrumentos:</Text>
              <View style={styles.chipsRow}>
                {INSTRUMENTS.map((inst) => {
                  const selected = instrumentNames.includes(inst);
                  return (
                    <TouchableOpacity
                      key={inst}
                      style={[styles.chip, selected && styles.chipSelected]}
                      onPress={() =>
                        setInstrumentNames((prev) =>
                          selected ? prev.filter((i) => i !== inst) : [...prev, inst]
                        )
                      }
                    >
                      <Text style={[styles.chipText, selected && styles.chipTextSelected]}>
                        {inst}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </>
          )}

          {/* Encontro Despertar */}
          <Text style={styles.label}>Encontro Despertar</Text>
          <View style={styles.picker}>
            <Picker
              selectedValue={despertarEncounter}
              onValueChange={setDespertarEncounter}
            >
              {DESPERTAR_ENCOUNTERS.map((item, i) => (
                <Picker.Item
                  key={i}
                  label={item || 'Selecione o encontro...'}
                  value={item}
                />
              ))}
            </Picker>
          </View>
        </View>

        {/* ============================================ */}
        {/* BOTÃO SALVAR */}
        {/* ============================================ */}
        <TouchableOpacity
          style={[styles.submitButton, isSaving && styles.submitButtonDisabled]}
          onPress={handleSubmit}
          disabled={isSaving}
        >
          {isSaving ? (
            <ActivityIndicator color={t.text.inverse} />
          ) : (
            <Text style={styles.submitButtonText}>Salvar e Continuar</Text>
          )}
        </TouchableOpacity>

        <View style={styles.spacer} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const makeStyles = (t: SemanticTokens) => StyleSheet.create({
  container: { flex: 1, backgroundColor: t.bg.screen },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: t.bg.screen },
  loadingText: { marginTop: 12, fontSize: 16, color: t.text.secondary },
  scrollView: { flex: 1 },
  scrollContent: { padding: 20 },
  title: { fontSize: 28, fontFamily: 'Nunito-Bold', color: t.text.primary, marginBottom: 8, marginTop: 20 },
  subtitle: { fontSize: 16, color: t.text.secondary, marginBottom: 24, lineHeight: 22 },
  section: {
    backgroundColor: t.bg.elevated, borderRadius: 16, padding: 20, marginBottom: 16,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05, shadowRadius: 4, elevation: 2,
  },
  sectionTitle: { fontSize: 20, fontFamily: 'Nunito-Bold', color: t.text.primary, marginBottom: 16 },
  sectionHint: { fontSize: 13, color: t.text.tertiary, marginBottom: 12, fontStyle: 'italic' },
  label: { fontSize: 14, fontWeight: '600', color: t.text.primary, marginBottom: 8, marginTop: 12 },
  input: {
    backgroundColor: t.bg.surface, borderRadius: 12, padding: 16,
    fontSize: 16, borderWidth: 1, borderColor: t.border.subtle, color: t.text.primary,
  },
  inputError: { borderColor: t.status.error },
  textArea: { minHeight: 80, textAlignVertical: 'top' },
  errorText: { color: t.status.error, fontSize: 13, marginTop: 4 },
  picker: { backgroundColor: t.bg.surface, borderRadius: 12, borderWidth: 1, borderColor: t.border.subtle, overflow: 'hidden' },
  pickerError: { borderColor: t.status.error },
  photoContainer: { alignSelf: 'center', marginBottom: 8 },
  photo: { width: 120, height: 120, borderRadius: 60 },
  photoPlaceholder: {
    width: 120, height: 120, borderRadius: 60,
    backgroundColor: t.bg.surface, borderWidth: 2,
    borderColor: t.border.subtle, borderStyle: 'dashed',
    justifyContent: 'center', alignItems: 'center',
  },
  photoPlaceholderText: { fontSize: 40, color: t.text.tertiary },
  photoHint: { fontSize: 14, color: t.text.secondary, textAlign: 'center' },
  switchRow: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', paddingVertical: 8,
  },
  switchLabel: { fontSize: 15, color: t.text.primary, flex: 1, marginRight: 12 },
  submitButton: { backgroundColor: t.brand.primary, borderRadius: 12, padding: 18, alignItems: 'center', marginTop: 8 },
  submitButtonDisabled: { opacity: 0.6 },
  submitButtonText: { color: t.text.inverse, fontSize: 18, fontWeight: '600' },
  spacer: { height: 40 },
  lockedField: { position: 'relative' },
  inputLocked: { backgroundColor: t.status.successBg, borderColor: t.status.success, borderWidth: 1, color: t.text.secondary },
  lockedBadge: { position: 'absolute', right: 14, top: 0, bottom: 0, flexDirection: 'row', alignItems: 'center', gap: 4 },
  lockedText: { fontSize: 12, color: t.status.success, fontWeight: '600' },
  lockedHint: { fontSize: 12, color: t.text.tertiary, marginTop: 4, marginLeft: 4, fontStyle: 'italic' },
  chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4, marginBottom: 8 },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1.5, borderColor: t.border.subtle, backgroundColor: t.bg.surface },
  chipSelected: { borderColor: t.brand.primary, backgroundColor: t.brand.primary },
  chipText: { fontSize: 13, color: t.text.secondary, fontWeight: '500' },
  chipTextSelected: { color: t.text.inverse, fontWeight: '700' },
});
