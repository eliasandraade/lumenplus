# Lumen+ Mobile

Frontend do Lumen+ — aplicativo React Native / Expo exportado como SPA web, hospedado no Vercel.

## Stack

- **React Native 0.76** + **Expo SDK 52**
- **Expo Router 4** (file-based routing)
- **TypeScript 5.3**
- **Zustand 4** (estado global)
- **TanStack React Query 5** (dados do servidor)
- **Firebase SDK 10** (autenticação)
- **Sentry React Native** (monitoramento de erros)
- **Vercel Analytics** (métricas de uso)

## Estrutura de rotas

```
app/
├── _layout.tsx            # Stack raiz
├── index.tsx              # Splash/redirect
├── (auth)/                # Login · Cadastro · Verificações
├── (onboarding)/          # Termos · Perfil · Documentos
├── (tabs)/                # Home · Serviço · Comunidade · Convites · Perfil
├── vida/                  # Projeto de Vida (wizard 8 passos, revisão mensal)
├── admin/                 # Painel administrativo
├── biblia/                # Bíblia (leitor por livro/capítulo)
├── catecismo/             # Catecismo da Igreja Católica
├── retreats/              # Retiros
└── coordinator/           # Painel do coordenador
```

## Como rodar localmente

```bash
cd lumen_mobile
npm install
npx expo start          # Expo Go / simulador
npx expo start --web    # Navegador
```

## Build para web (produção)

```bash
npx expo export --platform web
# Saída em dist/
```

## Deploy

O deploy é feito automaticamente via Vercel CLI ou push para o branch principal:

```bash
vercel --prod --yes
```

URL de produção: `https://lumenmobile.vercel.app`

## Variáveis de ambiente

Criar `.env.local` na raiz do `lumen_mobile/`:

```env
EXPO_PUBLIC_API_URL=https://backend-production-6efc.up.railway.app
EXPO_PUBLIC_FIREBASE_API_KEY=...
EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN=...
EXPO_PUBLIC_FIREBASE_PROJECT_ID=lumenplus-3fec7
EXPO_PUBLIC_SENTRY_DSN=...          # opcional
EXPO_PUBLIC_ENVIRONMENT=production
EXPO_PUBLIC_APP_VERSION=1.0.0
```
