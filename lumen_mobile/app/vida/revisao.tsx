/**
 * Projeto de Vida — Revisão Mensal
 * ==================================
 * 4 passos: Revisão Vocacional → Ato de Contrição → Próximo Ciclo → Concluído
 */

import { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, ActivityIndicator, KeyboardAvoidingView, Platform,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import type { IoniconsName } from '@/types/icons';
import projetoVidaMensalApi from '@/services/projetoVidaMensal';

const colors = {
  primary: '#1A859B', primaryLight: '#E8F4F7',
  white: '#ffffff', gray: '#6b7280',
  dark: '#171717', border: '#e5e7eb', error: '#ef4444',
};

const STEP_TITLES = ['Vigília Vocacional', 'Ato de Contrição', 'Próximo Ciclo', 'Revisão Salva'];

interface RevisaoState {
  graca: string; fidelidade: string; falhas: string; ordenar: string; passo: string;
  decisao: string; virtude: string; conversao: string; passo_proximo: string;
}

const defaultState = (): RevisaoState => ({
  graca: '', fidelidade: '', falhas: '', ordenar: '', passo: '',
  decisao: '', virtude: '', conversao: '', passo_proximo: '',
});

const QUESTOES_REVISAO: Array<{ key: keyof RevisaoState; q: string }> = [
  { key: 'graca',       q: 'Onde percebi a graça de Deus neste mês?' },
  { key: 'fidelidade',  q: 'Onde fui fiel?' },
  { key: 'falhas',      q: 'Onde falhei?' },
  { key: 'ordenar',     q: 'O que preciso ordenar melhor?' },
  { key: 'passo',       q: 'Que passo concreto Deus me pede para o próximo ciclo?' },
];

const QUESTOES_PROXIMO: Array<{ key: keyof RevisaoState; q: string }> = [
  { key: 'decisao',      q: 'Que decisão concreta tomarei?' },
  { key: 'virtude',      q: 'Que virtude quero cultivar?' },
  { key: 'conversao',    q: 'Em que área preciso de conversão?' },
  { key: 'passo_proximo', q: 'Qual o primeiro passo prático?' },
];

const CONTRICAO_TEXT =
  `Emanuel, eu, Teu Filho, reconheço minhas falhas e me arrependo de todo o mal que cometi e do bem que deixei de fazer. Confio no Teu amor misericordioso e me proponho, com a Tua graça, a recomeçar com mais fidelidade no próximo ciclo. Amém.`;

export default function RevisaoScreen() {
  const { projetoId } = useLocalSearchParams<{ projetoId: string }>();
  const [step, setStep] = useState(0);
  const [state, setState] = useState<RevisaoState>(defaultState());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const update = (key: keyof RevisaoState, val: string) =>
    setState(s => ({ ...s, [key]: val }));

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      await projetoVidaMensalApi.upsertRevisao(projetoId, {
        graca: state.graca || null,
        fidelidade: state.fidelidade || null,
        falhas: state.falhas || null,
        ordenar: state.ordenar || null,
        passo: state.passo || null,
        decisao: state.decisao || null,
        virtude: state.virtude || null,
        conversao: state.conversao || null,
        passo_proximo: state.passo_proximo || null,
      });
      setStep(3); // Concluído
    } catch {
      setError('Erro ao salvar revisão. Tente novamente.');
    } finally {
      setSaving(false);
    }
  };

  const renderStep = () => {
    switch (step) {
      // ── Passo 0: Revisão Vocacional ──────────────────────────────────────
      case 0:
        return (
          <View style={styles.stepContent}>
            <Text style={styles.sectionLabel}>Vigília Vocacional</Text>
            <Text style={styles.intro}>
              Na Vigília Vocacional, somos convidados a rever o caminho com sinceridade diante de Deus em comunidade.
            </Text>
            {QUESTOES_REVISAO.map(({ key, q }) => (
              <View key={key} style={styles.questionCard}>
                <Text style={styles.questionText}>{q}</Text>
                <TextInput
                  style={styles.textarea}
                  value={state[key]}
                  onChangeText={v => update(key, v)}
                  multiline
                  numberOfLines={4}
                  placeholderTextColor={colors.gray}
                  placeholder="Sua resposta..."
                />
              </View>
            ))}
          </View>
        );

      // ── Passo 1: Ato de Contrição ────────────────────────────────────────
      case 1:
        return (
          <View style={styles.stepContent}>
            <Text style={styles.sectionLabel}>Ato de Contrição</Text>
            <View style={styles.prayerCard}>
              <Ionicons name={'heart' as IoniconsName} size={28} color={colors.primary} style={{ marginBottom: 14, alignSelf: 'center' }} />
              <Text style={styles.prayerText}>{CONTRICAO_TEXT}</Text>
            </View>
          </View>
        );

      // ── Passo 2: Próximo Ciclo ───────────────────────────────────────────
      case 2:
        return (
          <View style={styles.stepContent}>
            <Text style={styles.sectionLabel}>Compromisso — Próximo Ciclo</Text>
            <Text style={styles.intro}>
              Com base na revisão, defina seus compromissos para o próximo mês.
            </Text>
            {QUESTOES_PROXIMO.map(({ key, q }) => (
              <View key={key} style={styles.questionCard}>
                <Text style={styles.questionText}>{q}</Text>
                <TextInput
                  style={styles.textarea}
                  value={state[key]}
                  onChangeText={v => update(key, v)}
                  multiline
                  numberOfLines={3}
                  placeholderTextColor={colors.gray}
                  placeholder="Sua resposta..."
                />
              </View>
            ))}
            {error && (
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>{error}</Text>
              </View>
            )}
          </View>
        );

      // ── Passo 3: Concluído ───────────────────────────────────────────────
      case 3:
        return (
          <View style={[styles.stepContent, { alignItems: 'center', paddingTop: 40 }]}>
            <View style={styles.successIcon}>
              <Ionicons name={'checkmark-circle' as IoniconsName} size={64} color={colors.primary} />
            </View>
            <Text style={styles.successTitle}>Revisão concluída!</Text>
            <Text style={styles.successSubtitle}>
              Que Deus abençoe o seu novo ciclo de vida.
            </Text>
            <TouchableOpacity
              style={styles.primaryBtn}
              onPress={() => router.replace({ pathname: '/vida/ciclo', params: { projetoId } })}
              activeOpacity={0.8}
            >
              <Text style={styles.primaryBtnText}>Ver ciclo atualizado</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.ghostBtn} onPress={() => router.replace('/vida')} activeOpacity={0.8}>
              <Text style={styles.ghostBtnText}>Voltar ao início</Text>
            </TouchableOpacity>
          </View>
        );

      default:
        return null;
    }
  };

  const isLastContentStep = step === 2;

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      {/* Indicador de passos */}
      {step < 3 && (
        <>
          <View style={styles.stepBar}>
            {[0, 1, 2].map(i => (
              <View key={i} style={[styles.stepDot, i === step && styles.stepDotActive, i < step && styles.stepDotDone]} />
            ))}
          </View>
          <View style={styles.stepHeader}>
            <Text style={styles.stepTitle}>{STEP_TITLES[step]}</Text>
            <Text style={styles.stepCounter}>{step + 1} / 3</Text>
          </View>
        </>
      )}

      <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 40 }}>
        {renderStep()}
      </ScrollView>

      {/* Navegação (não mostrar no passo final) */}
      {step < 3 && (
        <View style={styles.navRow}>
          <TouchableOpacity
            style={[styles.navBtn, styles.navBtnBack]}
            onPress={() => (step === 0 ? router.back() : setStep(s => s - 1))}
          >
            <Ionicons name={'chevron-back' as IoniconsName} size={20} color={colors.primary} />
            <Text style={styles.navBtnBackText}>{step === 0 ? 'Cancelar' : 'Voltar'}</Text>
          </TouchableOpacity>

          {isLastContentStep ? (
            <TouchableOpacity
              style={[styles.navBtn, styles.navBtnNext]}
              onPress={handleSave}
              disabled={saving}
            >
              {saving
                ? <ActivityIndicator color={colors.white} size="small" />
                : <>
                    <Text style={styles.navBtnNextText}>Salvar Revisão</Text>
                    <Ionicons name={'checkmark' as IoniconsName} size={20} color={colors.white} />
                  </>
              }
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={[styles.navBtn, styles.navBtnNext]}
              onPress={() => setStep(s => s + 1)}
            >
              <Text style={styles.navBtnNextText}>Próximo</Text>
              <Ionicons name={'chevron-forward' as IoniconsName} size={20} color={colors.white} />
            </TouchableOpacity>
          )}
        </View>
      )}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9fafb' },
  stepBar: { flexDirection: 'row', justifyContent: 'center', gap: 8, paddingVertical: 12, backgroundColor: colors.white, borderBottomWidth: 1, borderColor: colors.border },
  stepDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.border },
  stepDotActive: { backgroundColor: colors.primary, width: 24, borderRadius: 4 },
  stepDotDone: { backgroundColor: colors.primaryLight },
  stepHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 12, backgroundColor: colors.white },
  stepTitle: { fontSize: 18, fontWeight: '700', color: colors.dark },
  stepCounter: { fontSize: 13, color: colors.gray },
  stepContent: { padding: 20 },
  sectionLabel: { fontSize: 11, letterSpacing: 1.5, textTransform: 'uppercase', color: colors.primary, fontWeight: '700', marginBottom: 8 },
  intro: { fontSize: 14, color: colors.gray, lineHeight: 21, marginBottom: 20 },
  questionCard: { backgroundColor: colors.white, borderRadius: 12, padding: 16, marginBottom: 14, borderWidth: 1, borderColor: colors.border },
  questionText: { fontSize: 15, fontWeight: '600', color: colors.dark, marginBottom: 10, lineHeight: 22 },
  textarea: { borderWidth: 1, borderColor: colors.border, borderRadius: 8, padding: 10, fontSize: 14, color: colors.dark, textAlignVertical: 'top', minHeight: 90, backgroundColor: '#f9fafb' },
  prayerCard: { backgroundColor: colors.primaryLight, borderRadius: 14, padding: 24, borderWidth: 1, borderColor: colors.primary + '40' },
  prayerText: { fontSize: 16, color: colors.dark, lineHeight: 28, textAlign: 'center', fontStyle: 'italic' },
  errorBox: { backgroundColor: '#fef2f2', borderColor: '#fecaca', borderWidth: 1, borderRadius: 10, padding: 12, marginTop: 8 },
  errorText: { color: '#dc2626', fontSize: 14 },
  successIcon: { marginBottom: 16 },
  successTitle: { fontSize: 24, fontWeight: '700', color: colors.dark, marginBottom: 8 },
  successSubtitle: { fontSize: 15, color: colors.gray, textAlign: 'center', marginBottom: 32, lineHeight: 22 },
  primaryBtn: { backgroundColor: colors.primary, borderRadius: 12, paddingVertical: 14, paddingHorizontal: 36, marginBottom: 12, width: '100%', alignItems: 'center' },
  primaryBtnText: { color: colors.white, fontSize: 16, fontWeight: '700' },
  ghostBtn: { padding: 12 },
  ghostBtnText: { color: colors.gray, fontSize: 14 },
  navRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, backgroundColor: colors.white, borderTopWidth: 1, borderColor: colors.border },
  navBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 10, paddingHorizontal: 20, borderRadius: 10 },
  navBtnBack: { borderWidth: 1, borderColor: colors.border },
  navBtnBackText: { fontSize: 15, color: colors.primary, fontWeight: '600' },
  navBtnNext: { backgroundColor: colors.primary },
  navBtnNextText: { fontSize: 15, color: colors.white, fontWeight: '600' },
});
