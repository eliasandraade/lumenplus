/**
 * Profile Screen (Onboarding)
 * ===========================
 * Formulário completo de preenchimento do perfil.
 *
 * Inclui:
 * - Foto de perfil
 * - Dados pessoais
 * - Localização (BrasilAPI: estado + cidade)
 * - Estado de Vida, Civil e Realidade Vocacional
 * - Ano de consagração (se Consagrado Filho da Luz)
 * - Realidade Atual (multi-select chips)
 * - Cônjuge na comunidade (condicional ao estado civil)
 * - Missão (switch + Picker de missões + país)
 * - Interesse em Ministério (switch + chips de setores)
 * - Disponibilidade de Acomodação (multi-select chips)
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
import { Ionicons } from '@expo/vector-icons';
import api from '@/services/api';
import { profileService } from '@/services';
import brasilApi, { type Estado, type Municipio } from '@/services/brasilApi';

const colors = {
  primary: '#1a365d',
  primaryLight: '#2c5282',
  white: '#ffffff',
  gray: '#6b7280',
  lightGray: '#f3f4f6',
  error: '#ef4444',
  success: '#22c55e',
  border: '#e5e5e5',
  background: '#f9fafb',
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
  life_state_item_id?: string;
  marital_status_item_id?: string;
  vocational_reality_item_id?: string;
  consecration_year?: number;
  interested_in_ministry?: boolean;
  interested_ministry_id?: string;
  ministry_interest_notes?: string;
  realidade_atual?: string[];
  spouse_in_community?: boolean | null;
  accommodation_options?: string[];
  is_from_mission?: boolean | null;
  mission_name?: string;
  country?: string;
  mission_org_unit_id?: string | null;
  ministry_sector_ids?: string[];
}

export default function ProfileScreen() {
  const params = useLocalSearchParams<{ fullName?: string; phone?: string }>();
  // Telefone verificado = veio do fluxo verify-phone via params
  const phoneVerified = !!params.phone;
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Catálogos
  const [lifeStates, setLifeStates] = useState<CatalogItem[]>([]);
  const [maritalStatuses, setMaritalStatuses] = useState<CatalogItem[]>([]);
  const [vocationalRealities, setVocationalRealities] = useState<CatalogItem[]>([]);

  // BrasilAPI
  const [estados, setEstados] = useState<Estado[]>([]);
  const [municipios, setMunicipios] = useState<Municipio[]>([]);
  const [loadingMunicipios, setLoadingMunicipios] = useState(false);

  // Novos campos
  const [realidadeAtual, setRealidadeAtual] = useState<string[]>([]);
  const [realidadeAtualOptions, setRealidadeAtualOptions] = useState<CatalogItem[]>([]);
  const [spouseInCommunity, setSpouseInCommunity] = useState<boolean | null>(null);
  const [accommodationOptions, setAccommodationOptions] = useState<string[]>([]);
  const [isFromMission, setIsFromMission] = useState(false);
  const [missionName, setMissionName] = useState('');
  const [country, setCountry] = useState('');
  const [missionOrgUnitId, setMissionOrgUnitId] = useState<string | null>(null);
  const [missions, setMissions] = useState<{ id: string; name: string }[]>([]);
  const [sectors, setSectors] = useState<{ id: string; name: string }[]>([]);
  const [selectedSectorIds, setSelectedSectorIds] = useState<string[]>([]);

  // Form state
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [fullName, setFullName] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [cpf, setCpf] = useState('');
  const [rg, setRg] = useState('');
  const [phone, setPhone] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');

  // Catálogos selecionados
  const [lifeState, setLifeState] = useState('');
  const [maritalStatus, setMaritalStatus] = useState('');
  const [vocationalReality, setVocationalReality] = useState('');

  // Campos condicionais
  const [consecrationYear, setConsecrationYear] = useState('');
  const [interestedInMinistry, setInterestedInMinistry] = useState(false);
  const [ministryNotes, setMinistryNotes] = useState('');

  // Verifica se é Consagrado Filho da Luz (vocationalReality guarda o UUID do item)
  const isConsagrado =
    vocationalRealities.find((i) => i.id === vocationalReality)?.code ===
    'CONSAGRADO_FILHO_DA_LUZ';

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

      // Pré-popula campos com dados já existentes no backend
      if (profile) {
        if (profile.full_name) setFullName(profile.full_name);
        if (profile.birth_date) {
          // Converte YYYY-MM-DD para DD/MM/YYYY
          const parts = profile.birth_date.split('-');
          if (parts.length === 3) setBirthDate(`${parts[2]}/${parts[1]}/${parts[0]}`);
        }
        if (profile.cpf) setCpf(formatCPF(profile.cpf));
        if (profile.rg) setRg(profile.rg);
        if (profile.phone_e164) {
          // Converte E164 (+5511999999999) para formato BR
          const digits = profile.phone_e164.replace(/\D/g, '').slice(2); // remove +55
          setPhone(formatPhone(digits));
        }
        if (profile.city) setCity(profile.city);
        if (profile.state) {
          setState(profile.state);
          // Se tiver estado salvo, pré-carregar municípios
          loadMunicipios(profile.state);
        }
        if (profile.life_state_item_id) setLifeState(profile.life_state_item_id);
        if (profile.marital_status_item_id) setMaritalStatus(profile.marital_status_item_id);
        if (profile.vocational_reality_item_id) setVocationalReality(profile.vocational_reality_item_id);
        if (profile.consecration_year) setConsecrationYear(String(profile.consecration_year));
        if (profile.interested_in_ministry != null) setInterestedInMinistry(profile.interested_in_ministry);
        if (profile.ministry_interest_notes) setMinistryNotes(profile.ministry_interest_notes);
        // Novos campos
        if (profile.realidade_atual) setRealidadeAtual(profile.realidade_atual);
        if (profile.spouse_in_community != null) setSpouseInCommunity(profile.spouse_in_community);
        if (profile.accommodation_options) setAccommodationOptions(profile.accommodation_options);
        if (profile.is_from_mission != null) setIsFromMission(!!profile.is_from_mission);
        if (profile.mission_name) setMissionName(profile.mission_name);
        if (profile.country) setCountry(profile.country);
        if (profile.mission_org_unit_id) setMissionOrgUnitId(profile.mission_org_unit_id);
        if (profile.ministry_sector_ids) setSelectedSectorIds(profile.ministry_sector_ids);
      }

      // Parâmetros de rota têm prioridade sobre dados do backend
      if (params.fullName) setFullName(params.fullName);
      if (params.phone) {
        const digits = params.phone.replace(/\D/g, '').slice(2); // remove 55
        if (digits) setPhone(formatPhone(digits));
      }
    } catch (err) {
      Alert.alert('Erro', 'Não foi possível carregar os dados');
    } finally {
      setIsLoading(false);
    }
  };

  const pickImage = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Permissão necessária', 'Precisamos de acesso às suas fotos');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      setPhotoUri(result.assets[0].uri);
    }
  };

  const takePhoto = async () => {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Permissão necessária', 'Precisamos de acesso à câmera');
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      setPhotoUri(result.assets[0].uri);
    }
  };

  const showPhotoOptions = () => {
    Alert.alert('Foto de Perfil', 'Escolha uma opção', [
      { text: 'Câmera', onPress: takePhoto },
      { text: 'Galeria', onPress: pickImage },
      { text: 'Cancelar', style: 'cancel' },
    ]);
  };

  const formatCPF = (value: string) => {
    const digits = value.replace(/\D/g, '').slice(0, 11);
    if (digits.length <= 3) return digits;
    if (digits.length <= 6) return `${digits.slice(0, 3)}.${digits.slice(3)}`;
    if (digits.length <= 9)
      return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`;
    return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
  };

  const formatPhone = (value: string) => {
    const digits = value.replace(/\D/g, '').slice(0, 11);
    if (digits.length <= 2) return digits;
    if (digits.length <= 6) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
    if (digits.length <= 10) return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
  };

  const formatDate = (value: string) => {
    const digits = value.replace(/\D/g, '').slice(0, 8);
    if (digits.length <= 2) return digits;
    if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
    return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
  };

  const parseDate = (formatted: string): string => {
    // Converte DD/MM/YYYY para YYYY-MM-DD
    const parts = formatted.split('/');
    if (parts.length === 3) {
      return `${parts[2]}-${parts[1]}-${parts[0]}`;
    }
    return '';
  };

  const validate = () => {
    const newErrors: Record<string, string> = {};

    if (!fullName.trim() || fullName.length < 3) {
      newErrors.fullName = 'Nome deve ter pelo menos 3 caracteres';
    }
    if (!birthDate || birthDate.length < 10) {
      newErrors.birthDate = 'Data de nascimento obrigatória';
    }
    if (cpf.replace(/\D/g, '').length !== 11) {
      newErrors.cpf = 'CPF inválido';
    }
    if (!rg.trim()) {
      newErrors.rg = 'RG obrigatório';
    }
    if (phone.replace(/\D/g, '').length < 10) {
      newErrors.phone = 'Telefone inválido';
    }
    if (!state) {
      newErrors.state = 'Estado obrigatório';
    }
    if (!city.trim()) {
      newErrors.city = 'Cidade obrigatória';
    }
    if (!lifeState) {
      newErrors.lifeState = 'Selecione o estado de vida';
    }
    if (!maritalStatus) {
      newErrors.maritalStatus = 'Selecione o estado civil';
    }
    if (!vocationalReality) {
      newErrors.vocationalReality = 'Selecione a realidade vocacional';
    }

    // Validações condicionais
    if (isConsagrado && !consecrationYear) {
      newErrors.consecrationYear = 'Ano de consagração obrigatório';
    }
    if (interestedInMinistry && selectedSectorIds.length === 0 && !ministryNotes.trim()) {
      newErrors.ministry = 'Selecione ao menos um setor ou descreva seu interesse';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) {
      Alert.alert('Atenção', 'Preencha todos os campos obrigatórios');
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
        state,
        // Backend espera UUIDs dos itens de catálogo
        life_state_item_id: lifeState,
        marital_status_item_id: maritalStatus,
        vocational_reality_item_id: vocationalReality,
        consecration_year: isConsagrado ? parseInt(consecrationYear) : null,
        interested_in_ministry: interestedInMinistry,
        ministry_interest_notes: interestedInMinistry ? ministryNotes.trim() : null,
        // Novos campos
        country: isFromMission ? country.trim() || null : null,
        spouse_in_community: spouseInCommunity,
        realidade_atual: realidadeAtual.length > 0 ? realidadeAtual : null,
        ministry_sector_ids: interestedInMinistry && selectedSectorIds.length > 0 ? selectedSectorIds : null,
        accommodation_options: accommodationOptions.length > 0 ? accommodationOptions : null,
        mission_org_unit_id: isFromMission ? missionOrgUnitId : null,
        is_from_mission: isFromMission,
        mission_name: isFromMission && !missionOrgUnitId ? missionName.trim() || null : null,
      };

      // Salva perfil
      await api.put('/profile', data);

      // Upload de foto se existir
      if (photoUri) {
        const formData = new FormData();
        formData.append('file', {
          uri: photoUri,
          type: 'image/jpeg',
          name: 'profile.jpg',
        } as any);

        try {
          await api.post('/profile/photo', formData, {
            headers: { 'Content-Type': 'multipart/form-data' },
          });
        } catch {
          // Foto é opcional, não bloqueia o cadastro
          console.warn('Erro ao enviar foto');
        }
      }

      Alert.alert('Sucesso!', 'Perfil salvo com sucesso!', [
        { text: 'Continuar', onPress: () => router.replace('/(tabs)/home') },
      ]);
    } catch (err: any) {
      const message = err.response?.data?.detail?.message || 'Erro ao salvar perfil';
      Alert.alert('Erro', message);
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>Carregando...</Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.title}>Complete seu perfil</Text>
        <Text style={styles.subtitle}>
          Precisamos de algumas informações para finalizar seu cadastro.
        </Text>

        {/* ============================================ */}
        {/* FOTO DE PERFIL */}
        {/* ============================================ */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>📷 Foto de Perfil</Text>

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
          <Text style={styles.sectionTitle}>👤 Dados Pessoais</Text>

          <Text style={styles.label}>Nome completo *</Text>
          <TextInput
            style={[styles.input, errors.fullName && styles.inputError]}
            placeholder="Seu nome completo"
            value={fullName}
            onChangeText={setFullName}
            autoCapitalize="words"
            placeholderTextColor={colors.gray}
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
            placeholderTextColor={colors.gray}
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
            placeholderTextColor={colors.gray}
          />
          {errors.cpf && <Text style={styles.errorText}>{errors.cpf}</Text>}

          <Text style={styles.label}>RG *</Text>
          <TextInput
            style={[styles.input, errors.rg && styles.inputError]}
            placeholder="Seu RG"
            value={rg}
            onChangeText={setRg}
            placeholderTextColor={colors.gray}
          />
          {errors.rg && <Text style={styles.errorText}>{errors.rg}</Text>}

          <Text style={styles.label}>Telefone (WhatsApp) *</Text>
          {phoneVerified ? (
            <View style={styles.lockedField}>
              <TextInput
                style={[styles.input, styles.inputLocked]}
                value={phone}
                editable={false}
                placeholderTextColor={colors.gray}
              />
              <View style={styles.lockedBadge}>
                <Ionicons name="lock-closed" size={14} color={colors.success} />
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
              placeholderTextColor={colors.gray}
            />
          )}
          {!phoneVerified && errors.phone && <Text style={styles.errorText}>{errors.phone}</Text>}
          {phoneVerified && (
            <Text style={styles.lockedHint}>
              Para alterar o telefone é necessário uma nova verificação.
            </Text>
          )}
        </View>

        {/* ============================================ */}
        {/* LOCALIZAÇÃO */}
        {/* ============================================ */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>📍 Localização</Text>

          {/* Estado */}
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

          {/* Cidade */}
          <Text style={styles.label}>Cidade *</Text>
          {loadingMunicipios ? (
            <ActivityIndicator size="small" color={colors.primary} style={{ marginVertical: 8 }} />
          ) : (
            <View style={[styles.picker, errors.city && styles.pickerError]}>
              <Picker
                selectedValue={city}
                onValueChange={setCity}
                enabled={municipios.length > 0}
              >
                <Picker.Item label={state ? 'Selecione a cidade...' : 'Selecione o estado primeiro'} value="" />
                {municipios.map((m) => (
                  <Picker.Item key={m.nome} label={m.nome} value={m.nome} />
                ))}
              </Picker>
            </View>
          )}
          {errors.city && <Text style={styles.errorText}>{errors.city}</Text>}
        </View>

        {/* ============================================ */}
        {/* INFORMAÇÕES DA COMUNIDADE */}
        {/* ============================================ */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>⛪ Informações da Comunidade</Text>

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
            <Picker selectedValue={maritalStatus} onValueChange={setMaritalStatus}>
              <Picker.Item label="Selecione..." value="" />
              {maritalStatuses.map((item) => (
                <Picker.Item key={item.id} label={item.label} value={item.id} />
              ))}
            </Picker>
          </View>
          {errors.maritalStatus && <Text style={styles.errorText}>{errors.maritalStatus}</Text>}

          {/* Cônjuge na comunidade? */}
          {['CASADO', 'UNIAO_ESTAVEL'].includes(
            maritalStatuses.find(i => i.id === maritalStatus)?.code ?? ''
          ) && (
            <View style={styles.switchRow}>
              <Text style={styles.switchLabel}>Seu cônjuge faz parte da comunidade de vida?</Text>
              <Switch
                value={spouseInCommunity ?? false}
                onValueChange={setSpouseInCommunity}
                trackColor={{ false: colors.border, true: colors.primaryLight }}
                thumbColor={spouseInCommunity ? colors.primary : colors.lightGray}
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

          {/* ANO DE CONSAGRAÇÃO (condicional) */}
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
                placeholderTextColor={colors.gray}
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
            <Text style={styles.sectionTitle}>🌟 Realidade Atual</Text>
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
          <Text style={styles.sectionTitle}>✈️ Missão</Text>

          <View style={styles.switchRow}>
            <Text style={styles.switchLabel}>
              Você faz parte de alguma missão da Obra Lumen fora de Fortaleza?
            </Text>
            <Switch
              value={isFromMission}
              onValueChange={(v) => {
                setIsFromMission(v);
                if (!v) {
                  setMissionOrgUnitId(null);
                  setMissionName('');
                  setCountry('');
                }
              }}
              trackColor={{ false: colors.border, true: colors.primaryLight }}
              thumbColor={isFromMission ? colors.primary : colors.lightGray}
            />
          </View>

          {isFromMission && (
            <>
              <Text style={styles.label}>Missão</Text>
              {missions.length > 0 ? (
                <View style={styles.picker}>
                  <Picker
                    selectedValue={missionOrgUnitId ?? ''}
                    onValueChange={(v) => {
                      setMissionOrgUnitId(v === 'OUTROS' ? null : v || null);
                      setMissionName(v === 'OUTROS' ? missionName : '');
                    }}
                  >
                    <Picker.Item label="Selecione..." value="" />
                    {missions.map((m) => (
                      <Picker.Item key={m.id} label={m.name} value={m.id} />
                    ))}
                    <Picker.Item label="Outros" value="OUTROS" />
                  </Picker>
                </View>
              ) : null}

              {(!missionOrgUnitId || missionOrgUnitId === null) && (
                <TextInput
                  style={styles.input}
                  placeholder="Nome da missão"
                  value={missionName}
                  onChangeText={setMissionName}
                  placeholderTextColor={colors.gray}
                />
              )}

              <Text style={styles.label}>País</Text>
              <TextInput
                style={styles.input}
                placeholder="Ex: Portugal, Estados Unidos..."
                value={country}
                onChangeText={setCountry}
                placeholderTextColor={colors.gray}
              />
            </>
          )}
        </View>

        {/* ============================================ */}
        {/* INTERESSE EM MINISTÉRIO */}
        {/* ============================================ */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>💼 Interesse em Ministério</Text>

          <View style={styles.switchRow}>
            <Text style={styles.switchLabel}>Você se sente chamado a servir em um ministério?</Text>
            <Switch
              value={interestedInMinistry}
              onValueChange={setInterestedInMinistry}
              trackColor={{ false: colors.border, true: colors.primaryLight }}
              thumbColor={interestedInMinistry ? colors.primary : colors.lightGray}
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
                placeholderTextColor={colors.gray}
              />
              {errors.ministry && <Text style={styles.errorText}>{errors.ministry}</Text>}
            </>
          )}
        </View>

        {/* ============================================ */}
        {/* DISPONIBILIDADE DE ACOMODAÇÃO */}
        {/* ============================================ */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>🛏️ Disponibilidade de Acomodação</Text>
          <Text style={styles.label}>Selecione todas as formas que você se dispõe a ser acomodado:</Text>
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
        {/* BOTÃO SALVAR */}
        {/* ============================================ */}
        <TouchableOpacity
          style={[styles.submitButton, isSaving && styles.submitButtonDisabled]}
          onPress={handleSubmit}
          disabled={isSaving}
        >
          {isSaving ? (
            <ActivityIndicator color={colors.white} />
          ) : (
            <Text style={styles.submitButtonText}>Salvar e Continuar</Text>
          )}
        </TouchableOpacity>

        <View style={styles.spacer} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: colors.gray,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#171717',
    marginBottom: 8,
    marginTop: 20,
  },
  subtitle: {
    fontSize: 16,
    color: colors.gray,
    marginBottom: 24,
    lineHeight: 22,
  },
  section: {
    backgroundColor: colors.white,
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#171717',
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
    marginTop: 12,
  },
  input: {
    backgroundColor: colors.lightGray,
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    borderWidth: 1,
    borderColor: colors.border,
    color: '#171717',
  },
  inputError: {
    borderColor: colors.error,
  },
  textArea: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  errorText: {
    color: colors.error,
    fontSize: 13,
    marginTop: 4,
  },
  picker: {
    backgroundColor: colors.lightGray,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  pickerError: {
    borderColor: colors.error,
  },
  photoContainer: {
    alignSelf: 'center',
    marginBottom: 8,
  },
  photo: {
    width: 120,
    height: 120,
    borderRadius: 60,
  },
  photoPlaceholder: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: colors.lightGray,
    borderWidth: 2,
    borderColor: colors.border,
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
  },
  photoPlaceholderText: {
    fontSize: 40,
    color: colors.gray,
  },
  photoHint: {
    fontSize: 14,
    color: colors.gray,
    textAlign: 'center',
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  switchLabel: {
    fontSize: 15,
    color: '#374151',
    flex: 1,
    marginRight: 12,
  },
  submitButton: {
    backgroundColor: colors.primary,
    borderRadius: 12,
    padding: 18,
    alignItems: 'center',
    marginTop: 8,
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  submitButtonText: {
    color: colors.white,
    fontSize: 18,
    fontWeight: '600',
  },
  spacer: {
    height: 40,
  },
  lockedField: {
    position: 'relative',
  },
  inputLocked: {
    backgroundColor: '#f0fdf4',
    borderColor: colors.success,
    borderWidth: 1,
    color: colors.gray,
  },
  lockedBadge: {
    position: 'absolute',
    right: 14,
    top: 0,
    bottom: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  lockedText: {
    fontSize: 12,
    color: colors.success,
    fontWeight: '600',
  },
  lockedHint: {
    fontSize: 12,
    color: colors.gray,
    marginTop: 4,
    marginLeft: 4,
    fontStyle: 'italic',
  },
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 4,
    marginBottom: 8,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.white,
  },
  chipSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primary,
  },
  chipText: {
    fontSize: 13,
    color: colors.gray,
    fontWeight: '500',
  },
  chipTextSelected: {
    color: colors.white,
    fontWeight: '700',
  },
});
