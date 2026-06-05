/**
 * Complete Documents Screen
 * =========================
 * Tela para usuários existentes que ainda não preencheram CPF e RG.
 * Exibida automaticamente ao entrar no app se has_documents === false.
 */

import { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { profileService } from '@/services';
import { useTheme } from '@/theme';
import type { SemanticTokens } from '@/theme';

export default function CompleteDocumentsScreen() {
  const { t } = useTheme();
  const styles = makeStyles(t);

  const [cpf, setCpf] = useState('');
  const [rg, setRg] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saveError, setSaveError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const formatCpf = (v: string) => {
    const d = v.replace(/\D/g, '').slice(0, 11);
    if (d.length <= 3) return d;
    if (d.length <= 6) return `${d.slice(0,3)}.${d.slice(3)}`;
    if (d.length <= 9) return `${d.slice(0,3)}.${d.slice(3,6)}.${d.slice(6)}`;
    return `${d.slice(0,3)}.${d.slice(3,6)}.${d.slice(6,9)}-${d.slice(9)}`;
  };

  const validate = () => {
    const e: Record<string, string> = {};
    if (cpf.replace(/\D/g, '').length !== 11) e.cpf = 'CPF deve ter 11 dígitos';
    if (!rg.trim()) e.rg = 'RG obrigatório';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSave = async () => {
    setSaveError('');
    if (!validate()) return;

    setIsLoading(true);
    try {
      // Busca perfil atual para não perder outros campos obrigatórios
      const current = await profileService.getProfile();

      // Se o perfil básico não foi preenchido (cadastro incompleto),
      // redireciona para o formulário completo em vez de falhar com 422
      if (!current.full_name || !current.birth_date || !current.phone_e164 || !current.city || !current.state) {
        router.replace('/(onboarding)/profile');
        return;
      }

      await profileService.updateProfile({
        full_name: current.full_name,
        birth_date: current.birth_date,
        phone_e164: current.phone_e164,
        city: current.city,
        state: current.state,
        cpf: cpf.replace(/\D/g, ''),
        rg: rg.trim(),
        life_state_item_id: current.life_state_item_id ?? undefined,
        marital_status_item_id: current.marital_status_item_id ?? undefined,
        vocational_reality_item_id: current.vocational_reality_item_id ?? undefined,
      });

      router.replace('/(tabs)/home');
    } catch (err: any) {
      const detail = err?.response?.data?.detail;
      let msg = 'Não foi possível salvar. Tente novamente.';
      if (typeof detail === 'string') msg = detail;
      else if (detail?.message) msg = detail.message;
      else if (Array.isArray(detail) && detail[0]?.msg) msg = `Dado inválido: ${detail[0].msg}`;
      setSaveError(msg);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>

        {/* Ícone */}
        <View style={styles.iconContainer}>
          <Ionicons name="id-card-outline" size={64} color={t.brand.primary} />
        </View>

        {/* Título */}
        <Text style={styles.title}>Complete seu cadastro</Text>
        <Text style={styles.subtitle}>
          Precisamos do seu CPF e RG para participação em retiros e eventos da comunidade.
        </Text>

        {/* Campos */}
        <View style={styles.form}>
          <Text style={styles.label}>CPF</Text>
          <TextInput
            style={[styles.input, errors.cpf ? styles.inputError : null]}
            placeholder="000.000.000-00"
            value={cpf}
            placeholderTextColor={t.text.tertiary}
            onChangeText={v => { setCpf(formatCpf(v)); setErrors({ ...errors, cpf: '' }); }}
            keyboardType="numeric"
          />
          {errors.cpf ? <Text style={styles.errorText}>{errors.cpf}</Text> : null}

          <Text style={styles.label}>RG</Text>
          <TextInput
            style={[styles.input, errors.rg ? styles.inputError : null]}
            placeholder="Número do RG"
            value={rg}
            placeholderTextColor={t.text.tertiary}
            onChangeText={v => { setRg(v); setErrors({ ...errors, rg: '' }); }}
            autoCapitalize="characters"
          />
          {errors.rg ? <Text style={styles.errorText}>{errors.rg}</Text> : null}

          {saveError ? (
            <View style={styles.errorBox}>
              <Text style={styles.errorBoxText}>⚠️ {saveError}</Text>
            </View>
          ) : null}

          <TouchableOpacity
            style={[styles.primaryButton, isLoading && styles.buttonDisabled]}
            onPress={handleSave}
            disabled={isLoading}
          >
            {isLoading
              ? <ActivityIndicator color={t.text.inverse} />
              : <Text style={styles.primaryButtonText}>Salvar e continuar</Text>
            }
          </TouchableOpacity>

          <TouchableOpacity style={styles.skipButton} onPress={() => router.replace('/(tabs)/home')}>
            <Text style={styles.skipText}>Preencher mais tarde</Text>
          </TouchableOpacity>
        </View>

      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const makeStyles = (t: SemanticTokens) => StyleSheet.create({
  container: { flex: 1, backgroundColor: t.bg.screen },
  scrollContent: { flexGrow: 1, padding: 28, paddingTop: 60 },

  iconContainer: {
    width: 120, height: 120, borderRadius: 60,
    backgroundColor: t.brand.primaryDim,
    alignItems: 'center', justifyContent: 'center',
    alignSelf: 'center', marginBottom: 24,
  },
  title: { fontSize: 24, fontWeight: '700', color: t.text.primary, textAlign: 'center', marginBottom: 12 },
  subtitle: { fontSize: 15, color: t.text.secondary, textAlign: 'center', lineHeight: 22, marginBottom: 32 },

  form: { flex: 1 },
  label: { fontSize: 13, fontWeight: '600', color: t.text.primary, marginBottom: 6, marginLeft: 4 },
  input: {
    backgroundColor: t.bg.surface,
    borderRadius: 12,
    paddingHorizontal: 16, paddingVertical: 14,
    fontSize: 16, marginBottom: 6, color: t.text.primary,
    borderWidth: 1, borderColor: t.border.subtle,
  },
  inputError: { borderColor: t.status.error, borderWidth: 1.5 },
  errorText: { color: t.status.error, fontSize: 13, marginBottom: 12, marginLeft: 4 },

  errorBox: {
    backgroundColor: t.status.errorBg, borderRadius: 8, padding: 12,
    marginBottom: 12, borderWidth: 1, borderColor: t.status.error,
  },
  errorBoxText: { color: t.status.error, fontSize: 13, textAlign: 'center' },

  primaryButton: {
    backgroundColor: t.brand.primary, borderRadius: 12, paddingVertical: 16,
    alignItems: 'center', marginTop: 16,
  },
  buttonDisabled: { opacity: 0.6 },
  primaryButtonText: { color: t.text.inverse, fontSize: 16, fontWeight: '600' },

  skipButton: { alignItems: 'center', marginTop: 16, padding: 8 },
  skipText: { fontSize: 14, color: t.text.secondary, textDecorationLine: 'underline' },
});
