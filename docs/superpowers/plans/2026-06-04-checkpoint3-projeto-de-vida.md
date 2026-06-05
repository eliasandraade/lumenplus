# Checkpoint 3 — Projeto de Vida: "Caderno de Oração" — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign visual de todas as 6 telas do Projeto de Vida usando o design system dos Checkpoints 1 e 2. Conceito "Caderno de Oração" — contemplativo, espiritual, limpo.

**Architecture:** 6 tarefas independentes em sequência (uma por tela), cada uma com commit isolado. A lógica de negócio de cada arquivo é preservada byte-a-byte — apenas `const colors`, StyleSheet e JSX de apresentação mudam. Padrão idêntico ao CP2: remover `const colors`, adicionar `useTheme`, substituir return() e styles.

**Tech Stack:** `useTheme()` do design system CP1, tokens de `src/theme/tokens.ts`, Nunito fonts, `react-native-reanimated` (não usado aqui — sem novas animações além do que já existe), Expo Router.

**Regra universal:** `const colors = {...}` → remover. `useTheme()` → adicionar. `StyleSheet.create` → remover onde possível, usar inline com tokens. Toda lógica acima do `return (` é intocável.

---

## Mapa de arquivos

| Arquivo | Ação | Complexidade |
|---|---|---|
| `lumen_mobile/app/vida/unlock.tsx` | Redesign visual | Baixa — 1 card central |
| `lumen_mobile/app/vida/historico.tsx` | Redesign visual | Baixa — FlatList simples |
| `lumen_mobile/app/vida/index.tsx` | Redesign visual | Média — múltiplas seções |
| `lumen_mobile/app/vida/ciclo.tsx` | Redesign visual | Média — seções com sub-componentes |
| `lumen_mobile/app/vida/revisao.tsx` | Redesign visual | Média — Ato de Contrição especial |
| `lumen_mobile/app/vida/wizard.tsx` | Redesign visual | Alta — 8 steps, barra progresso, formulários |

---

## Task 1: unlock.tsx — PIN "Caderno de Oração"

**Files:**
- Modify: `lumen_mobile/app/vida/unlock.tsx`

**Lógica intocável:** `useLocalSearchParams`, `useState` (pin, loading, error), `useRef`, `handleVerify`, `projetoVidaMensalApi.verificarPin`, `router.replace`, `inputRef`.

- [ ] **Step 1.1 — Escrever unlock.tsx redesenhado**

```tsx
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
```

- [ ] **Step 1.2 — Verificar tipos**

```bash
cd lumen_mobile && npx tsc --noEmit 2>&1 | grep "vida/unlock"
```

Esperado: zero linhas.

- [ ] **Step 1.3 — Commit**

```bash
git add "lumen_mobile/app/vida/unlock.tsx"
git commit -m "feat(vida): unlock — PIN redesign Caderno de Oração + privacidade + a11y"
```

---

## Task 2: historico.tsx — Lista de ciclos

**Files:**
- Modify: `lumen_mobile/app/vida/historico.tsx`

**Lógica intocável:** `useState`, `useFocusEffect`, `fetchHistorico`, `onRefresh`, `handleOpen`, `projetoVidaMensalApi.getHistorico`.

- [ ] **Step 2.1 — Escrever historico.tsx redesenhado**

```tsx
/**
 * Projeto de Vida — Histórico de Ciclos
 * Lógica intacta. Redesign "Caderno de Oração".
 */

import { useState, useCallback } from 'react';
import {
  View, Text, FlatList,
  TouchableOpacity, ActivityIndicator, RefreshControl, StyleSheet,
} from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import projetoVidaMensalApi, {
  type ProjetoVidaMensalSummary,
  MESES,
} from '@/services/projetoVidaMensal';
import { useTheme } from '@/theme';

export default function HistoricoScreen() {
  const { t, r } = useTheme();
  const [projetos, setProjetos] = useState<ProjetoVidaMensalSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchHistorico = async () => {
    try {
      const result = await projetoVidaMensalApi.getHistorico();
      setProjetos(result);
    } catch {
      setProjetos([]);
    }
  };

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      fetchHistorico().finally(() => setLoading(false));
    }, [])
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchHistorico();
    setRefreshing(false);
  }, []);

  const handleOpen = (item: ProjetoVidaMensalSummary) => {
    if (item.has_pin) {
      router.push({ pathname: '/vida/unlock', params: { projetoId: item.id } });
    } else {
      router.push({ pathname: '/vida/ciclo', params: { projetoId: item.id } });
    }
  };

  if (loading) {
    return (
      <View style={[styles.centered, { backgroundColor: t.bg.screen }]}>
        <ActivityIndicator size="large" color={t.brand.primary} />
      </View>
    );
  }

  if (projetos.length === 0) {
    return (
      <View style={[styles.centered, { backgroundColor: t.bg.screen }]}>
        <Ionicons name="compass-outline" size={48} color={t.text.tertiary} />
        <Text style={[styles.emptyTitle, { color: t.text.primary }]}>
          Nenhum ciclo ainda
        </Text>
        <Text style={[styles.emptySubtitle, { color: t.text.secondary }]}>
          O primeiro passo é sempre o mais sagrado.
        </Text>
        <TouchableOpacity
          style={[styles.startButton, { backgroundColor: t.brand.primary, borderRadius: r.lg }]}
          onPress={() => router.replace('/vida' as any)}
          accessibilityLabel="Ir para Projeto de Vida"
          accessibilityRole="button"
        >
          <Text style={styles.startButtonText}>Ir para Projeto de Vida</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <FlatList
      style={{ flex: 1, backgroundColor: t.bg.screen }}
      contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
      data={projetos}
      keyExtractor={(item) => item.id}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          colors={[t.brand.primary]}
        />
      }
      ListHeaderComponent={
        <Text style={[styles.headerTitle, { color: t.text.tertiary }]}>
          {projetos.length} ciclo{projetos.length !== 1 ? 's' : ''} registrado{projetos.length !== 1 ? 's' : ''}
        </Text>
      }
      renderItem={({ item }) => (
        <TouchableOpacity
          style={[
            styles.cycleCard,
            {
              backgroundColor: t.bg.elevated,
              borderColor: t.border.subtle,
              borderRadius: r.lg,
              ...t.shadow.sm,
            },
          ]}
          onPress={() => handleOpen(item)}
          activeOpacity={0.8}
          accessibilityLabel={`Ciclo de ${MESES[item.mes - 1]} ${item.ano}`}
        >
          <View style={styles.cardTop}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.cardMonth, { color: t.text.primary }]}>
                {MESES[item.mes - 1]}
              </Text>
              <Text style={[styles.cardYear, { color: t.text.tertiary }]}>
                {item.ano}
              </Text>
            </View>
            <View style={styles.badges}>
              {item.has_pin && (
                <Ionicons name="lock-closed" size={14} color={t.text.tertiary} />
              )}
              {item.concluido && (
                <View style={[styles.badge, { backgroundColor: t.brand.primaryDim, borderRadius: r.full }]}>
                  <Ionicons name="checkmark-circle" size={12} color={t.brand.primary} />
                  <Text style={[styles.badgeText, { color: t.brand.primary }]}>Concluído</Text>
                </View>
              )}
            </View>
            <Ionicons name="chevron-forward" size={16} color={t.text.tertiary} />
          </View>
        </TouchableOpacity>
      )}
    />
  );
}

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    gap: 12,
  },
  emptyTitle: {
    fontSize: 18,
    fontFamily: 'Nunito-Bold',
  },
  emptySubtitle: {
    fontSize: 14,
    fontFamily: 'Nunito-Italic',
    textAlign: 'center',
    lineHeight: 22,
  },
  startButton: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    marginTop: 8,
  },
  startButtonText: {
    color: '#ffffff',
    fontSize: 15,
    fontFamily: 'Nunito-SemiBold',
  },
  headerTitle: {
    fontSize: 12,
    fontFamily: 'Nunito-Regular',
    marginBottom: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  cycleCard: {
    padding: 16,
    marginBottom: 10,
    borderWidth: StyleSheet.hairlineWidth,
  },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  cardMonth: {
    fontSize: 16,
    fontFamily: 'Nunito-Bold',
  },
  cardYear: {
    fontSize: 13,
    fontFamily: 'Nunito-Regular',
    marginTop: 1,
  },
  badges: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 3,
    gap: 4,
  },
  badgeText: {
    fontSize: 11,
    fontFamily: 'Nunito-SemiBold',
  },
});
```

- [ ] **Step 2.2 — Verificar tipos**

```bash
cd lumen_mobile && npx tsc --noEmit 2>&1 | grep "vida/historico"
```

Esperado: zero linhas (os erros de `Href` em historico são pré-existentes — confirmar se permanecem iguais).

- [ ] **Step 2.3 — Commit**

```bash
git add "lumen_mobile/app/vida/historico.tsx"
git commit -m "feat(vida): historico — redesign Caderno de Oração + estado vazio acolhedor"
```

---

## Task 3: index.tsx — Hub principal

**Files:**
- Modify: `lumen_mobile/app/vida/index.tsx`

**Lógica intocável:** `useState` (projeto, loading, refreshing, error), `useFocusEffect`, `load`, `handleAbrirCiclo`, `handleNovoMes`, `handleHistorico`, `projetoVidaMensalApi.getAtual`.

- [ ] **Step 3.1 — Escrever index.tsx redesenhado**

Substituir o arquivo completo mantendo toda a lógica:

```tsx
/**
 * Projeto de Vida Mensal — Hub
 * Lógica intacta. Redesign "Caderno de Oração".
 */

import { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  TouchableOpacity, ActivityIndicator, RefreshControl,
} from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import type { IoniconsName } from '@/types/icons';
import projetoVidaMensalApi, {
  type ProjetoVidaMensalFull,
  MESES,
} from '@/services/projetoVidaMensal';
import { useTheme } from '@/theme';

export default function VidaHubScreen() {
  const { t, r } = useTheme();

  const [projeto, setProjeto] = useState<ProjetoVidaMensalFull | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const now = new Date();
  const mesAtual = now.getMonth() + 1;
  const anoAtual = now.getFullYear();

  const load = useCallback(async (isRefresh = false) => {
    if (!isRefresh) setLoading(true);
    setError(null);
    try {
      const data = await projetoVidaMensalApi.getAtual(mesAtual, anoAtual);
      setProjeto(data);
    } catch {
      setError('Erro ao carregar projeto. Tente novamente.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const handleAbrirCiclo = () => {
    if (!projeto) return;
    if (projeto.has_pin) {
      router.push({ pathname: '/vida/unlock', params: { projetoId: projeto.id } });
    } else {
      router.push({ pathname: '/vida/ciclo', params: { projetoId: projeto.id } });
    }
  };

  const handleNovoMes = () => router.push('/vida/wizard');
  const handleHistorico = () => router.push('/vida/historico');

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: t.bg.screen }]}>
        <ActivityIndicator size="large" color={t.brand.primary} />
      </View>
    );
  }

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: t.bg.screen }}
      contentContainerStyle={{ padding: 20, paddingBottom: 48 }}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => { setRefreshing(true); load(true); }}
          colors={[t.brand.primary]}
        />
      }
    >
      {/* Erro */}
      {error && (
        <View style={[styles.errorBox, { backgroundColor: t.status.errorBg, borderColor: t.status.error }]}>
          <Ionicons name={'alert-circle' as IoniconsName} size={15} color={t.status.error} />
          <Text style={[styles.errorText, { color: t.status.error }]}>{error}</Text>
        </View>
      )}

      {/* ── Header contemplativo ── */}
      <View style={styles.headerCard}>
        <View style={[styles.iconWrap, { backgroundColor: t.brand.primaryDim, borderRadius: r.xl }]}>
          <Ionicons name={'compass-outline' as IoniconsName} size={28} color={t.brand.primary} />
        </View>
        <Text style={[styles.title, { color: t.text.primary }]}>Projeto de Vida</Text>
        <Text style={[styles.subtitle, { color: t.text.tertiary }]}>
          {MESES[mesAtual - 1]} {anoAtual}
        </Text>
      </View>

      {/* ── Recomendação espiritual ── */}
      <View
        style={[
          styles.recomendacaoCard,
          {
            backgroundColor: t.bg.spiritual,
            borderLeftColor: t.accent.spiritual,
            borderRadius: r.md,
          },
        ]}
      >
        <View style={styles.recomendacaoHeader}>
          <Ionicons
            name={'sparkles' as IoniconsName}
            size={14}
            color={t.accent.spiritual}
          />
          <Text style={[styles.recomendacaoLabel, { color: t.accent.spiritual }]}>
            Recomendação
          </Text>
        </View>
        <Text style={[styles.recomendacaoText, { color: t.text.spiritual }]}>
          Recomendamos que você inicie o seu Projeto de Vida em oração e, de preferência, na Vigília Vocacional em comunidade com seus irmãos.
        </Text>
      </View>

      {/* ── Ciclo atual ou estado vazio ── */}
      {projeto ? (
        <>
          {/* Card do ciclo */}
          <TouchableOpacity
            style={[
              styles.cicloCard,
              {
                backgroundColor: t.bg.elevated,
                borderColor: t.border.subtle,
                borderRadius: r.xl,
                ...t.shadow.sm,
              },
            ]}
            onPress={handleAbrirCiclo}
            activeOpacity={0.8}
            accessibilityLabel={`Ciclo de ${MESES[projeto.mes - 1]} ${projeto.ano}`}
          >
            {/* Header do card */}
            <View style={styles.cicloCardHeader}>
              <Ionicons
                name={'book-outline' as IoniconsName}
                size={20}
                color={t.brand.primary}
              />
              <Text style={[styles.cicloCardTitle, { color: t.text.primary }]}>
                {MESES[projeto.mes - 1]} {projeto.ano}
              </Text>
              {projeto.has_pin && (
                <Ionicons
                  name={'lock-closed' as IoniconsName}
                  size={14}
                  color={t.text.tertiary}
                  style={{ marginLeft: 4 }}
                />
              )}
              {projeto.concluido && (
                <View style={[styles.badge, { backgroundColor: t.brand.primaryDim, borderRadius: r.full }]}>
                  <Ionicons name={'checkmark-circle' as IoniconsName} size={12} color={t.brand.primary} />
                  <Text style={[styles.badgeText, { color: t.brand.primary }]}>Concluído</Text>
                </View>
              )}
            </View>

            {/* Indicadores de caminho — não de performance */}
            <Text style={[styles.caminhoLabel, { color: t.text.tertiary }]}>
              Como está o seu ciclo
            </Text>
            <View style={styles.statsRow}>
              <CaminhoItem
                icon={'people-outline' as IoniconsName}
                label="Comunidade"
                ok={(projeto.comunidade?.partilha_acompanhador?.length ?? 0) > 0
                  || (projeto.comunidade?.dias_grupo?.length ?? 0) > 0}
                t={t}
              />
              <CaminhoItem
                icon={'heart-outline' as IoniconsName}
                label="Cuidado"
                ok={(projeto.cuidado?.consultas?.length ?? 0) > 0
                  || (projeto.cuidado?.descanso?.length ?? 0) > 0}
                t={t}
              />
              <CaminhoItem
                icon={'list-outline' as IoniconsName}
                label="Compromissos"
                ok={projeto.compromissos.length > 0}
                t={t}
              />
              <CaminhoItem
                icon={'sunny-outline' as IoniconsName}
                label="Oração"
                ok={projeto.praticas.length > 0}
                t={t}
              />
            </View>

            <View style={[styles.openRow, { borderTopColor: t.border.subtle }]}>
              <Text style={[styles.openText, { color: t.brand.primary }]}>
                Ver ciclo completo
              </Text>
              <Ionicons name={'chevron-forward' as IoniconsName} size={15} color={t.brand.primary} />
            </View>
          </TouchableOpacity>

          {/* Botão revisão */}
          {!projeto.concluido && (
            <TouchableOpacity
              style={[
                styles.revisaoBtn,
                { backgroundColor: t.brand.primary, borderRadius: r.lg },
              ]}
              onPress={() =>
                router.push({ pathname: '/vida/revisao', params: { projetoId: projeto.id } })
              }
              activeOpacity={0.8}
              accessibilityLabel="Iniciar revisão mensal"
              accessibilityRole="button"
            >
              <Ionicons name={'checkmark-circle-outline' as IoniconsName} size={18} color="#ffffff" />
              <Text style={styles.revisaoBtnText}>Revisão Mensal</Text>
            </TouchableOpacity>
          )}
        </>
      ) : (
        /* Estado vazio acolhedor */
        <View
          style={[
            styles.emptyCard,
            {
              backgroundColor: t.bg.elevated,
              borderColor: t.border.subtle,
              borderRadius: r.xl,
              ...t.shadow.sm,
            },
          ]}
        >
          <Ionicons name={'compass-outline' as IoniconsName} size={40} color={t.brand.primary} />
          <Text style={[styles.emptyTitle, { color: t.text.primary }]}>
            Este mês ainda não tem um ciclo
          </Text>
          <Text style={[styles.emptySubtitle, { color: t.text.secondary }]}>
            Que tal começar em oração?
          </Text>
          <TouchableOpacity
            style={[styles.primaryBtn, { backgroundColor: t.brand.primary, borderRadius: r.lg }]}
            onPress={handleNovoMes}
            activeOpacity={0.8}
            accessibilityLabel="Iniciar novo ciclo"
            accessibilityRole="button"
          >
            <Text style={styles.primaryBtnText}>Iniciar novo ciclo</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* ── Privacidade ── */}
      <View
        style={[
          styles.privacidadeCard,
          { backgroundColor: t.brand.primaryDim, borderRadius: r.md },
        ]}
      >
        <Ionicons
          name={'shield-checkmark-outline' as IoniconsName}
          size={14}
          color={t.brand.primary}
        />
        <Text style={[styles.privacidadeText, { color: t.text.secondary }]}>
          Tudo o que você escreve é seu. A Equipe Lumen+ não acessa o conteúdo do seu Projeto de Vida.
        </Text>
      </View>

      {/* ── Histórico ── */}
      <TouchableOpacity
        style={styles.histBtn}
        onPress={handleHistorico}
        activeOpacity={0.8}
        accessibilityLabel="Ver histórico de ciclos"
      >
        <Ionicons name={'time-outline' as IoniconsName} size={16} color={t.brand.primary} />
        <Text style={[styles.histBtnText, { color: t.brand.primary }]}>
          Ver histórico de ciclos
        </Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

// ── Sub-componente: indicador de caminho (não de performance) ──────────────────

import type { SemanticTokens } from '@/theme';

function CaminhoItem({
  icon, label, ok, t,
}: {
  icon: IoniconsName;
  label: string;
  ok: boolean;
  t: SemanticTokens;
}) {
  return (
    <View style={styles.caminhoItem}>
      <Ionicons
        name={ok ? icon.replace('-outline', '') as IoniconsName : icon}
        size={20}
        color={ok ? t.accent.spiritual : t.text.tertiary}
      />
      <Text style={[styles.caminhoItemLabel, { color: ok ? t.text.secondary : t.text.tertiary }]}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    marginBottom: 16,
  },
  errorText: { flex: 1, fontSize: 13, fontFamily: 'Nunito-Regular' },
  headerCard: { alignItems: 'center', marginBottom: 20 },
  iconWrap: {
    width: 56, height: 56,
    justifyContent: 'center', alignItems: 'center', marginBottom: 12,
  },
  title: { fontSize: 22, fontFamily: 'Nunito-ExtraBold', marginBottom: 4 },
  subtitle: { fontSize: 14, fontFamily: 'Nunito-Regular' },
  recomendacaoCard: {
    borderLeftWidth: 3,
    padding: 16,
    marginBottom: 20,
  },
  recomendacaoHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8,
  },
  recomendacaoLabel: {
    fontSize: 10, fontFamily: 'Nunito-Bold', textTransform: 'uppercase', letterSpacing: 1,
  },
  recomendacaoText: {
    fontSize: 14, fontFamily: 'Nunito-Italic', lineHeight: 22,
  },
  cicloCard: { padding: 18, marginBottom: 14, borderWidth: StyleSheet.hairlineWidth },
  cicloCardHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 14 },
  cicloCardTitle: { flex: 1, fontSize: 17, fontFamily: 'Nunito-Bold' },
  badge: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 8, paddingVertical: 3, gap: 4,
  },
  badgeText: { fontSize: 11, fontFamily: 'Nunito-SemiBold' },
  caminhoLabel: {
    fontSize: 11, fontFamily: 'Nunito-Regular',
    textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 12,
  },
  statsRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 14 },
  caminhoItem: { alignItems: 'center', gap: 6 },
  caminhoItemLabel: { fontSize: 10, fontFamily: 'Nunito-Regular' },
  openRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end',
    gap: 4, paddingTop: 12, borderTopWidth: StyleSheet.hairlineWidth,
  },
  openText: { fontSize: 13, fontFamily: 'Nunito-SemiBold' },
  revisaoBtn: {
    flexDirection: 'row', justifyContent: 'center', alignItems: 'center',
    gap: 8, padding: 16, marginBottom: 16,
  },
  revisaoBtnText: { color: '#ffffff', fontSize: 15, fontFamily: 'Nunito-Bold' },
  emptyCard: {
    padding: 32, alignItems: 'center', marginBottom: 16,
    borderWidth: StyleSheet.hairlineWidth, gap: 8,
  },
  emptyTitle: { fontSize: 17, fontFamily: 'Nunito-SemiBold', textAlign: 'center' },
  emptySubtitle: { fontSize: 14, fontFamily: 'Nunito-Italic', textAlign: 'center', marginBottom: 8 },
  primaryBtn: { paddingVertical: 14, paddingHorizontal: 28, marginTop: 8 },
  primaryBtnText: { color: '#ffffff', fontSize: 15, fontFamily: 'Nunito-Bold' },
  privacidadeCard: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 8, padding: 12, marginBottom: 8,
  },
  privacidadeText: { flex: 1, fontSize: 12, fontFamily: 'Nunito-Regular', lineHeight: 18 },
  histBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, padding: 16,
  },
  histBtnText: { fontSize: 14, fontFamily: 'Nunito-SemiBold' },
});
```

- [ ] **Step 3.2 — Verificar tipos**

```bash
cd lumen_mobile && npx tsc --noEmit 2>&1 | grep "vida/index"
```

- [ ] **Step 3.3 — Commit**

```bash
git add "lumen_mobile/app/vida/index.tsx"
git commit -m "feat(vida): hub — redesign Caderno de Oração + recomendação espiritual + privacidade"
```

---

## Task 4: ciclo.tsx — Visualização do ciclo

**Files:**
- Modify: `lumen_mobile/app/vida/ciclo.tsx`

**Lógica intocável:** `useLocalSearchParams`, `useState`, `useFocusEffect`, `load`, `projetoVidaMensalApi.get`. Sub-componentes `Section`, `EventoList`, `OutroComunidadeList`, `CuidadoList`, `OutroCuidadoList`, `TextField` — preservar lógica, redesenhar apenas o visual.

- [ ] **Step 4.1 — Ler o arquivo completo**

Antes de escrever, leia `lumen_mobile/app/vida/ciclo.tsx` na íntegra para mapear todos os sub-componentes.

- [ ] **Step 4.2 — Substituir cores e estilos**

A abordagem aqui é cirúrgica (como o register no CP2), não reescrita total:

1. Remover `const colors = {...}`
2. Adicionar `import { useTheme } from '@/theme'` e `import type { SemanticTokens } from '@/theme'`
3. Adicionar `const { t, r } = useTheme()` dentro de `CicloScreen()`
4. Substituir o `StyleSheet.create({...})` por inline styles com tokens nos elementos do return()
5. Em cada sub-componente que receber `t` e `r` como props, adicionar ao tipo

**Header do ciclo:**
```tsx
// Mês em Nunito-ExtraBold, badge "Concluído" com checkmark-circle verde
<View style={{ paddingHorizontal: 20, paddingTop: 20, paddingBottom: 16 }}>
  <Text style={{ fontSize: 24, fontFamily: 'Nunito-ExtraBold', color: t.text.primary }}>
    {mesLabel} {projeto.ano}
  </Text>
  {projeto.concluido && (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 }}>
      <Ionicons name="checkmark-circle" size={16} color={t.status.success} />
      <Text style={{ fontSize: 13, fontFamily: 'Nunito-SemiBold', color: t.status.success }}>
        Ciclo concluído
      </Text>
    </View>
  )}
</View>
```

**Sub-componente Section:**
```tsx
// Header de seção com ícone colorido + linha separadora
function Section({ title, icon, children, color, t, r }: {
  title: string;
  icon: IoniconsName;
  children: React.ReactNode;
  color: string;
  t: SemanticTokens;
  r: RadiusTokens;
}) {
  return (
    <View style={{
      backgroundColor: t.bg.elevated,
      borderRadius: r.lg,
      marginHorizontal: 16,
      marginBottom: 12,
      overflow: 'hidden',
      ...t.shadow.sm,
    }}>
      <View style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        padding: 16,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: t.border.subtle,
      }}>
        <View style={{
          width: 32, height: 32, borderRadius: 8,
          backgroundColor: `${color}18`,
          alignItems: 'center', justifyContent: 'center',
        }}>
          <Ionicons name={icon} size={18} color={color} />
        </View>
        <Text style={{ fontSize: 15, fontFamily: 'Nunito-Bold', color: t.text.primary, flex: 1 }}>
          {title}
        </Text>
      </View>
      <View style={{ padding: 16 }}>
        {children}
      </View>
    </View>
  );
}
```

**Texto vazio em seção:**
```tsx
// ANTES: <Text style={styles.empty}>Não preenchido</Text>
// DEPOIS:
<Text style={{ fontSize: 13, fontFamily: 'Nunito-Italic', color: t.text.tertiary }}>
  Ainda não preenchido neste ciclo.
</Text>
```

**Cores de seção a usar:**
- Comunidade: `t.brand.primary`
- Cuidado: `t.status.success`
- Compromissos: `t.accent.spiritual`
- Oração: `t.accent.spiritual`
- Revisão: `t.brand.primary`

- [ ] **Step 4.3 — Verificar tipos**

```bash
cd lumen_mobile && npx tsc --noEmit 2>&1 | grep "vida/ciclo"
```

- [ ] **Step 4.4 — Commit**

```bash
git add "lumen_mobile/app/vida/ciclo.tsx"
git commit -m "feat(vida): ciclo — redesign seções + Nunito + dark mode + textos acolhedores"
```

---

## Task 5: revisao.tsx — Revisão mensal + Ato de Contrição

**Files:**
- Modify: `lumen_mobile/app/vida/revisao.tsx`

**Lógica intocável:** `useLocalSearchParams`, `useState` (step, state, saving, error), `update`, `handleSave`, `projetoVidaMensalApi.upsertRevisao`, `QUESTOES`, `CONTRICAO_TEXT`, `renderStep`, `router.replace`.

- [ ] **Step 5.1 — Ler o arquivo completo antes de alterar**

Leia `lumen_mobile/app/vida/revisao.tsx` na íntegra.

- [ ] **Step 5.2 — Substituir cores e estilos**

1. Remover `const colors = {...}`
2. Adicionar `useTheme` + `const { t, r } = useTheme()` dentro do componente
3. Substituir StyleSheet com inline tokens

**Step 0 — Questões:**

Título da questão:
```tsx
<Text style={{ fontSize: 15, fontFamily: 'Nunito-SemiBold', color: t.text.primary, marginBottom: 6 }}>
  {q}
</Text>
```

Descrição/exemplo (quando existir):
```tsx
<Text style={{ fontSize: 13, fontFamily: 'Nunito-Italic', color: t.text.tertiary, lineHeight: 20, marginBottom: 12 }}>
  {description}
</Text>
```

TextInput de resposta:
```tsx
<TextInput
  style={{
    minHeight: 120,
    textAlignVertical: 'top',
    backgroundColor: t.bg.surface,
    borderRadius: r.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: t.border.subtle,
    padding: 14,
    fontSize: 15,
    fontFamily: 'Nunito-Regular',
    color: t.text.primary,
  }}
  // ... manter todos os outros props intactos
/>
```

**Step 1 — Ato de Contrição (bloco espiritual especial):**

```tsx
// SUBSTITUIR o prayerCard existente por:
<View style={{
  borderLeftWidth: 3,
  borderLeftColor: t.accent.spiritual,
  backgroundColor: t.bg.spiritual,
  borderRadius: r.md,
  padding: 20,
  marginVertical: 24,
}}>
  <Ionicons
    name={'heart' as IoniconsName}
    size={22}
    color={t.accent.spiritual}
    style={{ marginBottom: 16, alignSelf: 'center' }}
  />
  <Text style={{
    fontSize: 15,
    fontFamily: 'Nunito-Italic',
    color: t.text.spiritual,
    lineHeight: 26,
    textAlign: 'center',
  }}>
    {CONTRICAO_TEXT}
  </Text>
</View>
```

**Step 2 — Concluído:**

```tsx
<Ionicons name={'checkmark-circle' as IoniconsName} size={56} color={t.status.success} />
<Text style={{ fontSize: 20, fontFamily: 'Nunito-Bold', color: t.text.primary, marginTop: 16, textAlign: 'center' }}>
  Que Deus abençoe o seu próximo ciclo.
</Text>
<Text style={{ fontSize: 14, fontFamily: 'Nunito-Italic', color: t.text.secondary, marginTop: 8, textAlign: 'center', lineHeight: 22 }}>
  Sua revisão foi salva com cuidado.
</Text>
```

- [ ] **Step 5.3 — Verificar tipos**

```bash
cd lumen_mobile && npx tsc --noEmit 2>&1 | grep "vida/revisao"
```

- [ ] **Step 5.4 — Commit**

```bash
git add "lumen_mobile/app/vida/revisao.tsx"
git commit -m "feat(vida): revisao — Ato de Contrição espiritual + questões contemplativas + dark mode"
```

---

## Task 6: wizard.tsx — 8 passos de criação

**Files:**
- Modify: `lumen_mobile/app/vida/wizard.tsx`

**Lógica intocável:** `useState` (step, data, activeSemana, activeDia, saving, error), todos os handlers (update, addCompromisso, removeCompromisso, updateCompromisso, addPratica, removePratica, updatePratica, addEventoItem, removeEventoItem, updateEventoItem, addOutroComunidade, removeOutroComunidade, updateOutroComunidade, addCuidadoItem, removeCuidadoItem, updateCuidadoItem, addOutroCuidado, removeOutroCuidado, updateOutroCuidado, handleSave), toda a lógica de renderStep/renderConteudo.

- [ ] **Step 6.1 — Ler o arquivo completo**

Leia `lumen_mobile/app/vida/wizard.tsx` na íntegra (pode ser longo — ~400+ linhas).

- [ ] **Step 6.2 — Substituir cores e estilos (abordagem cirúrgica)**

1. Remover `const colors = {...}`
2. Adicionar `useTheme` + `const { t, r } = useTheme()` dentro de `WizardScreen()`
3. Substituir `StyleSheet.create({...})` por inline tokens

**Barra de progresso (adicionar no topo do return, antes do content):**
```tsx
{/* Barra de progresso */}
<View style={{ paddingHorizontal: 20, paddingTop: 12, paddingBottom: 4 }}>
  <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
    <Text style={{ fontSize: 12, fontFamily: 'Nunito-Regular', color: t.text.tertiary }}>
      Passo {step + 1} de {STEP_TITLES.length}
    </Text>
    <Text style={{ fontSize: 12, fontFamily: 'Nunito-SemiBold', color: t.text.secondary }}>
      {STEP_TITLES[step]}
    </Text>
  </View>
  <View style={{ height: 3, backgroundColor: t.border.subtle, borderRadius: 2 }}>
    <View style={{
      height: 3,
      width: `${((step + 1) / STEP_TITLES.length) * 100}%`,
      backgroundColor: t.brand.primary,
      borderRadius: 2,
    }} />
  </View>
</View>
```

**Step 0 — Início (abertura contemplativa):**
Substituir o conteúdo do step 0 por texto de boas-vindas com `Nunito-Italic` e `text.spiritual`.

**Inputs de formulário (todos os steps 2–6):**
```tsx
// Para cada TextInput de label + campo:
<Text style={{ fontSize: 14, fontFamily: 'Nunito-SemiBold', color: t.text.primary, marginBottom: 6 }}>
  {label}
</Text>
<TextInput
  style={{
    backgroundColor: t.bg.surface,
    borderRadius: r.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: t.border.subtle,
    padding: 12,
    fontSize: 15,
    fontFamily: 'Nunito-Regular',
    color: t.text.primary,
    minHeight: 48,
  }}
  placeholderTextColor={t.text.tertiary}
  // manter todos os outros props
/>
```

**Botões de navegação:**
```tsx
// "← Anterior" + "Próximo →"
<View style={{ flexDirection: 'row', gap: 12, padding: 16 }}>
  {step > 0 && (
    <TouchableOpacity
      style={{
        flex: 1, minHeight: 48, borderRadius: r.lg,
        borderWidth: 1, borderColor: t.border.default,
        alignItems: 'center', justifyContent: 'center',
      }}
      onPress={() => setStep(s => s - 1)}
      accessibilityLabel="Passo anterior"
    >
      <Text style={{ fontFamily: 'Nunito-SemiBold', color: t.text.secondary }}>← Anterior</Text>
    </TouchableOpacity>
  )}
  <TouchableOpacity
    style={{
      flex: 1, minHeight: 48, borderRadius: r.lg,
      backgroundColor: t.brand.primary,
      alignItems: 'center', justifyContent: 'center',
    }}
    onPress={step === STEP_TITLES.length - 1 ? handleSave : () => setStep(s => s + 1)}
    disabled={saving}
    accessibilityLabel={step === STEP_TITLES.length - 1 ? 'Criar meu ciclo' : 'Próximo passo'}
  >
    {saving
      ? <ActivityIndicator color="#ffffff" />
      : <Text style={{ fontFamily: 'Nunito-Bold', color: '#ffffff' }}>
          {step === STEP_TITLES.length - 1 ? 'Criar meu ciclo' : 'Próximo →'}
        </Text>
    }
  </TouchableOpacity>
</View>
```

- [ ] **Step 6.3 — Verificar tipos**

```bash
cd lumen_mobile && npx tsc --noEmit 2>&1 | grep "vida/wizard"
```

- [ ] **Step 6.4 — Commit**

```bash
git add "lumen_mobile/app/vida/wizard.tsx"
git commit -m "feat(vida): wizard — barra progresso + formulários contemplativos + dark mode"
```

---

## Task 7: Typecheck final + validação

- [ ] **Step 7.1 — Typecheck completo**

```bash
cd lumen_mobile && npx tsc --noEmit 2>&1
```

Classificar:
- **Novos erros** (arquivos vida/): devem ser zero
- **Pré-existentes** (services/, firebase.ts, vida/ erros de Href): documentar

- [ ] **Step 7.2 — Commit de fechamento**

```bash
git add -A
git commit -m "chore(cp3): Checkpoint 3 completo — Projeto de Vida Caderno de Oração"
```

---

## Self-Review

**Cobertura do spec:**
- ✅ Hub: header contemplativo, recomendação espiritual borda dourada, indicadores "caminho percorrido", privacidade reforçada, estado vazio acolhedor → Tasks 3
- ✅ Wizard: barra de progresso, botões navegação, abertura contemplativa, inputs papel → Task 6
- ✅ Ciclo: seções com cor por área, header Nunito-ExtraBold, textos vazios acolhedores → Task 4
- ✅ Revisão: Ato de Contrição como bloco espiritual (não formulário), questões com exemplo em Italic, step concluído espiritual → Task 5
- ✅ Histórico: estado vazio "primeiro passo sagrado", badge com check → Task 2
- ✅ Unlock: halo + dots maiores, linguagem de privacidade e confiança, erro com ícone → Task 1
- ✅ Dark mode: `t.bg.spiritual`, `t.text.spiritual` = `teal[300]` legível sobre `blue[950]` → todos
- ✅ Acessibilidade: `accessibilityLabel` + `accessibilityRole` em todos os botões → todos
- ✅ Nunito-Italic para orações/reflexões → Tasks 3, 4, 5
- ✅ Zero alteração em lógica/API/rotas → regra universal

**Riscos:**
1. `wizard.tsx` é o arquivo mais longo — aplicar cirurgicamente, não reescrever inteiro
2. `ciclo.tsx` tem muitos sub-componentes inline — cada um precisa receber `t` como prop ou acessar via closure
3. `Nunito-Italic` deve estar carregado no `_layout.tsx` raiz (verificado no CP2, confirmar no CP3)
