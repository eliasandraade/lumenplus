# Progresso de execução — rodada final

**Atualizado:** 2026-08-06. Estado **verificado**, não presumido.

## Concluído nesta rodada

| Item | Evidência |
|---|---|
| **UGC — denúncia e bloqueio** | PR #33: modelos + migration 045 (head único) + 6 endpoints + **20 testes**; UI no app |
| **Bloqueio esconde conteúdo de verdade** | teste `test_bloqueio_esconde_conteudo_no_feed`: post some do feed, `total` acompanha, desbloqueio restaura |
| **Políticas oficiais verificadas** | `policy-baseline.md`: **101 requisitos VERIFICADOS** em developer.apple.com / support.google.com / docs.expo.dev; 27 marcados NÃO VERIFICADO |
| **Target API 36** | `android/gradle.properties` gerado: `android.targetSdkVersion=36`, `compileSdkVersion=36` |
| **Build local automatizado** | `npm run android:release` — detecta caminho hostil, espelha, compila, coleta artefatos |
| **Exclusão de conta (app + web)** | `app/account/delete.tsx` e `app/excluir-conta.tsx` |
| **Assets reais** | gerados de `icon.svg`, dimensões e alpha validados |
| **Compilação Android (debug)** | `app-debug.apk`, 169 MB, manifest conferido |

## Achados com prazo (de fonte oficial)

### 1. Google Play — target API 36 até **31/08/2026** ✅ RESOLVIDO
Expo SDK 52 gera `targetSdkVersion 34` (confirmado no `build.gradle` do prebuild).
Sem override o app **não poderia ser publicado** após essa data.
Corrigido via `expo-build-properties`.

### 2. Apple — Xcode 26 + iOS SDK 26 desde **28/04/2026** ⚠️ EM ABERTO
A compatibilidade de **Expo SDK 52 / RN 0.76 com Xcode 26 NÃO foi verificada**
em fonte oficial da Expo. Pode exigir upgrade de SDK antes de submeter.
**Este é o maior risco de prazo do projeto.**

### 3. Apple — exclusão precisa apagar o UGC ⚠️ DECISÃO JURÍDICA
A Apple exige apagar *"the entire account record"*, e a documentação diz
explicitamente que isso inclui conteúdo compartilhado com outros (posts, fotos).
O `anonymize_user` atual **mantém** a linha `User`, os consentimentos e a
auditoria (retenção legal de 5 anos) e **não toca** posts de canal.
Conflito real entre exigência da loja e obrigação legal — **precisa de decisão jurídica**.

## Bugs meus, encontrados e corrigidos nesta rodada

| Bug | Sintoma | Correção |
|---|---|---|
| `/XD android ios` no robocopy | excluía `node_modules/@expo/config-plugins/build/ios` → `Cannot find module './ios'` | excluir pelo caminho absoluto da raiz |
| `gradlew.bat` sem caminho | "não é reconhecido como comando" | invocar pelo caminho absoluto |
| `expo install` sobrescreveu o plugin | virou string simples → rodou **sem config**, targetSdk voltou a 34 | restaurada a entrada `["expo-build-properties", {...}]` |
| `buildToolsVersion 36.0.0` | não instalado; auto-install falha | trocado por `36.1.0` (presente na máquina) |

## Ainda pendente (técnico)

| Item | Bloqueio |
|---|---|
| AAB de release | build em curso |
| Instalar APK e smoke | **sem emulador/`adb`** neste ambiente |
| E2E | depende de instalação |
| iOS compilar | job macOS no CI — GitHub instável hoje (HTTP 500 / Service Unavailable) |
| Filtro pré-publicação de UGC | Apple G1.2 exige **4** salvaguardas; implementei 3 (denúncia, bloqueio, moderação) |
| Screenshots | dependem do app rodando |
| Carga autenticada | staging roda `AUTH_MODE=PROD`; exige token Firebase real |

## Nota sobre o CI

O workflow `mobile-build.yml` falhou hoje por **infraestrutura do GitHub**
(`Failed to resolve action download info: Service Unavailable`), não por código.
Os jobs Android e iOS ficaram `skipped` por dependerem do job `checks`.
Re-disparado.
