/**
 * Projeto de Vida — Desbloqueio por PIN
 * =======================================
 * Recebe projetoId via params. Verifica PIN no backend.
 * Em caso de sucesso, navega para /vida/ciclo.
 */

import { useState, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  ActivityIndicator, TextInput,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import type { IoniconsName } from '@/types/icons';
import projetoVidaMensalApi from '@/services/projetoVidaMensal';

const colors = {
  primary: '#1A859B', primaryLight: '#E8F4F7',
  white: '#ffffff', gray: '#6b7280',
  dark: '#171717', border: '#e5e7eb', error: '#ef4444',
};

export default function UnlockScreen() {
  const { projetoId } = useLocalSearchParams<{ projetoId: string }>();
  const [pin, setPin] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<TextInput>(null);

  const handleVerify = async () => {
    if (pin.length < 4) {
      setError('Digite os 4 dígitos do PIN.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const result = await projetoVidaMensalApi.verificarPin(projetoId, pin);
      if (result.valid) {
        router.replace({ pathname: '/vida/ciclo', params: { projetoId } });
      } else {
        setError('PIN incorreto. Tente novamente.');
        setPin('');
        inputRef.current?.focus();
      }
    } catch {
      setError('Erro ao verificar PIN. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <View style={styles.iconWrap}>
          <Ionicons name={'lock-closed' as IoniconsName} size={32} color={colors.primary} />
        </View>
        <Text style={styles.title}>Projeto protegido</Text>
        <Text style={styles.subtitle}>Digite o PIN de 4 dígitos para acessar.</Text>

        {/* Exibição dos dots */}
        <View style={styles.dotsRow}>
          {[0, 1, 2, 3].map(i => (
            <View key={i} style={[styles.dot, i < pin.length && styles.dotFilled]} />
          ))}
        </View>

        {/* Input oculto que recebe o PIN */}
        <TextInput
          ref={inputRef}
          style={styles.hiddenInput}
          value={pin}
          onChangeText={v => { setPin(v.replace(/\D/g, '').slice(0, 4)); setError(null); }}
          keyboardType="numeric"
          secureTextEntry
          maxLength={4}
          autoFocus
          onSubmitEditing={handleVerify}
        />

        {error && <Text style={styles.errorText}>{error}</Text>}

        <TouchableOpacity style={styles.btn} onPress={handleVerify} disabled={loading} activeOpacity={0.8}>
          {loading
            ? <ActivityIndicator color={colors.white} />
            : <Text style={styles.btnText}>Desbloquear</Text>
          }
        </TouchableOpacity>

        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Text style={styles.backBtnText}>Voltar</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9fafb', justifyContent: 'center', alignItems: 'center', padding: 24 },
  card: { backgroundColor: colors.white, borderRadius: 20, padding: 32, width: '100%', maxWidth: 360, alignItems: 'center', borderWidth: 1, borderColor: colors.border, shadowColor: '#000', shadowOpacity: 0.07, shadowRadius: 12, elevation: 4 },
  iconWrap: { width: 72, height: 72, borderRadius: 20, backgroundColor: colors.primaryLight, justifyContent: 'center', alignItems: 'center', marginBottom: 16 },
  title: { fontSize: 20, fontWeight: '700', color: colors.dark, marginBottom: 6 },
  subtitle: { fontSize: 14, color: colors.gray, textAlign: 'center', marginBottom: 24 },
  dotsRow: { flexDirection: 'row', gap: 16, marginBottom: 8 },
  dot: { width: 18, height: 18, borderRadius: 9, borderWidth: 2, borderColor: colors.border, backgroundColor: colors.white },
  dotFilled: { backgroundColor: colors.primary, borderColor: colors.primary },
  hiddenInput: { position: 'absolute', opacity: 0, height: 1, width: 1 },
  errorText: { color: colors.error, fontSize: 14, marginBottom: 16, textAlign: 'center' },
  btn: { backgroundColor: colors.primary, borderRadius: 12, paddingVertical: 14, paddingHorizontal: 40, marginTop: 8, marginBottom: 8, width: '100%', alignItems: 'center' },
  btnText: { color: colors.white, fontSize: 16, fontWeight: '700' },
  backBtn: { padding: 12 },
  backBtnText: { color: colors.gray, fontSize: 14 },
});
