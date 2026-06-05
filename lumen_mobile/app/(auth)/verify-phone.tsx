/**
 * Verify Phone Screen
 * ===================
 * Tela de verificação de telefone via WhatsApp ou SMS.
 */

import { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import api from '@/services/api';
import { useTheme } from '@/theme';
import type { SemanticTokens } from '@/theme';

export default function VerifyPhoneScreen() {
  const { t } = useTheme();
  const styles = makeStyles(t);

  const params = useLocalSearchParams<{ phone: string; method: string; fullName: string }>();
  const [code, setCode] = useState(['', '', '', '', '', '']);
  const [isLoading, setIsLoading] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [verificationId, setVerificationId] = useState<string | null>(null);
  const [countdown, setCountdown] = useState(0);
  const [error, setError] = useState('');

  const inputRefs = useRef<(TextInput | null)[]>([]);

  useEffect(() => {
    // Envia código automaticamente ao entrar na tela
    sendVerificationCode();
  }, []);

  useEffect(() => {
    // Countdown para reenviar
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [countdown]);

  const sendVerificationCode = async () => {
    if (isSending || countdown > 0) return;

    try {
      setIsSending(true);
      setError('');

      const response = await api.post<{ verification_id: string; debug_code?: string }>(
        '/verify/phone/start',
        {
          phone_e164: params.phone,
          channel: params.method || 'WHATSAPP',
        }
      );

      setVerificationId(response.verification_id);
      setCountdown(60);

      // DEV mode: mostra código
      if (response.debug_code) {
        Alert.alert('DEV Mode', `Código: ${response.debug_code}`);
      }
    } catch (err: any) {
      const message = err.response?.data?.detail?.message || 'Erro ao enviar código';
      setError(message);
    } finally {
      setIsSending(false);
    }
  };

  const handleCodeChange = (index: number, value: string) => {
    if (value.length > 1) {
      // Colou um código completo
      const digits = value.replace(/\D/g, '').slice(0, 6);
      const newCode = [...code];
      for (let i = 0; i < 6; i++) {
        newCode[i] = digits[i] || '';
      }
      setCode(newCode);
      if (digits.length === 6) {
        inputRefs.current[5]?.blur();
        verifyCode(newCode.join(''));
      }
      return;
    }

    const newCode = [...code];
    newCode[index] = value;
    setCode(newCode);
    setError('');

    // Move para próximo input
    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }

    // Verifica automaticamente quando completo
    if (value && index === 5) {
      const fullCode = newCode.join('');
      if (fullCode.length === 6) {
        verifyCode(fullCode);
      }
    }
  };

  const handleKeyPress = (index: number, key: string) => {
    if (key === 'Backspace' && !code[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const verifyCode = async (fullCode: string) => {
    if (!verificationId) {
      setError('Envie o código primeiro');
      return;
    }

    try {
      setIsLoading(true);
      setError('');

      await api.post('/verify/phone/confirm', {
        verification_id: verificationId,
        code: fullCode,
      });

      // Sucesso! Navega para completar perfil
      Alert.alert('Sucesso!', 'Telefone verificado com sucesso!', [
        {
          text: 'Continuar',
          onPress: () =>
            router.replace({
              pathname: '/(onboarding)/profile',
              params: { fullName: params.fullName || '', phone: params.phone || '' },
            }),
        },
      ]);
    } catch (err: any) {
      const message = err.response?.data?.detail?.message || 'Código inválido';
      setError(message);
      setCode(['', '', '', '', '', '']);
      inputRefs.current[0]?.focus();
    } finally {
      setIsLoading(false);
    }
  };

  const formatPhone = (phone: string) => {
    if (!phone) return '';
    const digits = phone.replace(/\D/g, '');
    if (digits.startsWith('55') && digits.length >= 12) {
      const ddd = digits.slice(2, 4);
      const number = digits.slice(4);
      if (number.length === 9) {
        return `(${ddd}) ${number.slice(0, 5)}-${number.slice(5)}`;
      }
      return `(${ddd}) ${number.slice(0, 4)}-${number.slice(4)}`;
    }
    return phone;
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={styles.content}>
        {/* Header */}
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Text style={styles.backButtonText}>← Voltar</Text>
        </TouchableOpacity>

        {/* Icon */}
        <View style={styles.iconContainer}>
          <Text style={styles.icon}>📱</Text>
        </View>

        <Text style={styles.title}>Verificar Telefone</Text>
        <Text style={styles.subtitle}>
          Enviamos um código de 6 dígitos para{'\n'}
          <Text style={styles.phone}>{formatPhone(params.phone || '')}</Text>
          {'\n'}via {params.method === 'SMS' ? 'SMS' : 'WhatsApp'}
        </Text>

        {/* Code inputs */}
        <View style={styles.codeContainer}>
          {code.map((digit, index) => (
            <TextInput
              key={index}
              ref={(ref) => (inputRefs.current[index] = ref)}
              style={[
                styles.codeInput,
                digit ? styles.codeInputFilled : null,
                error ? styles.codeInputError : null,
              ]}
              value={digit}
              onChangeText={(value) => handleCodeChange(index, value)}
              onKeyPress={({ nativeEvent }) => handleKeyPress(index, nativeEvent.key)}
              keyboardType="number-pad"
              maxLength={1}
              selectTextOnFocus
            />
          ))}
        </View>

        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        {isLoading && (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={t.brand.primary} />
            <Text style={styles.loadingText}>Verificando...</Text>
          </View>
        )}

        {/* Resend */}
        <View style={styles.resendContainer}>
          {countdown > 0 ? (
            <Text style={styles.countdownText}>
              Reenviar código em {countdown}s
            </Text>
          ) : (
            <TouchableOpacity onPress={sendVerificationCode} disabled={isSending}>
              <Text style={styles.resendText}>
                {isSending ? 'Enviando...' : 'Reenviar código'}
              </Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Change method */}
        <TouchableOpacity
          style={styles.changeMethodButton}
          onPress={() => router.back()}
        >
          <Text style={styles.changeMethodText}>
            Usar outro número ou método
          </Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const makeStyles = (t: SemanticTokens) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: t.bg.screen,
  },
  content: {
    flex: 1,
    padding: 24,
    paddingTop: 60,
  },
  backButton: {
    marginBottom: 32,
  },
  backButtonText: {
    fontSize: 16,
    color: t.text.primary,
    fontWeight: '500',
  },
  iconContainer: {
    alignItems: 'center',
    marginBottom: 24,
  },
  icon: {
    fontSize: 64,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: t.text.primary,
    textAlign: 'center',
    marginBottom: 12,
  },
  subtitle: {
    fontSize: 16,
    color: t.text.secondary,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 32,
  },
  phone: {
    fontWeight: '600',
    color: t.text.primary,
  },
  codeContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 24,
  },
  codeInput: {
    width: 48,
    height: 56,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: t.border.subtle,
    backgroundColor: t.bg.surface,
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    color: t.text.primary,
  },
  codeInputFilled: {
    borderColor: t.brand.primary,
    backgroundColor: t.bg.elevated,
  },
  codeInputError: {
    borderColor: t.status.error,
    backgroundColor: t.status.errorBg,
  },
  errorText: {
    color: t.status.error,
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 16,
  },
  loadingContainer: {
    alignItems: 'center',
    marginVertical: 24,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: t.text.secondary,
  },
  resendContainer: {
    alignItems: 'center',
    marginTop: 32,
  },
  countdownText: {
    fontSize: 14,
    color: t.text.secondary,
  },
  resendText: {
    fontSize: 16,
    color: t.brand.primary,
    fontWeight: '600',
  },
  changeMethodButton: {
    alignItems: 'center',
    marginTop: 24,
  },
  changeMethodText: {
    fontSize: 14,
    color: t.text.secondary,
    textDecorationLine: 'underline',
  },
});
