/**
 * Projeto de Vida Mensal — Hub
 * ==============================
 * Exibe o ciclo do mês atual ou convida a criar um novo.
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

const colors = {
  primary: '#1A859B',
  primaryLight: '#E8F4F7',
  white: '#ffffff',
  gray: '#6b7280',
  lightGray: '#f3f4f6',
  dark: '#171717',
  border: '#e5e7eb',
  gold: '#b45309',
  goldLight: '#fef3c7',
};

export default function VidaHubScreen() {
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

  const handleNovoMes = () => {
    router.push('/vida/wizard');
  };

  const handleHistorico = () => {
    router.push('/vida/historico');
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => { setRefreshing(true); load(true); }}
          colors={[colors.primary]}
        />
      }
    >
      {error && (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      {/* Cabeçalho */}
      <View style={styles.headerCard}>
        <View style={styles.iconWrap}>
          <Ionicons name={'calendar' as IoniconsName} size={28} color={colors.primary} />
        </View>
        <Text style={styles.title}>Projeto de Vida</Text>
        <Text style={styles.subtitle}>
          {MESES[mesAtual - 1]} {anoAtual}
        </Text>
      </View>

      {/* Recomendação espiritual */}
      <View style={styles.recomendacaoCard}>
        <Ionicons name={'sparkles' as IoniconsName} size={18} color={colors.gold} style={{ marginBottom: 8 }} />
        <Text style={styles.recomendacaoText}>
          Caro irmão, recomendamos que você inicie o seu Projeto de Vida em oração e, de preferência, na Vigília Vocacional em comunidade com seus irmãos.
        </Text>
      </View>

      {projeto ? (
        <>
          {/* Card do ciclo atual */}
          <TouchableOpacity style={styles.cicloCard} onPress={handleAbrirCiclo} activeOpacity={0.8}>
            <View style={styles.cicloCardHeader}>
              <Ionicons name={'book-outline' as IoniconsName} size={22} color={colors.primary} />
              <Text style={styles.cicloCardTitle}>
                {MESES[projeto.mes - 1]} {projeto.ano}
              </Text>
              {projeto.has_pin && (
                <Ionicons name={'lock-closed' as IoniconsName} size={16} color={colors.gray} style={{ marginLeft: 6 }} />
              )}
              {projeto.concluido && (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>Concluído</Text>
                </View>
              )}
            </View>
            <View style={styles.statsRow}>
              <StatItem
                icon={'people-outline' as IoniconsName}
                label="Comunidade"
                ok={(projeto.comunidade?.partilha_acompanhador?.length ?? 0) > 0
                  || (projeto.comunidade?.dias_grupo?.length ?? 0) > 0}
              />
              <StatItem
                icon={'heart-outline' as IoniconsName}
                label="Cuidado"
                ok={(projeto.cuidado?.consultas?.length ?? 0) > 0
                  || (projeto.cuidado?.descanso?.length ?? 0) > 0}
              />
              <StatItem
                icon={'list-outline' as IoniconsName}
                label="Compromissos"
                ok={projeto.compromissos.length > 0}
              />
              <StatItem
                icon={'sunny-outline' as IoniconsName}
                label="Oração"
                ok={projeto.praticas.length > 0}
              />
            </View>
            <View style={styles.openRow}>
              <Text style={styles.openText}>Ver ciclo completo</Text>
              <Ionicons name={'chevron-forward' as IoniconsName} size={16} color={colors.primary} />
            </View>
          </TouchableOpacity>

          {/* Botão revisão */}
          {!projeto.concluido && (
            <TouchableOpacity
              style={styles.revisaoBtn}
              onPress={() =>
                router.push({ pathname: '/vida/revisao', params: { projetoId: projeto.id } })
              }
              activeOpacity={0.8}
            >
              <Ionicons name={'checkmark-circle-outline' as IoniconsName} size={20} color={colors.white} />
              <Text style={styles.revisaoBtnText}>Revisão Mensal</Text>
            </TouchableOpacity>
          )}
        </>
      ) : (
        /* Sem ciclo para o mês atual */
        <View style={styles.emptyCard}>
          <Ionicons name={'add-circle-outline' as IoniconsName} size={48} color={colors.primary} />
          <Text style={styles.emptyTitle}>Nenhum projeto para este mês</Text>
          <Text style={styles.emptySubtitle}>
            Crie seu Projeto de Vida para {MESES[mesAtual - 1]} {anoAtual}
          </Text>
          <TouchableOpacity style={styles.primaryBtn} onPress={handleNovoMes} activeOpacity={0.8}>
            <Text style={styles.primaryBtnText}>Iniciar novo ciclo</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Aviso de privacidade */}
      <View style={styles.privacidadeCard}>
        <Ionicons name={'shield-checkmark-outline' as IoniconsName} size={16} color={colors.primary} style={{ marginRight: 6 }} />
        <Text style={styles.privacidadeText}>
          Tudo o que você escrever é privado. A Equipe Lumen+ não terá acesso ao conteúdo do seu Projeto de Vida.
        </Text>
      </View>

      {/* Histórico */}
      <TouchableOpacity style={styles.histBtn} onPress={handleHistorico} activeOpacity={0.8}>
        <Ionicons name={'time-outline' as IoniconsName} size={18} color={colors.primary} />
        <Text style={styles.histBtnText}>Ver histórico de ciclos</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

function StatItem({ icon, label, ok }: { icon: IoniconsName; label: string; ok: boolean }) {
  return (
    <View style={styles.statItem}>
      <Ionicons name={icon} size={18} color={ok ? colors.primary : colors.gray} />
      <Text style={[styles.statLabel, ok && { color: colors.primary }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9fafb' },
  content: { padding: 20, paddingBottom: 40 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  errorBox: { backgroundColor: '#fef2f2', borderColor: '#fecaca', borderWidth: 1, borderRadius: 10, padding: 12, marginBottom: 16 },
  errorText: { color: '#dc2626', fontSize: 14 },
  headerCard: { alignItems: 'center', marginBottom: 16 },
  iconWrap: { width: 56, height: 56, borderRadius: 16, backgroundColor: colors.primaryLight, justifyContent: 'center', alignItems: 'center', marginBottom: 12 },
  title: { fontSize: 22, fontWeight: '700', color: colors.dark, marginBottom: 4 },
  subtitle: { fontSize: 15, color: colors.gray },
  recomendacaoCard: { backgroundColor: colors.goldLight, borderRadius: 12, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: '#fde68a', alignItems: 'center' },
  recomendacaoText: { fontSize: 14, color: colors.gold, textAlign: 'center', lineHeight: 20 },
  cicloCard: { backgroundColor: colors.white, borderRadius: 14, padding: 18, marginBottom: 16, borderWidth: 1, borderColor: colors.border, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 6, elevation: 2 },
  cicloCardHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 8, gap: 8 },
  cicloCardTitle: { fontSize: 17, fontWeight: '600', color: colors.dark, flex: 1 },
  badge: { backgroundColor: colors.primaryLight, borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2 },
  badgeText: { fontSize: 11, color: colors.primary, fontWeight: '600' },
  statsRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 14 },
  statItem: { alignItems: 'center', gap: 4 },
  statLabel: { fontSize: 11, color: colors.gray },
  openRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 4 },
  openText: { fontSize: 13, color: colors.primary, fontWeight: '600' },
  revisaoBtn: { backgroundColor: colors.primary, borderRadius: 12, padding: 16, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8, marginBottom: 16 },
  revisaoBtnText: { color: colors.white, fontSize: 15, fontWeight: '700' },
  emptyCard: { backgroundColor: colors.white, borderRadius: 14, padding: 32, alignItems: 'center', borderWidth: 1, borderColor: colors.border, marginBottom: 16, gap: 8 },
  emptyTitle: { fontSize: 17, fontWeight: '600', color: colors.dark, textAlign: 'center' },
  emptySubtitle: { fontSize: 14, color: colors.gray, textAlign: 'center', marginBottom: 8 },
  primaryBtn: { backgroundColor: colors.primary, borderRadius: 12, paddingVertical: 14, paddingHorizontal: 28, marginTop: 8 },
  primaryBtnText: { color: colors.white, fontSize: 15, fontWeight: '700' },
  privacidadeCard: { flexDirection: 'row', alignItems: 'flex-start', backgroundColor: colors.primaryLight, borderRadius: 10, padding: 12, marginBottom: 8 },
  privacidadeText: { fontSize: 12, color: '#1e6a7d', flex: 1, lineHeight: 17 },
  histBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, padding: 16 },
  histBtnText: { fontSize: 14, color: colors.primary, fontWeight: '600' },
});
