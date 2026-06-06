/**
 * Projeto de Vida — Projeto Semanal
 * ====================================
 * Wizard de 4 passos: Semana → Dever de Estado → Vida Interior → Evangelização → Confirmar
 */

import { useState, useEffect, useCallback } from 'react';
import {
  View, Text, ScrollView, TextInput, TouchableOpacity,
  ActivityIndicator, KeyboardAvoidingView, Platform, StyleSheet,
  Switch,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import type { IoniconsName } from '@/types/icons';
import projetoVidaMensalApi, {
  type ProjetoVidaSemanasCreate,
  type ProjetoVidaSemanasOut,
  type ProjetoVidaSemanasSummary,
} from '@/services/projetoVidaMensal';
import { getDeveEstadoTemplate } from '@/data/conteudoVocacional';
import { useTheme } from '@/theme';

const STEP_TITLES = ['Semana', 'Dever de Estado', 'Vida Interior', 'Evangelização', 'Confirmar'];

const DIAS = ['seg', 'ter', 'qua', 'qui', 'sex', 'sab', 'dom'] as const;
const DIA_LABELS: Record<string, string> = {
  seg: 'Seg', ter: 'Ter', qua: 'Qua', qui: 'Qui', sex: 'Sex', sab: 'Sáb', dom: 'Dom',
};

const PRATICAS_VIDA_INTERIOR = [
  { key: 'missa', label: 'Missa' },
  { key: 'lectio_divina', label: 'Lectio Divina' },
  { key: 'terco', label: 'Terço' },
  { key: 'leitura_espiritual', label: 'Leitura Espiritual' },
  { key: 'adoracao', label: 'Adoração' },
  { key: 'jejum', label: 'Jejum' },
] as const;

interface PraticaState {
  ativa: boolean;
  dias: string[];
  horario: string;
  obs: string;
}

interface WizardSemanalData {
  numero_semana: number;
  deverEstado: Record<string, string>; // categoria → texto
  reflexao_dever: string;
  praticas: Record<string, PraticaState>;
  evangelizacao_disposicao: string;
  momentos: string[]; // lista de descrições
}

const defaultPratica = (): PraticaState => ({ ativa: false, dias: [], horario: '', obs: '' });

const defaultData = (semana: number): WizardSemanalData => ({
  numero_semana: semana,
  deverEstado: {},
  reflexao_dever: '',
  praticas: {
    missa: defaultPratica(),
    lectio_divina: defaultPratica(),
    terco: defaultPratica(),
    leitura_espiritual: defaultPratica(),
    adoracao: defaultPratica(),
    jejum: defaultPratica(),
  },
  evangelizacao_disposicao: '',
  momentos: [],
});

export default function SemanalmScreen() {
  const { projetoId, reflexaoEvangelizacao } = useLocalSearchParams<{
    projetoId: string;
    reflexaoEvangelizacao?: string;
  }>();
  const { t, r } = useTheme();

  const [step, setStep] = useState(0);
  const [semanas, setSemanas] = useState<ProjetoVidaSemanasSummary[]>([]);
  const [semanaAtual, setSemanaAtual] = useState<number>(1);
  const [semanalExistente, setSemanalExistente] = useState<ProjetoVidaSemanasOut | null>(null);
  const [data, setData] = useState<WizardSemanalData>(defaultData(1));
  const [lifeStateCode, setLifeStateCode] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const update = (partial: Partial<WizardSemanalData>) => setData(d => ({ ...d, ...partial }));

  // Carregar lista de semanas e contexto vocacional
  useEffect(() => {
    const init = async () => {
      try {
        const [lista, ctx] = await Promise.all([
          projetoVidaMensalApi.listSemanas(projetoId),
          projetoVidaMensalApi.getContextoVocacional(),
        ]);
        setSemanas(lista);
        setLifeStateCode(ctx.life_state_code);

        // Detectar semana atual pelo calendário (simplificado: semana do mês)
        const hoje = new Date();
        const diaDoMes = hoje.getDate();
        const semanaDetectada = Math.min(Math.ceil(diaDoMes / 7), 5);
        setSemanaAtual(semanaDetectada);
        await carregarSemana(semanaDetectada, lista);
      } catch {
        // Não bloquear o fluxo
      } finally {
        setLoading(false);
      }
    };
    init();
  }, [projetoId]);

  const carregarSemana = async (n: number, lista: ProjetoVidaSemanasSummary[]) => {
    const existente = lista.find(s => s.numero_semana === n);
    if (existente) {
      try {
        const full = await projetoVidaMensalApi.getSemanal(existente.id);
        setSemanalExistente(full);
        // Preencher data a partir do semanal existente
        const newData: WizardSemanalData = defaultData(n);
        if (full.evangelizacao_disposicao) {
          newData.evangelizacao_disposicao = full.evangelizacao_disposicao;
        }
        if (full.evangelizacao_momentos) {
          newData.momentos = full.evangelizacao_momentos.map((m: any) => m.descricao ?? '');
        }
        setData(newData);
      } catch {
        setSemanalExistente(null);
      }
    } else {
      setSemanalExistente(null);
      setData(defaultData(n));
    }
    setSemanaAtual(n);
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      const deveEstadoTemplate = getDeveEstadoTemplate(lifeStateCode);
      const deveEstadoItens = deveEstadoTemplate.categorias.map(cat => ({
        categoria: cat.label,
        descricao: data.deverEstado[cat.label] || '',
      })).filter(item => item.descricao);

      const deveEstadoPayload = deveEstadoItens.length > 0 ? {
        estado_de_vida: lifeStateCode ?? 'GENERICO',
        itens: deveEstadoItens,
        reflexao: data.reflexao_dever || null,
      } : null;

      const vidaInteriorPayload: Record<string, object> = {};
      for (const [key, p] of Object.entries(data.praticas)) {
        if (p.ativa) {
          vidaInteriorPayload[key] = {
            dias: p.dias,
            horario: p.horario || null,
            obs: p.obs || null,
          };
        }
      }

      const payload: ProjetoVidaSemanasCreate = {
        numero_semana: data.numero_semana,
        dever_estado: deveEstadoPayload,
        vida_interior: Object.keys(vidaInteriorPayload).length > 0 ? vidaInteriorPayload : null,
        evangelizacao_disposicao: data.evangelizacao_disposicao || null,
        evangelizacao_momentos: data.momentos
          .filter(m => m.trim())
          .map(m => ({ descricao: m })),
        observacoes: null,
      };

      if (semanalExistente) {
        await projetoVidaMensalApi.updateSemanal(semanalExistente.id, payload);
      } else {
        await projetoVidaMensalApi.createSemanal(projetoId, payload);
      }

      router.replace({ pathname: '/vida/ciclo', params: { projetoId } });
    } catch (e: any) {
      setError(e?.response?.data?.detail?.message ?? 'Erro ao salvar. Tente novamente.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: t.bg.screen }]}>
        <ActivityIndicator size="large" color={t.brand.primary} />
      </View>
    );
  }

  const deveEstadoTemplate = getDeveEstadoTemplate(lifeStateCode);

  const renderStep = () => {
    switch (step) {

      // ── Step 0: Seletor de semana ──────────────────────────────────────────
      case 0:
        return (
          <View style={{ padding: 20 }}>
            <Text style={{ fontSize: 16, fontFamily: 'Nunito-Regular', color: t.text.secondary, marginBottom: 20, lineHeight: 22 }}>
              Transforme as decisões do seu Projeto Mensal em compromissos concretos para esta semana.
            </Text>
            <Text style={{ fontSize: 13, fontFamily: 'Nunito-Bold', color: t.text.secondary, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 12 }}>
              Selecione a semana
            </Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
              {[1, 2, 3, 4, 5].map(n => {
                const existe = semanas.some(s => s.numero_semana === n);
                const ativa = semanaAtual === n;
                return (
                  <TouchableOpacity
                    key={n}
                    style={{
                      paddingHorizontal: 20,
                      paddingVertical: 12,
                      borderRadius: r.md,
                      borderWidth: 1.5,
                      borderColor: ativa ? t.brand.primary : t.border.default,
                      backgroundColor: ativa ? t.brand.primaryDim : t.bg.elevated,
                      flexDirection: 'row', alignItems: 'center', gap: 6,
                    }}
                    onPress={() => carregarSemana(n, semanas)}
                    activeOpacity={0.8}
                  >
                    <Text style={{ fontSize: 15, fontFamily: ativa ? 'Nunito-Bold' : 'Nunito-Regular', color: ativa ? t.brand.primary : t.text.primary }}>
                      Semana {n}
                    </Text>
                    {existe && (
                      <Ionicons name={'checkmark-circle' as IoniconsName} size={14} color={t.status.success} />
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        );

      // ── Step 1: Dever de Estado ────────────────────────────────────────────
      case 1:
        return (
          <View style={{ padding: 20 }}>
            <Text style={{ fontSize: 16, fontFamily: 'Nunito-Bold', color: t.text.primary, marginBottom: 4 }}>
              {deveEstadoTemplate.titulo}
            </Text>
            <Text style={{ fontSize: 14, fontFamily: 'Nunito-Italic', color: t.text.secondary, lineHeight: 20, marginBottom: 20 }}>
              {deveEstadoTemplate.descricao}
            </Text>
            {!lifeStateCode && (
              <View style={{ flexDirection: 'row', gap: 8, backgroundColor: t.brand.primaryDim, borderRadius: r.md, padding: 12, marginBottom: 16 }}>
                <Ionicons name={'information-circle-outline' as IoniconsName} size={16} color={t.brand.primary} />
                <Text style={{ flex: 1, fontSize: 13, fontFamily: 'Nunito-Regular', color: t.text.secondary }}>
                  Complete seu perfil para uma experiência personalizada.
                </Text>
              </View>
            )}
            {deveEstadoTemplate.categorias.map(cat => (
              <View key={cat.label} style={{ marginBottom: 16 }}>
                <Text style={{ fontSize: 13, fontFamily: 'Nunito-Bold', color: t.text.secondary, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 8 }}>
                  {cat.label}
                </Text>
                <TextInput
                  style={{
                    backgroundColor: t.bg.surface, borderRadius: r.md,
                    borderWidth: StyleSheet.hairlineWidth, borderColor: t.border.subtle,
                    padding: 12, fontSize: 15, fontFamily: 'Nunito-Regular', color: t.text.primary,
                    minHeight: 72, textAlignVertical: 'top',
                  }}
                  value={data.deverEstado[cat.label] ?? ''}
                  onChangeText={v => update({ deverEstado: { ...data.deverEstado, [cat.label]: v } })}
                  multiline numberOfLines={3}
                  placeholder={cat.placeholder}
                  placeholderTextColor={t.text.tertiary}
                />
              </View>
            ))}
            <Text style={{ fontSize: 13, fontFamily: 'Nunito-Bold', color: t.text.secondary, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 8 }}>
              Reflexão sobre meu dever de estado
            </Text>
            <TextInput
              style={{
                backgroundColor: t.bg.surface, borderRadius: r.md,
                borderWidth: StyleSheet.hairlineWidth, borderColor: t.border.subtle,
                padding: 12, fontSize: 15, fontFamily: 'Nunito-Regular', color: t.text.primary,
                minHeight: 72, textAlignVertical: 'top',
              }}
              value={data.reflexao_dever}
              onChangeText={v => update({ reflexao_dever: v })}
              multiline numberOfLines={3}
              placeholder="Como estou vivendo meu estado de vida esta semana?"
              placeholderTextColor={t.text.tertiary}
            />
          </View>
        );

      // ── Step 2: Vida Interior ──────────────────────────────────────────────
      case 2:
        return (
          <View style={{ padding: 20 }}>
            <Text style={{ fontSize: 14, fontFamily: 'Nunito-Regular', color: t.text.secondary, lineHeight: 22, marginBottom: 20 }}>
              Planeje suas práticas espirituais para esta semana.
            </Text>
            {PRATICAS_VIDA_INTERIOR.map(({ key, label }) => {
              const pratica = data.praticas[key];
              return (
                <View key={key} style={{
                  backgroundColor: t.bg.elevated, borderRadius: r.lg,
                  padding: 14, marginBottom: 12,
                  borderWidth: StyleSheet.hairlineWidth, borderColor: t.border.subtle,
                }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: pratica.ativa ? 12 : 0 }}>
                    <Text style={{ fontSize: 15, fontFamily: 'Nunito-SemiBold', color: t.text.primary }}>{label}</Text>
                    <Switch
                      value={pratica.ativa}
                      onValueChange={v => update({
                        praticas: { ...data.praticas, [key]: { ...pratica, ativa: v } }
                      })}
                      trackColor={{ false: t.border.default, true: t.brand.primary }}
                      thumbColor="#ffffff"
                    />
                  </View>
                  {pratica.ativa && (
                    <>
                      <Text style={{ fontSize: 12, fontFamily: 'Nunito-Bold', color: t.text.tertiary, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 8 }}>
                        Dias
                      </Text>
                      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
                        {DIAS.map(dia => {
                          const selecionado = pratica.dias.includes(dia);
                          return (
                            <TouchableOpacity
                              key={dia}
                              style={{
                                paddingHorizontal: 10, paddingVertical: 5,
                                borderRadius: 16, borderWidth: 1,
                                borderColor: selecionado ? t.brand.primary : t.border.default,
                                backgroundColor: selecionado ? t.brand.primaryDim : t.bg.surface,
                              }}
                              onPress={() => {
                                const dias = selecionado
                                  ? pratica.dias.filter(d => d !== dia)
                                  : [...pratica.dias, dia];
                                update({ praticas: { ...data.praticas, [key]: { ...pratica, dias } } });
                              }}
                            >
                              <Text style={{ fontSize: 12, fontFamily: 'Nunito-SemiBold', color: selecionado ? t.brand.primary : t.text.secondary }}>
                                {DIA_LABELS[dia]}
                              </Text>
                            </TouchableOpacity>
                          );
                        })}
                      </View>
                      <TextInput
                        style={{
                          backgroundColor: t.bg.surface, borderRadius: r.md,
                          borderWidth: StyleSheet.hairlineWidth, borderColor: t.border.subtle,
                          padding: 10, fontSize: 14, fontFamily: 'Nunito-Regular', color: t.text.primary, minHeight: 40,
                        }}
                        value={pratica.horario}
                        onChangeText={v => update({ praticas: { ...data.praticas, [key]: { ...pratica, horario: v } } })}
                        placeholder="Horário (ex.: 07:00)"
                        placeholderTextColor={t.text.tertiary}
                      />
                    </>
                  )}
                </View>
              );
            })}
          </View>
        );

      // ── Step 3: Evangelização ──────────────────────────────────────────────
      case 3:
        return (
          <View style={{ padding: 20 }}>
            {reflexaoEvangelizacao && (
              <View style={{
                backgroundColor: t.bg.spiritual, borderLeftWidth: 3,
                borderLeftColor: t.accent.spiritual, borderRadius: r.md,
                padding: 14, marginBottom: 20,
              }}>
                <Text style={{ fontSize: 11, fontFamily: 'Nunito-Bold', color: t.accent.spiritual, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 6 }}>
                  Intenção do mês
                </Text>
                <Text style={{ fontSize: 14, fontFamily: 'Nunito-Italic', color: t.text.spiritual, lineHeight: 20 }}>
                  {reflexaoEvangelizacao}
                </Text>
              </View>
            )}

            <Text style={{ fontSize: 13, fontFamily: 'Nunito-Bold', color: t.text.secondary, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 8 }}>
              Disposição desta semana
            </Text>
            <TextInput
              style={{
                backgroundColor: t.bg.surface, borderRadius: r.md,
                borderWidth: StyleSheet.hairlineWidth, borderColor: t.border.subtle,
                padding: 14, fontSize: 15, fontFamily: 'Nunito-Regular', color: t.text.primary,
                minHeight: 100, textAlignVertical: 'top', marginBottom: 20,
              }}
              value={data.evangelizacao_disposicao}
              onChangeText={v => update({ evangelizacao_disposicao: v })}
              multiline numberOfLines={4}
              placeholder="Com qual espírito e disposição você entra nesta semana para evangelizar?"
              placeholderTextColor={t.text.tertiary}
            />

            <Text style={{ fontSize: 13, fontFamily: 'Nunito-Bold', color: t.text.secondary, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 8 }}>
              Momentos relacionais planejados
            </Text>
            <Text style={{ fontSize: 13, fontFamily: 'Nunito-Italic', color: t.text.tertiary, lineHeight: 18, marginBottom: 12 }}>
              Com quem você pretende estar presente esta semana?
            </Text>
            {data.momentos.map((m, idx) => (
              <View key={idx} style={{ flexDirection: 'row', gap: 8, marginBottom: 8, alignItems: 'center' }}>
                <TextInput
                  style={{
                    flex: 1, backgroundColor: t.bg.surface, borderRadius: r.md,
                    borderWidth: StyleSheet.hairlineWidth, borderColor: t.border.subtle,
                    padding: 12, fontSize: 14, fontFamily: 'Nunito-Regular', color: t.text.primary,
                  }}
                  value={m}
                  onChangeText={v => {
                    const list = [...data.momentos]; list[idx] = v;
                    update({ momentos: list });
                  }}
                  placeholder="Ex.: Conversa com colega durante o almoço"
                  placeholderTextColor={t.text.tertiary}
                />
                <TouchableOpacity onPress={() => update({ momentos: data.momentos.filter((_, i) => i !== idx) })}>
                  <Ionicons name={'close-circle' as IoniconsName} size={22} color={t.status.error} />
                </TouchableOpacity>
              </View>
            ))}
            <TouchableOpacity
              style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 12, borderRadius: 10, borderWidth: 1.5, borderColor: t.brand.primary, borderStyle: 'dashed' }}
              onPress={() => update({ momentos: [...data.momentos, ''] })}
            >
              <Text style={{ fontSize: 14, fontFamily: 'Nunito-SemiBold', color: t.brand.primary }}>+ Adicionar momento</Text>
            </TouchableOpacity>
          </View>
        );

      // ── Step 4: Confirmar ─────────────────────────────────────────────────
      case 4:
        return (
          <View style={{ padding: 20 }}>
            <View style={{ backgroundColor: t.brand.primaryDim, borderRadius: r.xl, padding: 20, marginBottom: 20 }}>
              <Text style={{ fontSize: 18, fontFamily: 'Nunito-Bold', color: t.brand.primary, marginBottom: 12 }}>
                Semana {data.numero_semana} {semanalExistente ? '(atualização)' : '(nova)'}
              </Text>
              <Text style={{ fontSize: 14, fontFamily: 'Nunito-Regular', color: t.text.primary }}>
                {Object.values(data.praticas).filter(p => p.ativa).length} prática(s) de vida interior
              </Text>
              <Text style={{ fontSize: 14, fontFamily: 'Nunito-Regular', color: t.text.primary, marginTop: 6 }}>
                {data.momentos.filter(m => m.trim()).length} momento(s) de evangelização
              </Text>
            </View>
            {error && (
              <View style={{ backgroundColor: t.status.errorBg, borderRadius: r.md, padding: 12, marginBottom: 12 }}>
                <Text style={{ fontSize: 13, fontFamily: 'Nunito-Regular', color: t.status.error }}>{error}</Text>
              </View>
            )}
            <TouchableOpacity
              style={{ backgroundColor: t.brand.primary, borderRadius: r.lg, padding: 18, alignItems: 'center' }}
              onPress={handleSave} disabled={saving} activeOpacity={0.8}
            >
              {saving
                ? <ActivityIndicator color="#ffffff" />
                : <Text style={{ color: '#ffffff', fontSize: 16, fontFamily: 'Nunito-Bold' }}>
                    {semanalExistente ? 'Atualizar Semana' : 'Salvar Semana'}
                  </Text>
              }
            </TouchableOpacity>
          </View>
        );

      default: return null;
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: t.bg.screen }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {/* Barra de progresso */}
      <View style={{ paddingHorizontal: 20, paddingVertical: 10, backgroundColor: t.bg.elevated, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: t.border.subtle }}>
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
            height: 3, borderRadius: 2,
            width: `${((step + 1) / STEP_TITLES.length) * 100}%` as any,
            backgroundColor: t.brand.primary,
          }} />
        </View>
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 40 }}>
        {renderStep()}
      </ScrollView>

      {/* Navegação */}
      <View style={[styles.navRow, { backgroundColor: t.bg.elevated, borderTopColor: t.border.subtle }]}>
        <TouchableOpacity
          style={{ flex: 1, minHeight: 48, borderRadius: r.lg, borderWidth: 1, borderColor: t.border.default, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 6 }}
          onPress={() => step === 0 ? router.back() : setStep(s => s - 1)}
        >
          <Ionicons name={'chevron-back' as IoniconsName} size={20} color={t.text.secondary} />
          <Text style={{ fontFamily: 'Nunito-SemiBold', color: t.text.secondary, fontSize: 15 }}>
            {step === 0 ? 'Cancelar' : 'Voltar'}
          </Text>
        </TouchableOpacity>

        {step < STEP_TITLES.length - 1 && (
          <TouchableOpacity
            style={{ flex: 1, minHeight: 48, borderRadius: r.lg, backgroundColor: t.brand.primary, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 6, marginLeft: 12 }}
            onPress={() => setStep(s => s + 1)}
          >
            <Text style={{ color: '#ffffff', fontFamily: 'Nunito-Bold', fontSize: 15 }}>Próximo</Text>
            <Ionicons name={'chevron-forward' as IoniconsName} size={20} color={'#ffffff'} />
          </TouchableOpacity>
        )}
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  navRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderTopWidth: StyleSheet.hairlineWidth },
});
