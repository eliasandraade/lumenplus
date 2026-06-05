/**
 * Projeto de Vida — Desbloqueio por PIN
 * Lógica intacta. Redesign "Caderno de Oração".
 */

import { useState, useRef } from 'react';
import {
  View, Text, TouchableOpacity,
  ActivityIndicator, TextInput, StyleSheet,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import type { IoniconsName } from '@/types/icons';
import projetoVidaMensalApi from '@/services/projetoVidaMensal';
import { useTheme } from '@/theme';

export default function UnlockScreen() {
  const { t, r } = useTheme();
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
    <View style={[styles.container, { backgroundColor: t.bg.screen }]}>
      <View
        style={[
          styles.card,
          {
            backgroundColor: t.bg.elevated,
            borderColor: t.border.subtle,
            ...t.shadow.md,
          },
        ]}
      >
        {/* Halo + ícone */}
        <View style={[styles.iconHalo, { backgroundColor: t.brand.primaryDim }]}>
          <Ionicons
            name={'lock-closed' as IoniconsName}
            size={28}
            color={t.brand.primary}
          />
        </View>

        <Text style={[styles.title, { color: t.text.primary }]}>
          Projeto protegido
        </Text>
        <Text style={[styles.subtitle, { color: t.text.secondary }]}>
          Este ciclo está protegido por você.{'\n'}Digite seu PIN para continuar.
        </Text>

        {/* Dots */}
        <View style={styles.dotsRow}>
          {[0, 1, 2, 3].map(i => (
            <View
              key={i}
              style={[
                styles.dot,
                {
                  borderColor: i < pin.length ? t.brand.primary : t.border.default,
                  backgroundColor: i < pin.length ? t.brand.primary : 'transparent',
                },
              ]}
            />
          ))}
        </View>

        {/* Input oculto */}
        <TextInput
          ref={inputRef}
          style={styles.hiddenInput}
          value={pin}
          onChangeText={v => {
            setPin(v.replace(/\D/g, '').slice(0, 4));
            setError(null);
          }}
          keyboardType="numeric"
          secureTextEntry
          maxLength={4}
          autoFocus
          onSubmitEditing={handleVerify}
          accessibilityLabel="Campo PIN de 4 dígitos"
        />

        {/* Erro com ícone */}
        {error ? (
          <View style={styles.errorRow}>
            <Ionicons name={'alert-circle' as IoniconsName} size={15} color={t.status.error} />
            <Text style={[styles.errorText, { color: t.status.error }]}>{error}</Text>
          </View>
        ) : null}

        <TouchableOpacity
          style={[
            styles.btn,
            { backgroundColor: t.brand.primary, borderRadius: r.lg },
            loading && { opacity: 0.6 },
          ]}
          onPress={handleVerify}
          disabled={loading}
          activeOpacity={0.8}
          accessibilityLabel="Desbloquear projeto"
          accessibilityRole="button"
        >
          {loading
            ? <ActivityIndicator color="#ffffff" />
            : <Text style={styles.btnText}>Desbloquear</Text>
          }
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => router.back()}
          accessibilityLabel="Voltar"
        >
          <Text style={[styles.backBtnText, { color: t.text.tertiary }]}>Voltar</Text>
        </TouchableOpacity>

        {/* Privacidade */}
        <View style={[styles.privacyRow, { borderTopColor: t.border.subtle }]}>
          <Ionicons
            name={'shield-checkmark-outline' as IoniconsName}
            size={13}
            color={t.brand.primary}
          />
          <Text style={[styles.privacyText, { color: t.text.tertiary }]}>
            Tudo o que você escreve é seu. A Equipe Lumen+ não acessa o conteúdo.
          </Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  card: {
    borderRadius: 24,
    padding: 32,
    width: '100%',
    maxWidth: 360,
    alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth,
  },
  iconHalo: {
    width: 72,
    height: 72,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 20,
    fontFamily: 'Nunito-Bold',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    fontFamily: 'Nunito-Regular',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 28,
  },
  dotsRow: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 12,
  },
  dot: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
  },
  hiddenInput: {
    position: 'absolute',
    opacity: 0,
    height: 1,
    width: 1,
  },
  errorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 16,
    marginTop: 4,
  },
  errorText: {
    fontSize: 13,
    fontFamily: 'Nunito-Regular',
  },
  btn: {
    minHeight: 52,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
    marginBottom: 8,
  },
  btnText: {
    color: '#ffffff',
    fontSize: 16,
    fontFamily: 'Nunito-Bold',
  },
  backBtn: {
    padding: 12,
  },
  backBtnText: {
    fontSize: 14,
    fontFamily: 'Nunito-Regular',
  },
  privacyRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    marginTop: 20,
    paddingTop: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
    width: '100%',
  },
  privacyText: {
    flex: 1,
    fontSize: 11,
    fontFamily: 'Nunito-Regular',
    lineHeight: 16,
  },
});
