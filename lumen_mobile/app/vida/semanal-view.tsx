import { useState, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  ActivityIndicator, StyleSheet,
} from 'react-native';
import { router, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import type { IoniconsName } from '@/types/icons';
import projetoVidaMensalApi, {
  type ProjetoVidaSemanasOut,
  type PlanoDiarioItem,
} from '@/services/projetoVidaMensal';
import { useTheme, type SemanticTokens } from '@/theme';

const DIAS_SEMANA = ['seg', 'ter', 'qua', 'qui', 'sex', 'sab', 'dom'] as const;
type DiaSemana = typeof DIAS_SEMANA[number];

const DIA_LABELS: Record<DiaSemana, string> = {
  seg: 'Segunda', ter: 'Terça',  qua: 'Quarta', qui: 'Quinta',
  sex: 'Sexta',   sab: 'Sábado', dom: 'Domingo',
};
const DIA_SHORT: Record<DiaSemana, string> = {
  seg: 'Seg', ter: 'Ter', qua: 'Qua', qui: 'Qui',
  sex: 'Sex', sab: 'Sáb', dom: 'Dom',
};

const PRATICAS_LABELS: Record<string, string> = {
  missa: 'Missa',
  lectio_divina: 'Lectio Divina',
  terco: 'Terço',
  leitura_espiritual: 'Leitura Espiritual',
  adoracao: 'Adoração',
  jejum: 'Jejum',
};

function getDiaPadrao(): DiaSemana {
  // (getDay()+1) % 7: 0=dom→1=seg, 6=sab→0=dom, etc.
  return DIAS_SEMANA[(new Date().getDay() + 1) % 7];
}

export default function SemanalViewScreen() {
  const { semanalId, projetoId } = useLocalSearchParams<{
    semanalId?: string;
    projetoId?: string;
  }>();
  const { t, r } = useTheme();

  const [semanal, setSemanal] = useState<ProjetoVidaSemanasOut | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [diaAtivo, setDiaAtivo] = useState<DiaSemana>(getDiaPadrao());

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      if (semanalId) {
        const data = await projetoVidaMensalApi.getSemanal(semanalId);
        setSemanal(data);
      } else if (projetoId) {
        const semanas = await projetoVidaMensalApi.listSemanas(projetoId);
        if (semanas.length === 0) {
          setSemanal(null);
        } else {
          const hoje = new Date();
          const semanaAtualNum = Math.min(Math.ceil(hoje.getDate() / 7), 5);
          const melhor = semanas.reduce((prev, curr) =>
            Math.abs(curr.numero_semana - semanaAtualNum) <
            Math.abs(prev.numero_semana - semanaAtualNum) ? curr : prev
          );
          const data = await projetoVidaMensalApi.getSemanal(melhor.id);
          setSemanal(data);
        }
      }
    } catch {
      setError('Erro ao carregar o projeto semanal. Tente novamente.');
    } finally {
      setLoading(false);
    }
  }, [semanalId, projetoId]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  // Guard: sem params
  if (!semanalId && !projetoId) {
    return (
      <View style={[styles.center, { backgroundColor: t.bg.screen, padding: 24 }]}>
        <Ionicons name={'calendar-outline' as IoniconsName} size={32} color={t.text.tertiary} />
        <Text style={{ fontSize: 15, fontFamily: 'Nunito-Regular', color: t.text.secondary, textAlign: 'center', lineHeight: 22, marginTop: 12 }}>
          Não foi possível identificar o Projeto Semanal.
        </Text>
        <TouchableOpacity
          style={{ marginTop: 16, paddingHorizontal: 20, paddingVertical: 12, backgroundColor: t.brand.primary, borderRadius: r.lg }}
          onPress={() => router.back()}
        >
          <Text style={{ color: '#ffffff', fontFamily: 'Nunito-Bold', fontSize: 14 }}>Voltar</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: t.bg.screen }]}>
        <ActivityIndicator size="large" color={t.brand.primary} />
      </View>
    );
  }

  if (error) {
    return (
      <View style={[styles.center, { backgroundColor: t.bg.screen, padding: 24 }]}>
        <Text style={{ fontSize: 14, fontFamily: 'Nunito-Regular', color: t.status.error, textAlign: 'center' }}>{error}</Text>
        <TouchableOpacity
          style={{ marginTop: 16, paddingHorizontal: 20, paddingVertical: 12, backgroundColor: t.brand.primary, borderRadius: r.lg }}
          onPress={load}
        >
          <Text style={{ color: '#ffffff', fontFamily: 'Nunito-Bold', fontSize: 14 }}>Tentar novamente</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (!semanal) {
    return (
      <View style={[styles.center, { backgroundColor: t.bg.screen, padding: 24 }]}>
        <Ionicons name={'calendar-outline' as IoniconsName} size={32} color={t.text.tertiary} />
        <Text style={{ fontSize: 15, fontFamily: 'Nunito-Regular', color: t.text.secondary, textAlign: 'center', lineHeight: 22, marginTop: 12 }}>
          Nenhum Projeto Semanal encontrado para esta semana.
        </Text>
        {projetoId && (
          <TouchableOpacity
            style={{ marginTop: 16, paddingHorizontal: 20, paddingVertical: 12, backgroundColor: t.brand.primary, borderRadius: r.lg }}
            onPress={() => router.push({ pathname: '/vida/semanal', params: { projetoId } })}
          >
            <Text style={{ color: '#ffffff', fontFamily: 'Nunito-Bold', fontSize: 14 }}>Criar Projeto Semanal</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  }

  // Práticas planejadas para o dia ativo (vida_interior é Record<string, {dias, horario}>)
  const vidaInterior = (semanal.vida_interior ?? {}) as Record<string, { dias?: string[]; horario?: string | null }>;
  const praticasHoje = Object.entries(vidaInterior)
    .filter(([, p]) => Array.isArray(p?.dias) && p.dias.includes(diaAtivo))
    .map(([key, p]) => ({ key, label: PRATICAS_LABELS[key] ?? key, horario: p.horario }));

  // plano_diario para o dia ativo
  const plano = ((semanal.plano_diario ?? {}) as Record<string, PlanoDiarioItem>)[diaAtivo] ?? {};
  const temPlanoDiario = !!(
    plano.proposito || plano.missa || plano.oracao_manha ||
    plano.lectio || plano.terco || plano.leitura_espiritual || plano.evangelizacao
  );

  // semanalId resolvido (pode ter vindo de listSemanas)
  const resolvedSemanalId = semanalId ?? semanal.id;

  return (
    <View style={{ flex: 1, backgroundColor: t.bg.screen }}>
      {/* Cabeçalho */}
      <View style={[styles.header, { backgroundColor: t.bg.elevated, borderBottomColor: t.border.subtle }]}>
        <Text style={{ fontSize: 20, fontFamily: 'Nunito-ExtraBold', color: t.text.primary, marginBottom: 12 }}>
          Semana {semanal.numero_semana}
        </Text>
        {/* Chips de dia */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View style={{ flexDirection: 'row', gap: 6 }}>
            {DIAS_SEMANA.map(dia => (
              <TouchableOpacity
                key={dia}
                style={{
                  paddingHorizontal: 12, paddingVertical: 5, borderRadius: 16,
                  borderWidth: 1,
                  borderColor: dia === diaAtivo ? t.brand.primary : t.border.default,
                  backgroundColor: dia === diaAtivo ? t.brand.primaryDim : t.bg.surface,
                }}
                onPress={() => setDiaAtivo(dia)}
              >
                <Text style={{
                  fontSize: 12,
                  fontFamily: dia === diaAtivo ? 'Nunito-Bold' : 'Nunito-Regular',
                  color: dia === diaAtivo ? t.brand.primary : t.text.secondary,
                }}>
                  {DIA_SHORT[dia]}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 20, paddingBottom: 80 }}>
        <Text style={{ fontSize: 16, fontFamily: 'Nunito-Bold', color: t.text.primary, marginBottom: 16 }}>
          {DIA_LABELS[diaAtivo]}
        </Text>

        {/* Seção: Práticas planejadas */}
        <View style={[styles.card, { backgroundColor: t.bg.elevated, borderColor: t.border.subtle, borderRadius: r.lg }]}>
          <View style={styles.sectionHeader}>
            <Ionicons name={'sunny-outline' as IoniconsName} size={16} color={t.accent.spiritual} />
            <Text style={[styles.sectionLabel, { color: t.text.secondary }]}>Práticas planejadas</Text>
          </View>
          {praticasHoje.length === 0 ? (
            <Text style={{ fontSize: 14, fontFamily: 'Nunito-Italic', color: t.text.tertiary }}>
              Nenhuma prática para este dia.
            </Text>
          ) : (
            praticasHoje.map(({ key, label, horario }) => (
              <View key={key} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <Ionicons name={'ellipse' as IoniconsName} size={6} color={t.brand.primary} />
                <Text style={{ fontSize: 15, fontFamily: 'Nunito-SemiBold', color: t.text.primary }}>
                  {label}{horario ? ` — ${horario}` : ''}
                </Text>
              </View>
            ))
          )}
        </View>

        {/* Seção: Amanhã com o Emanuel */}
        <View style={[styles.card, { backgroundColor: t.bg.elevated, borderColor: t.border.subtle, borderRadius: r.lg }]}>
          <View style={styles.sectionHeader}>
            <Ionicons name={'moon-outline' as IoniconsName} size={16} color={t.brand.primary} />
            <Text style={[styles.sectionLabel, { color: t.text.secondary }]}>Amanhã com o Emanuel</Text>
          </View>

          {!temPlanoDiario ? (
            <>
              <Text style={{ fontSize: 14, fontFamily: 'Nunito-Italic', color: t.text.tertiary, marginBottom: 12 }}>
                Este dia ainda não foi planejado.
              </Text>
              <TouchableOpacity
                style={[styles.planBtn, { backgroundColor: t.brand.primaryDim, borderColor: t.brand.primary, borderRadius: r.lg }]}
                onPress={() => router.push({
                  pathname: '/vida/diario',
                  params: { semanalId: resolvedSemanalId, dia: diaAtivo },
                })}
                activeOpacity={0.8}
              >
                <Ionicons name={'add-circle-outline' as IoniconsName} size={16} color={t.brand.primary} />
                <Text style={{ fontSize: 14, fontFamily: 'Nunito-SemiBold', color: t.brand.primary }}>
                  Planejar este dia
                </Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
              {plano.proposito ? <CampoView label="Propósito" value={plano.proposito} t={t} /> : null}
              {plano.missa ? (
                <CampoView
                  label="Missa"
                  value={plano.horario_missa ? `Sim — ${plano.horario_missa}` : 'Sim'}
                  t={t}
                />
              ) : null}
              {plano.oracao_manha ? <CampoView label="Oração da manhã" value={plano.oracao_manha} t={t} /> : null}
              {plano.lectio ? <CampoView label="Lectio Divina" value={plano.lectio} t={t} /> : null}
              {plano.terco ? (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                  <Ionicons name={'checkmark-circle' as IoniconsName} size={16} color={t.status.success} />
                  <Text style={{ fontSize: 14, fontFamily: 'Nunito-SemiBold', color: t.text.primary }}>Terço</Text>
                </View>
              ) : null}
              {plano.leitura_espiritual ? <CampoView label="Leitura Espiritual" value={plano.leitura_espiritual} t={t} /> : null}
              {plano.evangelizacao ? <CampoView label="Evangelização" value={plano.evangelizacao} t={t} /> : null}

              <TouchableOpacity
                style={[styles.editBtn, { borderColor: t.border.default, borderRadius: r.md }]}
                onPress={() => router.push({
                  pathname: '/vida/diario',
                  params: { semanalId: resolvedSemanalId, dia: diaAtivo },
                })}
                activeOpacity={0.8}
              >
                <Ionicons name={'pencil-outline' as IoniconsName} size={14} color={t.text.secondary} />
                <Text style={{ fontSize: 13, fontFamily: 'Nunito-SemiBold', color: t.text.secondary }}>
                  Editar planejamento
                </Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      </ScrollView>

      {/* Rodapé fixo */}
      <View style={[styles.footer, { backgroundColor: t.bg.elevated, borderTopColor: t.border.subtle }]}>
        {projetoId ? (
          <TouchableOpacity
            style={[styles.footerBtn, { borderColor: t.border.default, borderRadius: r.lg }]}
            onPress={() => router.push({
              pathname: '/vida/semanal',
              params: { projetoId },
            })}
            activeOpacity={0.8}
          >
            <Ionicons name={'pencil-outline' as IoniconsName} size={16} color={t.text.secondary} />
            <Text style={{ fontSize: 15, fontFamily: 'Nunito-SemiBold', color: t.text.secondary }}>
              Editar Semana
            </Text>
          </TouchableOpacity>
        ) : null}
      </View>
    </View>
  );
}

function CampoView({ label, value, t }: { label: string; value: string; t: SemanticTokens }) {
  return (
    <View style={{ marginBottom: 10 }}>
      <Text style={{ fontSize: 11, fontFamily: 'Nunito-Bold', color: t.text.tertiary, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 3 }}>
        {label}
      </Text>
      <Text style={{ fontSize: 14, fontFamily: 'Nunito-Regular', color: t.text.primary, lineHeight: 20 }}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 12, borderBottomWidth: StyleSheet.hairlineWidth },
  card: { padding: 16, marginBottom: 16, borderWidth: StyleSheet.hairlineWidth },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  sectionLabel: { fontSize: 13, fontFamily: 'Nunito-Bold', textTransform: 'uppercase', letterSpacing: 0.8 },
  planBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, padding: 12, borderWidth: 1 },
  editBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, padding: 10, marginTop: 8, borderWidth: StyleSheet.hairlineWidth },
  footer: { padding: 16, borderTopWidth: StyleSheet.hairlineWidth },
  footerBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, padding: 16, borderWidth: 1 },
});
