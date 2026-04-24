/**
 * Login Screen
 * ============
 * Autenticação via Firebase (email + senha).
 * Recuperação de senha via Firebase sendPasswordResetEmail.
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
  StatusBar,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import {
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
} from 'firebase/auth';
import { auth, IS_DEV_AUTH } from '@/config/firebase';
import api, { setDevToken } from '@/services/api';

const colors = {
  primary: '#1A859B',
  white: '#ffffff',
  orange: '#F5A623',
  gray: '#6b7280',
  inputBg: 'rgba(255, 255, 255, 0.9)',
};

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [authError, setAuthError] = useState('');
  const [resetMessage, setResetMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [isSendingReset, setIsSendingReset] = useState(false);

  const validate = () => {
    const newErrors: Record<string, string> = {};
    if (!email.includes('@')) newErrors.email = 'Email inválido';
    if (!IS_DEV_AUTH && !password) newErrors.password = 'Digite sua senha';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleLogin = async () => {
    if (!validate()) return;
    try {
      setIsLoading(true);

      if (IS_DEV_AUTH) {
        // Modo DEV: autentica diretamente no backend (sem Firebase)
        const res = await fetch(`${api.baseUrl}/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: email.trim().toLowerCase(), password: 'dev-password' }),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          const msg = err?.detail?.message ?? 'Usuário não encontrado. Crie uma conta primeiro.';
          setAuthError(msg);
          return;
        }
        const data = await res.json();
        await setDevToken(data.access_token);
        router.replace('/(tabs)/home');
        return;
      }

      await signInWithEmailAndPassword(auth, email.trim().toLowerCase(), password);
      router.replace('/(tabs)/home');
    } catch (err: unknown) {
      const code = (err as { code?: string }).code ?? '';
      let message = 'Email ou senha inválidos.';
      if (code === 'auth/user-not-found') message = 'Usuário não encontrado.';
      if (code === 'auth/wrong-password') message = 'Senha incorreta.';
      if (code === 'auth/too-many-requests') message = 'Muitas tentativas. Aguarde e tente novamente.';
      if (code === 'auth/invalid-credential') message = 'Email ou senha inválidos.';
      setAuthError(message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    // Para customizar o e-mail enviado pelo Firebase (idioma, template, link):
    // Firebase Console → Authentication → Templates → Password reset
    // Assunto sugerido: "Redefinição de senha — Lumen+"
    // Corpo: saudação acolhedora em português, botão com cor #1A859B, assinatura "Equipe Lumen+"
    if (IS_DEV_AUTH) {
      setResetMessage({ type: 'error', text: 'Recuperação de senha não disponível em modo de desenvolvimento.' });
      return;
    }
    if (!email.includes('@')) {
      setErrors({ email: 'Digite seu email acima primeiro' });
      return;
    }
    try {
      setIsSendingReset(true);
      setResetMessage(null);
      await sendPasswordResetEmail(auth, email.trim().toLowerCase());
      setResetMessage({
        type: 'success',
        text: `Enviamos um e-mail para ${email.trim().toLowerCase()}. Verifique sua caixa de entrada.`,
      });
    } catch {
      setResetMessage({ type: 'error', text: 'Não foi possível enviar o e-mail. Verifique o endereço e tente novamente.' });
    } finally {
      setIsSendingReset(false);
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={colors.primary} />

      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Logo Section */}
          <View style={styles.logoSection}>
            <View style={styles.compassContainer}>
              <Ionicons name="compass-outline" size={80} color={colors.white} />
            </View>
            <Text style={styles.logoText}>
              LUMEN<Text style={styles.logoPlus}>+</Text>
            </Text>
            <Text style={styles.slogan}>
              Mais <Text style={styles.sloganBold}>Luz</Text> | Mais{' '}
              <Text style={styles.sloganBold}>Encontro</Text>
            </Text>
          </View>

          {/* Form */}
          <View style={styles.form}>
            <TextInput
              style={[styles.input, errors.email && styles.inputError]}
              placeholder="E-mail"
              value={email}
              onChangeText={(text) => {
                setEmail(text);
                setErrors({ ...errors, email: '' });
                setAuthError('');
              }}
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
              placeholderTextColor={colors.gray}
            />
            {errors.email ? (
              <Text style={styles.errorText}>{errors.email}</Text>
            ) : null}

            <TextInput
              style={[styles.input, errors.password && styles.inputError]}
              placeholder="Senha"
              value={password}
              onChangeText={(text) => {
                setPassword(text);
                setErrors({ ...errors, password: '' });
                setAuthError('');
              }}
              secureTextEntry
              placeholderTextColor={colors.gray}
            />
            {errors.password ? (
              <Text style={styles.errorText}>{errors.password}</Text>
            ) : null}

            {authError ? (
              <Text style={styles.authErrorText}>{authError}</Text>
            ) : null}

            <TouchableOpacity
              style={[styles.forgotPassword, isSendingReset && { opacity: 0.5 }]}
              onPress={handleForgotPassword}
              disabled={isSendingReset}
            >
              {isSendingReset ? (
                <ActivityIndicator size="small" color={colors.white} />
              ) : (
                <Text style={styles.forgotPasswordText}>Esqueci a senha</Text>
              )}
            </TouchableOpacity>

            {resetMessage ? (
              <Text
                style={[
                  styles.resetMessageText,
                  resetMessage.type === 'success' ? styles.resetSuccess : styles.resetError,
                ]}
              >
                {resetMessage.text}
              </Text>
            ) : null}

            <TouchableOpacity
              style={[styles.primaryButton, isLoading && styles.buttonDisabled]}
              onPress={handleLogin}
              disabled={isLoading}
            >
              {isLoading ? (
                <ActivityIndicator color={colors.white} />
              ) : (
                <Text style={styles.primaryButtonText}>Entrar</Text>
              )}
            </TouchableOpacity>
          </View>

          {/* Footer */}
          <View style={styles.footer}>
            <Text style={styles.footerText}>Não tem uma conta? </Text>
            <TouchableOpacity onPress={() => router.push('/(auth)/register')}>
              <Text style={styles.footerLink}>Crie agora.</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.primary,
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 32,
    paddingTop: 60,
    paddingBottom: 40,
  },
  logoSection: {
    alignItems: 'center',
    marginBottom: 48,
  },
  compassContainer: {
    marginBottom: 16,
  },
  logoText: {
    fontSize: 36,
    fontWeight: 'bold',
    color: colors.white,
    letterSpacing: 2,
  },
  logoPlus: {
    fontSize: 36,
    fontWeight: 'normal',
  },
  slogan: {
    fontSize: 16,
    color: colors.white,
    opacity: 0.9,
    marginTop: 8,
  },
  sloganBold: {
    fontWeight: 'bold',
  },
  form: {
    flex: 1,
  },
  input: {
    backgroundColor: colors.inputBg,
    borderRadius: 25,
    paddingHorizontal: 20,
    paddingVertical: 16,
    fontSize: 16,
    marginBottom: 12,
    color: '#333',
  },
  inputError: {
    borderWidth: 2,
    borderColor: '#ef4444',
    marginBottom: 4,
  },
  errorText: {
    color: '#fecaca',
    fontSize: 13,
    marginBottom: 10,
    marginLeft: 16,
  },
  authErrorText: {
    color: '#fecaca',
    fontSize: 14,
    marginBottom: 12,
    marginLeft: 4,
    textAlign: 'center',
  },
  forgotPassword: {
    alignSelf: 'flex-end',
    marginBottom: 20,
  },
  forgotPasswordText: {
    fontSize: 14,
    color: colors.white,
    textDecorationLine: 'underline',
  },
  resetMessageText: {
    fontSize: 13,
    marginBottom: 12,
    marginLeft: 4,
    lineHeight: 18,
  },
  resetSuccess: {
    color: '#bbf7d0',
  },
  resetError: {
    color: '#fecaca',
  },
  primaryButton: {
    backgroundColor: colors.orange,
    borderRadius: 25,
    paddingVertical: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  primaryButtonText: {
    color: colors.white,
    fontSize: 18,
    fontWeight: '600',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    paddingTop: 32,
  },
  footerText: {
    fontSize: 14,
    color: colors.white,
  },
  footerLink: {
    fontSize: 14,
    color: colors.white,
    fontWeight: 'bold',
    textDecorationLine: 'underline',
  },
});
