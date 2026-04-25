/**
 * Register Screen
 * ===============
 * Cadastro em 4 passos:
 *  1. Dados da conta (nome, email, senha)
 *  2. Localização + Missão
 *     - País → se Brasil: Estado (BrasilAPI) + Cidade (BrasilAPI)
 *                         senão: Cidade (texto livre)
 *     - Faz parte de missão da Obra?
 *     - Telefone, nascimento, CPF, RG
 *  3. Dados vocacionais (estado de vida, estado civil, cônjuge,
 *     realidade vocacional, consagração, realidade atual, ministério/setores)
 *  4. Informações extras (instagram, alimentação, saúde, acomodação,
 *     instrumentos, Despertar numerado, contato de emergência) — opcionais
 *
 * Após criação da conta Firebase, salva o perfil completo no backend.
 */

import { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  KeyboardAvoidingView, Platform, ScrollView,
  ActivityIndicator, StatusBar, Modal, FlatList, Switch, Alert,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { createUserWithEmailAndPassword, updateProfile, sendEmailVerification } from 'firebase/auth';
import { auth, IS_DEV_AUTH } from '@/config/firebase';
import { profileService } from '@/services';
import api, { setDevToken } from '@/services/api';
import brasilApi, { type Estado, type Municipio } from '@/services/brasilApi';
import type { CatalogItem } from '@/types';

// ─── Encontros Despertar numerados (1 – Água Viva … 47 – Kadosh) ────────────
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
const DESPERTAR_ENCOUNTERS = DESPERTAR_NAMES.map((name, i) => `${i + 1} – ${name}`);

// ─── Lista de países ─────────────────────────────────────────────────────────
const COUNTRIES = [
  'Brasil',
  'Alemanha', 'Angola', 'Argentina', 'Austrália', 'Áustria',
  'Bélgica', 'Bolívia', 'Cabo Verde', 'Canadá', 'Chile',
  'China', 'Colômbia', 'Costa Rica', 'Cuba', 'Dinamarca',
  'Equador', 'Espanha', 'Estados Unidos', 'Finlândia', 'França',
  'Grécia', 'Guatemala', 'Guiné-Bissau', 'Honduras', 'Irlanda',
  'Israel', 'Itália', 'Japão', 'México', 'Moçambique',
  'Noruega', 'Nova Zelândia', 'Paraguai', 'Peru', 'Polônia',
  'Portugal', 'Reino Unido', 'República Tcheca', 'Rússia',
  'São Tomé e Príncipe', 'Suécia', 'Suíça', 'Timor-Leste',
  'Ucrânia', 'Uruguai', 'Venezuela',
];

const INSTRUMENTS = [
  'Voz / Canto', 'Violão', 'Guitarra', 'Teclado', 'Piano',
  'Bateria', 'Percussão', 'Flauta', 'Saxofone', 'Trompete',
  'Contrabaixo', 'Violino', 'Outro',
];

const ACCOMMODATION_OPTS = [
  { value: 'CAMA', label: 'Cama' },
  { value: 'REDE', label: 'Rede' },
  { value: 'COLCHAO_INFLAVEL', label: 'Colchão Inflável' },
];

function isValidCpf(cpf: string): boolean {
  const d = cpf.replace(/\D/g, '');
  if (d.length !== 11 || /^(\d)\1{10}$/.test(d)) return false;
  let sum = 0;
  for (let i = 0; i < 9; i++) sum += parseInt(d[i]) * (10 - i);
  let check = (sum * 10) % 11;
  if (check >= 10) check = 0;
  if (check !== parseInt(d[9])) return false;
  sum = 0;
  for (let i = 0; i < 10; i++) sum += parseInt(d[i]) * (11 - i);
  check = (sum * 10) % 11;
  if (check >= 10) check = 0;
  return check === parseInt(d[10]);
}

const colors = {
  primary: '#1A859B',
  white: '#ffffff',
  orange: '#F5A623',
  gray: '#6b7280',
  inputBg: 'rgba(255, 255, 255, 0.9)',
  error: '#ef4444',
};

export default function RegisterScreen() {
  const [step, setStep] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [firebaseError, setFirebaseError] = useState('');

  // Catálogos carregados do backend
  const [lifeStates, setLifeStates] = useState<CatalogItem[]>([]);
  const [maritalStatuses, setMaritalStatuses] = useState<CatalogItem[]>([]);
  const [vocationalRealities, setVocationalRealities] = useState<CatalogItem[]>([]);
  const [realidadeAtualOptions, setRealidadeAtualOptions] = useState<CatalogItem[]>([]);
  const [loadingCatalogs, setLoadingCatalogs] = useState(false);

  // BrasilAPI — estado + cidade (apenas Brasil)
  const [estados, setEstados] = useState<Estado[]>([]);
  const [municipios, setMunicipios] = useState<Municipio[]>([]);
  const [loadingMunicipios, setLoadingMunicipios] = useState(false);
  const [citySearch, setCitySearch] = useState('');

  // Setores e missões
  const [sectors, setSectors] = useState<{ id: string; name: string }[]>([]);
  const [selectedSectorIds, setSelectedSectorIds] = useState<string[]>([]);
  const [missions, setMissions] = useState<{ id: string; name: string }[]>([]);

  // ── Passo 1: Conta ──────────────────────────────────────────────────────────
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // ── Passo 2: Localização + Missão ──────────────────────────────────────────
  const [pais, setPais] = useState('Brasil');
  const [uf, setUf] = useState('');
  const [city, setCity] = useState('');
  const [phone, setPhone] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [cpf, setCpf] = useState('');
  const [rg, setRg] = useState('');
  const [isFromMission, setIsFromMission] = useState(false);
  const [missionOrgUnitId, setMissionOrgUnitId] = useState<string | null>(null);
  const [missionName, setMissionName] = useState('');

  // ── Passo 3: Vocacional ─────────────────────────────────────────────────────
  const [selectedLifeState, setSelectedLifeState] = useState<CatalogItem | null>(null);
  const [selectedMarital, setSelectedMarital] = useState<CatalogItem | null>(null);
  const [selectedVocational, setSelectedVocational] = useState<CatalogItem | null>(null);
  const [consecrationYear, setConsecrationYear] = useState('');
  const [spouseInCommunity, setSpouseInCommunity] = useState<boolean | null>(null);
  const [realidadeAtual, setRealidadeAtual] = useState<string[]>([]);
  const [interestedInMinistry, setInterestedInMinistry] = useState(false);
  const [ministryNotes, setMinistryNotes] = useState('');

  // ── Passo 4: Extras (opcionais) ─────────────────────────────────────────────
  const [instagram, setInstagram] = useState('');
  const [dietaryRestriction, setDietaryRestriction] = useState(false);
  const [dietaryNotes, setDietaryNotes] = useState('');
  const [healthInsurance, setHealthInsurance] = useState(false);
  const [healthInsuranceName, setHealthInsuranceName] = useState('');
  const [accommodationOptions, setAccommodationOptions] = useState<string[]>([]);
  const [despertarEncounter, setDespertarEncounter] = useState('');
  const [emergencyName, setEmergencyName] = useState('');
  const [emergencyRelationship, setEmergencyRelationship] = useState('');
  const [emergencyPhone, setEmergencyPhone] = useState('');
  const [playsInstrument, setPlaysInstrument] = useState(false);
  const [instrumentNames, setInstrumentNames] = useState<string[]>([]);

  // ── Modais ──────────────────────────────────────────────────────────────────
  const [paisModalVisible, setPaisModalVisible] = useState(false);
  const [paisSearch, setPaisSearch] = useState('');
  const [stateModalVisible, setStateModalVisible] = useState(false);
  const [cityModalVisible, setCityModalVisible] = useState(false);
  const [missionModalVisible, setMissionModalVisible] = useState(false);
  const [despertarModalVisible, setDespertarModalVisible] = useState(false);
  const [catalogModalVisible, setCatalogModalVisible] = useState(false);
  const [catalogModalTitle, setCatalogModalTitle] = useState('');
  const [catalogModalOptions, setCatalogModalOptions] = useState<CatalogItem[]>([]);
  const [catalogModalOnSelect, setCatalogModalOnSelect] = useState<(item: CatalogItem) => void>(() => () => {});

  // ── Derivados ───────────────────────────────────────────────────────────────
  const isBrasil = pais === 'Brasil';
  const isConsagrado = selectedVocational?.code === 'CONSAGRADO_FILHO_DA_LUZ';
  const showSpouseField = ['CASADO', 'UNIAO_ESTAVEL'].includes(selectedMarital?.code ?? '');
  const filteredMunicipios = citySearch
    ? municipios.filter(m => m.nome.toLowerCase().includes(citySearch.toLowerCase()))
    : municipios;
  const filteredPaises = paisSearch
    ? COUNTRIES.filter(c => c.toLowerCase().includes(paisSearch.toLowerCase()))
    : COUNTRIES;

  // ── Carregamento inicial (passo 2) ──────────────────────────────────────────
  useEffect(() => {
    brasilApi.getEstados().then(setEstados).catch(() => {});
    profileService.getMissions().then(setMissions).catch(() => {});
  }, []);

  // ── Catálogos + setores (passo 3) ───────────────────────────────────────────
  useEffect(() => {
    if (step === 3 && lifeStates.length === 0) loadCatalogs();
  }, [step]);

  const loadCatalogs = async () => {
    setLoadingCatalogs(true);
    try {
      const [catalogs, sectorsData] = await Promise.all([
        profileService.getCatalogs(),
        profileService.getSectors().catch(() => [] as { id: string; name: string }[]),
      ]);
      const find = (code: string): CatalogItem[] =>
        (catalogs as any[]).find((c) => c.code === code)?.items ?? [];
      setLifeStates(find('LIFE_STATE'));
      setMaritalStatuses(find('MARITAL_STATUS'));
      setVocationalRealities(find('VOCATIONAL_REALITY'));
      setRealidadeAtualOptions(find('REALIDADE_ATUAL'));
      setSectors(sectorsData);
    } catch {
      // silencioso
    } finally {
      setLoadingCatalogs(false);
    }
  };

  const loadMunicipios = async (sigla: string) => {
    if (!sigla) { setMunicipios([]); return; }
    setLoadingMunicipios(true);
    try {
      setMunicipios(await brasilApi.getMunicipios(sigla));
    } catch {
      setMunicipios([]);
    } finally {
      setLoadingMunicipios(false);
    }
  };

  // ── Formatadores ─────────────────────────────────────────────────────────────
  const formatPhone = (v: string) => {
    const d = v.replace(/\D/g, '').slice(0, 11);
    if (d.length <= 2) return d;
    if (d.length <= 6) return `(${d.slice(0,2)}) ${d.slice(2)}`;
    if (d.length <= 10) return `(${d.slice(0,2)}) ${d.slice(2,6)}-${d.slice(6)}`;
    return `(${d.slice(0,2)}) ${d.slice(2,7)}-${d.slice(7)}`;
  };
  const formatDate = (v: string) => {
    const d = v.replace(/\D/g, '').slice(0, 8);
    if (d.length <= 2) return d;
    if (d.length <= 4) return `${d.slice(0,2)}/${d.slice(2)}`;
    return `${d.slice(0,2)}/${d.slice(2,4)}/${d.slice(4)}`;
  };
  const formatCpf = (v: string) => {
    const d = v.replace(/\D/g, '').slice(0, 11);
    if (d.length <= 3) return d;
    if (d.length <= 6) return `${d.slice(0,3)}.${d.slice(3)}`;
    if (d.length <= 9) return `${d.slice(0,3)}.${d.slice(3,6)}.${d.slice(6)}`;
    return `${d.slice(0,3)}.${d.slice(3,6)}.${d.slice(6,9)}-${d.slice(9)}`;
  };

  const openCatalogModal = (title: string, options: CatalogItem[], onSelect: (item: CatalogItem) => void) => {
    setCatalogModalTitle(title);
    setCatalogModalOptions(options);
    setCatalogModalOnSelect(() => onSelect);
    setCatalogModalVisible(true);
  };

  // ── Validações ───────────────────────────────────────────────────────────────
  const validateStep1 = () => {
    const e: Record<string, string> = {};
    if (fullName.trim().length < 3) e.fullName = 'Nome deve ter pelo menos 3 caracteres';
    if (!email.includes('@') || !email.includes('.')) e.email = 'Email inválido';
    if (password.length < 6) e.password = 'Senha deve ter pelo menos 6 caracteres';
    if (password !== confirmPassword) e.confirmPassword = 'Senhas não conferem';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const validateStep2 = () => {
    const e: Record<string, string> = {};
    if (!pais) e.pais = 'Selecione o país';
    if (isBrasil && !uf) e.uf = 'Selecione o estado';
    if (!city.trim()) e.city = isBrasil ? 'Selecione a cidade' : 'Informe a cidade';
    if (phone.replace(/\D/g, '').length < 10) e.phone = 'Telefone inválido';
    const parts = birthDate.split('/');
    if (parts.length !== 3 || parts[2]?.length !== 4) e.birthDate = 'Data inválida (DD/MM/AAAA)';
    if (!isValidCpf(cpf)) e.cpf = 'CPF inválido';
    if (rg.trim().length < 4) e.rg = 'RG inválido';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleNext = async () => {
    if (step === 1 && validateStep1()) {
      setStep(2);
    } else if (step === 2) {
      if (!validateStep2()) return;
      setIsLoading(true);
      try {
        const res = await fetch(`${api.baseUrl}/auth/check-cpf`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ cpf: cpf.replace(/\D/g, '') }),
        });
        if (res.ok) {
          const data = await res.json();
          if (!data.available) {
            setErrors(e => ({ ...e, cpf: 'CPF já está em uso' }));
            return;
          }
        }
      } catch {
        // erro de rede — permite avançar; backend valida na hora do cadastro
      } finally {
        setIsLoading(false);
      }
      setStep(3);
    } else if (step === 3) {
      setStep(4);
    }
  };

  // ── Envio ─────────────────────────────────────────────────────────────────────
  const handleRegister = async () => {
    setFirebaseError('');
    setIsLoading(true);
    try {
      if (IS_DEV_AUTH) {
        const res = await fetch(`${api.baseUrl}/auth/register`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: email.trim().toLowerCase(), full_name: fullName.trim(), password: 'dev-password' }),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          const msg = err?.detail?.message ?? 'Erro ao criar conta.';
          if (err?.detail?.error === 'email_exists') {
            setFirebaseError('Este email já está cadastrado. Tente fazer login.');
            setStep(1);
          } else {
            setFirebaseError(msg);
          }
          return;
        }
        await setDevToken((await res.json()).access_token);
      } else {
        const credential = await createUserWithEmailAndPassword(
          auth, email.trim().toLowerCase(), password,
        );
        await updateProfile(credential.user, { displayName: fullName.trim() });
        await sendEmailVerification(credential.user).catch(() => {});
      }

      const [dd, mm, yyyy] = birthDate.split('/');

      try {
        await profileService.updateProfile({
          full_name: fullName.trim(),
          birth_date: `${yyyy}-${mm}-${dd}`,
          phone_e164: `+55${phone.replace(/\D/g, '')}`,
          city: city.trim(),
          state: isBrasil ? uf : null,
          country: !isBrasil ? pais : null,        // país de residência p/ não-brasileiros
          cpf: cpf.replace(/\D/g, '') || null,
          rg: rg.trim() || null,
          life_state_item_id: selectedLifeState?.id,
          marital_status_item_id: selectedMarital?.id,
          vocational_reality_item_id: selectedVocational?.id,
          consecration_year: isConsagrado && consecrationYear ? parseInt(consecrationYear) : null,
          spouse_in_community: spouseInCommunity,
          realidade_atual: realidadeAtual.length > 0 ? realidadeAtual : null,
          instagram: instagram.trim() || null,
          dietary_restriction: dietaryRestriction,
          dietary_restriction_notes: dietaryRestriction ? dietaryNotes.trim() || null : null,
          health_insurance: healthInsurance,
          health_insurance_name: healthInsurance ? healthInsuranceName.trim() || null : null,
          accommodation_options: accommodationOptions.length > 0 ? accommodationOptions : null,
          is_from_mission: isFromMission,
          mission_org_unit_id: isFromMission ? missionOrgUnitId : null,
          mission_name: isFromMission && !missionOrgUnitId ? missionName.trim() || null : null,
          despertar_encounter: despertarEncounter || null,
          interested_in_ministry: interestedInMinistry,
          ministry_interest_notes: interestedInMinistry ? ministryNotes.trim() || null : null,
          ministry_sector_ids: interestedInMinistry && selectedSectorIds.length > 0 ? selectedSectorIds : null,
          plays_instrument: playsInstrument,
          instrument_names: playsInstrument && instrumentNames.length > 0 ? instrumentNames : null,
        });

        if (emergencyName.trim() && emergencyPhone.replace(/\D/g, '').length >= 10) {
          await profileService.addEmergencyContact({
            name: emergencyName.trim(),
            phone_e164: `+55${emergencyPhone.replace(/\D/g, '')}`,
            relationship: emergencyRelationship.trim() || 'Não informado',
          });
        }
      } catch (profileErr: any) {
        console.error('[register] perfil:', JSON.stringify(profileErr?.response?.data ?? profileErr?.message ?? profileErr));
        const detail = profileErr?.response?.data?.detail;
        let msg = 'Dados básicos salvos, mas houve um erro em algumas informações. Complete seu perfil depois.';
        if (typeof detail === 'string') msg = detail;
        else if (detail?.message) msg = `Erro: ${detail.message}`;
        else if (Array.isArray(detail) && detail[0]?.msg) msg = `Dado inválido: ${detail[0].msg}`;
        Alert.alert('Atenção', msg, [{ text: 'OK' }]);
      }

      router.replace({ pathname: '/(auth)/verify-email', params: { email: email.trim().toLowerCase(), fromRegister: '1' } });
    } catch (err: unknown) {
      const code = (err as { code?: string }).code ?? '';
      if (code === 'auth/email-already-in-use') { setFirebaseError('Email já cadastrado. Faça login.'); setStep(1); }
      else if (code === 'auth/weak-password') { setFirebaseError('Senha fraca. Use pelo menos 6 caracteres.'); setStep(1); }
      else if (code === 'auth/invalid-email') { setFirebaseError('Email inválido.'); setStep(1); }
      else if (code === 'auth/network-request-failed') setFirebaseError('Sem conexão. Verifique sua internet.');
      else if (code) setFirebaseError(`Erro ao criar conta: ${code}`);
    } finally {
      setIsLoading(false);
    }
  };

  const stepTitles    = ['Criar Conta', 'Localização', 'Dados Vocacionais', 'Informações Extras'];
  const stepSubtitles = [
    'Preencha seus dados para começar',
    'Onde você mora?',
    'Sua realidade na comunidade',
    'Opcional — pode preencher depois no perfil',
  ];

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={colors.primary} />
      <KeyboardAvoidingView style={styles.keyboardView} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>

          {/* ── Header ── */}
          <View style={styles.header}>
            <TouchableOpacity style={styles.backButton} onPress={() => step > 1 ? setStep(step - 1) : router.back()}>
              <Ionicons name="arrow-back" size={24} color={colors.white} />
            </TouchableOpacity>
            <View style={styles.stepIndicator}>
              {[1,2,3,4].map((s, i) => (
                <View key={s} style={styles.stepRow}>
                  <View style={[styles.stepDot, step >= s && styles.stepDotActive]} />
                  {i < 3 && <View style={[styles.stepLine, step > s && styles.stepLineActive]} />}
                </View>
              ))}
            </View>
          </View>

          <View style={styles.logoSection}>
            <Ionicons name="compass-outline" size={56} color={colors.white} />
            <Text style={styles.title}>{stepTitles[step - 1]}</Text>
            <Text style={styles.subtitle}>{stepSubtitles[step - 1]}</Text>
          </View>

          {/* ══════════════════════════════════════════════════════════════════
              PASSO 1 — Conta
          ══════════════════════════════════════════════════════════════════ */}
          {step === 1 && (
            <View style={styles.form}>
              <TextInput style={[styles.input, errors.fullName && styles.inputError]}
                placeholder="Nome completo" value={fullName} placeholderTextColor={colors.gray}
                onChangeText={t => { setFullName(t); setErrors({...errors, fullName: ''}); }}
                autoCapitalize="words" />
              {errors.fullName ? <Text style={styles.errorText}>{errors.fullName}</Text> : null}

              <TextInput style={[styles.input, errors.email && styles.inputError]}
                placeholder="E-mail" value={email} placeholderTextColor={colors.gray}
                onChangeText={t => { setEmail(t); setErrors({...errors, email: ''}); }}
                keyboardType="email-address" autoCapitalize="none" />
              {errors.email ? <Text style={styles.errorText}>{errors.email}</Text> : null}

              <TextInput style={[styles.input, errors.password && styles.inputError]}
                placeholder="Senha (mínimo 6 caracteres)" value={password} placeholderTextColor={colors.gray}
                onChangeText={t => { setPassword(t); setErrors({...errors, password: ''}); }}
                secureTextEntry />
              {errors.password ? <Text style={styles.errorText}>{errors.password}</Text> : null}

              <TextInput style={[styles.input, errors.confirmPassword && styles.inputError]}
                placeholder="Confirmar senha" value={confirmPassword} placeholderTextColor={colors.gray}
                onChangeText={t => { setConfirmPassword(t); setErrors({...errors, confirmPassword: ''}); }}
                secureTextEntry />
              {errors.confirmPassword ? <Text style={styles.errorText}>{errors.confirmPassword}</Text> : null}

              {firebaseError ? <View style={styles.errorBox}><Text style={styles.errorBoxText}>⚠️ {firebaseError}</Text></View> : null}

              <TouchableOpacity style={styles.primaryButton} onPress={handleNext}>
                <Text style={styles.primaryButtonText}>Continuar</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* ══════════════════════════════════════════════════════════════════
              PASSO 2 — Localização + Missão
          ══════════════════════════════════════════════════════════════════ */}
          {step === 2 && (
            <View style={styles.form}>

              {/* País */}
              <Text style={styles.sectionLabel}>📍 Onde você mora?</Text>
              <TouchableOpacity style={[styles.input, styles.selector, errors.pais && styles.inputError]}
                onPress={() => { setPaisSearch(''); setPaisModalVisible(true); }}>
                <Text style={[styles.selectorText, !pais && styles.selectorPlaceholder]}>
                  {pais || 'País'}
                </Text>
                <Ionicons name="chevron-down" size={18} color={colors.gray} />
              </TouchableOpacity>
              {errors.pais ? <Text style={styles.errorText}>{errors.pais}</Text> : null}

              {/* Se Brasil → Estado (BrasilAPI) + Cidade (BrasilAPI) */}
              {isBrasil && (
                <>
                  <TouchableOpacity
                    style={[styles.input, styles.selector, errors.uf && styles.inputError]}
                    onPress={() => setStateModalVisible(true)}>
                    <Text style={[styles.selectorText, !uf && styles.selectorPlaceholder]}>
                      {uf
                        ? `${uf} – ${estados.find(e => e.sigla === uf)?.nome ?? ''}`
                        : 'Estado'}
                    </Text>
                    <Ionicons name="chevron-down" size={18} color={colors.gray} />
                  </TouchableOpacity>
                  {errors.uf ? <Text style={styles.errorText}>{errors.uf}</Text> : null}

                  <TouchableOpacity
                    style={[styles.input, styles.selector, errors.city && styles.inputError, !uf && styles.inputDisabled]}
                    onPress={() => { if (uf) { setCitySearch(''); setCityModalVisible(true); } }}
                    disabled={!uf}>
                    {loadingMunicipios
                      ? <ActivityIndicator size="small" color={colors.gray} style={{ marginRight: 8 }} />
                      : null}
                    <Text style={[styles.selectorText, !city && styles.selectorPlaceholder, { flex: 1 }]}>
                      {city || (uf ? 'Selecione a cidade' : 'Selecione o estado primeiro')}
                    </Text>
                    <Ionicons name="chevron-down" size={18} color={colors.gray} />
                  </TouchableOpacity>
                  {errors.city ? <Text style={styles.errorText}>{errors.city}</Text> : null}
                </>
              )}

              {/* Se outro país → cidade em texto livre */}
              {!isBrasil && pais !== '' && (
                <>
                  <TextInput
                    style={[styles.input, errors.city && styles.inputError]}
                    placeholder="Cidade" value={city} placeholderTextColor={colors.gray}
                    onChangeText={t => { setCity(t); setErrors({...errors, city: ''}); }}
                    autoCapitalize="words" />
                  {errors.city ? <Text style={styles.errorText}>{errors.city}</Text> : null}
                </>
              )}

              {/* Missão */}
              <View style={styles.toggleRow}>
                <Text style={styles.toggleLabel}>Você faz parte de alguma missão da Obra Lumen?</Text>
                <Switch value={isFromMission}
                  onValueChange={v => { setIsFromMission(v); if (!v) { setMissionOrgUnitId(null); setMissionName(''); } }}
                  trackColor={{ false: '#d1d5db', true: `${colors.primary}80` }}
                  thumbColor={isFromMission ? colors.primary : '#9ca3af'} />
              </View>
              {isFromMission && (
                <>
                  {missions.length > 0 && (
                    <TouchableOpacity style={[styles.input, styles.selector]}
                      onPress={() => setMissionModalVisible(true)}>
                      <Text style={[styles.selectorText, !missionOrgUnitId && !missionName && styles.selectorPlaceholder]}>
                        {missionOrgUnitId
                          ? missions.find(m => m.id === missionOrgUnitId)?.name ?? 'Missão selecionada'
                          : missionName || 'Selecione a missão'}
                      </Text>
                      <Ionicons name="chevron-down" size={18} color={colors.gray} />
                    </TouchableOpacity>
                  )}
                  {!missionOrgUnitId && (
                    <TextInput style={styles.input}
                      placeholder="Nome da missão (se não listada acima)" value={missionName}
                      placeholderTextColor={colors.gray}
                      onChangeText={setMissionName} />
                  )}
                </>
              )}

              {/* Dados pessoais */}
              <Text style={styles.sectionLabel}>👤 Dados Pessoais</Text>

              <TextInput style={[styles.input, errors.phone && styles.inputError]}
                placeholder="Telefone (WhatsApp)" value={phone} placeholderTextColor={colors.gray}
                onChangeText={t => { setPhone(formatPhone(t)); setErrors({...errors, phone: ''}); }}
                keyboardType="phone-pad" />
              {errors.phone ? <Text style={styles.errorText}>{errors.phone}</Text> : null}

              <TextInput style={[styles.input, errors.birthDate && styles.inputError]}
                placeholder="Data de nascimento (DD/MM/AAAA)" value={birthDate} placeholderTextColor={colors.gray}
                onChangeText={t => { setBirthDate(formatDate(t)); setErrors({...errors, birthDate: ''}); }}
                keyboardType="numeric" />
              {errors.birthDate ? <Text style={styles.errorText}>{errors.birthDate}</Text> : null}

              <TextInput style={[styles.input, errors.cpf && styles.inputError]}
                placeholder="CPF (000.000.000-00)" value={cpf} placeholderTextColor={colors.gray}
                onChangeText={t => { setCpf(formatCpf(t)); setErrors({...errors, cpf: ''}); }}
                keyboardType="numeric" />
              {errors.cpf ? <Text style={styles.errorText}>{errors.cpf}</Text> : null}

              <TextInput style={[styles.input, errors.rg && styles.inputError]}
                placeholder="RG" value={rg} placeholderTextColor={colors.gray}
                onChangeText={t => { setRg(t); setErrors({...errors, rg: ''}); }}
                autoCapitalize="characters" />
              {errors.rg ? <Text style={styles.errorText}>{errors.rg}</Text> : null}

              <TouchableOpacity style={styles.primaryButton} onPress={handleNext}>
                <Text style={styles.primaryButtonText}>Continuar</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* ══════════════════════════════════════════════════════════════════
              PASSO 3 — Vocacional
          ══════════════════════════════════════════════════════════════════ */}
          {step === 3 && (
            <View style={styles.form}>
              {loadingCatalogs ? (
                <ActivityIndicator color={colors.white} style={{ marginVertical: 24 }} />
              ) : (
                <>
                  <TouchableOpacity style={[styles.input, styles.selector]}
                    onPress={() => openCatalogModal('Estado de Vida', lifeStates, item => { setSelectedLifeState(item); setCatalogModalVisible(false); })}>
                    <Text style={[styles.selectorText, !selectedLifeState && styles.selectorPlaceholder]}>
                      {selectedLifeState?.label || 'Estado de Vida'}
                    </Text>
                    <Ionicons name="chevron-down" size={18} color={colors.gray} />
                  </TouchableOpacity>

                  <TouchableOpacity style={[styles.input, styles.selector]}
                    onPress={() => openCatalogModal('Estado Civil', maritalStatuses, item => {
                      setSelectedMarital(item);
                      if (!['CASADO', 'UNIAO_ESTAVEL'].includes(item.code)) setSpouseInCommunity(null);
                      setCatalogModalVisible(false);
                    })}>
                    <Text style={[styles.selectorText, !selectedMarital && styles.selectorPlaceholder]}>
                      {selectedMarital?.label || 'Estado Civil'}
                    </Text>
                    <Ionicons name="chevron-down" size={18} color={colors.gray} />
                  </TouchableOpacity>

                  {showSpouseField && (
                    <View style={styles.toggleRow}>
                      <Text style={styles.toggleLabel}>Seu cônjuge faz parte da comunidade de vida?</Text>
                      <Switch value={spouseInCommunity ?? false} onValueChange={setSpouseInCommunity}
                        trackColor={{ false: '#d1d5db', true: `${colors.primary}80` }}
                        thumbColor={spouseInCommunity ? colors.primary : '#9ca3af'} />
                    </View>
                  )}

                  <TouchableOpacity style={[styles.input, styles.selector]}
                    onPress={() => openCatalogModal('Realidade Vocacional', vocationalRealities, item => { setSelectedVocational(item); setCatalogModalVisible(false); })}>
                    <Text style={[styles.selectorText, !selectedVocational && styles.selectorPlaceholder]}>
                      {selectedVocational?.label || 'Realidade Vocacional'}
                    </Text>
                    <Ionicons name="chevron-down" size={18} color={colors.gray} />
                  </TouchableOpacity>

                  {isConsagrado && (
                    <TextInput style={styles.input}
                      placeholder="Ano de Consagração (ex: 2020)" value={consecrationYear}
                      placeholderTextColor={colors.gray}
                      onChangeText={setConsecrationYear} keyboardType="numeric" maxLength={4} />
                  )}

                  {realidadeAtualOptions.length > 0 && (
                    <>
                      <Text style={styles.sectionLabel}>Realidade Atual</Text>
                      <Text style={styles.sectionHint}>Selecione todas que se aplicam:</Text>
                      <View style={styles.chipsContainer}>
                        {realidadeAtualOptions.map(opt => {
                          const selected = realidadeAtual.includes(opt.code);
                          return (
                            <TouchableOpacity key={opt.code}
                              style={[styles.chip, selected && styles.chipSelected]}
                              onPress={() => setRealidadeAtual(prev =>
                                selected ? prev.filter(c => c !== opt.code) : [...prev, opt.code])}>
                              <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{opt.label}</Text>
                            </TouchableOpacity>
                          );
                        })}
                      </View>
                    </>
                  )}

                  <View style={styles.toggleRow}>
                    <Text style={styles.toggleLabel}>Tem interesse em servir em algum ministério?</Text>
                    <Switch value={interestedInMinistry}
                      onValueChange={v => { setInterestedInMinistry(v); if (!v) { setSelectedSectorIds([]); setMinistryNotes(''); } }}
                      trackColor={{ false: '#d1d5db', true: `${colors.primary}80` }}
                      thumbColor={interestedInMinistry ? colors.primary : '#9ca3af'} />
                  </View>

                  {interestedInMinistry && sectors.length > 0 && (
                    <>
                      <Text style={styles.sectionHint}>Em quais setores você tem interesse?</Text>
                      <View style={styles.chipsContainer}>
                        {sectors.map(sector => {
                          const selected = selectedSectorIds.includes(sector.id);
                          return (
                            <TouchableOpacity key={sector.id}
                              style={[styles.chip, selected && styles.chipSelected]}
                              onPress={() => setSelectedSectorIds(prev =>
                                selected ? prev.filter(id => id !== sector.id) : [...prev, sector.id])}>
                              <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{sector.name}</Text>
                            </TouchableOpacity>
                          );
                        })}
                      </View>
                    </>
                  )}

                  {interestedInMinistry && (
                    <TextInput style={[styles.input, { height: 80, textAlignVertical: 'top' }]}
                      placeholder="Descreva seu interesse (opcional)" value={ministryNotes}
                      placeholderTextColor={colors.gray}
                      onChangeText={setMinistryNotes} multiline numberOfLines={3} />
                  )}
                </>
              )}

              <Text style={styles.skipNote}>* Campos opcionais. Você pode preencher depois no perfil.</Text>
              <TouchableOpacity style={styles.primaryButton} onPress={handleNext}>
                <Text style={styles.primaryButtonText}>Continuar</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* ══════════════════════════════════════════════════════════════════
              PASSO 4 — Extras
          ══════════════════════════════════════════════════════════════════ */}
          {step === 4 && (
            <View style={styles.form}>
              <Text style={styles.skipNote}>Todos os campos abaixo são opcionais.</Text>

              <TextInput style={styles.input}
                placeholder="Instagram (ex: @usuario)" value={instagram} placeholderTextColor={colors.gray}
                onChangeText={setInstagram} autoCapitalize="none" />

              <View style={styles.toggleRow}>
                <Text style={styles.toggleLabel}>Restrição alimentar?</Text>
                <Switch value={dietaryRestriction}
                  onValueChange={v => { setDietaryRestriction(v); if (!v) setDietaryNotes(''); }}
                  trackColor={{ false: '#d1d5db', true: `${colors.primary}80` }}
                  thumbColor={dietaryRestriction ? colors.primary : '#9ca3af'} />
              </View>
              {dietaryRestriction && (
                <TextInput style={styles.input} placeholder="Quais restrições alimentares?" value={dietaryNotes}
                  placeholderTextColor={colors.gray} onChangeText={setDietaryNotes} />
              )}

              <View style={styles.toggleRow}>
                <Text style={styles.toggleLabel}>Possui plano de saúde?</Text>
                <Switch value={healthInsurance}
                  onValueChange={v => { setHealthInsurance(v); if (!v) setHealthInsuranceName(''); }}
                  trackColor={{ false: '#d1d5db', true: `${colors.primary}80` }}
                  thumbColor={healthInsurance ? colors.primary : '#9ca3af'} />
              </View>
              {healthInsurance && (
                <TextInput style={styles.input} placeholder="Qual plano de saúde?" value={healthInsuranceName}
                  placeholderTextColor={colors.gray} onChangeText={setHealthInsuranceName} />
              )}

              <Text style={styles.sectionLabel}>Disponibilidade de Acomodação em Retiros</Text>
              <Text style={styles.sectionHint}>Selecione todas que você aceita:</Text>
              <View style={styles.chipsContainer}>
                {ACCOMMODATION_OPTS.map(opt => {
                  const selected = accommodationOptions.includes(opt.value);
                  return (
                    <TouchableOpacity key={opt.value}
                      style={[styles.chip, selected && styles.chipSelected]}
                      onPress={() => setAccommodationOptions(prev =>
                        selected ? prev.filter(v => v !== opt.value) : [...prev, opt.value])}>
                      <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{opt.label}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <View style={styles.toggleRow}>
                <Text style={styles.toggleLabel}>Toca algum instrumento ou canta?</Text>
                <Switch value={playsInstrument}
                  onValueChange={v => { setPlaysInstrument(v); if (!v) setInstrumentNames([]); }}
                  trackColor={{ false: '#d1d5db', true: `${colors.primary}80` }}
                  thumbColor={playsInstrument ? colors.primary : '#9ca3af'} />
              </View>
              {playsInstrument && (
                <View style={styles.chipsContainer}>
                  {INSTRUMENTS.map(inst => {
                    const selected = instrumentNames.includes(inst);
                    return (
                      <TouchableOpacity key={inst}
                        style={[styles.chip, selected && styles.chipSelected]}
                        onPress={() => setInstrumentNames(prev =>
                          selected ? prev.filter(i => i !== inst) : [...prev, inst])}>
                        <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{inst}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}

              <TouchableOpacity style={[styles.input, styles.selector]}
                onPress={() => setDespertarModalVisible(true)}>
                <Text style={[styles.selectorText, !despertarEncounter && styles.selectorPlaceholder]}>
                  {despertarEncounter || 'Qual encontro Despertar você fez?'}
                </Text>
                <Ionicons name="chevron-down" size={18} color={colors.gray} />
              </TouchableOpacity>

              <Text style={styles.sectionLabel}>Contato de Emergência</Text>
              <TextInput style={styles.input} placeholder="Nome do contato" value={emergencyName}
                placeholderTextColor={colors.gray} onChangeText={setEmergencyName} autoCapitalize="words" />
              <TextInput style={styles.input} placeholder="Parentesco (ex: Mãe, Pai, Cônjuge)" value={emergencyRelationship}
                placeholderTextColor={colors.gray} onChangeText={setEmergencyRelationship} autoCapitalize="words" />
              <TextInput style={styles.input} placeholder="Telefone do contato" value={emergencyPhone}
                placeholderTextColor={colors.gray}
                onChangeText={t => setEmergencyPhone(formatPhone(t))} keyboardType="phone-pad" />

              {firebaseError ? <View style={styles.errorBox}><Text style={styles.errorBoxText}>⚠️ {firebaseError}</Text></View> : null}

              <TouchableOpacity style={[styles.primaryButton, isLoading && styles.buttonDisabled]}
                onPress={handleRegister} disabled={isLoading}>
                {isLoading
                  ? <ActivityIndicator color={colors.white} />
                  : <Text style={styles.primaryButtonText}>Criar Conta</Text>}
              </TouchableOpacity>
            </View>
          )}

          <View style={styles.footer}>
            <Text style={styles.footerText}>Já tem uma conta? </Text>
            <TouchableOpacity onPress={() => router.push('/(auth)/login')}>
              <Text style={styles.footerLink}>Entrar</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* ─── Modal: País ─────────────────────────────────────────────────────── */}
      <Modal visible={paisModalVisible} animationType="slide" transparent onRequestClose={() => setPaisModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>País</Text>
              <TouchableOpacity onPress={() => setPaisModalVisible(false)}>
                <Ionicons name="close" size={24} color={colors.gray} />
              </TouchableOpacity>
            </View>
            <TextInput style={styles.modalSearch} placeholder="Buscar país..." value={paisSearch}
              onChangeText={setPaisSearch} autoFocus placeholderTextColor={colors.gray} />
            <FlatList
              data={filteredPaises}
              keyExtractor={item => item}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[styles.modalItem, pais === item && styles.modalItemSelected]}
                  onPress={() => {
                    setPais(item);
                    setErrors({...errors, pais: ''});
                    // Resetar campos de localização ao trocar país
                    setUf(''); setCity(''); setMunicipios([]);
                    setPaisModalVisible(false);
                  }}>
                  <Text style={[styles.modalItemText, pais === item && styles.modalItemTextSelected]}>
                    {item === 'Brasil' ? '🇧🇷 Brasil' : item}
                  </Text>
                  {pais === item && <Ionicons name="checkmark" size={20} color={colors.primary} />}
                </TouchableOpacity>
              )}
              ListEmptyComponent={<Text style={styles.modalEmpty}>Nenhum país encontrado</Text>}
            />
          </View>
        </View>
      </Modal>

      {/* ─── Modal: Estado (BrasilAPI) ───────────────────────────────────────── */}
      <Modal visible={stateModalVisible} animationType="slide" transparent onRequestClose={() => setStateModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Estado</Text>
              <TouchableOpacity onPress={() => setStateModalVisible(false)}>
                <Ionicons name="close" size={24} color={colors.gray} />
              </TouchableOpacity>
            </View>
            <FlatList
              data={estados}
              keyExtractor={item => item.sigla}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[styles.modalItem, uf === item.sigla && styles.modalItemSelected]}
                  onPress={() => {
                    setUf(item.sigla); setCity(''); setCitySearch('');
                    setErrors({...errors, uf: '', city: ''});
                    setStateModalVisible(false);
                    loadMunicipios(item.sigla);
                  }}>
                  <Text style={[styles.modalItemText, uf === item.sigla && styles.modalItemTextSelected]}>
                    {item.sigla} – {item.nome}
                  </Text>
                  {uf === item.sigla && <Ionicons name="checkmark" size={20} color={colors.primary} />}
                </TouchableOpacity>
              )}
            />
          </View>
        </View>
      </Modal>

      {/* ─── Modal: Cidade (BrasilAPI) ───────────────────────────────────────── */}
      <Modal visible={cityModalVisible} animationType="slide" transparent onRequestClose={() => { setCityModalVisible(false); setCitySearch(''); }}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Cidade</Text>
              <TouchableOpacity onPress={() => { setCityModalVisible(false); setCitySearch(''); }}>
                <Ionicons name="close" size={24} color={colors.gray} />
              </TouchableOpacity>
            </View>
            <TextInput style={styles.modalSearch} placeholder="Buscar cidade..." value={citySearch}
              onChangeText={setCitySearch} autoFocus placeholderTextColor={colors.gray} />
            <FlatList
              data={filteredMunicipios}
              keyExtractor={item => item.nome}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[styles.modalItem, city === item.nome && styles.modalItemSelected]}
                  onPress={() => {
                    setCity(item.nome);
                    setErrors({...errors, city: ''});
                    setCityModalVisible(false); setCitySearch('');
                  }}>
                  <Text style={[styles.modalItemText, city === item.nome && styles.modalItemTextSelected]}>
                    {item.nome}
                  </Text>
                  {city === item.nome && <Ionicons name="checkmark" size={20} color={colors.primary} />}
                </TouchableOpacity>
              )}
              ListEmptyComponent={<Text style={styles.modalEmpty}>Nenhuma cidade encontrada</Text>}
            />
          </View>
        </View>
      </Modal>

      {/* ─── Modal: Missão ───────────────────────────────────────────────────── */}
      <Modal visible={missionModalVisible} animationType="slide" transparent onRequestClose={() => setMissionModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Selecione a Missão</Text>
              <TouchableOpacity onPress={() => setMissionModalVisible(false)}>
                <Ionicons name="close" size={24} color={colors.gray} />
              </TouchableOpacity>
            </View>
            <FlatList
              data={[...missions, { id: 'OUTROS', name: 'Outros' }]}
              keyExtractor={item => item.id}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[styles.modalItem, missionOrgUnitId === item.id && styles.modalItemSelected]}
                  onPress={() => {
                    if (item.id === 'OUTROS') { setMissionOrgUnitId(null); }
                    else { setMissionOrgUnitId(item.id); setMissionName(''); }
                    setMissionModalVisible(false);
                  }}>
                  <Text style={[styles.modalItemText, missionOrgUnitId === item.id && styles.modalItemTextSelected]}>
                    {item.name}
                  </Text>
                  {missionOrgUnitId === item.id && <Ionicons name="checkmark" size={20} color={colors.primary} />}
                </TouchableOpacity>
              )}
            />
          </View>
        </View>
      </Modal>

      {/* ─── Modal: Encontro Despertar ───────────────────────────────────────── */}
      <Modal visible={despertarModalVisible} animationType="slide" transparent onRequestClose={() => setDespertarModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Encontro Despertar</Text>
              <TouchableOpacity onPress={() => setDespertarModalVisible(false)}>
                <Ionicons name="close" size={24} color={colors.gray} />
              </TouchableOpacity>
            </View>
            <FlatList data={DESPERTAR_ENCOUNTERS} keyExtractor={item => item}
              renderItem={({ item }) => (
                <TouchableOpacity style={[styles.modalItem, despertarEncounter === item && styles.modalItemSelected]}
                  onPress={() => { setDespertarEncounter(item); setDespertarModalVisible(false); }}>
                  <Text style={[styles.modalItemText, despertarEncounter === item && styles.modalItemTextSelected]}>{item}</Text>
                  {despertarEncounter === item && <Ionicons name="checkmark" size={20} color={colors.primary} />}
                </TouchableOpacity>
              )} />
          </View>
        </View>
      </Modal>

      {/* ─── Modal: Seletor de Catálogo ──────────────────────────────────────── */}
      <Modal visible={catalogModalVisible} animationType="slide" transparent onRequestClose={() => setCatalogModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{catalogModalTitle}</Text>
              <TouchableOpacity onPress={() => setCatalogModalVisible(false)}>
                <Ionicons name="close" size={24} color={colors.gray} />
              </TouchableOpacity>
            </View>
            <FlatList data={catalogModalOptions} keyExtractor={item => item.id}
              renderItem={({ item }) => {
                const isSelected =
                  (catalogModalTitle === 'Estado de Vida' && selectedLifeState?.id === item.id) ||
                  (catalogModalTitle === 'Estado Civil' && selectedMarital?.id === item.id) ||
                  (catalogModalTitle === 'Realidade Vocacional' && selectedVocational?.id === item.id);
                return (
                  <TouchableOpacity style={[styles.modalItem, isSelected && styles.modalItemSelected]}
                    onPress={() => catalogModalOnSelect(item)}>
                    <Text style={[styles.modalItemText, isSelected && styles.modalItemTextSelected]}>{item.label}</Text>
                    {isSelected && <Ionicons name="checkmark" size={20} color={colors.primary} />}
                  </TouchableOpacity>
                );
              }} />
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.primary },
  keyboardView: { flex: 1 },
  scrollContent: { flexGrow: 1, paddingHorizontal: 28, paddingTop: 50, paddingBottom: 40 },
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: 20 },
  backButton: { padding: 8, marginLeft: -8 },
  stepIndicator: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingRight: 32 },
  stepRow: { flexDirection: 'row', alignItems: 'center' },
  stepDot: { width: 12, height: 12, borderRadius: 6, backgroundColor: 'rgba(255,255,255,0.3)' },
  stepDotActive: { backgroundColor: colors.white },
  stepLine: { width: 32, height: 2, backgroundColor: 'rgba(255,255,255,0.3)', marginHorizontal: 6 },
  stepLineActive: { backgroundColor: colors.white },
  logoSection: { alignItems: 'center', marginBottom: 28, gap: 8 },
  title: { fontSize: 26, fontWeight: 'bold', color: colors.white },
  subtitle: { fontSize: 15, color: colors.white, opacity: 0.85, textAlign: 'center' },
  form: { flex: 1 },
  input: {
    backgroundColor: colors.inputBg, borderRadius: 25,
    paddingHorizontal: 20, paddingVertical: 14,
    fontSize: 16, marginBottom: 12, color: '#333',
  },
  inputError: { borderWidth: 2, borderColor: colors.error, marginBottom: 4 },
  inputDisabled: { opacity: 0.5 },
  selector: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  selectorText: { fontSize: 16, color: '#333', flex: 1 },
  selectorPlaceholder: { color: colors.gray },
  errorText: { color: '#fecaca', fontSize: 13, marginBottom: 10, marginLeft: 16 },
  skipNote: { color: 'rgba(255,255,255,0.7)', fontSize: 12, textAlign: 'center', marginBottom: 12, marginTop: 4 },
  errorBox: { backgroundColor: '#FEE2E2', borderRadius: 8, padding: 12, marginBottom: 12, borderWidth: 1, borderColor: '#FECACA' },
  errorBoxText: { color: '#B91C1C', fontSize: 13, textAlign: 'center' },
  primaryButton: {
    backgroundColor: colors.orange, borderRadius: 25, paddingVertical: 16,
    alignItems: 'center', marginTop: 16,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.2, shadowRadius: 4, elevation: 3,
  },
  buttonDisabled: { opacity: 0.6 },
  primaryButtonText: { color: colors.white, fontSize: 18, fontWeight: '600' },
  footer: { flexDirection: 'row', justifyContent: 'center', paddingTop: 20 },
  footerText: { fontSize: 14, color: colors.white },
  footerLink: { fontSize: 14, color: colors.white, fontWeight: 'bold', textDecorationLine: 'underline' },
  toggleRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: 'rgba(255,255,255,0.9)', borderRadius: 25,
    paddingHorizontal: 20, paddingVertical: 12, marginBottom: 12,
  },
  toggleLabel: { fontSize: 15, color: '#333', flex: 1, marginRight: 8 },
  sectionLabel: {
    fontSize: 13, fontWeight: '600', color: colors.white,
    marginBottom: 4, marginTop: 8, marginLeft: 4, opacity: 0.9,
  },
  sectionHint: { fontSize: 12, color: 'rgba(255,255,255,0.7)', marginBottom: 8, marginLeft: 4 },
  chipsContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  chip: {
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.15)', borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.4)',
  },
  chipSelected: { backgroundColor: colors.primary, borderColor: colors.white },
  chipText: { fontSize: 13, color: colors.white, fontWeight: '500' },
  chipTextSelected: { color: colors.white, fontWeight: '700' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: colors.white, borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: '70%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: '#e5e5e5' },
  modalTitle: { fontSize: 18, fontWeight: '600', color: '#171717' },
  modalSearch: {
    margin: 12, padding: 12, backgroundColor: '#f3f4f6',
    borderRadius: 10, fontSize: 15, color: '#171717',
  },
  modalItem: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 14, paddingHorizontal: 20, borderBottomWidth: 1, borderBottomColor: '#f3f4f6' },
  modalItemSelected: { backgroundColor: 'rgba(26,133,155,0.08)' },
  modalItemText: { fontSize: 16, color: '#171717' },
  modalItemTextSelected: { color: colors.primary, fontWeight: '600' },
  modalEmpty: { textAlign: 'center', padding: 24, color: colors.gray, fontSize: 15 },
});
