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
import { useTheme } from '@/theme';
import type { SemanticTokens } from '@/theme';

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
  `Emanuel, eu, Teu amigo e Teu servo, reconheço minhas falhas e me arrependo de todo o mal que cometi e do bem que deixei de fazer. Confio no Teu amor misericordioso e me proponho, com a Tua graça, a recomeçar com mais fidelidade no próximo mês. Amém.`;

export default function RevisaoScreen() {
  const { projetoId } = useLocalSearchParams<{ projetoId: string }>();
  const [step, setStep] = useState(0);
  const [state, setState] = useState<RevisaoState>(defaultState());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { t, r } = useTheme();

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
          <View style={{ padding: 20 }}>
            <Text style={{ fontSize: 13, fontFamily: 'Nunito-Bold', color: t.text.tertiary, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 8 }}>
              Revisão do Ciclo
            </Text>
            <Text style={{ fontSize: 14, fontFamily: 'Nunito-Italic', color: t.text.secondary, lineHeight: 22, marginBottom: 20 }}>
              Responda com sinceridade diante de Deus. Não é preciso responder a todas as questões.
            </Text>
            {QUESTOES.map(({ key, q, description, placeholder }) => (
              <View key={key} style={{ backgroundColor: t.bg.elevated, borderRadius: r.lg, padding: 16, marginBottom: 14, borderWidth: StyleSheet.hairlineWidth, borderColor: t.border.subtle, ...t.shadow.sm }}>
                <Text style={{ fontSize: 15, fontFamily: 'Nunito-SemiBold', color: t.text.primary, lineHeight: 24, marginBottom: 8 }}>
                  {q}
                </Text>
                {description && (
                  <Text style={{ fontSize: 13, fontFamily: 'Nunito-Italic', color: t.text.tertiary, lineHeight: 20, marginBottom: 12 }}>
                    {description}
                  </Text>
                )}
                <TextInput
                  style={{
                    minHeight: 120,
                    textAlignVertical: 'top',
                    backgroundColor: t.bg.surface,
                    borderRadius: r.md,
                    borderWidth: StyleSheet.hairlineWidth,
                    borderColor: t.border.subtle,
                    padding: 14,
                    fontSize: 15,
                    fontFamily: 'Nunito-Regular',
                    color: t.text.primary,
                  }}
                  value={state[key]}
                  onChangeText={v => update(key, v)}
                  multiline
                  numberOfLines={4}
                  placeholderTextColor={t.text.tertiary}
                  placeholder={placeholder}
                />
              </View>
            ))}
            {error && (
              <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 8, backgroundColor: t.status.errorBg, borderRadius: r.md, padding: 12, marginBottom: 12 }}>
                <Ionicons name={'alert-circle' as IoniconsName} size={15} color={t.status.error} />
                <Text style={{ flex: 1, fontSize: 13, fontFamily: 'Nunito-Regular', color: t.status.error }}>{error}</Text>
              </View>
            )}
          </View>
        );

      // ── Passo 1: Ato de Contrição ────────────────────────────────────────
      case 1:
        return (
          <View style={{ padding: 20 }}>
            <Text style={{ fontSize: 13, fontFamily: 'Nunito-Bold', color: t.text.tertiary, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 8 }}>
              Ato de Contrição
            </Text>
            <Text style={{ fontSize: 14, fontFamily: 'Nunito-Italic', color: t.text.secondary, lineHeight: 22, marginBottom: 24 }}>
              Antes de concluir, ore o Ato de Contrição em comunhão com seus irmãos.
            </Text>

            {/* Bloco espiritual especial */}
            <View style={{
              borderLeftWidth: 3,
              borderLeftColor: t.accent.spiritual,
              backgroundColor: t.bg.spiritual,
              borderRadius: r.md,
              padding: 20,
              marginVertical: 8,
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
          </View>
        );

      // ── Passo 2: Concluído ───────────────────────────────────────────────
      case 2:
        return (
          <View style={{ flex: 1, alignItems: 'center', paddingTop: 48, padding: 24 }}>
            <Ionicons name={'checkmark-circle' as IoniconsName} size={64} color={t.status.success} />
            <Text style={{ fontSize: 20, fontFamily: 'Nunito-Bold', color: t.text.primary, marginTop: 20, textAlign: 'center' }}>
              Que Deus abençoe o seu próximo ciclo.
            </Text>
            <Text style={{ fontSize: 14, fontFamily: 'Nunito-Italic', color: t.text.secondary, marginTop: 8, textAlign: 'center', lineHeight: 22 }}>
              Sua revisão foi salva com cuidado.
            </Text>

            <View style={{ width: '100%', gap: 12, marginTop: 32 }}>
              <Text style={{ fontSize: 14, fontFamily: 'Nunito-SemiBold', color: t.text.primary, textAlign: 'center', marginBottom: 4 }}>
                O que você deseja fazer agora?
              </Text>

              <TouchableOpacity
                style={{
                  backgroundColor: t.brand.primary,
                  borderRadius: r.lg,
                  padding: 16,
                  alignItems: 'center',
                  flexDirection: 'row',
                  justifyContent: 'center',
                  gap: 8,
                }}
                onPress={() => router.replace({ pathname: '/vida/ciclo', params: { projetoId } })}
                activeOpacity={0.8}
              >
                <Ionicons name={'book-outline' as IoniconsName} size={18} color="#ffffff" />
                <Text style={{ color: '#ffffff', fontFamily: 'Nunito-Bold', fontSize: 16 }}>Ver ciclo atual</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={{
                  borderWidth: 1,
                  borderColor: t.border.default,
                  borderRadius: r.lg,
                  padding: 14,
                  alignItems: 'center',
                  flexDirection: 'row',
                  justifyContent: 'center',
                  gap: 8,
                }}
                onPress={() => router.replace('/vida/wizard')}
                activeOpacity={0.8}
              >
                <Ionicons name={'add-circle-outline' as IoniconsName} size={18} color={t.brand.primary} />
                <Text style={{ color: t.brand.primary, fontFamily: 'Nunito-Bold', fontSize: 16 }}>Iniciar novo ciclo</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={{ padding: 12, alignItems: 'center' }}
                onPress={() => router.replace('/vida')}
                activeOpacity={0.8}
              >
                <Text style={{ color: t.text.tertiary, fontFamily: 'Nunito-Regular', fontSize: 14 }}>Voltar ao início</Text>
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
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: t.bg.screen }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      {/* Indicador de passos */}
      {step < 2 && (
        <View style={{ paddingHorizontal: 20, paddingVertical: 12, backgroundColor: t.bg.elevated, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: t.border.subtle }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text style={{ fontSize: 18, fontFamily: 'Nunito-Bold', color: t.text.primary }}>
              {STEP_TITLES[step]}
            </Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              {[0, 1].map(i => (
                <View
                  key={i}
                  style={{
                    height: 8,
                    borderRadius: 4,
                    backgroundColor: i === step ? t.brand.primary : i < step ? t.brand.primary + '60' : t.border.subtle,
                    width: i === step ? 24 : 8,
                  }}
                />
              ))}
              <Text style={{ fontSize: 12, fontFamily: 'Nunito-Regular', color: t.text.tertiary, marginLeft: 4 }}>
                {step + 1} / 2
              </Text>
            </View>
          </View>
        </View>
      )}

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 48 }}>
        {renderStep()}
      </ScrollView>

      {/* Navegação (não mostrar no passo final) */}
      {step < 2 && (
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, backgroundColor: t.bg.elevated, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: t.border.subtle }}>
          <TouchableOpacity
            style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 10, paddingHorizontal: 20, borderRadius: r.md, borderWidth: StyleSheet.hairlineWidth, borderColor: t.border.subtle }}
            onPress={() => (step === 0 ? router.back() : setStep(s => s - 1))}
          >
            <Ionicons name={'chevron-back' as IoniconsName} size={20} color={t.brand.primary} />
            <Text style={{ fontSize: 15, fontFamily: 'Nunito-SemiBold', color: t.brand.primary }}>{step === 0 ? 'Cancelar' : 'Voltar'}</Text>
          </TouchableOpacity>

          {isLastContentStep ? (
            <TouchableOpacity
              style={{
                backgroundColor: t.brand.primary,
                borderRadius: r.lg,
                padding: 16,
                alignItems: 'center',
                flexDirection: 'row',
                justifyContent: 'center',
                gap: 8,
              }}
              onPress={handleSave}
              disabled={saving}
              activeOpacity={0.8}
            >
              {saving
                ? <ActivityIndicator color="#ffffff" size="small" />
                : <>
                    <Text style={{ color: '#ffffff', fontFamily: 'Nunito-Bold', fontSize: 16 }}>Salvar Revisão</Text>
                    <Ionicons name={'checkmark' as IoniconsName} size={20} color="#ffffff" />
                  </>
              }
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={{
                backgroundColor: t.brand.primary,
                borderRadius: r.lg,
                padding: 16,
                alignItems: 'center',
                flexDirection: 'row',
                justifyContent: 'center',
                gap: 8,
              }}
              onPress={() => setStep(s => s + 1)}
              activeOpacity={0.8}
            >
              <Text style={{ color: '#ffffff', fontFamily: 'Nunito-Bold', fontSize: 16 }}>Próximo</Text>
              <Ionicons name={'chevron-forward' as IoniconsName} size={20} color="#ffffff" />
            </TouchableOpacity>
          )}
        </View>
      )}
    </KeyboardAvoidingView>
  );
}
