/**
 * Projeto de Vida Mensal — Wizard de Criação
 * ============================================
 * 11 passos: Motivação → Ciclo → 5 Áreas → Evangelização → Intercessão → PIN → Confirmar
 */

import { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, ActivityIndicator, KeyboardAvoidingView, Platform,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import type { IoniconsName } from '@/types/icons';
import { useTheme } from '@/theme';
import projetoVidaMensalApi, {
  MESES,
  type CompromissoAreaItem, type AreaMensalIn,
  type ContextoVocacionalOut,
  type IntercessaoUpsert,
} from '@/services/projetoVidaMensal';
import { getMotivacaoContent } from '@/data/conteudoVocacional';

// ── Tipos locais ─────────────────────────────────────────────────────────────

interface AreaData {
  objetivo: string;
  compromissos: CompromissoAreaItem[];
  observacoes: string;
}

interface WizardData {
  mes: string;
  ano: string;
  pin: string;
  intencao: string;
  reflexao_evangelizacao: string;
  intencoes_pessoais: string;
  intencoes_comunitarias: string;
  oferecimento: string;
  areas: Record<string, AreaData>;
}

const now = new Date();
const defaultData = (): WizardData => ({
  mes: String(now.getMonth() + 1),
  ano: String(now.getFullYear()),
  pin: '',
  intencao: '',
  reflexao_evangelizacao: '',
  intencoes_pessoais: '',
  intencoes_comunitarias: '',
  oferecimento: '',
  areas: {
    FAMILIA_VOCACIONAL:    { objetivo: '', compromissos: [], observacoes: '' },
    MINISTERIO_BOM_PASTOR: { objetivo: '', compromissos: [], observacoes: '' },
    GRUPO_FORMATIVO:       { objetivo: '', compromissos: [], observacoes: '' },
    SAUDE_LAZER:           { objetivo: '', compromissos: [], observacoes: '' },
    FAMILIA_ORIGEM:        { objetivo: '', compromissos: [], observacoes: '' },
  },
});

const STEP_TITLES = [
  'Motivação', 'Ciclo Mensal',
  'Família Vocacional', 'Ministério Bom Pastor', 'Grupo Formativo',
  'Saúde e Lazer', 'Família de Origem', 'Evangelização Ser Feliz',
  'Intercessão', 'Privacidade', 'Confirmar',
];

// ── Main ─────────────────────────────────────────────────────────────────────

export default function WizardScreen() {
  const { t, r } = useTheme();
  const [step, setStep] = useState(0);
  const [data, setData] = useState<WizardData>(defaultData());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [contextoVoc, setContextoVoc] = useState<ContextoVocacionalOut | null>(null);
  const [loadingContexto, setLoadingContexto] = useState(true);

  const update = (partial: Partial<WizardData>) => setData(d => ({ ...d, ...partial }));

  useEffect(() => {
    setLoadingContexto(true);
    projetoVidaMensalApi.getContextoVocacional()
      .then(res => setContextoVoc(res))
      .catch(() => setContextoVoc(null))
      .finally(() => setLoadingContexto(false));
  }, []);

  // ── Save ─────────────────────────────────────────────────────────────────────

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      const mes = parseInt(data.mes, 10);
      const ano = parseInt(data.ano, 10);

      let projetoId: string;
      try {
        const criado = await projetoVidaMensalApi.criar({
          mes, ano,
          pin: data.pin || null,
          intencao: data.intencao || null,
        });
        projetoId = criado.id;
      } catch (e: any) {
        if (e?.response?.status === 409 || e?.status === 409) {
          const historico = await projetoVidaMensalApi.getHistorico();
          const existente = historico.find(p => p.mes === mes && p.ano === ano);
          if (!existente) throw e;
          projetoId = existente.id;
        } else {
          throw e;
        }
      }

      const areasArray: AreaMensalIn[] = Object.entries(data.areas).map(([tipo_area, areaData]) => ({
        tipo_area,
        objetivo: areaData.objetivo || null,
        compromissos: areaData.compromissos,
        observacoes: areaData.observacoes || null,
      }));

      await projetoVidaMensalApi.update(projetoId, {
        reflexao_evangelizacao: data.reflexao_evangelizacao || null,
        areas: areasArray,
      });

      // Salvar intercessão (todos os campos opcionais)
      if (data.intencoes_pessoais || data.intencoes_comunitarias || data.oferecimento) {
        await projetoVidaMensalApi.upsertIntercessao(projetoId, {
          intencoes_pessoais: data.intencoes_pessoais || null,
          intencoes_comunitarias: data.intencoes_comunitarias || null,
          oferecimento: data.oferecimento || null,
        });
      }

      router.replace({ pathname: '/vida/ciclo', params: { projetoId } });
    } catch (e: any) {
      const msg = e?.response?.data?.detail?.message ?? 'Erro ao salvar. Tente novamente.';
      setError(msg);
    } finally {
      setSaving(false);
    }
  };

  // ── Input style helper ────────────────────────────────────────────────────────
  const inputStyle = {
    backgroundColor: t.bg.surface,
    borderRadius: r.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: t.border.subtle,
    padding: 12,
    fontSize: 15,
    fontFamily: 'Nunito-Regular',
    color: t.text.primary,
    minHeight: 48,
    marginBottom: 10,
  };

  // ── Render steps ─────────────────────────────────────────────────────────────

  const renderStep = () => {
    switch (step) {

      // ── Step 0: Motivação adaptada ao perfil vocacional ───────────────────
      case 0: {
        if (loadingContexto) {
          return (
            <View style={[styles.stepContent, { alignItems: 'center', paddingTop: 48 }]}>
              <ActivityIndicator size="large" color={t.brand.primary} />
            </View>
          );
        }

        const motivacao = getMotivacaoContent(
          contextoVoc?.vocational_reality_code,
          contextoVoc?.nome ?? '',
        );

        return (
          <View style={styles.stepContent}>
            {/* Saudação */}
            <View style={{ alignItems: 'center', marginBottom: 24 }}>
              <Ionicons name={'compass-outline' as IoniconsName} size={48} color={t.brand.primary} />
              <Text style={{ fontSize: 22, fontFamily: 'Nunito-ExtraBold', color: t.text.primary, textAlign: 'center', marginTop: 12 }}>
                {motivacao.saudacao}
              </Text>
            </View>

            {/* Reflexão adaptada */}
            <View style={{ backgroundColor: '#fef3c7', borderRadius: 14, padding: 20, marginBottom: 16, borderWidth: 1, borderColor: '#fde68a' }}>
              <Ionicons name={'sparkles' as IoniconsName} size={18} color={'#b45309'} style={{ marginBottom: 10, alignSelf: 'center' }} />
              <Text style={{ fontSize: 15, color: '#92400e', fontFamily: 'Nunito-Regular', textAlign: 'center', lineHeight: 24, marginBottom: 12 }}>
                {motivacao.reflexao}
              </Text>
              <Text style={{ fontSize: 14, color: '#b45309', fontFamily: 'Nunito-Italic', textAlign: 'center', lineHeight: 22 }}>
                {motivacao.escritura}
              </Text>
            </View>

            {/* Questão de meditação */}
            <Text style={{ fontSize: 15, fontFamily: 'Nunito-SemiBold', color: t.text.secondary, textAlign: 'center', marginBottom: 20, lineHeight: 22 }}>
              {motivacao.questaoMeditacao}
            </Text>

            {/* Campo intenção */}
            <View style={{ marginBottom: 16 }}>
              <Text style={{ fontSize: 13, fontFamily: 'Nunito-Bold', color: t.text.secondary, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 8 }}>
                Minha intenção para este ciclo
              </Text>
              <TextInput
                style={{
                  backgroundColor: t.bg.surface,
                  borderRadius: r.md,
                  borderWidth: StyleSheet.hairlineWidth,
                  borderColor: t.border.subtle,
                  padding: 14,
                  fontSize: 15,
                  fontFamily: 'Nunito-Regular',
                  color: t.text.primary,
                  minHeight: 80,
                  textAlignVertical: 'top',
                }}
                value={data.intencao}
                onChangeText={v => update({ intencao: v })}
                multiline
                numberOfLines={3}
                placeholder="Opcional. Uma palavra ou frase que oferece este mês ao Senhor..."
                placeholderTextColor={t.text.tertiary}
              />
            </View>

            {/* Nota de perfil incompleto */}
            {contextoVoc?.perfil_incompleto && (
              <View style={{ flexDirection: 'row', gap: 8, alignItems: 'flex-start', backgroundColor: t.brand.primaryDim, borderRadius: r.md, padding: 12 }}>
                <Ionicons name={'information-circle-outline' as IoniconsName} size={16} color={t.brand.primary} />
                <Text style={{ flex: 1, fontSize: 13, fontFamily: 'Nunito-Regular', color: t.text.secondary, lineHeight: 18 }}>
                  Complete seu perfil para uma experiência mais personalizada.
                </Text>
              </View>
            )}

            {/* Nota de privacidade */}
            <View style={{ backgroundColor: t.bg.elevated, borderRadius: 12, padding: 14, alignItems: 'center', borderWidth: 1, borderColor: t.border.subtle, marginTop: 16 }}>
              <Ionicons name={'shield-checkmark-outline' as IoniconsName} size={16} color={t.brand.primary} style={{ marginBottom: 6 }} />
              <Text style={{ fontSize: 13, fontFamily: 'Nunito-Regular', color: t.text.secondary, textAlign: 'center', lineHeight: 18 }}>
                Tudo o que você escrever aqui é seu. A Equipe Lumen+ não acessa o conteúdo do seu Projeto de Vida.
              </Text>
            </View>
          </View>
        );
      }

      // ── Step 1: Ciclo Mensal ──────────────────────────────────────────────
      case 1:
        return (
          <View style={styles.stepContent}>
            <Text style={{ fontSize: 14, fontFamily: 'Nunito-SemiBold', color: t.text.primary, marginBottom: 4 }}>Mês *</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
              <View style={styles.chipRow}>
                {MESES.map((m, i) => (
                  <TouchableOpacity
                    key={m}
                    style={[
                      styles.chip,
                      { borderColor: t.border.default, backgroundColor: t.bg.elevated },
                      data.mes === String(i + 1) && { backgroundColor: t.brand.primary, borderColor: t.brand.primary },
                    ]}
                    onPress={() => update({ mes: String(i + 1) })}
                  >
                    <Text style={[
                      { fontSize: 13, fontFamily: 'Nunito-Regular', color: t.text.secondary },
                      data.mes === String(i + 1) && { color: '#ffffff', fontFamily: 'Nunito-SemiBold' },
                    ]}>
                      {m.slice(0, 3)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>

            <Text style={{ fontSize: 14, fontFamily: 'Nunito-SemiBold', color: t.text.primary, marginBottom: 4 }}>Ano *</Text>
            <TextInput
              style={inputStyle}
              value={data.ano}
              onChangeText={v => update({ ano: v })}
              keyboardType="numeric"
              maxLength={4}
              placeholderTextColor={t.text.tertiary}
            />
          </View>
        );

      // ── Steps 2-6: 5 Áreas Mensais ───────────────────────────────────────────
      case 2:
        return (
          <AreaMensalStep
            titulo="Família Vocacional"
            descricaoOrientadora="Sua família vocacional é o coração de sua jornada comunitária. Planeje encontros, partilhas com o acompanhador e compromissos com a comunidade."
            areaData={data.areas.FAMILIA_VOCACIONAL}
            onChange={patch => update({ areas: { ...data.areas, FAMILIA_VOCACIONAL: { ...data.areas.FAMILIA_VOCACIONAL, ...patch } } })}
            t={t} r={r}
          />
        );

      case 3:
        return (
          <AreaMensalStep
            titulo="Ministério Bom Pastor"
            descricaoOrientadora="Seu serviço e missão apostólica. Liste atividades pastorais, atendimentos e compromissos de serviço que você assume neste mês."
            areaData={data.areas.MINISTERIO_BOM_PASTOR}
            onChange={patch => update({ areas: { ...data.areas, MINISTERIO_BOM_PASTOR: { ...data.areas.MINISTERIO_BOM_PASTOR, ...patch } } })}
            t={t} r={r}
          />
        );

      case 4:
        return (
          <AreaMensalStep
            titulo="Grupo Formativo"
            descricaoOrientadora="Datas e compromissos do seu grupo formativo. Inclua os encontros do grupo, retiros e formações previstas para este mês."
            areaData={data.areas.GRUPO_FORMATIVO}
            onChange={patch => update({ areas: { ...data.areas, GRUPO_FORMATIVO: { ...data.areas.GRUPO_FORMATIVO, ...patch } } })}
            t={t} r={r}
          />
        );

      case 5:
        return (
          <AreaMensalStep
            titulo="Saúde, Descanso e Lazer"
            descricaoOrientadora="Cuidar de si é parte da vocação. Liste consultas, momentos de descanso, atividades físicas e lazer que você planeja neste mês."
            areaData={data.areas.SAUDE_LAZER}
            onChange={patch => update({ areas: { ...data.areas, SAUDE_LAZER: { ...data.areas.SAUDE_LAZER, ...patch } } })}
            t={t} r={r}
          />
        );

      case 6:
        return (
          <AreaMensalStep
            titulo="Família de Origem"
            descricaoOrientadora="Sua família de sangue é um presente de Deus. Planeje momentos concretos de presença, contato e cuidado com seus familiares neste mês."
            areaData={data.areas.FAMILIA_ORIGEM}
            onChange={patch => update({ areas: { ...data.areas, FAMILIA_ORIGEM: { ...data.areas.FAMILIA_ORIGEM, ...patch } } })}
            t={t} r={r}
          />
        );

      // ── Step 7: Evangelização Ser Feliz ─────────────────────────────────────
      case 7:
        return (
          <View style={{ padding: 20 }}>
            <View style={{ backgroundColor: '#f97316', borderRadius: 14, padding: 18, marginBottom: 20 }}>
              <Text style={{ fontSize: 11, fontFamily: 'Nunito-Bold' as const, color: 'rgba(255,255,255,0.8)', letterSpacing: 1, marginBottom: 6 }}>✦ COMUNHÃO COMUNITÁRIA</Text>
              <Text style={{ fontSize: 16, fontFamily: 'Nunito-Bold' as const, color: '#ffffff', marginBottom: 10 }}>Evangelização Ser Feliz</Text>
              <Text style={{ fontSize: 14, fontFamily: 'Nunito-Regular' as const, color: 'rgba(255,255,255,0.95)', lineHeight: 21 }}>
                Como você quer viver a Evangelização Ser Feliz neste mês? Quais pessoas estão no seu coração?
              </Text>
            </View>
            <Text style={{ fontSize: 13, fontFamily: 'Nunito-Bold' as const, color: t.text.secondary, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 8 }}>
              Reflexão e intenção
            </Text>
            <TextInput
              style={{
                backgroundColor: t.bg.surface,
                borderRadius: r.md,
                borderWidth: StyleSheet.hairlineWidth,
                borderColor: t.border.subtle,
                padding: 14,
                fontSize: 15,
                fontFamily: 'Nunito-Regular' as const,
                color: t.text.primary,
                minHeight: 120,
                textAlignVertical: 'top',
              }}
              value={data.reflexao_evangelizacao}
              onChangeText={v => update({ reflexao_evangelizacao: v })}
              multiline
              numberOfLines={4}
              placeholder="Escreva livremente sobre como quer estar presente para evangelizar neste mês..."
              placeholderTextColor={t.text.tertiary}
            />
          </View>
        );

      // ── Step 8: Intercessão ──────────────────────────────────────────────────
      case 8:
        return (
          <View style={{ padding: 20 }}>
            <View style={{ alignItems: 'center', marginBottom: 20 }}>
              <Ionicons name={'heart' as IoniconsName} size={32} color={t.accent.spiritual} />
              <Text style={{ fontSize: 18, fontFamily: 'Nunito-Bold', color: t.text.primary, textAlign: 'center', marginTop: 10, marginBottom: 8 }}>
                Encerre em oração
              </Text>
              <Text style={{ fontSize: 14, fontFamily: 'Nunito-Italic', color: t.text.secondary, textAlign: 'center', lineHeight: 22 }}>
                Termine o seu Projeto de Vida entregando tudo ao Senhor.
              </Text>
            </View>

            {/* Intenções pessoais */}
            <Text style={{ fontSize: 13, fontFamily: 'Nunito-Bold', color: t.text.secondary, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 8 }}>
              Intenções pessoais
            </Text>
            <TextInput
              style={{
                backgroundColor: t.bg.surface,
                borderRadius: r.md,
                borderWidth: StyleSheet.hairlineWidth,
                borderColor: t.border.subtle,
                padding: 14,
                fontSize: 15,
                fontFamily: 'Nunito-Regular',
                color: t.text.primary,
                minHeight: 80,
                textAlignVertical: 'top',
                marginBottom: 16,
              }}
              value={data.intencoes_pessoais}
              onChangeText={v => update({ intencoes_pessoais: v })}
              multiline
              numberOfLines={3}
              placeholder="Pessoas e intenções que carrego no coração..."
              placeholderTextColor={t.text.tertiary}
            />

            {/* Intenções comunitárias */}
            <Text style={{ fontSize: 13, fontFamily: 'Nunito-Bold', color: t.text.secondary, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 8 }}>
              Intenções comunitárias
            </Text>
            <TextInput
              style={{
                backgroundColor: t.bg.surface,
                borderRadius: r.md,
                borderWidth: StyleSheet.hairlineWidth,
                borderColor: t.border.subtle,
                padding: 14,
                fontSize: 15,
                fontFamily: 'Nunito-Regular',
                color: t.text.primary,
                minHeight: 80,
                textAlignVertical: 'top',
                marginBottom: 16,
              }}
              value={data.intencoes_comunitarias}
              onChangeText={v => update({ intencoes_comunitarias: v })}
              multiline
              numberOfLines={3}
              placeholder="Intenções pela comunidade, irmãos, missão..."
              placeholderTextColor={t.text.tertiary}
            />

            {/* Oferecimento */}
            <Text style={{ fontSize: 13, fontFamily: 'Nunito-Bold', color: t.text.secondary, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 8 }}>
              Oferecimento do mês
            </Text>
            <TextInput
              style={{
                backgroundColor: t.bg.surface,
                borderRadius: r.md,
                borderWidth: StyleSheet.hairlineWidth,
                borderColor: t.border.subtle,
                padding: 14,
                fontSize: 15,
                fontFamily: 'Nunito-Regular',
                color: t.text.primary,
                minHeight: 64,
                textAlignVertical: 'top',
                marginBottom: 16,
              }}
              value={data.oferecimento}
              onChangeText={v => update({ oferecimento: v })}
              multiline
              numberOfLines={2}
              placeholder="Ofereço este ciclo ao Senhor por..."
              placeholderTextColor={t.text.tertiary}
            />
          </View>
        );

      // ── Step 9: PIN / Privacidade ─────────────────────────────────────────
      case 9:
        return (
          <View style={styles.stepContent}>
            {/* Bloco de privacidade */}
            <View style={{ backgroundColor: t.bg.elevated, borderRadius: 14, padding: 18, marginBottom: 24, borderWidth: 1, borderColor: t.border.subtle }}>
              <Text style={{ fontSize: 17, fontFamily: 'Nunito-Bold', color: t.text.primary, marginBottom: 12 }}>🔒 Sua privacidade é sagrada</Text>
              <Text style={{ fontSize: 14, fontFamily: 'Nunito-Regular', color: t.text.primary, lineHeight: 21, marginBottom: 12 }}>
                O seu Projeto de Vida é um espaço íntimo entre você e Deus. Tudo o que você escrever aqui
                será protegido.{'\n\n'}
                O conteúdo deste módulo é pessoal. Nem a equipe técnica do Lumen+ terá acesso ao que você escreveu.{'\n\n'}
                Permanecemos unidos em oração e comunhão.{'\n\n'}
                Para manter esse conteúdo privado, você pode criar uma senha que será usada para acessar seu
                Projeto de Vida.
              </Text>
              <View style={{ flexDirection: 'row', gap: 8, backgroundColor: '#fef3c7', borderRadius: 10, padding: 12, marginBottom: 12, alignItems: 'flex-start' }}>
                <Ionicons name={'warning-outline' as IoniconsName} size={16} color={'#b45309'} />
                <Text style={{ fontSize: 13, fontFamily: 'Nunito-Regular', color: '#b45309', flex: 1, lineHeight: 18 }}>
                  Se você perder essa senha, não será possível recuperar o conteúdo ou o acesso ao seu Projeto de Vida.
                </Text>
              </View>
              <View style={{ gap: 8 }}>
                {[
                  'Este conteúdo é completamente privado',
                  'Nossos servidores não terão acesso ao conteúdo que você escrever ou à senha que você criar',
                  'Desenvolvedores e administradores não terão acesso ao conteúdo escrito',
                ].map((item, i) => (
                  <View key={i} style={{ flexDirection: 'row', gap: 8, alignItems: 'flex-start' }}>
                    <Ionicons name={'checkmark-circle' as IoniconsName} size={16} color={t.brand.primary} />
                    <Text style={{ fontSize: 13, fontFamily: 'Nunito-Regular', color: t.text.primary, flex: 1, lineHeight: 18 }}>{item}</Text>
                  </View>
                ))}
              </View>
            </View>

            {/* Campo PIN */}
            <Text style={{ fontSize: 14, fontFamily: 'Nunito-SemiBold', color: t.text.primary, marginBottom: 4 }}>Senha de 4 dígitos (opcional)</Text>
            <Text style={{ fontSize: 13, fontFamily: 'Nunito-Regular', color: t.text.tertiary, lineHeight: 20, marginBottom: 12 }}>Deixe em branco para não usar senha.</Text>
            <TextInput
              style={inputStyle}
              value={data.pin}
              onChangeText={v => update({ pin: v.replace(/\D/g, '').slice(0, 4) })}
              placeholder="0000"
              placeholderTextColor={t.text.tertiary}
              keyboardType="numeric"
              secureTextEntry
              maxLength={4}
            />
          </View>
        );

      // ── Step 10: Confirmar ─────────────────────────────────────────────────
      case 10:
        return (
          <View style={styles.stepContent}>
            <View style={{ backgroundColor: t.brand.primaryDim, borderRadius: 14, padding: 20, marginBottom: 20, gap: 8 }}>
              <Text style={{ fontSize: 20, fontFamily: 'Nunito-Bold', color: t.brand.primary, marginBottom: 8 }}>
                {MESES[parseInt(data.mes, 10) - 1]} {data.ano}
              </Text>
              {data.pin ? <Text style={{ fontSize: 15, fontFamily: 'Nunito-Regular', color: t.text.primary }}>🔒 Senha configurada</Text> : null}
              {Object.entries(data.areas).map(([key, area]) => {
                const labels: Record<string, string> = {
                  FAMILIA_VOCACIONAL: 'Família Vocacional',
                  MINISTERIO_BOM_PASTOR: 'Ministério Bom Pastor',
                  GRUPO_FORMATIVO: 'Grupo Formativo',
                  SAUDE_LAZER: 'Saúde e Lazer',
                  FAMILIA_ORIGEM: 'Família de Origem',
                };
                const total = area.compromissos.length;
                return (
                  <Text key={key} style={{ fontSize: 15, fontFamily: 'Nunito-Regular', color: t.text.primary }}>
                    • {labels[key] ?? key}: {total} compromisso(s)
                  </Text>
                );
              })}
              {data.reflexao_evangelizacao ? (
                <Text style={{ fontSize: 15, fontFamily: 'Nunito-Regular', color: t.text.primary }}>✦ Evangelização Ser Feliz preenchida</Text>
              ) : null}
              {(data.intencoes_pessoais || data.intencoes_comunitarias || data.oferecimento) ? (
                <Text style={{ fontSize: 15, fontFamily: 'Nunito-Regular', color: t.text.primary }}>🙏 Intercessão preenchida</Text>
              ) : null}
            </View>
            {error && (
              <View style={{ backgroundColor: '#fef2f2', borderColor: '#fecaca', borderWidth: 1, borderRadius: 10, padding: 12, marginBottom: 12 }}>
                <Text style={{ color: t.status.error, fontSize: 14, fontFamily: 'Nunito-Regular' }}>{error}</Text>
              </View>
            )}
            <TouchableOpacity
              style={{ backgroundColor: t.brand.primary, borderRadius: r.lg, padding: 18, alignItems: 'center', marginTop: 8 }}
              onPress={handleSave} disabled={saving} activeOpacity={0.8}
            >
              {saving
                ? <ActivityIndicator color={'#ffffff'} />
                : <Text style={{ color: '#ffffff', fontSize: 16, fontFamily: 'Nunito-Bold' }}>Salvar Projeto de Vida</Text>
              }
            </TouchableOpacity>
          </View>
        );

      default:
        return null;
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: t.bg.screen }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      {/* Barra de progresso */}
      <View style={{
        paddingHorizontal: 20,
        paddingVertical: 10,
        backgroundColor: t.bg.elevated,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: t.border.subtle,
      }}>
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
            width: `${((step + 1) / STEP_TITLES.length) * 100}%` as any,
            backgroundColor: t.brand.primary,
            borderRadius: 2,
          }} />
        </View>
      </View>

      <ScrollView style={[styles.container, { backgroundColor: t.bg.screen }]} contentContainerStyle={{ paddingBottom: 40 }}>
        {renderStep()}
      </ScrollView>

      {/* Navegação */}
      <View style={[styles.navRow, { backgroundColor: t.bg.elevated, borderTopColor: t.border.subtle }]}>
        <TouchableOpacity
          style={{
            flex: 1,
            minHeight: 48,
            borderRadius: r.lg,
            borderWidth: 1,
            borderColor: t.border.default,
            alignItems: 'center',
            justifyContent: 'center',
            flexDirection: 'row',
            gap: 6,
          }}
          onPress={() => (step === 0 ? router.back() : setStep(s => s - 1))}
        >
          <Ionicons name={'chevron-back' as IoniconsName} size={20} color={t.text.secondary} />
          <Text style={{ fontFamily: 'Nunito-SemiBold', color: t.text.secondary, fontSize: 15 }}>{step === 0 ? 'Cancelar' : 'Voltar'}</Text>
        </TouchableOpacity>

        {step < STEP_TITLES.length - 1 && (
          <TouchableOpacity
            style={{
              flex: 1,
              minHeight: 48,
              borderRadius: r.lg,
              backgroundColor: t.brand.primary,
              alignItems: 'center',
              justifyContent: 'center',
              flexDirection: 'row',
              gap: 6,
              marginLeft: 12,
            }}
            onPress={() => setStep(s => s + 1)}
          >
            <Text style={{ color: '#ffffff', fontFamily: 'Nunito-Bold', fontSize: 15 }}>{step === 0 ? 'Iniciar meu Projeto de Vida' : 'Próximo'}</Text>
            <Ionicons name={'chevron-forward' as IoniconsName} size={20} color={'#ffffff'} />
          </TouchableOpacity>
        )}
      </View>
    </KeyboardAvoidingView>
  );
}

// ── Componentes auxiliares ────────────────────────────────────────────────────

type ThemeTokens = ReturnType<typeof useTheme>['t'];
type RadiiTokens = ReturnType<typeof useTheme>['r'];

function SectionTitle({ label, t }: { label: string; t: ThemeTokens }) {
  return (
    <Text style={{ fontSize: 13, fontFamily: 'Nunito-Bold', color: t.text.secondary, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 12, marginTop: 4 }}>
      {label}
    </Text>
  );
}

function AddButton({ label, onPress, t }: { label: string; onPress: () => void; t: ThemeTokens }) {
  return (
    <TouchableOpacity
      style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 14, borderRadius: 12, borderWidth: 1.5, borderColor: t.brand.primary, borderStyle: 'dashed', marginBottom: 4 }}
      onPress={onPress}
    >
      <Text style={{ fontSize: 14, fontFamily: 'Nunito-SemiBold', color: t.brand.primary }}>{label}</Text>
    </TouchableOpacity>
  );
}

// ── Componente de Área Mensal ─────────────────────────────────────────────────

function AreaMensalStep({
  titulo,
  descricaoOrientadora,
  areaData,
  onChange,
  t,
  r,
}: {
  titulo: string;
  descricaoOrientadora: string;
  areaData: AreaData;
  onChange: (patch: Partial<AreaData>) => void;
  t: ThemeTokens;
  r: RadiiTokens;
}) {
  const inputStyle = {
    backgroundColor: t.bg.surface,
    borderRadius: r.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: t.border.subtle,
    padding: 12,
    fontSize: 15,
    fontFamily: 'Nunito-Regular' as const,
    color: t.text.primary,
    minHeight: 48,
    marginBottom: 10,
  };

  const addCompromisso = () =>
    onChange({
      compromissos: [
        ...areaData.compromissos,
        { descricao: '', data: '', horario: '', local: '', obs: '' },
      ],
    });

  const removeCompromisso = (idx: number) =>
    onChange({ compromissos: areaData.compromissos.filter((_, i) => i !== idx) });

  const updateCompromisso = (idx: number, patch: Partial<CompromissoAreaItem>) => {
    const list = [...areaData.compromissos];
    list[idx] = { ...list[idx], ...patch };
    onChange({ compromissos: list });
  };

  return (
    <View style={{ padding: 20 }}>
      <Text style={{ fontSize: 13, fontFamily: 'Nunito-Regular' as const, color: t.text.tertiary, lineHeight: 20, marginBottom: 16 }}>
        {descricaoOrientadora}
      </Text>

      {/* Objetivo */}
      <Text style={{ fontSize: 13, fontFamily: 'Nunito-Bold' as const, color: t.text.secondary, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 8 }}>
        Objetivo do mês
      </Text>
      <TextInput
        style={[inputStyle, { minHeight: 64, textAlignVertical: 'top' }]}
        value={areaData.objetivo}
        onChangeText={v => onChange({ objetivo: v })}
        multiline
        numberOfLines={2}
        placeholder="O que você pretende viver nesta área este mês?"
        placeholderTextColor={t.text.tertiary}
      />

      {/* Compromissos */}
      <Text style={{ fontSize: 13, fontFamily: 'Nunito-Bold' as const, color: t.text.secondary, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 8, marginTop: 8 }}>
        Compromissos concretos
      </Text>
      {areaData.compromissos.map((c, idx) => (
        <View key={idx} style={{ backgroundColor: t.bg.elevated, borderRadius: 10, padding: 12, marginBottom: 10, borderWidth: StyleSheet.hairlineWidth, borderColor: t.border.subtle }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <Text style={{ fontSize: 13, fontFamily: 'Nunito-SemiBold' as const, color: t.text.primary }}>
              Compromisso {idx + 1}
            </Text>
            <TouchableOpacity onPress={() => removeCompromisso(idx)}>
              <Ionicons name={'trash-outline' as IoniconsName} size={16} color={t.status.error} />
            </TouchableOpacity>
          </View>
          <TextInput style={inputStyle} placeholder="Descrição" placeholderTextColor={t.text.tertiary}
            value={c.descricao ?? ''} onChangeText={v => updateCompromisso(idx, { descricao: v })} />
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <TextInput style={[inputStyle, { flex: 1 }]} placeholder="Data" placeholderTextColor={t.text.tertiary}
              value={c.data ?? ''} onChangeText={v => updateCompromisso(idx, { data: v })} />
            <TextInput style={[inputStyle, { flex: 1 }]} placeholder="Horário" placeholderTextColor={t.text.tertiary}
              value={c.horario ?? ''} onChangeText={v => updateCompromisso(idx, { horario: v })} />
          </View>
          <TextInput style={inputStyle} placeholder="Local (opcional)" placeholderTextColor={t.text.tertiary}
            value={c.local ?? ''} onChangeText={v => updateCompromisso(idx, { local: v })} />
        </View>
      ))}
      <TouchableOpacity
        style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 12, borderRadius: 10, borderWidth: 1.5, borderColor: t.brand.primary, borderStyle: 'dashed', marginBottom: 16 }}
        onPress={addCompromisso}
      >
        <Text style={{ fontSize: 14, fontFamily: 'Nunito-SemiBold' as const, color: t.brand.primary }}>+ Adicionar compromisso</Text>
      </TouchableOpacity>

      {/* Observações */}
      <Text style={{ fontSize: 13, fontFamily: 'Nunito-Bold' as const, color: t.text.secondary, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 8 }}>
        Observações (opcional)
      </Text>
      <TextInput
        style={[inputStyle, { minHeight: 64, textAlignVertical: 'top' }]}
        value={areaData.observacoes}
        onChangeText={v => onChange({ observacoes: v })}
        multiline
        numberOfLines={2}
        placeholder="Notas livres sobre esta área..."
        placeholderTextColor={t.text.tertiary}
      />
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1 },
  stepContent: { padding: 20 },
  textarea: { height: 80, textAlignVertical: 'top' },
  row: { flexDirection: 'row' },
  chipRow: { flexDirection: 'row', gap: 8, paddingHorizontal: 2 },
  chip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20, borderWidth: 1 },
  itemCard: { borderRadius: 12, padding: 14, marginBottom: 12, borderWidth: 1 },
  itemCardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  navRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderTopWidth: StyleSheet.hairlineWidth },
});
