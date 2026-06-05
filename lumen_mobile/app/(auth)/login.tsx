/**
 * Login Screen — "Vela em Catedral"
 * ==================================
 * Visual redesenhado. Lógica Firebase 100% intacta.
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

// ── Paleta "Vela em Catedral" ──────────────────────────────────────────────
const C = {
  bg:          '#0d1a2e',
  teal:        '#2da8c0',
  tealFocus:   '#5cc8de',
  white:       '#ffffff',
  offWhite:    '#e8f0f8',
  placeholder: 'rgba(255,255,255,0.40)',
  inputBg:     'rgba(255,255,255,0.07)',
  inputBorder: 'rgba(255,255,255,0.14)',
  errorText:   '#fca5a5',
  successText: '#86efac',
};

export default function LoginScreen() {
  // ── Lógica intacta ──────────────────────────────────────────────────────
  const [email,          setEmail]          = useState('');
  const [password,       setPassword]       = useState('');
  const [errors,         setErrors]         = useState<Record<string, string>>({});
  const [isLoading,      setIsLoading]      = useState(false);
  const [authError,      setAuthError]      = useState('');
  const [resetMessage,   setResetMessage]   = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [isSendingReset, setIsSendingReset] = useState(false);
  const [showPassword,   setShowPassword]   = useState(false);

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
      setResetMessage(null);
      if (IS_DEV_AUTH) {
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
      if (code === 'auth/user-not-found')    message = 'Usuário não encontrado.';
      if (code === 'auth/wrong-password')    message = 'Senha incorreta.';
      if (code === 'auth/too-many-requests') message = 'Muitas tentativas. Aguarde e tente novamente.';
      if (code === 'auth/invalid-credential') message = 'Email ou senha inválidos.';
      setAuthError(message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleForgotPassword = async () => {
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
  // ── Fim da lógica intacta ───────────────────────────────────────────────

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={C.bg} />

      {/* Glow radial suave — camada decorativa */}
      <View style={styles.glow} pointerEvents="none" />

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* ── Hero ─────────────────────────────────────────── */}
          <View style={styles.hero}>
            <View style={styles.compassHalo} />
            <View style={styles.compassWrapper}>
              <Ionicons name="compass-outline" size={72} color={C.teal} />
            </View>
            <Text style={styles.logoText}>
              LUMEN<Text style={styles.logoPlus}>+</Text>
            </Text>
            <Text style={styles.slogan}>
              Mais <Text style={styles.sloganBold}>Luz</Text>
              {'  '}·{'  '}
              Mais <Text style={styles.sloganBold}>Encontro</Text>
            </Text>
          </View>

          {/* ── Formulário ───────────────────────────────────── */}
          <View style={styles.form}>

            {/* E-mail */}
            <View style={[styles.inputWrapper, errors.email ? styles.inputWrapperError : null]}>
              <Ionicons name="mail-outline" size={18} color={C.placeholder} style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="E-mail"
                value={email}
                onChangeText={(t) => { setEmail(t); setErrors({ ...errors, email: '' }); setAuthError(''); }}
                keyboardType="email-address"
                autoCapitalize="none"
                autoComplete="email"
                placeholderTextColor={C.placeholder}
                accessibilityLabel="Campo de e-mail"
              />
              {errors.email ? (
                <Ionicons name="alert-circle" size={18} color={C.errorText} />
              ) : null}
            </View>
            {errors.email ? (
              <View style={styles.fieldError}>
                <Ionicons name="alert-circle-outline" size={13} color={C.errorText} />
                <Text style={styles.fieldErrorText}>{errors.email}</Text>
              </View>
            ) : null}

            {/* Senha */}
            <View style={[styles.inputWrapper, errors.password ? styles.inputWrapperError : null]}>
              <Ionicons name="lock-closed-outline" size={18} color={C.placeholder} style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="Senha"
                value={password}
                onChangeText={(t) => { setPassword(t); setErrors({ ...errors, password: '' }); setAuthError(''); }}
                secureTextEntry={!showPassword}
                placeholderTextColor={C.placeholder}
                accessibilityLabel="Campo de senha"
              />
              <TouchableOpacity
                onPress={() => setShowPassword(!showPassword)}
                accessibilityLabel={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
              >
                <Ionicons
                  name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                  size={18}
                  color={C.placeholder}
                />
              </TouchableOpacity>
            </View>
            {errors.password ? (
              <View style={styles.fieldError}>
                <Ionicons name="alert-circle-outline" size={13} color={C.errorText} />
                <Text style={styles.fieldErrorText}>{errors.password}</Text>
              </View>
            ) : null}

            {/* Erro de auth */}
            {authError ? (
              <View style={styles.authError}>
                <Ionicons name="close-circle" size={16} color={C.errorText} />
                <Text style={styles.authErrorText}>{authError}</Text>
              </View>
            ) : null}

            {/* Esqueci a senha */}
            <TouchableOpacity
              style={[styles.forgotBtn, isSendingReset ? { opacity: 0.5 } : null]}
              onPress={handleForgotPassword}
              disabled={isSendingReset}
              accessibilityLabel="Recuperar senha"
            >
              {isSendingReset
                ? <ActivityIndicator size="small" color={C.teal} />
                : <Text style={styles.forgotText}>Esqueci a senha</Text>
              }
            </TouchableOpacity>

            {/* Mensagem reset */}
            {resetMessage ? (
              <View style={[styles.resetMsg, resetMessage.type === 'success' ? styles.resetSuccess : styles.resetError]}>
                <Ionicons
                  name={resetMessage.type === 'success' ? 'checkmark-circle' : 'close-circle'}
                  size={15}
                  color={resetMessage.type === 'success' ? C.successText : C.errorText}
                />
                <Text style={[styles.resetMsgText, { color: resetMessage.type === 'success' ? C.successText : C.errorText }]}>
                  {resetMessage.text}
                </Text>
              </View>
            ) : null}

            {/* Botão Entrar */}
            <TouchableOpacity
              style={[styles.btn, isLoading ? { opacity: 0.6 } : null]}
              onPress={handleLogin}
              disabled={isLoading}
              accessibilityLabel="Entrar na conta"
              accessibilityRole="button"
            >
              {isLoading
                ? <ActivityIndicator color={C.white} />
                : <Text style={styles.btnText}>Entrar</Text>
              }
            </TouchableOpacity>
          </View>

          {/* ── Footer ───────────────────────────────────────── */}
          <View style={styles.footer}>
            <Text style={styles.footerText}>Não tem uma conta? </Text>
            <TouchableOpacity
              onPress={() => router.push('/(auth)/register')}
              accessibilityLabel="Criar conta"
            >
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
    backgroundColor: C.bg,
  },
  glow: {
    position: 'absolute',
    top: '10%',
    alignSelf: 'center',
    width: 320,
    height: 320,
    borderRadius: 160,
    backgroundColor: 'rgba(26,133,155,0.10)',
  },
  scroll: {
    flexGrow: 1,
    paddingHorizontal: 28,
    paddingTop: 72,
    paddingBottom: 48,
  },
  hero: {
    alignItems: 'center',
    marginBottom: 44,
  },
  compassHalo: {
    position: 'absolute',
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(45,168,192,0.10)',
    top: -8,
  },
  compassWrapper: {
    marginBottom: 20,
  },
  logoText: {
    fontSize: 34,
    fontFamily: 'Nunito-ExtraBold',
    color: C.white,
    letterSpacing: 3,
  },
  logoPlus: {
    color: C.teal,
    fontFamily: 'Nunito-Regular',
  },
  slogan: {
    fontSize: 14,
    fontFamily: 'Nunito-Regular',
    color: 'rgba(255,255,255,0.60)',
    marginTop: 6,
    letterSpacing: 0.3,
  },
  sloganBold: {
    fontFamily: 'Nunito-SemiBold',
    color: 'rgba(255,255,255,0.85)',
  },
  form: {
    gap: 0,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.inputBg,
    borderWidth: 1,
    borderColor: C.inputBorder,
    borderRadius: 14,
    paddingHorizontal: 14,
    minHeight: 52,
    marginBottom: 4,
  },
  inputWrapperError: {
    borderColor: 'rgba(252,165,165,0.60)',
  },
  inputIcon: {
    marginRight: 10,
  },
  input: {
    flex: 1,
    fontSize: 15,
    fontFamily: 'Nunito-Regular',
    color: C.white,
    paddingVertical: 14,
  },
  fieldError: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 10,
    marginLeft: 4,
  },
  fieldErrorText: {
    fontSize: 12,
    fontFamily: 'Nunito-Regular',
    color: C.errorText,
  },
  authError: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: 'rgba(252,165,165,0.10)',
    borderRadius: 10,
    padding: 12,
    marginBottom: 12,
    marginTop: 4,
  },
  authErrorText: {
    flex: 1,
    fontSize: 13,
    fontFamily: 'Nunito-Regular',
    color: C.errorText,
    lineHeight: 18,
  },
  forgotBtn: {
    alignSelf: 'flex-end',
    paddingVertical: 4,
    marginBottom: 20,
    marginTop: 8,
  },
  forgotText: {
    fontSize: 13,
    fontFamily: 'Nunito-SemiBold',
    color: C.teal,
  },
  resetMsg: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    borderRadius: 10,
    padding: 12,
    marginBottom: 16,
  },
  resetSuccess: {
    backgroundColor: 'rgba(134,239,172,0.10)',
  },
  resetError: {
    backgroundColor: 'rgba(252,165,165,0.10)',
  },
  resetMsgText: {
    flex: 1,
    fontSize: 13,
    fontFamily: 'Nunito-Regular',
    lineHeight: 18,
  },
  btn: {
    backgroundColor: '#1A859B',
    borderRadius: 14,
    minHeight: 52,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  btnText: {
    fontSize: 16,
    fontFamily: 'Nunito-Bold',
    color: C.white,
    letterSpacing: 0.3,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 36,
  },
  footerText: {
    fontSize: 14,
    fontFamily: 'Nunito-Regular',
    color: 'rgba(255,255,255,0.55)',
  },
  footerLink: {
    fontSize: 14,
    fontFamily: 'Nunito-Bold',
    color: C.teal,
  },
});
