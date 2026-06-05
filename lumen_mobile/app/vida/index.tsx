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
import type { Href } from 'expo-router';
import projetoVidaMensalApi, {
  type ProjetoVidaMensalFull,
  MESES,
} from '@/services/projetoVidaMensal';
import { useTheme } from '@/theme';
import type { SemanticTokens } from '@/theme';

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

  const handleNovoMes = () => router.push('/vida/wizard' as Href);
  const handleHistorico = () => router.push('/vida/historico' as Href);

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
        <View style={[
          styles.errorBox,
          { backgroundColor: t.status.errorBg, borderColor: t.status.error },
        ]}>
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
      <View style={[
        styles.recomendacaoCard,
        { backgroundColor: t.bg.spiritual, borderLeftColor: t.accent.spiritual, borderRadius: r.md },
      ]}>
        <View style={styles.recomendacaoHeader}>
          <Ionicons name={'sparkles' as IoniconsName} size={14} color={t.accent.spiritual} />
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
            accessibilityRole="button"
          >
            <View style={styles.cicloCardHeader}>
              <Ionicons name={'book-outline' as IoniconsName} size={20} color={t.brand.primary} />
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
              <Text style={[styles.openText, { color: t.brand.primary }]}>Ver ciclo completo</Text>
              <Ionicons name={'chevron-forward' as IoniconsName} size={15} color={t.brand.primary} />
            </View>
          </TouchableOpacity>

          {/* Botão revisão */}
          {!projeto.concluido && (
            <TouchableOpacity
              style={[styles.revisaoBtn, { backgroundColor: t.brand.primary, borderRadius: r.lg }]}
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
        <View style={[
          styles.emptyCard,
          {
            backgroundColor: t.bg.elevated,
            borderColor: t.border.subtle,
            borderRadius: r.xl,
            ...t.shadow.sm,
          },
        ]}>
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
      <View style={[styles.privacidadeCard, { backgroundColor: t.brand.primaryDim, borderRadius: r.md }]}>
        <Ionicons name={'shield-checkmark-outline' as IoniconsName} size={14} color={t.brand.primary} />
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
        accessibilityRole="button"
      >
        <Ionicons name={'time-outline' as IoniconsName} size={16} color={t.brand.primary} />
        <Text style={[styles.histBtnText, { color: t.brand.primary }]}>Ver histórico de ciclos</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

// ── Sub-componente: indicador de caminho ─────────────────────────────────────

function CaminhoItem({
  icon, label, ok, t,
}: {
  icon: IoniconsName;
  label: string;
  ok: boolean;
  t: SemanticTokens;
}) {
  const filledIcon = icon.replace('-outline', '') as IoniconsName;
  return (
    <View style={styles.caminhoItem}>
      <Ionicons
        name={ok ? filledIcon : icon}
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
    flexDirection: 'row', alignItems: 'flex-start', gap: 8,
    borderWidth: 1, borderRadius: 10, padding: 12, marginBottom: 16,
  },
  errorText: { flex: 1, fontSize: 13, fontFamily: 'Nunito-Regular' },
  headerCard: { alignItems: 'center', marginBottom: 20 },
  iconWrap: { width: 56, height: 56, justifyContent: 'center', alignItems: 'center', marginBottom: 12 },
  title: { fontSize: 22, fontFamily: 'Nunito-ExtraBold', marginBottom: 4 },
  subtitle: { fontSize: 14, fontFamily: 'Nunito-Regular' },
  recomendacaoCard: { borderLeftWidth: 3, padding: 16, marginBottom: 20 },
  recomendacaoHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 },
  recomendacaoLabel: { fontSize: 10, fontFamily: 'Nunito-Bold', textTransform: 'uppercase', letterSpacing: 1 },
  recomendacaoText: { fontSize: 14, fontFamily: 'Nunito-Italic', lineHeight: 22 },
  cicloCard: { padding: 18, marginBottom: 14, borderWidth: StyleSheet.hairlineWidth },
  cicloCardHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 14 },
  cicloCardTitle: { flex: 1, fontSize: 17, fontFamily: 'Nunito-Bold' },
  badge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingVertical: 3, gap: 4 },
  badgeText: { fontSize: 11, fontFamily: 'Nunito-SemiBold' },
  caminhoLabel: { fontSize: 11, fontFamily: 'Nunito-Regular', textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 12 },
  statsRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 14 },
  caminhoItem: { alignItems: 'center', gap: 6 },
  caminhoItemLabel: { fontSize: 10, fontFamily: 'Nunito-Regular' },
  openRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 4, paddingTop: 12, borderTopWidth: StyleSheet.hairlineWidth },
  openText: { fontSize: 13, fontFamily: 'Nunito-SemiBold' },
  revisaoBtn: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8, padding: 16, marginBottom: 16 },
  revisaoBtnText: { color: '#ffffff', fontSize: 15, fontFamily: 'Nunito-Bold' },
  emptyCard: { padding: 32, alignItems: 'center', marginBottom: 16, borderWidth: StyleSheet.hairlineWidth, gap: 8 },
  emptyTitle: { fontSize: 17, fontFamily: 'Nunito-SemiBold', textAlign: 'center' },
  emptySubtitle: { fontSize: 14, fontFamily: 'Nunito-Italic', textAlign: 'center', marginBottom: 8 },
  primaryBtn: { paddingVertical: 14, paddingHorizontal: 28, marginTop: 8 },
  primaryBtnText: { color: '#ffffff', fontSize: 15, fontFamily: 'Nunito-Bold' },
  privacidadeCard: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, padding: 12, marginBottom: 8 },
  privacidadeText: { flex: 1, fontSize: 12, fontFamily: 'Nunito-Regular', lineHeight: 18 },
  histBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, padding: 16 },
  histBtnText: { fontSize: 14, fontFamily: 'Nunito-SemiBold' },
});
