/**
 * Firebase Configuration
 * ======================
 * Inicializa o Firebase App e Auth para uso universal (web + iOS + Android).
 * Os valores são lidos de variáveis de ambiente EXPO_PUBLIC_FIREBASE_*.
 *
 * Para desenvolvimento local: copie .env.example → .env.local e preencha os valores.
 * Para produção (Vercel/EAS): configure as variáveis no painel do serviço.
 *
 * Modo DEV (sem credenciais Firebase): IS_DEV_AUTH=true.
 * O auth exportado é um mock — tokens são gerenciados via AsyncStorage.
 */

import { Platform } from 'react-native';
import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { getAuth, initializeAuth, Auth } from 'firebase/auth';

/** true quando não há credenciais Firebase configuradas (ambiente local/dev) */
export const IS_DEV_AUTH = !process.env.EXPO_PUBLIC_FIREBASE_API_KEY;

/**
 * Trava de segurança (M4): em build de PRODUÇÃO sem credenciais Firebase, o app
 * NÃO deve cair silenciosamente em modo DEV (mock auth). `MISCONFIGURED` sinaliza
 * esse cenário para o root layout exibir uma tela clara de erro de configuração.
 * Em DEV/local (`__DEV__`), o modo DEV continua permitido normalmente.
 */
export const MISCONFIGURED = !__DEV__ && IS_DEV_AUTH;

// Mock auth para modo DEV — evita crash por API key ausente
const mockAuth = {
  authStateReady: () => Promise.resolve(),
  get currentUser() { return null; },
  onAuthStateChanged: (_cb: (u: null) => void) => { _cb(null); return () => {}; },
} as unknown as Auth;

function initFirebase(): { app: FirebaseApp; auth: Auth } {
  const firebaseConfig = {
    apiKey:            process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
    authDomain:        process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId:         process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
    storageBucket:     process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    appId:             process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
    measurementId:     process.env.EXPO_PUBLIC_FIREBASE_MEASUREMENT_ID,
  };

  const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

  function createAuth(): Auth {
    if (Platform.OS === 'web') return getAuth(app);

    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const AsyncStorage = require('@react-native-async-storage/async-storage').default;
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { getReactNativePersistence } = require('firebase/auth');

    // O try/catch que existia aqui engolia o erro e caía em getAuth(app) — que
    // falha exatamente igual, com "Component auth has not been registered yet".
    // O resultado era um crash na inicialização cuja causa não aparecia em
    // lugar nenhum. Se a persistência de RN não estiver disponível, o problema
    // é de resolução de módulo (ver metro.config.js) e precisa aparecer.
    if (typeof getReactNativePersistence !== 'function') {
      throw new Error(
        'firebase/auth foi resolvido sem getReactNativePersistence — o Metro ' +
          'provavelmente carregou o bundle de browser. Ver metro.config.js.'
      );
    }

    return initializeAuth(app, { persistence: getReactNativePersistence(AsyncStorage) });
  }

  return { app, auth: createAuth() };
}

const firebase = IS_DEV_AUTH ? null : initFirebase();

export const auth: Auth = IS_DEV_AUTH ? mockAuth : firebase!.auth;
export default IS_DEV_AUTH ? {} as FirebaseApp : firebase!.app;
