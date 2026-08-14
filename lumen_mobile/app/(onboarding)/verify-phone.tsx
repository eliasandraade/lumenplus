/**
 * Verify Phone Screen
 * ===================
 * Verificação de telefone via SMS/WhatsApp.
 */

import { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
} from 'react-native';
import { router } from 'expo-router';
import { useAuthStore } from '@/stores';
import { verificationService, profileService } from '@/services';
import { Button, Loading, Card } from '@/components';
import { useTheme } from '@/theme';
import type { SemanticTokens } from '@/theme';

type Channel = 'SMS' | 'WHATSAPP';

export default function VerifyPhoneScreen() {
  const { t } = useTheme();
  const styles = makeStyles(t);

  const { user, refreshUser } = useAuthStore();
  const [step, setStep] = useState<'select' | 'verify'>('select');
  const [channel, setChannel] = useState<Channel>('WHATSAPP');
  const [verificationId, setVerificationId] = useState('');
  const [code, setCode] = useState(['', '', '', '', '', '']);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [phone, setPhone] = useState('');
  const [debugCode, setDebugCode] = useState('');

  const inputRefs = useRef<(TextInput | null)[]>([]);

  useEffect(() => {
    loadPhone();
  }, []);

  const loadPhone = async () => {
    try {
      const profile = await profileService.getProfile();
      setPhone(profile.phone_e164 || '');
    } catch {
      setError('Erro ao carregar telefone');
    }
  };

  const handleStartVerification = async () => {
    if (!phone) {
      setError('Telefone não encontrado no perfil');
      return;
    }

    try {
      setIsLoading(true);
      setError('');
      const response = await verificationService.startPhone({
        phone_e164: phone,
        channel,
      });
      setVerificationId(response.verification_id);
      if (response.debug_code) {
        setDebugCode(response.debug_code);
      }
      setStep('verify');
    } catch (err: any) {
      setError(err.response?.data?.detail?.message || 'Erro ao enviar código');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCodeChange = (index: number, value: string) => {
    if (value.length > 1) {
      // Paste handling
      const digits = value.replace(/\D/g, '').slice(0, 6).split('');
      const newCode = [...code];
      digits.forEach((d, i) => {
        if (i < 6) newCode[i] = d;
      });
      setCode(newCode);
      const lastIndex = Math.min(digits.length, 5);
      inputRefs.current[lastIndex]?.focus();
      return;
    }

    const newCode = [...code];
    newCode[index] = value;
    setCode(newCode);

    // Auto-focus next input
    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyPress = (index: number, key: string) => {
    if (key === 'Backspace' && !code[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handleConfirm = async () => {
    const fullCode = code.join('');
    if (fullCode.length !== 6) {
      setError('Digite o código completo');
      return;
    }

    try {
      setIsLoading(true);
      setError('');
      await verificationService.confirmPhone({
        verification_id: verificationId,
        code: fullCode,
      });
      await refreshUser();
      router.replace('/');
    } catch (err: any) {
      setError(err.response?.data?.detail?.message || 'Código inválido');
      setCode(['', '', '', '', '', '']);
      inputRefs.current[0]?.focus();
    } finally {
      setIsLoading(false);
    }
  };

  if (step === 'select') {
    return (
      <View style={styles.container}>
        <View style={styles.content}>
          <Text style={styles.title}>Verificar Telefone</Text>
          <Text style={styles.subtitle}>
            Enviaremos um código de 6 dígitos para:
          </Text>
          <Text style={styles.phone}>{phone || 'Carregando...'}</Text>

          <Text style={styles.channelLabel}>Como deseja receber?</Text>

          <TouchableOpacity
            style={[styles.channelOption, channel === 'WHATSAPP' && styles.channelSelected]}
            onPress={() => setChannel('WHATSAPP')}
          >
            <Text style={styles.channelIcon}>💬</Text>
            <View>
              <Text style={styles.channelTitle}>WhatsApp</Text>
              <Text style={styles.channelDesc}>Receba via mensagem no WhatsApp</Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.channelOption, channel === 'SMS' && styles.channelSelected]}
            onPress={() => setChannel('SMS')}
          >
            <Text style={styles.channelIcon}>📱</Text>
            <View>
              <Text style={styles.channelTitle}>SMS</Text>
              <Text style={styles.channelDesc}>Receba via mensagem de texto</Text>
            </View>
          </TouchableOpacity>

          {error ? <Text style={styles.error}>{error}</Text> : null}
        </View>

        <View style={styles.footer}>
          <Button
            title="Enviar Código"
            onPress={handleStartVerification}
            loading={isLoading}
            fullWidth
            size="lg"
          />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>Digite o código</Text>
        <Text style={styles.subtitle}>
          Enviamos um código de 6 dígitos via {channel === 'WHATSAPP' ? 'WhatsApp' : 'SMS'}
        </Text>

        <View style={styles.codeContainer}>
          {code.map((digit, index) => (
            <TextInput
              key={index}
              // Chaves obrigatorias: no React 19 o retorno de um ref callback e
              // tratado como funcao de cleanup. A forma implicita devolvia o
              // proprio TextInput, que o React tentaria chamar ao desmontar.
              ref={(ref) => {
                inputRefs.current[index] = ref;
              }}
              style={[styles.codeInput, digit ? styles.codeInputFilled : null]}
              value={digit}
              onChangeText={(value) => handleCodeChange(index, value)}
              onKeyPress={({ nativeEvent }) => handleKeyPress(index, nativeEvent.key)}
              keyboardType="number-pad"
              maxLength={1}
              selectTextOnFocus
            />
          ))}
        </View>

        {debugCode ? (
          <Card variant="filled" style={styles.debugCard}>
            <Text style={styles.debugText}>🛠️ Código de teste: {debugCode}</Text>
          </Card>
        ) : null}

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <TouchableOpacity onPress={() => setStep('select')} style={styles.resend}>
          <Text style={styles.resendText}>Não recebeu? Tentar novamente</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.footer}>
        <Button
          title="Confirmar"
          onPress={handleConfirm}
          loading={isLoading}
          fullWidth
          size="lg"
          disabled={code.join('').length !== 6}
        />
      </View>
    </View>
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
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: t.text.primary,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 15,
    color: t.text.secondary,
    marginBottom: 16,
  },
  phone: {
    fontSize: 20,
    fontWeight: '600',
    color: t.brand.primary,
    marginBottom: 24,
  },
  channelLabel: {
    fontSize: 15,
    fontWeight: '500',
    color: t.text.primary,
    marginBottom: 16,
  },
  channelOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: t.bg.surface,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: 'transparent',
    marginBottom: 12,
  },
  channelSelected: {
    borderColor: t.brand.primary,
    backgroundColor: t.brand.primaryDim,
  },
  channelIcon: {
    fontSize: 32,
    marginRight: 16,
  },
  channelTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: t.text.primary,
  },
  channelDesc: {
    fontSize: 13,
    color: t.text.secondary,
  },
  codeContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    marginVertical: 24,
  },
  codeInput: {
    width: 48,
    height: 56,
    borderRadius: 14,
    backgroundColor: t.bg.surface,
    borderWidth: 2,
    borderColor: t.border.subtle,
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    color: t.text.primary,
  },
  codeInputFilled: {
    borderColor: t.brand.primary,
    backgroundColor: t.bg.screen,
  },
  debugCard: {
    marginTop: 16,
  },
  debugText: {
    fontSize: 13,
    color: t.text.secondary,
    textAlign: 'center',
  },
  error: {
    color: t.status.error,
    fontSize: 13,
    textAlign: 'center',
    marginTop: 16,
  },
  resend: {
    marginTop: 24,
    alignItems: 'center',
  },
  resendText: {
    fontSize: 15,
    color: t.brand.primary,
  },
  footer: {
    padding: 24,
    borderTopWidth: 1,
    borderTopColor: t.border.subtle,
  },
});
