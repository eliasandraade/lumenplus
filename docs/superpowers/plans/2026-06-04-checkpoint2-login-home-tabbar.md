# Checkpoint 2 — Login, Home e Tab Bar — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign visual do Login, Home e Tab Bar usando o design system do Checkpoint 1, sem alterar nenhuma lógica de negócio, Firebase, rotas ou chamadas de API.

**Architecture:** 5 tarefas independentes em sequência: (1) CustomTabBar novo componente, (2) integrar na `_layout.tsx` das tabs com novos labels, (3) redesign do Login, (4) ajuste visual do Register step 1, (5) redesign estrutural da Home. Cada tarefa é um commit isolado.

**Tech Stack:** React Native + Expo Router, `react-native-reanimated` (spring pill), `useTheme()` do design system do CP1, Nunito fonts, tokens de `src/theme/tokens.ts`.

---

## Mapa de arquivos

| Arquivo | Ação | Responsabilidade |
|---|---|---|
| `lumen_mobile/src/components/ui/CustomTabBar.tsx` | **Criar** | Pill animado, dark/light, fallback web |
| `lumen_mobile/app/(tabs)/_layout.tsx` | **Modificar** | Integrar CustomTabBar, labels definitivos |
| `lumen_mobile/app/(auth)/login.tsx` | **Modificar** | Visual "Vela em Catedral", a11y |
| `lumen_mobile/app/(auth)/register.tsx` | **Modificar** | Fundo step 1 + tipografia, zero lógica |
| `lumen_mobile/app/(tabs)/home.tsx` | **Modificar** | Hierarquia de 5 seções, useTheme |

---

## Task 1: CustomTabBar — Pill animado

**Files:**
- Create: `lumen_mobile/src/components/ui/CustomTabBar.tsx`

- [ ] **Step 1.1 — Criar o componente CustomTabBar**

```tsx
// lumen_mobile/src/components/ui/CustomTabBar.tsx
import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Platform,
  Dimensions,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/theme';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';

const TAB_HEIGHT = 62;
// Spring sem bounce (overshootClamping: true)
const PILL_SPRING = { damping: 20, stiffness: 260, overshootClamping: true };

export function CustomTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const { t, r } = useTheme();
  const insets = useSafeAreaInsets();
  const tabCount = state.routes.length;

  // Dimensões dinâmicas após layout
  const [tabWidth, setTabWidth] = React.useState(0);
  const pillX = useSharedValue(0);

  // Atualiza posição do pill quando a tab ativa muda
  useEffect(() => {
    if (tabWidth === 0) return;
    pillX.value = withSpring(state.index * tabWidth, PILL_SPRING);
  }, [state.index, tabWidth]);

  const pillStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: pillX.value }],
  }));

  const bottomPadding = insets.bottom > 0 ? insets.bottom : 8;

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: t.bg.elevated,
          borderTopColor: t.border.subtle,
          paddingBottom: bottomPadding,
          height: TAB_HEIGHT + bottomPadding,
          ...t.shadow.sm,
        },
      ]}
      onLayout={(e) => {
        const w = e.nativeEvent.layout.width / tabCount;
        setTabWidth(w);
        // Posiciona pill no index inicial sem animação
        pillX.value = state.index * w;
      }}
    >
      {/* Pill de fundo — desliza sob os ícones */}
      {tabWidth > 0 && (
        <Animated.View
          style={[
            styles.pill,
            pillStyle,
            {
              width: tabWidth - 16,
              marginHorizontal: 8,
              backgroundColor: t.brand.primary,
              borderRadius: r.xl,
              height: TAB_HEIGHT - 16,
              top: 8,
            },
          ]}
        />
      )}

      {/* Tabs */}
      <View style={styles.tabs}>
        {state.routes.map((route, index) => {
          const { options } = descriptors[route.key];
          const label = (options.tabBarLabel as string) ?? options.title ?? route.name;
          const isFocused = state.index === index;

          const iconColor = isFocused ? '#ffffff' : t.text.tertiary;
          const textColor = isFocused ? '#ffffff' : t.text.tertiary;

          const iconName = getIconName(route.name, isFocused);

          const onPress = () => {
            const event = navigation.emit({
              type: 'tabPress',
              target: route.key,
              canPreventDefault: true,
            });
            if (!isFocused && !event.defaultPrevented) {
              navigation.navigate(route.name);
            }
          };

          return (
            <TouchableOpacity
              key={route.key}
              accessibilityRole="button"
              accessibilityState={isFocused ? { selected: true } : {}}
              accessibilityLabel={label}
              onPress={onPress}
              style={styles.tab}
            >
              <Ionicons name={iconName} size={22} color={iconColor} />
              <Text
                style={[styles.label, { color: textColor }]}
                numberOfLines={1}
              >
                {label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

function getIconName(
  routeName: string,
  focused: boolean,
): React.ComponentProps<typeof Ionicons>['name'] {
  const map: Record<string, [string, string]> = {
    service:   ['book',         'book-outline'],
    community: ['people',       'people-outline'],
    home:      ['home',         'home-outline'],
    invites:   ['mail',         'mail-outline'],
    profile:   ['person',       'person-outline'],
  };
  const [active, inactive] = map[routeName] ?? ['ellipse', 'ellipse-outline'];
  return (focused ? active : inactive) as React.ComponentProps<typeof Ionicons>['name'];
}

const styles = StyleSheet.create({
  container: {
    position: 'relative',
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  pill: {
    position: 'absolute',
    zIndex: 0,
  },
  tabs: {
    flexDirection: 'row',
    height: TAB_HEIGHT,
    zIndex: 1,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
  },
  label: {
    fontSize: 10,
    fontFamily: 'Nunito-SemiBold',
  },
});
```

- [ ] **Step 1.2 — Verificar que não há erro de import**

```bash
cd lumen_mobile && npx tsc --noEmit 2>&1 | grep CustomTabBar
```

Esperado: sem linhas de output (zero erros no arquivo novo).

- [ ] **Step 1.3 — Commit**

```bash
git add lumen_mobile/src/components/ui/CustomTabBar.tsx
git commit -m "feat(ui): CustomTabBar com pill animado spring + dark mode"
```

---

## Task 2: Integrar CustomTabBar no `_layout.tsx` das tabs

**Files:**
- Modify: `lumen_mobile/app/(tabs)/_layout.tsx`

- [ ] **Step 2.1 — Substituir _layout.tsx**

Preserve toda a lógica do `useEffect` (verificação de termos, documentos, profile_update_due). Apenas troque a parte visual.

```tsx
// lumen_mobile/app/(tabs)/_layout.tsx
/**
 * Tabs Layout
 * ===========
 * Lógica de onboarding intacta.
 * Tab bar substituída pelo CustomTabBar com pill animado.
 */

import { useEffect } from 'react';
import { Tabs, router } from 'expo-router';
import { View, Image, StyleSheet } from 'react-native';
import { authService, profileService } from '@/services';
import { CustomTabBar } from '@/src/components/ui/CustomTabBar';
import { useTheme } from '@/theme';

export default function TabsLayout() {
  const { t } = useTheme();

  useEffect(() => {
    (async () => {
      try {
        const me = await authService.getMe();
        if (me.consents.pending_terms || me.consents.pending_privacy) {
          router.replace('/(onboarding)/terms');
          return;
        }
        const profile = await profileService.getProfile();
        if (!profile.has_documents) {
          router.replace('/(onboarding)/complete-documents');
          return;
        }
        if (me.profile_update_due) {
          router.replace('/(onboarding)/profile-update');
          return;
        }
      } catch {
        // Ignora erros de rede
      }
    })();
  }, []);

  return (
    <Tabs
      tabBar={(props) => <CustomTabBar {...props} />}
      screenOptions={{
        header: () => (
          <View style={[styles.header, { backgroundColor: t.bg.elevated, borderBottomColor: t.border.subtle }]}>
            <Image
              source={require('../../assets/images/logo.png')}
              style={styles.logo}
              resizeMode="contain"
            />
          </View>
        ),
      }}
    >
      <Tabs.Screen name="service"   options={{ title: 'Servir'     }} />
      <Tabs.Screen name="community" options={{ title: 'Comunidade' }} />
      <Tabs.Screen name="home"      options={{ title: 'Início'     }} />
      <Tabs.Screen name="invites"   options={{ title: 'Inbox'      }} />
      <Tabs.Screen name="profile"   options={{ title: 'Perfil'     }} />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  header: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 50,
    paddingBottom: 15,
    paddingHorizontal: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  logo: {
    height: 30,
    width: 120,
  },
});
```

- [ ] **Step 2.2 — Verificar tipos**

```bash
cd lumen_mobile && npx tsc --noEmit 2>&1 | grep "_layout\|CustomTabBar"
```

Esperado: zero linhas de output.

- [ ] **Step 2.3 — Commit**

```bash
git add lumen_mobile/app/(tabs)/_layout.tsx
git commit -m "feat(tabs): integrar CustomTabBar + labels definitivos (Servir, Comunidade, Início, Inbox, Perfil)"
```

---

## Task 3: Login — "Vela em Catedral"

**Files:**
- Modify: `lumen_mobile/app/(auth)/login.tsx`

Toda a lógica (`handleLogin`, `handleForgotPassword`, `validate`, estados) permanece byte-a-byte idêntica. Apenas o JSX de apresentação e os estilos mudam.

- [ ] **Step 3.1 — Substituir login.tsx**

```tsx
// lumen_mobile/app/(auth)/login.tsx
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

      {/* Glow radial suave — camada decorativa atrás do conteúdo */}
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
            {/* Halo atrás da bússola */}
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
            <View style={[styles.inputWrapper, errors.email && styles.inputWrapperError]}>
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
            <View style={[styles.inputWrapper, errors.password && styles.inputWrapperError]}>
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
              style={[styles.forgotBtn, isSendingReset && { opacity: 0.5 }]}
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
              style={[styles.btn, isLoading && { opacity: 0.6 }]}
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
  // Glow radial — círculo teal desfocado no centro-alto
  glow: {
    position: 'absolute',
    top: '10%',
    alignSelf: 'center',
    width: 320,
    height: 320,
    borderRadius: 160,
    backgroundColor: 'rgba(26,133,155,0.10)',
    // Web: blur nativo não existe; a opacidade baixa já simula o efeito
  },
  scroll: {
    flexGrow: 1,
    paddingHorizontal: 28,
    paddingTop: 72,
    paddingBottom: 48,
  },
  // Hero
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
  // Form
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
  // Footer
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
```

- [ ] **Step 3.2 — Verificar tipos**

```bash
cd lumen_mobile && npx tsc --noEmit 2>&1 | grep "auth)/login"
```

Esperado: zero linhas de output.

- [ ] **Step 3.3 — Commit**

```bash
git add lumen_mobile/app/\(auth\)/login.tsx
git commit -m "feat(auth): login redesign — Vela em Catedral + a11y + Nunito"
```

---

## Task 4: Register — fundo step 1 + tipografia

**Files:**
- Modify: `lumen_mobile/app/(auth)/register.tsx`

**Regra inviolável:** apenas os `StyleSheet` e o container externo mudam. Nenhum `useState`, `useEffect`, lógica de validação, handlers ou estrutura de steps é tocada.

- [ ] **Step 4.1 — Localizar e substituir apenas as constantes visuais e o container externo**

Encontre no arquivo o bloco `const colors = { ... }` (linha ~89) e substitua:

```tsx
// ANTES:
const colors = {
  primary: '#1A859B',
  white: '#ffffff',
  orange: '#F5A623',
  gray: '#6b7280',
  inputBg: 'rgba(255, 255, 255, 0.9)',
  error: '#ef4444',
};

// DEPOIS:
const colors = {
  primary:   '#1A859B',
  teal:      '#2da8c0',
  white:     '#ffffff',
  gray:      '#6b7280',
  inputBg:   'rgba(255, 255, 255, 0.92)',
  error:     '#ef4444',
  // Fundo "Vela em Catedral" — apenas step 1
  bgDark:    '#0d1a2e',
  glow:      'rgba(26,133,155,0.10)',
};
```

- [ ] **Step 4.2 — Substituir apenas os estilos do container e do header do step 1**

Encontre no `StyleSheet.create({...})` os estilos `container`, `header` e `headerTitle` e substitua:

```tsx
// SUBSTITUA estes três estilos no StyleSheet.create existente:
container: {
  flex: 1,
  backgroundColor: colors.bgDark,   // step 1 usa fundo escuro
},
// Adicione stepContent logo abaixo (para steps 2-4 usarem fundo neutro se necessário)
// Nota: não há mudança estrutural nos steps — o fundo escuro persiste, mas é menos intenso
// graças à opacidade mais alta dos inputs
```

> **Atenção:** apenas os dois estilos acima mudam. Toda a lógica de renderização dos 4 steps, os `useEffect`, handlers e validações ficam intactos. Se o arquivo tiver mais de 800 linhas, use o editor para substituição cirúrgica dos blocos de style, não reescrever o arquivo inteiro.

- [ ] **Step 4.3 — Atualizar fontFamily nos textos do step 1 para Nunito**

Encontre os estilos de texto do header (título "Criar conta", subtítulo, rótulos de step):

```tsx
// ANTES (exemplo):
headerTitle: {
  fontSize: 24,
  fontWeight: 'bold',
  color: colors.white,
},

// DEPOIS:
headerTitle: {
  fontSize: 24,
  fontFamily: 'Nunito-Bold',
  color: colors.white,
},
```

Aplique `fontFamily: 'Nunito-SemiBold'` para labels de campo e `fontFamily: 'Nunito-Regular'` para textos de placeholder/hint onde `fontWeight` estava definido.

- [ ] **Step 4.4 — Verificar tipos**

```bash
cd lumen_mobile && npx tsc --noEmit 2>&1 | grep "auth)/register"
```

Esperado: zero linhas de output (ou apenas erros pré-existentes não relacionados a esta task).

- [ ] **Step 4.5 — Commit**

```bash
git add lumen_mobile/app/\(auth\)/register.tsx
git commit -m "feat(auth): register — fundo Vela em Catedral step 1 + Nunito"
```

---

## Task 5: Home — hierarquia de 5 seções

**Files:**
- Modify: `lumen_mobile/app/(tabs)/home.tsx`

**Regra inviolável:** toda a lógica acima da função `return (` fica intacta — `useState`, `useEffect`, `loadData`, `onRefresh`, `handleLogout`, `handleOpenAviso`, `getAvisoIcon`, `formatDate`.

- [ ] **Step 5.1 — Adicionar import do useTheme e remover const colors local**

No topo do arquivo, substitua:

```tsx
// REMOVER este bloco:
const colors = {
  primary: '#1A859B',
  white: '#ffffff',
  gray: '#6b7280',
  lightGray: '#E8E8E8',
  success: '#22c55e',
  warning: '#f59e0b',
  admin: '#7c3aed',
  coord: '#059669',
};

// ADICIONAR no import section (junto aos outros imports):
import { useTheme } from '@/theme';
import { getVersiculoDoDia } from '@/services/bible';
```

E no topo da função `HomeScreen()`, adicionar:

```tsx
const { t, r } = useTheme();
```

- [ ] **Step 5.2 — Substituir o JSX do return com a estrutura de 5 seções**

```tsx
return (
  <ScrollView
    style={{ flex: 1, backgroundColor: t.bg.screen }}
    contentContainerStyle={{ paddingBottom: 40 }}
    refreshControl={
      <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[t.brand.primary]} />
    }
  >

    {/* ── 1. HERO DE ACOLHIMENTO ─────────────────────────────── */}
    <HeroSection userName={userName} t={t} r={r} loading={loading} />

    {/* Push permission (web only) */}
    {Platform.OS === 'web' && showPushCard && (
      <View style={{ paddingHorizontal: 16, marginTop: 8 }}>
        <PushPermissionCard onDismiss={() => setShowPushCard(false)} />
      </View>
    )}

    {/* ── 2. ÁREA DE ATENÇÃO ─────────────────────────────────── */}
    <AttentionSection
      avisosNaoLidos={avisosNaoLidos}
      t={t}
      r={r}
      onOpenAviso={handleOpenAviso}
      formatDate={formatDate}
      getAvisoIcon={getAvisoIcon}
      loading={loading}
    />

    {/* ── 3. VIDA COMUNITÁRIA ────────────────────────────────── */}
    <CommunitySection t={t} r={r} />

    {/* ── 4. ÁREA DE SERVIÇO (somente para admins/coords) ──── */}
    {(hasAdminAccess || isCoordinator || hasRetreatAccess) && (
      <ServiceSection
        hasAdminAccess={hasAdminAccess}
        isCoordinator={isCoordinator}
        hasRetreatAccess={hasRetreatAccess}
        t={t}
        r={r}
      />
    )}

    {/* ── 5. RODAPÉ ESPIRITUAL ───────────────────────────────── */}
    <SpiritualFooter t={t} />

    {/* Sair */}
    <TouchableOpacity
      style={{ alignSelf: 'center', marginTop: 24, padding: 12 }}
      onPress={handleLogout}
      accessibilityLabel="Sair da conta"
    >
      <Text style={{ fontSize: 13, fontFamily: 'Nunito-Regular', color: t.text.tertiary }}>
        Sair da conta
      </Text>
    </TouchableOpacity>

  </ScrollView>
);
```

- [ ] **Step 5.3 — Adicionar componentes de seção no mesmo arquivo (abaixo do export default)**

```tsx
// ──────────────────────────────────────────────────────────────
// Sub-componentes de seção — mesmo arquivo para manter contexto
// ──────────────────────────────────────────────────────────────

import type { SemanticTokens } from '@/theme';
import type { RadiusTokens } from '@/theme/tokens'; // se exportado, senão use typeof radius

// ── 1. Hero ───────────────────────────────────────────────────
function HeroSection({ userName, t, r, loading }: {
  userName: string;
  t: SemanticTokens;
  r: typeof import('@/theme/tokens').radius;
  loading: boolean;
}) {
  const v = getVersiculoDoDia();

  return (
    <View
      style={{
        backgroundColor: t.bg.elevated,
        paddingHorizontal: 20,
        paddingTop: 28,
        paddingBottom: 24,
        borderBottomLeftRadius: r.xl,
        borderBottomRightRadius: r.xl,
        marginBottom: 8,
        ...t.shadow.sm,
      }}
    >
      {/* Saudação */}
      <Text style={{ fontSize: 13, fontFamily: 'Nunito-Regular', color: t.text.tertiary, marginBottom: 2 }}>
        Bem-vindo de volta
      </Text>
      <Text style={{ fontSize: 26, fontFamily: 'Nunito-ExtraBold', color: t.text.primary, marginBottom: 16 }}>
        {loading ? 'Carregando...' : `Olá, ${userName || 'Usuário'}!`}
      </Text>

      {/* Versículo integrado ao hero */}
      {v.texto ? (
        <View
          style={{
            backgroundColor: t.bg.spiritual ?? t.bg.surface,
            borderRadius: r.md,
            padding: 14,
            borderLeftWidth: 3,
            borderLeftColor: t.accent.spiritual,
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 }}>
            <Ionicons name="book-outline" size={13} color={t.accent.spiritual} />
            <Text style={{ fontSize: 10, fontFamily: 'Nunito-Bold', color: t.accent.spiritual, letterSpacing: 1, textTransform: 'uppercase' }}>
              Versículo do Dia
            </Text>
          </View>
          <Text style={{ fontSize: 14, fontFamily: 'Nunito-Italic', color: t.text.spiritual, lineHeight: 22 }}>
            "{v.texto}"
          </Text>
          <Text style={{ fontSize: 12, fontFamily: 'Nunito-SemiBold', color: t.text.tertiary, marginTop: 6 }}>
            {v.referencia}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

// ── 2. Área de Atenção ────────────────────────────────────────
type Aviso = { id: string; title: string; message: string; type: string; read: boolean; created_at: string };

function AttentionSection({ avisosNaoLidos, t, r, onOpenAviso, formatDate, getAvisoIcon, loading }: {
  avisosNaoLidos: Aviso[];
  t: SemanticTokens;
  r: typeof import('@/theme/tokens').radius;
  onOpenAviso: (a: Aviso) => void;
  formatDate: (d: string) => string;
  getAvisoIcon: (type: string) => { name: string; color: string };
  loading: boolean;
}) {
  if (loading) return null;
  if (avisosNaoLidos.length === 0) {
    return (
      <View style={{ paddingHorizontal: 16, paddingVertical: 12, marginBottom: 4 }}>
        <View
          style={{
            backgroundColor: t.bg.elevated,
            borderRadius: r.lg,
            padding: 16,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 12,
            ...t.shadow.sm,
          }}
        >
          <Ionicons name="checkmark-done-circle" size={32} color={t.status.success} />
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 14, fontFamily: 'Nunito-SemiBold', color: t.text.primary }}>
              Tudo em dia!
            </Text>
            <Text style={{ fontSize: 12, fontFamily: 'Nunito-Regular', color: t.text.secondary, marginTop: 2 }}>
              Nenhum aviso pendente.
            </Text>
          </View>
        </View>
      </View>
    );
  }

  return (
    <View style={{ paddingHorizontal: 16, marginBottom: 4 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10, marginTop: 16 }}>
        <Text style={{ fontSize: 13, fontFamily: 'Nunito-Bold', color: t.text.secondary, textTransform: 'uppercase', letterSpacing: 0.8 }}>
          Atenção
        </Text>
        <View style={{ backgroundColor: t.status.error, borderRadius: r.full, minWidth: 20, height: 20, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 5 }}>
          <Text style={{ fontSize: 11, fontFamily: 'Nunito-Bold', color: '#ffffff' }}>
            {avisosNaoLidos.length}
          </Text>
        </View>
      </View>

      {avisosNaoLidos.slice(0, 5).map((aviso) => {
        const icon = getAvisoIcon(aviso.type);
        return (
          <TouchableOpacity
            key={aviso.id}
            onPress={() => onOpenAviso(aviso)}
            activeOpacity={0.75}
            accessibilityLabel={`Aviso: ${aviso.title}`}
            style={{
              backgroundColor: t.bg.elevated,
              borderRadius: r.lg,
              padding: 14,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 12,
              marginBottom: 8,
              ...t.shadow.sm,
            }}
          >
            <View style={{
              width: 40, height: 40, borderRadius: 20,
              backgroundColor: `${icon.color}18`,
              alignItems: 'center', justifyContent: 'center',
            }}>
              <Ionicons name={icon.name as any} size={22} color={icon.color} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 14, fontFamily: 'Nunito-SemiBold', color: t.text.primary }} numberOfLines={1}>
                {aviso.title}
              </Text>
              <Text style={{ fontSize: 12, fontFamily: 'Nunito-Regular', color: t.text.secondary, marginTop: 2 }} numberOfLines={2}>
                {aviso.message}
              </Text>
              <Text style={{ fontSize: 11, fontFamily: 'Nunito-Regular', color: t.text.tertiary, marginTop: 4 }}>
                {formatDate(aviso.created_at)}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={t.text.tertiary} />
          </TouchableOpacity>
        );
      })}

      {avisosNaoLidos.length > 5 && (
        <TouchableOpacity
          onPress={() => router.push('/(tabs)/invites')}
          style={{ alignItems: 'center', paddingVertical: 10 }}
        >
          <Text style={{ fontSize: 13, fontFamily: 'Nunito-SemiBold', color: t.brand.primary }}>
            Ver todos os avisos ({avisosNaoLidos.length})
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

// ── 3. Vida Comunitária ───────────────────────────────────────
function CommunitySection({ t, r }: { t: SemanticTokens; r: typeof import('@/theme/tokens').radius }) {
  const items = [
    { label: 'Projeto de Vida', icon: 'compass-outline' as const, route: '/vida' as any, color: t.brand.primary },
    { label: 'Retiros',         icon: 'earth-outline' as const,   route: '/retreats' as any, color: t.brand.coord },
    { label: 'Comunidade',      icon: 'people-outline' as const,  route: '/(tabs)/community' as any, color: t.brand.secondary },
    { label: 'Inbox',           icon: 'mail-outline' as const,    route: '/(tabs)/invites' as any, color: t.brand.admin },
  ];

  return (
    <View style={{ paddingHorizontal: 16, marginTop: 20, marginBottom: 4 }}>
      <Text style={{ fontSize: 13, fontFamily: 'Nunito-Bold', color: t.text.secondary, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 12 }}>
        Vida Comunitária
      </Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
        {items.map((item) => (
          <TouchableOpacity
            key={item.label}
            onPress={() => router.push(item.route)}
            accessibilityLabel={item.label}
            style={{
              flex: 1,
              minWidth: '44%',
              backgroundColor: t.bg.elevated,
              borderRadius: r.lg,
              padding: 16,
              alignItems: 'center',
              gap: 8,
              ...t.shadow.sm,
            }}
          >
            <View style={{
              width: 44, height: 44, borderRadius: 22,
              backgroundColor: `${item.color}18`,
              alignItems: 'center', justifyContent: 'center',
            }}>
              <Ionicons name={item.icon} size={22} color={item.color} />
            </View>
            <Text style={{ fontSize: 13, fontFamily: 'Nunito-SemiBold', color: t.text.primary, textAlign: 'center' }}>
              {item.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

// ── 4. Área de Serviço ────────────────────────────────────────
function ServiceSection({ hasAdminAccess, isCoordinator, hasRetreatAccess, t, r }: {
  hasAdminAccess: boolean;
  isCoordinator: boolean;
  hasRetreatAccess: boolean;
  t: SemanticTokens;
  r: typeof import('@/theme/tokens').radius;
}) {
  const items = [
    hasAdminAccess && {
      label: 'Administração',
      subtitle: 'Entidades, membros e comunicações',
      icon: 'shield-checkmark-outline' as const,
      color: t.brand.admin,
      route: '/admin' as any,
    },
    isCoordinator && !hasAdminAccess && {
      label: 'Minha Coordenação',
      subtitle: 'Membros e convites da unidade',
      icon: 'ribbon-outline' as const,
      color: t.brand.coord,
      route: '/coordinator' as any,
    },
    hasRetreatAccess && !hasAdminAccess && {
      label: 'Ministério de Retiro',
      subtitle: 'Retiros, equipes e inscrições',
      icon: 'compass-outline' as const,
      color: '#b45309',
      route: '/coordinator' as any,
    },
  ].filter(Boolean) as { label: string; subtitle: string; icon: any; color: string; route: any }[];

  return (
    <View style={{ paddingHorizontal: 16, marginTop: 20, marginBottom: 4 }}>
      <Text style={{ fontSize: 13, fontFamily: 'Nunito-Bold', color: t.text.tertiary, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 12 }}>
        Área de Serviço
      </Text>
      {items.map((item) => (
        <TouchableOpacity
          key={item.label}
          onPress={() => router.push(item.route)}
          accessibilityLabel={item.label}
          style={{
            backgroundColor: t.bg.elevated,
            borderRadius: r.lg,
            padding: 14,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 12,
            marginBottom: 8,
            borderWidth: 1,
            borderColor: `${item.color}30`,
            ...t.shadow.sm,
          }}
        >
          <View style={{
            width: 40, height: 40, borderRadius: 20,
            backgroundColor: `${item.color}18`,
            alignItems: 'center', justifyContent: 'center',
          }}>
            <Ionicons name={item.icon} size={20} color={item.color} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 14, fontFamily: 'Nunito-SemiBold', color: item.color }}>
              {item.label}
            </Text>
            <Text style={{ fontSize: 12, fontFamily: 'Nunito-Regular', color: t.text.secondary, marginTop: 2 }}>
              {item.subtitle}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={16} color={item.color} />
        </TouchableOpacity>
      ))}
    </View>
  );
}

// ── 5. Rodapé Espiritual ──────────────────────────────────────
function SpiritualFooter({ t }: { t: SemanticTokens }) {
  return (
    <View style={{ alignItems: 'center', paddingVertical: 32, paddingHorizontal: 32 }}>
      <View style={{ width: 32, height: 1, backgroundColor: t.border.subtle, marginBottom: 16 }} />
      <Text style={{
        fontSize: 12,
        fontFamily: 'Nunito-Italic',
        color: t.text.tertiary,
        textAlign: 'center',
        lineHeight: 20,
      }}>
        Obra Lumen · Formação e Missão
      </Text>
    </View>
  );
}
```

- [ ] **Step 5.4 — Remover StyleSheet antigo**

O `const styles = StyleSheet.create({...})` original do home.tsx pode ser removido inteiramente — toda a estilagem agora usa inline com tokens.

- [ ] **Step 5.5 — Verificar tipos**

```bash
cd lumen_mobile && npx tsc --noEmit 2>&1 | grep "tabs)/home"
```

Esperado: zero linhas de output (ou apenas erros pré-existentes previamente documentados).

- [ ] **Step 5.6 — Commit**

```bash
git add lumen_mobile/app/\(tabs\)/home.tsx
git commit -m "feat(home): hierarquia 5 seções + useTheme + Nunito — membro primeiro"
```

---

## Task 6: Typecheck final e validação

- [ ] **Step 6.1 — Rodar typecheck completo**

```bash
cd lumen_mobile && npx tsc --noEmit 2>&1
```

Classifique os erros:
- **Novos erros** (arquivos das Tasks 1-5): devem ser zero. Se houver, corrigir antes de seguir.
- **Erros pré-existentes** (services/, firebase.ts, vida/, channel/): documentar, não corrigir.

- [ ] **Step 6.2 — Verificar que exports do design system estão resolvendo**

```bash
cd lumen_mobile && npx tsc --noEmit 2>&1 | grep -E "theme|tokens|ThemeContext"
```

Esperado: zero linhas.

- [ ] **Step 6.3 — Commit de fechamento**

```bash
git add -A
git commit -m "chore(cp2): Checkpoint 2 completo — Login, Home, TabBar"
```

---

## Self-Review do Plano

**Cobertura do spec:**
- ✅ Login "Vela em Catedral" com fundo `#0d1a2e` → Task 3
- ✅ Register step 1 fundo + Nunito → Task 4
- ✅ Acessibilidade: ícone + texto em todos os estados de erro/sucesso → Task 3 (Steps 3.1)
- ✅ Home: hierarquia 5 seções, membro primeiro → Task 5
- ✅ Versículo integrado ao hero, não como card solto → Task 5 (HeroSection)
- ✅ Tab bar pill animado + labels definitivos → Tasks 1-2
- ✅ Fallback web (overshootClamping + spring compatível) → Task 1
- ✅ Labels: Servir, Comunidade, Início, Inbox, Perfil → Task 2
- ✅ Zero alteração em lógica Firebase/API/rotas → confirmado em Tasks 3, 4, 5

**Tipos consistentes entre tasks:**
- `SemanticTokens` importado de `@/theme` — definido em `tokens.ts` e re-exportado em `index.ts` ✓
- `radius` usado como `typeof import('@/theme/tokens').radius` — consistente ✓
- `CustomTabBar` recebe `BottomTabBarProps` de `@react-navigation/bottom-tabs` — disponível via Expo ✓

**Riscos documentados:**
1. `@react-navigation/bottom-tabs` precisa estar disponível — expo-router o inclui, mas confirmar se o tipo `BottomTabBarProps` resolve
2. `Nunito-Italic` precisa estar carregada no `_layout.tsx` raiz — verificar no CP1
3. `t.bg.spiritual` é opcional no tipo (`??` na Task 5 trata esse caso)
