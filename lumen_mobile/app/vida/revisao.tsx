/**
 * Projeto de Vida — Revisão Mensal
 * ==================================
 * 3 passos: Revisão → Ato de Contrição → Concluído (com opção de novo ciclo)
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

const STEP_TITLES = ['Revisão Mensal', 'Ato de Contrição', 'Revisão Salva'];

interface RevisaoState {
  pratica_melhorar: string;
  taticas_vigilancia: string;
  rotina_evangelizacao: string;
  outra_area_atencao: string;
}

const defaultState = (): RevisaoState => ({
  pratica_melhorar: '',
  taticas_vigilancia: '',
  rotina_evangelizacao: '',
  outra_area_atencao: '',
});

const QUESTOES: Array<{ key: keyof RevisaoState; q: string; description?: string; placeholder: string }> = [
  {
    key: 'pratica_melhorar',
    q: 'A prática espiritual que quero melhorar para o próximo mês é:',
    placeholder: 'Descreva a prática espiritual...',
  },
  {
    key: 'taticas_vigilancia',
    q: 'Diante das dificuldades que ainda serão enfrentadas para vivenciar essa prática espiritual, escreva algumas táticas que você precisa estar, com muita mansidão e humildade, em postura de vigilância:',
    description: 'Por exemplo, parar por 30 minutos no dia anterior, marcando horários, para a oração do Santo Terço diário e fazendo comunhão com a intercessão por 24 horas pelas intenções da Comunidade; no sábado, quando fizer o projeto de vida semanal, os dias e horários que irá participar da Missa Diária na semana; iniciar a Lectio Divina com 15 minutos de forma constante no turno da manhã ou da tarde, pois percebe que tem mais cansaço no turno da noite; entre outros.',
    placeholder: 'Descreva suas táticas de vigilância...',
  },
  {
    key: 'rotina_evangelizacao',
    q: 'Para abraçar um caminho de santificação pessoal e comunitária para a vivência diária da Evangelização Ser Feliz, em minutos concretos do dia, escreva como você pode assumir isso como rotina do dia a dia:',
    description: 'Por exemplo, um dia antes, já deixar anotado os 15 minutos iniciais de Evangelização Ser Feliz, ao conferir os compromissos do dia seguinte, anotando o tempo dos deslocamentos, as práticas espirituais incluídas, o trabalho, o apostolado e/ou serviço.',
    placeholder: 'Descreva sua rotina de evangelização...',
  },
  {
    key: 'outra_area_atencao',
    q: 'Além das práticas espirituais e da vivência da Evangelização Ser Feliz diárias, anote qual outra área você acha importante ter sempre uma atenção nesse mês, a incluir aos poucos tentativas de melhor trabalhar essa realidade:',
    description: 'Por exemplo, na área da saúde e atividades físicas, ir três vezes por semana fazer uma caminhada ou para a academia; na área da sua família, deixar previamente combinado alguns momentos de qualidade com seus familiares; na área do seu serviço, deixar combinado dias fixos para as reuniões periódicas, com atas e delegações de função com as respectivas pessoas, de forma a iniciar a próxima reunião de acordo com as pautas da reunião anterior e acompanhando a execução dos respectivos pontos.',
    placeholder: 'Descreva a área e as ações concretas...',
  },
];

const CONTRICAO_TEXT =
  `Emanuel, eu, Teu amigo e Teu servo, reconheço minhas falhas e me arrependo de todo o mal que cometi e do bem que deixei de fazer. Confio no Teu amor misericordioso e me proponho, com a Tua graça, a recomeçar com mais fidelidade no próximo ciclo. Amém.`;

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
        pratica_melhorar: state.pratica_melhorar || null,
        taticas_vigilancia: state.taticas_vigilancia || null,
        rotina_evangelizacao: state.rotina_evangelizacao || null,
        outra_area_atencao: state.outra_area_atencao || null,
      });
      setStep(2); // Concluído
    } catch {
      setError('Erro ao salvar revisão. Tente novamente.');
    } finally {
      setSaving(false);
    }
  };

  const renderStep = () => {
    switch (step) {
      // ── Passo 0: Revisão ─────────────────────────────────────────────────
      case 0:
        return (
          <View style={styles.stepContent}>
            <Text style={styles.sectionLabel}>Revisão do Ciclo</Text>
            <Text style={styles.intro}>
              Responda com sinceridade diante de Deus. Não é preciso responder a todas as questões.
            </Text>
            {QUESTOES.map(({ key, q, description, placeholder }) => (
              <View key={key} style={styles.questionCard}>
                <Text style={styles.questionText}>{q}</Text>
                {description && (
                  <Text style={styles.questionDescription}>{description}</Text>
                )}
                <TextInput
                  style={styles.textarea}
                  value={state[key]}
                  onChangeText={v => update(key, v)}
                  multiline
                  numberOfLines={4}
                  placeholderTextColor={colors.gray}
                  placeholder={placeholder}
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

      // ── Passo 1: Ato de Contrição ────────────────────────────────────────
      case 1:
        return (
          <View style={styles.stepContent}>
            <Text style={styles.sectionLabel}>Ato de Contrição</Text>
            <Text style={styles.intro}>
              Antes de concluir, ore o Ato de Contrição em comunhão com seus irmãos.
            </Text>
            <View style={styles.prayerCard}>
              <Ionicons
                name={'heart' as IoniconsName}
                size={28}
                color={colors.primary}
                style={{ marginBottom: 14, alignSelf: 'center' }}
              />
              <Text style={styles.prayerText}>{CONTRICAO_TEXT}</Text>
            </View>
          </View>
        );

      // ── Passo 2: Concluído ───────────────────────────────────────────────
      case 2:
        return (
          <View style={[styles.stepContent, { alignItems: 'center', paddingTop: 40 }]}>
            <View style={styles.successIcon}>
              <Ionicons name={'checkmark-circle' as IoniconsName} size={64} color={colors.primary} />
            </View>
            <Text style={styles.successTitle}>Revisão concluída!</Text>
            <Text style={styles.successSubtitle}>
              Que Deus abençoe o seu próximo ciclo de vida.
            </Text>

            <View style={styles.choiceSection}>
              <Text style={styles.choiceLabel}>O que você deseja fazer agora?</Text>

              <TouchableOpacity
                style={styles.primaryBtn}
                onPress={() => router.replace({ pathname: '/vida/ciclo', params: { projetoId } })}
                activeOpacity={0.8}
              >
                <Ionicons name={'book-outline' as IoniconsName} size={18} color={colors.white} />
                <Text style={styles.primaryBtnText}>Ver ciclo atual</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.secondaryBtn}
                onPress={() => router.replace('/vida/wizard')}
                activeOpacity={0.8}
              >
                <Ionicons name={'add-circle-outline' as IoniconsName} size={18} color={colors.primary} />
                <Text style={styles.secondaryBtnText}>Iniciar novo ciclo</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.ghostBtn} onPress={() => router.replace('/vida')} activeOpacity={0.8}>
                <Text style={styles.ghostBtnText}>Voltar ao início</Text>
              </TouchableOpacity>
            </View>
          </View>
        );

      default:
        return null;
    }
  };

  const isLastContentStep = step === 1;

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      {/* Indicador de passos */}
      {step < 2 && (
        <>
          <View style={styles.stepBar}>
            {[0, 1].map(i => (
              <View
                key={i}
                style={[
                  styles.stepDot,
                  i === step && styles.stepDotActive,
                  i < step && styles.stepDotDone,
                ]}
              />
            ))}
          </View>
          <View style={styles.stepHeader}>
            <Text style={styles.stepTitle}>{STEP_TITLES[step]}</Text>
            <Text style={styles.stepCounter}>{step + 1} / 2</Text>
          </View>
        </>
      )}

      <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 40 }}>
        {renderStep()}
      </ScrollView>

      {/* Navegação (não mostrar no passo final) */}
      {step < 2 && (
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
  stepBar: {
    flexDirection: 'row', justifyContent: 'center', gap: 8,
    paddingVertical: 12, backgroundColor: colors.white,
    borderBottomWidth: 1, borderColor: colors.border,
  },
  stepDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.border },
  stepDotActive: { backgroundColor: colors.primary, width: 24, borderRadius: 4 },
  stepDotDone: { backgroundColor: colors.primaryLight },
  stepHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 20, paddingVertical: 12, backgroundColor: colors.white,
  },
  stepTitle: { fontSize: 18, fontWeight: '700', color: colors.dark },
  stepCounter: { fontSize: 13, color: colors.gray },
  stepContent: { padding: 20 },
  sectionLabel: {
    fontSize: 11, letterSpacing: 1.5, textTransform: 'uppercase',
    color: colors.primary, fontWeight: '700', marginBottom: 8,
  },
  intro: { fontSize: 14, color: colors.gray, lineHeight: 21, marginBottom: 20 },
  questionCard: {
    backgroundColor: colors.white, borderRadius: 12, padding: 16,
    marginBottom: 14, borderWidth: 1, borderColor: colors.border,
  },
  questionText: { fontSize: 15, fontWeight: '600', color: colors.dark, marginBottom: 6, lineHeight: 22 },
  questionDescription: { fontSize: 13, color: colors.gray, lineHeight: 19, marginBottom: 10, fontStyle: 'italic' },
  textarea: {
    borderWidth: 1, borderColor: colors.border, borderRadius: 8,
    padding: 10, fontSize: 14, color: colors.dark,
    textAlignVertical: 'top', minHeight: 90, backgroundColor: '#f9fafb',
  },
  prayerCard: {
    backgroundColor: colors.primaryLight, borderRadius: 14, padding: 24,
    borderWidth: 1, borderColor: colors.primary + '40',
  },
  prayerText: { fontSize: 16, color: colors.dark, lineHeight: 28, textAlign: 'center', fontStyle: 'italic' },
  errorBox: {
    backgroundColor: '#fef2f2', borderColor: '#fecaca',
    borderWidth: 1, borderRadius: 10, padding: 12, marginTop: 8,
  },
  errorText: { color: '#dc2626', fontSize: 14 },
  successIcon: { marginBottom: 16 },
  successTitle: { fontSize: 24, fontWeight: '700', color: colors.dark, marginBottom: 8 },
  successSubtitle: { fontSize: 15, color: colors.gray, textAlign: 'center', marginBottom: 32, lineHeight: 22 },
  choiceSection: { width: '100%', gap: 12 },
  choiceLabel: { fontSize: 14, fontWeight: '600', color: colors.dark, textAlign: 'center', marginBottom: 4 },
  primaryBtn: {
    backgroundColor: colors.primary, borderRadius: 12,
    paddingVertical: 14, paddingHorizontal: 24,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
  },
  primaryBtnText: { color: colors.white, fontSize: 16, fontWeight: '700' },
  secondaryBtn: {
    borderWidth: 2, borderColor: colors.primary, borderRadius: 12,
    paddingVertical: 14, paddingHorizontal: 24,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
  },
  secondaryBtnText: { color: colors.primary, fontSize: 16, fontWeight: '700' },
  ghostBtn: { padding: 12, alignItems: 'center' },
  ghostBtnText: { color: colors.gray, fontSize: 14 },
  navRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    padding: 16, backgroundColor: colors.white, borderTopWidth: 1, borderColor: colors.border,
  },
  navBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 10, paddingHorizontal: 20, borderRadius: 10 },
  navBtnBack: { borderWidth: 1, borderColor: colors.border },
  navBtnBackText: { fontSize: 15, color: colors.primary, fontWeight: '600' },
  navBtnNext: { backgroundColor: colors.primary },
  navBtnNextText: { fontSize: 15, color: colors.white, fontWeight: '600' },
});
