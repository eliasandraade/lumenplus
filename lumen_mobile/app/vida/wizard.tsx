/**
 * Projeto de Vida Mensal — Wizard de Criação
 * ============================================
 * 8 passos: Intro → Ciclo → Comunidade → Cuidado → Compromissos → Oração → PIN → Confirmar
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
  MESES, SEMANAS, SEMANA_LABELS, DIAS, DIA_LABELS, TIPOS_PRATICA,
  type CompromissoIn, type PraticaIn,
  type EventoItem, type OutroItemComunidade,
  type CuidadoEventoItem, type OutroItemCuidado,
  type ContextoVocacionalOut,
} from '@/services/projetoVidaMensal';
import { getMotivacaoContent } from '@/data/conteudoVocacional';

// ── Tipos locais ─────────────────────────────────────────────────────────────

interface WizardData {
  mes: string;
  ano: string;
  pin: string;
  comunidade: {
    partilha_acompanhador: EventoItem[];
    encontro_familia: EventoItem[];
    dias_grupo: EventoItem[];
    outros: OutroItemComunidade[];
  };
  cuidado: {
    consultas: CuidadoEventoItem[];
    exames: CuidadoEventoItem[];
    descanso: CuidadoEventoItem[];
    outros: OutroItemCuidado[];
  };
  compromissos: CompromissoIn[];
  praticas: PraticaIn[];
  intencao: string;
}

const emptyEvento = (): EventoItem => ({ data: '', horario: '', local: '', observacoes: '' });
const emptyCuidadoEvento = (): CuidadoEventoItem => ({ data: '', horario: '', local: '', descricao: '' });
const emptyOutroComunidade = (): OutroItemComunidade => ({ titulo: '', descricao: '', local: '', data: '', horario: '' });
const emptyOutroCuidado = (): OutroItemCuidado => ({ titulo: '', descricao: '', local: '', data: '', horario: '' });

const now = new Date();
const defaultData = (): WizardData => ({
  mes: String(now.getMonth() + 1),
  ano: String(now.getFullYear()),
  pin: '',
  comunidade: { partilha_acompanhador: [], encontro_familia: [], dias_grupo: [], outros: [] },
  cuidado: { consultas: [], exames: [], descanso: [], outros: [] },
  compromissos: [],
  praticas: [],
  intencao: '',
});

const STEP_TITLES = [
  'Início', 'Ciclo Mensal', 'Comunidade', 'Cuidado Pessoal',
  'Compromissos', 'Oração Diária', 'Privacidade', 'Confirmar',
];

// ── Main ─────────────────────────────────────────────────────────────────────

export default function WizardScreen() {
  const { t, r } = useTheme();
  const [step, setStep] = useState(0);
  const [data, setData] = useState<WizardData>(defaultData());
  const [activeSemana, setActiveSemana] = useState('s1');
  const [activeDia, setActiveDia] = useState('seg');
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

  // ── Compromissos ────────────────────────────────────────────────────────────

  const addCompromisso = () => {
    update({
      compromissos: [
        ...data.compromissos,
        { semana: activeSemana, titulo: '', dia: '', horario: '', obs: '', ordem: data.compromissos.length },
      ],
    });
  };
  const removeCompromisso = (idx: number) =>
    update({ compromissos: data.compromissos.filter((_, i) => i !== idx) });
  const updateCompromisso = (idx: number, patch: Partial<CompromissoIn>) => {
    const list = [...data.compromissos]; list[idx] = { ...list[idx], ...patch };
    update({ compromissos: list });
  };

  // ── Práticas ────────────────────────────────────────────────────────────────

  const addPratica = () => {
    update({
      praticas: [
        ...data.praticas,
        { dia_semana: activeDia, tipo: TIPOS_PRATICA[0], horario: '', duracao: '', obs: '', ordem: data.praticas.length },
      ],
    });
  };
  const removePratica = (idx: number) =>
    update({ praticas: data.praticas.filter((_, i) => i !== idx) });
  const updatePratica = (idx: number, patch: Partial<PraticaIn>) => {
    const list = [...data.praticas]; list[idx] = { ...list[idx], ...patch };
    update({ praticas: list });
  };

  // ── Helpers de lista de eventos ─────────────────────────────────────────────

  const updateEventoItem = (
    field: 'partilha_acompanhador' | 'encontro_familia' | 'dias_grupo',
    idx: number,
    patch: Partial<EventoItem>,
  ) => {
    const arr = [...data.comunidade[field]];
    arr[idx] = { ...arr[idx], ...patch };
    update({ comunidade: { ...data.comunidade, [field]: arr } });
  };

  const addEventoItem = (field: 'partilha_acompanhador' | 'encontro_familia' | 'dias_grupo') => {
    update({ comunidade: { ...data.comunidade, [field]: [...data.comunidade[field], emptyEvento()] } });
  };

  const removeEventoItem = (field: 'partilha_acompanhador' | 'encontro_familia' | 'dias_grupo', idx: number) => {
    update({ comunidade: { ...data.comunidade, [field]: data.comunidade[field].filter((_, i) => i !== idx) } });
  };

  const addOutroComunidade = () => {
    update({ comunidade: { ...data.comunidade, outros: [...data.comunidade.outros, emptyOutroComunidade()] } });
  };
  const removeOutroComunidade = (idx: number) => {
    update({ comunidade: { ...data.comunidade, outros: data.comunidade.outros.filter((_, i) => i !== idx) } });
  };
  const updateOutroComunidade = (idx: number, patch: Partial<OutroItemComunidade>) => {
    const arr = [...data.comunidade.outros]; arr[idx] = { ...arr[idx], ...patch };
    update({ comunidade: { ...data.comunidade, outros: arr } });
  };

  // ── Helpers de lista de cuidado ─────────────────────────────────────────────

  const updateCuidadoItem = (
    field: 'consultas' | 'exames' | 'descanso',
    idx: number,
    patch: Partial<CuidadoEventoItem>,
  ) => {
    const arr = [...data.cuidado[field]];
    arr[idx] = { ...arr[idx], ...patch };
    update({ cuidado: { ...data.cuidado, [field]: arr } });
  };

  const addCuidadoItem = (field: 'consultas' | 'exames' | 'descanso') => {
    update({ cuidado: { ...data.cuidado, [field]: [...data.cuidado[field], emptyCuidadoEvento()] } });
  };

  const removeCuidadoItem = (field: 'consultas' | 'exames' | 'descanso', idx: number) => {
    update({ cuidado: { ...data.cuidado, [field]: data.cuidado[field].filter((_, i) => i !== idx) } });
  };

  const addOutroCuidado = () => {
    update({ cuidado: { ...data.cuidado, outros: [...data.cuidado.outros, emptyOutroCuidado()] } });
  };
  const removeOutroCuidado = (idx: number) => {
    update({ cuidado: { ...data.cuidado, outros: data.cuidado.outros.filter((_, i) => i !== idx) } });
  };
  const updateOutroCuidado = (idx: number, patch: Partial<OutroItemCuidado>) => {
    const arr = [...data.cuidado.outros]; arr[idx] = { ...arr[idx], ...patch };
    update({ cuidado: { ...data.cuidado, outros: arr } });
  };

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

      await projetoVidaMensalApi.update(projetoId, {
        comunidade: data.comunidade,
        cuidado: data.cuidado,
        compromissos: data.compromissos,
        praticas: data.praticas,
      });
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

      // ── Step 2: Comunidade ────────────────────────────────────────────────
      case 2:
        return (
          <View style={styles.stepContent}>
            {/* Partilha com acompanhador */}
            <SectionTitle label="Partilha com acompanhador" t={t} />
            <Text style={{ fontSize: 13, fontFamily: 'Nunito-Regular', color: t.text.tertiary, lineHeight: 20, marginBottom: 12 }}>
              Indique a data do próximo encontro de partilha com seu acompanhador espiritual.
            </Text>
            {data.comunidade.partilha_acompanhador.map((item, idx) => (
              <EventoCard
                key={idx}
                index={idx}
                item={item}
                onRemove={() => removeEventoItem('partilha_acompanhador', idx)}
                onChange={patch => updateEventoItem('partilha_acompanhador', idx, patch)}
                t={t} r={r}
              />
            ))}
            <AddButton label="+ Adicionar data de partilha" onPress={() => addEventoItem('partilha_acompanhador')} t={t} />

            <View style={{ height: 1, backgroundColor: t.border.subtle, marginVertical: 20 }} />

            {/* Encontro com família vocacional */}
            <SectionTitle label="Encontro com a família vocacional" t={t} />
            <Text style={{ fontSize: 13, fontFamily: 'Nunito-Regular', color: t.text.tertiary, lineHeight: 20, marginBottom: 12 }}>
              Informe a data do próximo encontro do grupo da família vocacional.
            </Text>
            {data.comunidade.encontro_familia.map((item, idx) => (
              <EventoCard
                key={idx}
                index={idx}
                item={item}
                onRemove={() => removeEventoItem('encontro_familia', idx)}
                onChange={patch => updateEventoItem('encontro_familia', idx, patch)}
                t={t} r={r}
              />
            ))}
            <AddButton label="+ Adicionar encontro" onPress={() => addEventoItem('encontro_familia')} t={t} />

            <View style={{ height: 1, backgroundColor: t.border.subtle, marginVertical: 20 }} />

            {/* Dias do grupo */}
            <SectionTitle label="Dias do grupo no mês" t={t} />
            <Text style={{ fontSize: 13, fontFamily: 'Nunito-Regular', color: t.text.tertiary, lineHeight: 20, marginBottom: 12 }}>
              Informe todos os dias/horários em que o seu grupo se reúne no mês.{'\n'}
              Ex.: 04/04 às 19h na Sede Mater Dei; 19/04 às 10h no Oásis da Paz.{'\n'}
              Adicione diversos dias/horários se necessário.
            </Text>
            {data.comunidade.dias_grupo.map((item, idx) => (
              <EventoCard
                key={idx}
                index={idx}
                item={item}
                onRemove={() => removeEventoItem('dias_grupo', idx)}
                onChange={patch => updateEventoItem('dias_grupo', idx, patch)}
                t={t} r={r}
              />
            ))}
            <AddButton label="+ Adicionar dia de grupo" onPress={() => addEventoItem('dias_grupo')} t={t} />

            <View style={{ height: 1, backgroundColor: t.border.subtle, marginVertical: 20 }} />

            {/* Outros */}
            <SectionTitle label="Outros compromissos comunitários" t={t} />
            <Text style={{ fontSize: 13, fontFamily: 'Nunito-Regular', color: t.text.tertiary, lineHeight: 20, marginBottom: 12 }}>
              Descreva outros compromissos comunitários que você assume (exemplo: serviço, ministério, retiros, etc).
            </Text>
            {data.comunidade.outros.map((item, idx) => (
              <OutroComCard
                key={idx}
                index={idx}
                item={item}
                onRemove={() => removeOutroComunidade(idx)}
                onChange={patch => updateOutroComunidade(idx, patch)}
                t={t} r={r}
              />
            ))}
            <AddButton label="+ Adicionar outro compromisso" onPress={addOutroComunidade} t={t} />
          </View>
        );

      // ── Step 3: Cuidado Pessoal ───────────────────────────────────────────
      case 3:
        return (
          <View style={styles.stepContent}>
            {/* Consultas */}
            <SectionTitle label="Consultas" t={t} />
            <Text style={{ fontSize: 13, fontFamily: 'Nunito-Regular', color: t.text.tertiary, lineHeight: 20, marginBottom: 12 }}>
              Liste aqui consultas médicas, acompanhamentos ou outros atendimentos de saúde.
            </Text>
            {data.cuidado.consultas.map((item, idx) => (
              <CuidadoCard
                key={idx}
                index={idx}
                item={item}
                onRemove={() => removeCuidadoItem('consultas', idx)}
                onChange={patch => updateCuidadoItem('consultas', idx, patch)}
                t={t} r={r}
              />
            ))}
            <AddButton label="+ Adicionar consulta" onPress={() => addCuidadoItem('consultas')} t={t} />

            <View style={{ height: 1, backgroundColor: t.border.subtle, marginVertical: 20 }} />

            {/* Exames */}
            <SectionTitle label="Exames" t={t} />
            <Text style={{ fontSize: 13, fontFamily: 'Nunito-Regular', color: t.text.tertiary, lineHeight: 20, marginBottom: 12 }}>
              Descreva exames ou procedimentos importantes para sua saúde.
            </Text>
            {data.cuidado.exames.map((item, idx) => (
              <CuidadoCard
                key={idx}
                index={idx}
                item={item}
                onRemove={() => removeCuidadoItem('exames', idx)}
                onChange={patch => updateCuidadoItem('exames', idx, patch)}
                t={t} r={r}
              />
            ))}
            <AddButton label="+ Adicionar exame" onPress={() => addCuidadoItem('exames')} t={t} />

            <View style={{ height: 1, backgroundColor: t.border.subtle, marginVertical: 20 }} />

            {/* Descanso */}
            <SectionTitle label="Descanso" t={t} />
            <Text style={{ fontSize: 13, fontFamily: 'Nunito-Regular', color: t.text.tertiary, lineHeight: 20, marginBottom: 12 }}>
              Inclua períodos de descanso, férias ou pausas importantes para seu bem-estar.
            </Text>
            {data.cuidado.descanso.map((item, idx) => (
              <CuidadoCard
                key={idx}
                index={idx}
                item={item}
                onRemove={() => removeCuidadoItem('descanso', idx)}
                onChange={patch => updateCuidadoItem('descanso', idx, patch)}
                t={t} r={r}
              />
            ))}
            <AddButton label="+ Adicionar período de descanso" onPress={() => addCuidadoItem('descanso')} t={t} />

            <View style={{ height: 1, backgroundColor: t.border.subtle, marginVertical: 20 }} />

            {/* Outros */}
            <SectionTitle label="Outros compromissos pessoais" t={t} />
            <Text style={{ fontSize: 13, fontFamily: 'Nunito-Regular', color: t.text.tertiary, lineHeight: 20, marginBottom: 12 }}>
              Registre outros compromissos pessoais que sejam relevantes para seu cuidado integral.
            </Text>
            {data.cuidado.outros.map((item, idx) => (
              <OutroCuidadoCard
                key={idx}
                index={idx}
                item={item}
                onRemove={() => removeOutroCuidado(idx)}
                onChange={patch => updateOutroCuidado(idx, patch)}
                t={t} r={r}
              />
            ))}
            <AddButton label="+ Adicionar outro compromisso" onPress={addOutroCuidado} t={t} />
          </View>
        );

      // ── Step 4: Compromissos semanais ─────────────────────────────────────
      case 4: {
        const semanaIndexes = data.compromissos
          .map((c, i) => ({ c, i }))
          .filter(({ c }) => c.semana === activeSemana);
        return (
          <View style={styles.stepContent}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
              <View style={styles.chipRow}>
                {SEMANAS.map(s => (
                  <TouchableOpacity
                    key={s}
                    style={[
                      styles.chip,
                      { borderColor: t.border.default, backgroundColor: t.bg.elevated },
                      activeSemana === s && { backgroundColor: t.brand.primary, borderColor: t.brand.primary },
                    ]}
                    onPress={() => setActiveSemana(s)}
                  >
                    <Text style={[
                      { fontSize: 13, fontFamily: 'Nunito-Regular', color: t.text.secondary },
                      activeSemana === s && { color: '#ffffff', fontFamily: 'Nunito-SemiBold' },
                    ]}>
                      {SEMANA_LABELS[s]}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>

            {semanaIndexes.map(({ c, i }, localIdx) => (
              <View key={i} style={[styles.itemCard, { backgroundColor: t.bg.elevated, borderColor: t.border.subtle }]}>
                <View style={styles.itemCardHeader}>
                  <Text style={{ fontSize: 14, fontFamily: 'Nunito-SemiBold', color: t.text.primary }}>Compromisso {localIdx + 1}</Text>
                  <TouchableOpacity onPress={() => removeCompromisso(i)}>
                    <Ionicons name={'trash-outline' as IoniconsName} size={18} color={t.status.error} />
                  </TouchableOpacity>
                </View>
                <TextInput style={inputStyle} placeholder="Título" placeholderTextColor={t.text.tertiary}
                  value={c.titulo} onChangeText={v => updateCompromisso(i, { titulo: v })} />
                <View style={styles.row}>
                  <TextInput style={[inputStyle, { flex: 1, marginRight: 8 }]} placeholder="Dia"
                    placeholderTextColor={t.text.tertiary} value={c.dia}
                    onChangeText={v => updateCompromisso(i, { dia: v })} />
                  <TextInput style={[inputStyle, { flex: 1 }]} placeholder="Horário"
                    placeholderTextColor={t.text.tertiary} value={c.horario}
                    onChangeText={v => updateCompromisso(i, { horario: v })} />
                </View>
                <TextInput style={[inputStyle, styles.textarea]} placeholder="Observações"
                  placeholderTextColor={t.text.tertiary} value={c.obs}
                  onChangeText={v => updateCompromisso(i, { obs: v })} multiline numberOfLines={2} />
              </View>
            ))}

            <AddButton label={`+ Adicionar compromisso em ${SEMANA_LABELS[activeSemana]}`} onPress={addCompromisso} t={t} />
          </View>
        );
      }

      // ── Step 5: Oração Diária ─────────────────────────────────────────────
      case 5: {
        const diaIndexes = data.praticas
          .map((p, i) => ({ p, i }))
          .filter(({ p }) => p.dia_semana === activeDia);
        return (
          <View style={styles.stepContent}>
            {/* Comunhão Comunitária — destaque */}
            <View style={{ backgroundColor: '#f97316', borderRadius: 14, padding: 18, marginBottom: 20 }}>
              <Text style={{ fontSize: 11, fontFamily: 'Nunito-Bold', color: 'rgba(255,255,255,0.8)', letterSpacing: 1, marginBottom: 6 }}>✦ COMUNHÃO COMUNITÁRIA</Text>
              <Text style={{ fontSize: 16, fontFamily: 'Nunito-Bold', color: '#ffffff', marginBottom: 10 }}>Momento de Evangelização Ser Feliz</Text>
              <Text style={{ fontSize: 14, fontFamily: 'Nunito-Regular', color: 'rgba(255,255,255,0.95)', lineHeight: 21 }}>
                Meu irmão, a comunidade propõe que cada membro disponha de, no mínimo,{' '}
                <Text style={{ fontFamily: 'Nunito-Bold' }}>30 minutos por dia</Text> para a Evangelização Ser Feliz,
                podendo ser fracionado ao longo de todo o dia. É uma forma de correspondermos ao chamado do
                Emanuel para nós como comunidade. O desejo do nosso coração é que todos os membros cresçam
                até <Text style={{ fontFamily: 'Nunito-Bold' }}>1 hora ou mais</Text> por dia de acordo com a
                possibilidade de cada um. Agradecemos desde já pela comunhão e permanecemos unidos em oração.
              </Text>
            </View>

            {/* Abas de dias */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
              <View style={styles.chipRow}>
                {DIAS.map(d => (
                  <TouchableOpacity
                    key={d}
                    style={[
                      styles.chip,
                      { borderColor: t.border.default, backgroundColor: t.bg.elevated },
                      activeDia === d && { backgroundColor: t.brand.primary, borderColor: t.brand.primary },
                    ]}
                    onPress={() => setActiveDia(d)}
                  >
                    <Text style={[
                      { fontSize: 13, fontFamily: 'Nunito-Regular', color: t.text.secondary },
                      activeDia === d && { color: '#ffffff', fontFamily: 'Nunito-SemiBold' },
                    ]}>
                      {DIA_LABELS[d].slice(0, 3)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>

            {diaIndexes.map(({ p, i }, idx) => (
              <View key={i} style={[styles.itemCard, { backgroundColor: t.bg.elevated, borderColor: t.border.subtle }]}>
                <View style={styles.itemCardHeader}>
                  <Text style={{ fontSize: 14, fontFamily: 'Nunito-SemiBold', color: t.text.primary }}>Prática {idx + 1}</Text>
                  <TouchableOpacity onPress={() => removePratica(i)}>
                    <Ionicons name={'trash-outline' as IoniconsName} size={18} color={t.status.error} />
                  </TouchableOpacity>
                </View>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 8 }}>
                  <View style={styles.chipRow}>
                    {TIPOS_PRATICA.map(tp => (
                      <TouchableOpacity key={tp} style={[
                        styles.chip,
                        { borderColor: t.border.default, backgroundColor: t.bg.elevated },
                        p.tipo === tp && { backgroundColor: t.brand.primary, borderColor: t.brand.primary },
                      ]}
                        onPress={() => updatePratica(i, { tipo: tp })}>
                        <Text style={[
                          { fontSize: 13, fontFamily: 'Nunito-Regular', color: t.text.secondary },
                          p.tipo === tp && { color: '#ffffff', fontFamily: 'Nunito-SemiBold' },
                        ]}>{tp}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </ScrollView>
                <View style={styles.row}>
                  <TextInput style={[inputStyle, { flex: 1, marginRight: 8 }]} placeholder="Horário"
                    placeholderTextColor={t.text.tertiary} value={p.horario}
                    onChangeText={v => updatePratica(i, { horario: v })} />
                  <TextInput style={[inputStyle, { flex: 1 }]} placeholder="Duração (ex.: 30min)"
                    placeholderTextColor={t.text.tertiary} value={p.duracao}
                    onChangeText={v => updatePratica(i, { duracao: v })} />
                </View>
                <TextInput style={[inputStyle, styles.textarea]} placeholder="Observação (opcional)"
                  placeholderTextColor={t.text.tertiary} value={p.obs}
                  onChangeText={v => updatePratica(i, { obs: v })} multiline numberOfLines={2} />
              </View>
            ))}

            <AddButton label={`+ Adicionar prática em ${DIA_LABELS[activeDia]}`} onPress={addPratica} t={t} />
          </View>
        );
      }

      // ── Step 6: PIN / Privacidade ─────────────────────────────────────────
      case 6:
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

      // ── Step 7: Confirmar ─────────────────────────────────────────────────
      case 7:
        return (
          <View style={styles.stepContent}>
            <View style={{ backgroundColor: t.brand.primaryDim, borderRadius: 14, padding: 20, marginBottom: 20, gap: 8 }}>
              <Text style={{ fontSize: 20, fontFamily: 'Nunito-Bold', color: t.brand.primary, marginBottom: 8 }}>
                {MESES[parseInt(data.mes, 10) - 1]} {data.ano}
              </Text>
              {data.pin ? <Text style={{ fontSize: 15, fontFamily: 'Nunito-Regular', color: t.text.primary }}>🔒 Senha configurada</Text> : null}
              <Text style={{ fontSize: 15, fontFamily: 'Nunito-Regular', color: t.text.primary }}>
                👥 {data.comunidade.partilha_acompanhador.length + data.comunidade.encontro_familia.length + data.comunidade.dias_grupo.length} compromisso(s) comunitário(s)
              </Text>
              <Text style={{ fontSize: 15, fontFamily: 'Nunito-Regular', color: t.text.primary }}>
                ❤️ {data.cuidado.consultas.length + data.cuidado.exames.length + data.cuidado.descanso.length} item(ns) de cuidado pessoal
              </Text>
              <Text style={{ fontSize: 15, fontFamily: 'Nunito-Regular', color: t.text.primary }}>
                📅 {data.compromissos.length} compromisso(s) semanal(is)
              </Text>
              <Text style={{ fontSize: 15, fontFamily: 'Nunito-Regular', color: t.text.primary }}>
                🙏 {data.praticas.length} prática(s) de oração
              </Text>
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

function EventoCard({
  index, item, onRemove, onChange, t, r,
}: {
  index: number;
  item: EventoItem;
  onRemove: () => void;
  onChange: (patch: Partial<EventoItem>) => void;
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
    fontFamily: 'Nunito-Regular',
    color: t.text.primary,
    minHeight: 48,
    marginBottom: 10,
  };
  return (
    <View style={[styles.itemCard, { backgroundColor: t.bg.elevated, borderColor: t.border.subtle }]}>
      <View style={styles.itemCardHeader}>
        <Text style={{ fontSize: 14, fontFamily: 'Nunito-SemiBold', color: t.text.primary }}>Entrada {index + 1}</Text>
        <TouchableOpacity onPress={onRemove}>
          <Ionicons name={'trash-outline' as IoniconsName} size={18} color={t.status.error} />
        </TouchableOpacity>
      </View>
      <View style={styles.row}>
        <TextInput style={[inputStyle, { flex: 1, marginRight: 8 }]}
          placeholder="Data (ex.: 04/04/2026)" placeholderTextColor={t.text.tertiary}
          value={item.data ?? ''} onChangeText={v => onChange({ data: v })} />
        <TextInput style={[inputStyle, { flex: 1 }]}
          placeholder="Horário" placeholderTextColor={t.text.tertiary}
          value={item.horario ?? ''} onChangeText={v => onChange({ horario: v })} />
      </View>
      <TextInput style={inputStyle}
        placeholder="Local" placeholderTextColor={t.text.tertiary}
        value={item.local ?? ''} onChangeText={v => onChange({ local: v })} />
      <TextInput style={[inputStyle, styles.textarea]}
        placeholder="Observações (opcional)" placeholderTextColor={t.text.tertiary}
        value={item.observacoes ?? ''} onChangeText={v => onChange({ observacoes: v })}
        multiline numberOfLines={2} />
    </View>
  );
}

function OutroComCard({
  index, item, onRemove, onChange, t, r,
}: {
  index: number;
  item: OutroItemComunidade;
  onRemove: () => void;
  onChange: (patch: Partial<OutroItemComunidade>) => void;
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
    fontFamily: 'Nunito-Regular',
    color: t.text.primary,
    minHeight: 48,
    marginBottom: 10,
  };
  return (
    <View style={[styles.itemCard, { backgroundColor: t.bg.elevated, borderColor: t.border.subtle }]}>
      <View style={styles.itemCardHeader}>
        <Text style={{ fontSize: 14, fontFamily: 'Nunito-SemiBold', color: t.text.primary }}>Compromisso {index + 1}</Text>
        <TouchableOpacity onPress={onRemove}>
          <Ionicons name={'trash-outline' as IoniconsName} size={18} color={t.status.error} />
        </TouchableOpacity>
      </View>
      <TextInput style={inputStyle}
        placeholder="Título do compromisso" placeholderTextColor={t.text.tertiary}
        value={item.titulo ?? ''} onChangeText={v => onChange({ titulo: v })} />
      <TextInput style={[inputStyle, styles.textarea]}
        placeholder="Descrição" placeholderTextColor={t.text.tertiary}
        value={item.descricao ?? ''} onChangeText={v => onChange({ descricao: v })}
        multiline numberOfLines={2} />
      <TextInput style={inputStyle}
        placeholder="Local" placeholderTextColor={t.text.tertiary}
        value={item.local ?? ''} onChangeText={v => onChange({ local: v })} />
      <View style={styles.row}>
        <TextInput style={[inputStyle, { flex: 1, marginRight: 8 }]}
          placeholder="Data" placeholderTextColor={t.text.tertiary}
          value={item.data ?? ''} onChangeText={v => onChange({ data: v })} />
        <TextInput style={[inputStyle, { flex: 1 }]}
          placeholder="Horário" placeholderTextColor={t.text.tertiary}
          value={item.horario ?? ''} onChangeText={v => onChange({ horario: v })} />
      </View>
    </View>
  );
}

function CuidadoCard({
  index, item, onRemove, onChange, t, r,
}: {
  index: number;
  item: CuidadoEventoItem;
  onRemove: () => void;
  onChange: (patch: Partial<CuidadoEventoItem>) => void;
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
    fontFamily: 'Nunito-Regular',
    color: t.text.primary,
    minHeight: 48,
    marginBottom: 10,
  };
  return (
    <View style={[styles.itemCard, { backgroundColor: t.bg.elevated, borderColor: t.border.subtle }]}>
      <View style={styles.itemCardHeader}>
        <Text style={{ fontSize: 14, fontFamily: 'Nunito-SemiBold', color: t.text.primary }}>Entrada {index + 1}</Text>
        <TouchableOpacity onPress={onRemove}>
          <Ionicons name={'trash-outline' as IoniconsName} size={18} color={t.status.error} />
        </TouchableOpacity>
      </View>
      <View style={styles.row}>
        <TextInput style={[inputStyle, { flex: 1, marginRight: 8 }]}
          placeholder="Data" placeholderTextColor={t.text.tertiary}
          value={item.data ?? ''} onChangeText={v => onChange({ data: v })} />
        <TextInput style={[inputStyle, { flex: 1 }]}
          placeholder="Horário" placeholderTextColor={t.text.tertiary}
          value={item.horario ?? ''} onChangeText={v => onChange({ horario: v })} />
      </View>
      <TextInput style={inputStyle}
        placeholder="Local" placeholderTextColor={t.text.tertiary}
        value={item.local ?? ''} onChangeText={v => onChange({ local: v })} />
      <TextInput style={[inputStyle, styles.textarea]}
        placeholder="Descrição (opcional)" placeholderTextColor={t.text.tertiary}
        value={item.descricao ?? ''} onChangeText={v => onChange({ descricao: v })}
        multiline numberOfLines={2} />
    </View>
  );
}

function OutroCuidadoCard({
  index, item, onRemove, onChange, t, r,
}: {
  index: number;
  item: OutroItemCuidado;
  onRemove: () => void;
  onChange: (patch: Partial<OutroItemCuidado>) => void;
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
    fontFamily: 'Nunito-Regular',
    color: t.text.primary,
    minHeight: 48,
    marginBottom: 10,
  };
  return (
    <View style={[styles.itemCard, { backgroundColor: t.bg.elevated, borderColor: t.border.subtle }]}>
      <View style={styles.itemCardHeader}>
        <Text style={{ fontSize: 14, fontFamily: 'Nunito-SemiBold', color: t.text.primary }}>Compromisso {index + 1}</Text>
        <TouchableOpacity onPress={onRemove}>
          <Ionicons name={'trash-outline' as IoniconsName} size={18} color={t.status.error} />
        </TouchableOpacity>
      </View>
      <TextInput style={inputStyle}
        placeholder="Título" placeholderTextColor={t.text.tertiary}
        value={item.titulo ?? ''} onChangeText={v => onChange({ titulo: v })} />
      <TextInput style={[inputStyle, styles.textarea]}
        placeholder="Descrição" placeholderTextColor={t.text.tertiary}
        value={item.descricao ?? ''} onChangeText={v => onChange({ descricao: v })}
        multiline numberOfLines={2} />
      <TextInput style={inputStyle}
        placeholder="Local" placeholderTextColor={t.text.tertiary}
        value={item.local ?? ''} onChangeText={v => onChange({ local: v })} />
      <View style={styles.row}>
        <TextInput style={[inputStyle, { flex: 1, marginRight: 8 }]}
          placeholder="Data" placeholderTextColor={t.text.tertiary}
          value={item.data ?? ''} onChangeText={v => onChange({ data: v })} />
        <TextInput style={[inputStyle, { flex: 1 }]}
          placeholder="Horário" placeholderTextColor={t.text.tertiary}
          value={item.horario ?? ''} onChangeText={v => onChange({ horario: v })} />
      </View>
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
