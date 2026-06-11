/**
 * Root Layout
 * ===========
 * Layout raiz que envolve toda a aplicação.
 */

import React from 'react';
import * as Sentry from '@sentry/react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { View, Text, StyleSheet, ScrollView, Platform } from 'react-native';
import { VercelAnalytics } from '@/components/VercelAnalytics';
import { useFonts } from 'expo-font';
import {
  Nunito_400Regular,
  Nunito_400Regular_Italic,
  Nunito_600SemiBold,
  Nunito_700Bold,
  Nunito_800ExtraBold,
} from '@expo-google-fonts/nunito';
import * as SplashScreen from 'expo-splash-screen';
import { ThemeProvider, useTheme } from '@/theme';
import { UnlockedCyclesProvider } from '@/contexts/UnlockedCyclesContext';
import { MISCONFIGURED } from '@/config/firebase';

// Sentry — inicializa antes de qualquer render
Sentry.init({
  dsn: process.env.EXPO_PUBLIC_SENTRY_DSN ?? '',
  environment: process.env.EXPO_PUBLIC_ENVIRONMENT ?? 'production',
  release: `lumenplus-frontend@${process.env.EXPO_PUBLIC_APP_VERSION ?? '1.0.0'}`,
  // LGPD: não capturar dados pessoais automaticamente
  sendDefaultPii: false,
  // Performance: 10% das navegações
  tracesSampleRate: 0.1,
  // Só ativa se o DSN estiver configurado
  enabled: !!process.env.EXPO_PUBLIC_SENTRY_DSN,
});

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 2,
      staleTime: 1000 * 60,
    },
  },
});

// Fallback exibido quando o Sentry captura um crash não recuperável
function CrashFallback({ error }: { error: Error }) {
  return (
    <View style={eb.container}>
      <ScrollView contentContainerStyle={eb.scroll}>
        <Text style={eb.title}>Algo deu errado</Text>
        <Text style={eb.msg}>
          O erro foi registrado automaticamente. Tente recarregar a página.
        </Text>
        {__DEV__ && (
          <>
            <Text style={eb.label}>{error.message}</Text>
            <Text style={eb.stack}>{error.stack}</Text>
          </>
        )}
      </ScrollView>
    </View>
  );
}

const eb = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#1a1a1a' },
  scroll: { padding: 16, paddingTop: 60 },
  title: { fontSize: 20, fontWeight: '700', color: '#ef4444', marginBottom: 16 },
  label: { fontSize: 12, fontWeight: '700', color: '#9ca3af', marginTop: 12, marginBottom: 4 },
  msg: { fontSize: 14, color: '#fca5a5' },
  stack: { fontSize: 11, color: '#6b7280', fontFamily: 'monospace', lineHeight: 18 },
});

// Tela de erro de configuração (M4): produção sem credenciais Firebase.
// Evita que o app caia silenciosamente em modo DEV auth em produção.
function ConfigError() {
  return (
    <View style={ce.container}>
      <View style={ce.box}>
        <Text style={ce.title}>Configuração de ambiente ausente</Text>
        <Text style={ce.msg}>
          As credenciais de autenticação (Firebase) não foram encontradas neste
          build. O aplicativo não pode iniciar com segurança.
        </Text>
        <Text style={ce.hint}>
          Verifique as variáveis EXPO_PUBLIC_FIREBASE_* no ambiente de produção.
        </Text>
      </View>
    </View>
  );
}

const ce = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0d1a2e', alignItems: 'center', justifyContent: 'center', padding: 24 },
  box: { maxWidth: 420, width: '100%' },
  title: { fontSize: 20, fontWeight: '700', color: '#f87171', marginBottom: 12, textAlign: 'center' },
  msg: { fontSize: 15, color: '#e8f0f8', lineHeight: 22, textAlign: 'center', marginBottom: 12 },
  hint: { fontSize: 13, color: '#7fa3c0', lineHeight: 20, textAlign: 'center' },
});

// Mantém splash screen até fontes carregarem
SplashScreen.preventAutoHideAsync().catch(() => {});

function AppStack() {
  const { isDark, t } = useTheme();

  return (
    <>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: t.bg.elevated },
          headerTintColor: t.text.primary,
          headerTitleStyle: {
            fontFamily: 'Nunito-Bold',
            fontSize: 17,
          },
          contentStyle: { backgroundColor: t.bg.screen },
          animation: 'fade_from_bottom',
        }}
      >
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="(auth)" options={{ headerShown: false }} />
        <Stack.Screen name="(onboarding)" options={{ headerShown: false }} />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="admin" options={{ headerShown: false }} />
        <Stack.Screen name="biblia" options={{ headerShown: false }} />
        <Stack.Screen name="catecismo" options={{ headerShown: false }} />
        <Stack.Screen name="retreats" options={{ headerShown: false }} />
        <Stack.Screen name="coordinator" options={{ headerShown: false }} />
        <Stack.Screen name="vida" options={{ headerShown: false }} />
        <Stack.Screen name="channel" options={{ headerShown: false }} />
      </Stack>
      <VercelAnalytics />
    </>
  );
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    'Nunito-Regular':   Nunito_400Regular,
    'Nunito-Italic':    Nunito_400Regular_Italic,
    'Nunito-SemiBold':  Nunito_600SemiBold,
    'Nunito-Bold':      Nunito_700Bold,
    'Nunito-ExtraBold': Nunito_800ExtraBold,
  });

  // Esconde splash quando fontes estiverem prontas (ou com erro — usa fallback)
  React.useEffect(() => {
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync().catch(() => {});
    }
  }, [fontsLoaded, fontError]);

  // Aguarda fontes antes de renderizar para evitar flash de fonte incorreta
  if (!fontsLoaded && !fontError) return null;

  // Trava de segurança (M4): produção sem credenciais Firebase → tela de erro
  // de config, em vez de cair silenciosamente em modo DEV auth.
  if (MISCONFIGURED) return <ConfigError />;

  return (
    <Sentry.ErrorBoundary fallback={({ error }) => <CrashFallback error={error as Error} />}>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider>
          <UnlockedCyclesProvider>
            <SafeAreaProvider>
              <AppStack />
            </SafeAreaProvider>
          </UnlockedCyclesProvider>
        </ThemeProvider>
      </QueryClientProvider>
    </Sentry.ErrorBoundary>
  );
}
