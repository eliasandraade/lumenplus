/**
 * Projeto de Vida Mensal — Wizard de Criação
 * ============================================
 * 8 passos: Intro → Ciclo → Comunidade → Cuidado → Compromissos → Oração → PIN → Confirmar
 */

import { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, ActivityIndicator, KeyboardAvoidingView, Platform,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import type { IoniconsName } from '@/types/icons';
import projetoVidaMensalApi, {
  MESES, SEMANAS, SEMANA_LABELS, DIAS, DIA_LABELS, TIPOS_PRATICA,
  type CompromissoIn, type PraticaIn,
  type EventoItem, type OutroItemComunidade,
  type CuidadoEventoItem, type OutroItemCuidado,
} from '@/services/projetoVidaMensal';

const colors = {
  primary: '#1A859B', primaryLight: '#E8F4F7',
  white: '#ffffff', gray: '#6b7280',
  lightGray: '#f3f4f6', dark: '#171717', border: '#e5e7eb', error: '#ef4444',
  gold: '#b45309', goldLight: '#fef3c7',
  teal: '#0f766e',
};

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
});

const STEP_TITLES = [
  'Início', 'Ciclo Mensal', 'Comunidade', 'Cuidado Pessoal',
  'Compromissos', 'Oração Diária', 'Privacidade', 'Confirmar',
];

// ── Main ─────────────────────────────────────────────────────────────────────

export default function WizardScreen() {
  const [step, setStep] = useState(0);
  const [data, setData] = useState<WizardData>(defaultData());
  const [activeSemana, setActiveSemana] = useState('s1');
  const [activeDia, setActiveDia] = useState('seg');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const update = (partial: Partial<WizardData>) => setData(d => ({ ...d, ...partial }));

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
        const criado = await projetoVidaMensalApi.criar({ mes, ano, pin: data.pin || null });
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

  // ── Render steps ─────────────────────────────────────────────────────────────

  const renderStep = () => {
    switch (step) {

      // ── Step 0: Intro ─────────────────────────────────────────────────────
      case 0:
        return (
          <View style={styles.stepContent}>
            <View style={styles.introQuoteCard}>
              <Ionicons name={'sparkles' as IoniconsName} size={20} color={colors.gold} style={{ marginBottom: 12 }} />
              <Text style={styles.introQuoteText}>
                "O Projeto de Vida não é um check list do que eu consegui ou não pontuar,
                mas é um ponto de partida para que eu possa amar a Deus segundo a segundo no meu dia."
              </Text>
            </View>
            <Text style={styles.introSubtitle}>
              Este é um caminho mensal de conversão, organização e fidelidade ao chamado de Deus.
            </Text>
            <View style={styles.privacyCard}>
              <Ionicons name={'shield-checkmark-outline' as IoniconsName} size={18} color={colors.primary} style={{ marginBottom: 8 }} />
              <Text style={styles.privacyTitle}>Privacidade garantida</Text>
              <Text style={styles.privacyText}>
                A partir deste momento, tudo o que você escrever será protegido pela sua senha.
                A Equipe Lumen+ não terá acesso ao conteúdo que você escrever.
              </Text>
            </View>
          </View>
        );

      // ── Step 1: Ciclo Mensal ──────────────────────────────────────────────
      case 1:
        return (
          <View style={styles.stepContent}>
            <Text style={styles.fieldLabel}>Mês *</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
              <View style={styles.chipRow}>
                {MESES.map((m, i) => (
                  <TouchableOpacity
                    key={m}
                    style={[styles.chip, data.mes === String(i + 1) && styles.chipActive]}
                    onPress={() => update({ mes: String(i + 1) })}
                  >
                    <Text style={[styles.chipText, data.mes === String(i + 1) && styles.chipTextActive]}>
                      {m.slice(0, 3)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>

            <Text style={styles.fieldLabel}>Ano *</Text>
            <TextInput
              style={styles.input}
              value={data.ano}
              onChangeText={v => update({ ano: v })}
              keyboardType="numeric"
              maxLength={4}
            />
          </View>
        );

      // ── Step 2: Comunidade ────────────────────────────────────────────────
      case 2:
        return (
          <View style={styles.stepContent}>
            {/* Partilha com acompanhador */}
            <SectionTitle label="Partilha com acompanhador" />
            <Text style={styles.fieldHint}>
              Indique a data do próximo encontro de partilha com seu acompanhador espiritual.
            </Text>
            {data.comunidade.partilha_acompanhador.map((item, idx) => (
              <EventoCard
                key={idx}
                index={idx}
                item={item}
                onRemove={() => removeEventoItem('partilha_acompanhador', idx)}
                onChange={patch => updateEventoItem('partilha_acompanhador', idx, patch)}
              />
            ))}
            <AddButton label="+ Adicionar data de partilha" onPress={() => addEventoItem('partilha_acompanhador')} />

            <View style={styles.separator} />

            {/* Encontro com família vocacional */}
            <SectionTitle label="Encontro com a família vocacional" />
            <Text style={styles.fieldHint}>
              Informe a data do próximo encontro do grupo da família vocacional.
            </Text>
            {data.comunidade.encontro_familia.map((item, idx) => (
              <EventoCard
                key={idx}
                index={idx}
                item={item}
                onRemove={() => removeEventoItem('encontro_familia', idx)}
                onChange={patch => updateEventoItem('encontro_familia', idx, patch)}
              />
            ))}
            <AddButton label="+ Adicionar encontro" onPress={() => addEventoItem('encontro_familia')} />

            <View style={styles.separator} />

            {/* Dias do grupo */}
            <SectionTitle label="Dias do grupo no mês" />
            <Text style={styles.fieldHint}>
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
              />
            ))}
            <AddButton label="+ Adicionar dia de grupo" onPress={() => addEventoItem('dias_grupo')} />

            <View style={styles.separator} />

            {/* Outros */}
            <SectionTitle label="Outros compromissos comunitários" />
            <Text style={styles.fieldHint}>
              Descreva outros compromissos comunitários que você assume (exemplo: serviço, ministério, retiros, etc).
            </Text>
            {data.comunidade.outros.map((item, idx) => (
              <OutroComCard
                key={idx}
                index={idx}
                item={item}
                onRemove={() => removeOutroComunidade(idx)}
                onChange={patch => updateOutroComunidade(idx, patch)}
              />
            ))}
            <AddButton label="+ Adicionar outro compromisso" onPress={addOutroComunidade} />
          </View>
        );

      // ── Step 3: Cuidado Pessoal ───────────────────────────────────────────
      case 3:
        return (
          <View style={styles.stepContent}>
            {/* Consultas */}
            <SectionTitle label="Consultas" />
            <Text style={styles.fieldHint}>
              Liste aqui consultas médicas, acompanhamentos ou outros atendimentos de saúde.
            </Text>
            {data.cuidado.consultas.map((item, idx) => (
              <CuidadoCard
                key={idx}
                index={idx}
                item={item}
                onRemove={() => removeCuidadoItem('consultas', idx)}
                onChange={patch => updateCuidadoItem('consultas', idx, patch)}
              />
            ))}
            <AddButton label="+ Adicionar consulta" onPress={() => addCuidadoItem('consultas')} />

            <View style={styles.separator} />

            {/* Exames */}
            <SectionTitle label="Exames" />
            <Text style={styles.fieldHint}>
              Descreva exames ou procedimentos importantes para sua saúde.
            </Text>
            {data.cuidado.exames.map((item, idx) => (
              <CuidadoCard
                key={idx}
                index={idx}
                item={item}
                onRemove={() => removeCuidadoItem('exames', idx)}
                onChange={patch => updateCuidadoItem('exames', idx, patch)}
              />
            ))}
            <AddButton label="+ Adicionar exame" onPress={() => addCuidadoItem('exames')} />

            <View style={styles.separator} />

            {/* Descanso */}
            <SectionTitle label="Descanso" />
            <Text style={styles.fieldHint}>
              Inclua períodos de descanso, férias ou pausas importantes para seu bem-estar.
            </Text>
            {data.cuidado.descanso.map((item, idx) => (
              <CuidadoCard
                key={idx}
                index={idx}
                item={item}
                onRemove={() => removeCuidadoItem('descanso', idx)}
                onChange={patch => updateCuidadoItem('descanso', idx, patch)}
              />
            ))}
            <AddButton label="+ Adicionar período de descanso" onPress={() => addCuidadoItem('descanso')} />

            <View style={styles.separator} />

            {/* Outros */}
            <SectionTitle label="Outros compromissos pessoais" />
            <Text style={styles.fieldHint}>
              Registre outros compromissos pessoais que sejam relevantes para seu cuidado integral.
            </Text>
            {data.cuidado.outros.map((item, idx) => (
              <OutroCuidadoCard
                key={idx}
                index={idx}
                item={item}
                onRemove={() => removeOutroCuidado(idx)}
                onChange={patch => updateOutroCuidado(idx, patch)}
              />
            ))}
            <AddButton label="+ Adicionar outro compromisso" onPress={addOutroCuidado} />
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
                    style={[styles.chip, activeSemana === s && styles.chipActive]}
                    onPress={() => setActiveSemana(s)}
                  >
                    <Text style={[styles.chipText, activeSemana === s && styles.chipTextActive]}>
                      {SEMANA_LABELS[s]}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>

            {semanaIndexes.map(({ c, i }, localIdx) => (
              <View key={i} style={styles.itemCard}>
                <View style={styles.itemCardHeader}>
                  <Text style={styles.itemCardTitle}>Compromisso {localIdx + 1}</Text>
                  <TouchableOpacity onPress={() => removeCompromisso(i)}>
                    <Ionicons name={'trash-outline' as IoniconsName} size={18} color={colors.error} />
                  </TouchableOpacity>
                </View>
                <TextInput style={styles.input} placeholder="Título" placeholderTextColor={colors.gray}
                  value={c.titulo} onChangeText={v => updateCompromisso(i, { titulo: v })} />
                <View style={styles.row}>
                  <TextInput style={[styles.input, { flex: 1, marginRight: 8 }]} placeholder="Dia"
                    placeholderTextColor={colors.gray} value={c.dia}
                    onChangeText={v => updateCompromisso(i, { dia: v })} />
                  <TextInput style={[styles.input, { flex: 1 }]} placeholder="Horário"
                    placeholderTextColor={colors.gray} value={c.horario}
                    onChangeText={v => updateCompromisso(i, { horario: v })} />
                </View>
                <TextInput style={[styles.input, styles.textarea]} placeholder="Observações"
                  placeholderTextColor={colors.gray} value={c.obs}
                  onChangeText={v => updateCompromisso(i, { obs: v })} multiline numberOfLines={2} />
              </View>
            ))}

            <AddButton label={`+ Adicionar compromisso em ${SEMANA_LABELS[activeSemana]}`} onPress={addCompromisso} />
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
            <View style={styles.comunhaoCard}>
              <Text style={styles.comunhaoLabel}>✦ COMUNHÃO COMUNITÁRIA</Text>
              <Text style={styles.comunhaoTitle}>Momento de Evangelização Ser Feliz</Text>
              <Text style={styles.comunhaoText}>
                Meu irmão, a comunidade propõe que cada membro disponha de, no mínimo,{' '}
                <Text style={styles.comunhaoEmphasis}>30 minutos por dia</Text> para a Evangelização Ser Feliz,
                podendo ser fracionado ao longo de todo o dia. É uma forma de correspondermos ao chamado do
                Emanuel para nós como comunidade. O desejo do nosso coração é que todos os membros cresçam
                até <Text style={styles.comunhaoEmphasis}>1 hora ou mais</Text> por dia de acordo com a
                possibilidade de cada um. Agradecemos desde já pela comunhão e permanecemos unidos em oração.
              </Text>
            </View>

            {/* Abas de dias */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
              <View style={styles.chipRow}>
                {DIAS.map(d => (
                  <TouchableOpacity
                    key={d}
                    style={[styles.chip, activeDia === d && styles.chipActive]}
                    onPress={() => setActiveDia(d)}
                  >
                    <Text style={[styles.chipText, activeDia === d && styles.chipTextActive]}>
                      {DIA_LABELS[d].slice(0, 3)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>

            {diaIndexes.map(({ p, i }, idx) => (
              <View key={i} style={styles.itemCard}>
                <View style={styles.itemCardHeader}>
                  <Text style={styles.itemCardTitle}>Prática {idx + 1}</Text>
                  <TouchableOpacity onPress={() => removePratica(i)}>
                    <Ionicons name={'trash-outline' as IoniconsName} size={18} color={colors.error} />
                  </TouchableOpacity>
                </View>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 8 }}>
                  <View style={styles.chipRow}>
                    {TIPOS_PRATICA.map(t => (
                      <TouchableOpacity key={t} style={[styles.chip, p.tipo === t && styles.chipActive]}
                        onPress={() => updatePratica(i, { tipo: t })}>
                        <Text style={[styles.chipText, p.tipo === t && styles.chipTextActive]}>{t}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </ScrollView>
                <View style={styles.row}>
                  <TextInput style={[styles.input, { flex: 1, marginRight: 8 }]} placeholder="Horário"
                    placeholderTextColor={colors.gray} value={p.horario}
                    onChangeText={v => updatePratica(i, { horario: v })} />
                  <TextInput style={[styles.input, { flex: 1 }]} placeholder="Duração (ex.: 30min)"
                    placeholderTextColor={colors.gray} value={p.duracao}
                    onChangeText={v => updatePratica(i, { duracao: v })} />
                </View>
                <TextInput style={[styles.input, styles.textarea]} placeholder="Observação (opcional)"
                  placeholderTextColor={colors.gray} value={p.obs}
                  onChangeText={v => updatePratica(i, { obs: v })} multiline numberOfLines={2} />
              </View>
            ))}

            <AddButton label={`+ Adicionar prática em ${DIA_LABELS[activeDia]}`} onPress={addPratica} />
          </View>
        );
      }

      // ── Step 6: PIN / Privacidade ─────────────────────────────────────────
      case 6:
        return (
          <View style={styles.stepContent}>
            {/* Bloco de privacidade */}
            <View style={styles.privacyFullCard}>
              <Text style={styles.privacyFullTitle}>🔒 Sua privacidade é sagrada</Text>
              <Text style={styles.privacyFullText}>
                O seu Projeto de Vida é um espaço íntimo entre você e Deus. Tudo o que você escrever aqui
                será protegido.{'\n\n'}
                O conteúdo deste módulo é pessoal. Nem a equipe técnica do Lumen+ terá acesso ao que você escreveu.{'\n\n'}
                Permanecemos unidos em oração e comunhão.{'\n\n'}
                Para manter esse conteúdo privado, você pode criar uma senha que será usada para acessar seu
                Projeto de Vida.
              </Text>
              <View style={styles.privacyWarning}>
                <Ionicons name={'warning-outline' as IoniconsName} size={16} color={colors.gold} />
                <Text style={styles.privacyWarningText}>
                  Se você perder essa senha, não será possível recuperar o conteúdo ou o acesso ao seu Projeto de Vida.
                </Text>
              </View>
              <View style={styles.privacyItems}>
                {[
                  'Este conteúdo é completamente privado',
                  'Nossos servidores não terão acesso ao conteúdo que você escrever ou à senha que você criar',
                  'Desenvolvedores e administradores não terão acesso ao conteúdo escrito',
                ].map((item, i) => (
                  <View key={i} style={styles.privacyItem}>
                    <Ionicons name={'checkmark-circle' as IoniconsName} size={16} color={colors.primary} />
                    <Text style={styles.privacyItemText}>{item}</Text>
                  </View>
                ))}
              </View>
            </View>

            {/* Campo PIN */}
            <Text style={styles.fieldLabel}>Senha de 4 dígitos (opcional)</Text>
            <Text style={styles.fieldHint}>Deixe em branco para não usar senha.</Text>
            <TextInput
              style={styles.input}
              value={data.pin}
              onChangeText={v => update({ pin: v.replace(/\D/g, '').slice(0, 4) })}
              placeholder="0000"
              placeholderTextColor={colors.gray}
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
            <View style={styles.summaryCard}>
              <Text style={styles.summaryTitle}>
                {MESES[parseInt(data.mes, 10) - 1]} {data.ano}
              </Text>
              {data.pin ? <Text style={styles.summaryItem}>🔒 Senha configurada</Text> : null}
              <Text style={styles.summaryItem}>
                👥 {data.comunidade.partilha_acompanhador.length + data.comunidade.encontro_familia.length + data.comunidade.dias_grupo.length} compromisso(s) comunitário(s)
              </Text>
              <Text style={styles.summaryItem}>
                ❤️ {data.cuidado.consultas.length + data.cuidado.exames.length + data.cuidado.descanso.length} item(ns) de cuidado pessoal
              </Text>
              <Text style={styles.summaryItem}>
                📅 {data.compromissos.length} compromisso(s) semanal(is)
              </Text>
              <Text style={styles.summaryItem}>
                🙏 {data.praticas.length} prática(s) de oração
              </Text>
            </View>
            {error && (
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>{error}</Text>
              </View>
            )}
            <TouchableOpacity style={styles.saveBtn} onPress={handleSave} disabled={saving} activeOpacity={0.8}>
              {saving
                ? <ActivityIndicator color={colors.white} />
                : <Text style={styles.saveBtnText}>Salvar Projeto de Vida</Text>
              }
            </TouchableOpacity>
          </View>
        );

      default:
        return null;
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      {/* Indicador de passo */}
      <View style={styles.stepBar}>
        {STEP_TITLES.map((_, i) => (
          <View key={i} style={[styles.stepDot, i === step && styles.stepDotActive, i < step && styles.stepDotDone]} />
        ))}
      </View>
      <View style={styles.stepHeader}>
        <Text style={styles.stepTitle}>{STEP_TITLES[step]}</Text>
        <Text style={styles.stepCounter}>{step + 1} / {STEP_TITLES.length}</Text>
      </View>

      <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 40 }}>
        {renderStep()}
      </ScrollView>

      {/* Navegação */}
      <View style={styles.navRow}>
        <TouchableOpacity
          style={[styles.navBtn, styles.navBtnBack]}
          onPress={() => (step === 0 ? router.back() : setStep(s => s - 1))}
        >
          <Ionicons name={'chevron-back' as IoniconsName} size={20} color={colors.primary} />
          <Text style={styles.navBtnBackText}>{step === 0 ? 'Cancelar' : 'Voltar'}</Text>
        </TouchableOpacity>

        {step < STEP_TITLES.length - 1 && (
          <TouchableOpacity
            style={[styles.navBtn, styles.navBtnNext]}
            onPress={() => setStep(s => s + 1)}
          >
            <Text style={styles.navBtnNextText}>{step === 0 ? 'Iniciar meu Projeto de Vida' : 'Próximo'}</Text>
            <Ionicons name={'chevron-forward' as IoniconsName} size={20} color={colors.white} />
          </TouchableOpacity>
        )}
      </View>
    </KeyboardAvoidingView>
  );
}

// ── Componentes auxiliares ────────────────────────────────────────────────────

function SectionTitle({ label }: { label: string }) {
  return <Text style={styles.sectionTitle}>{label}</Text>;
}

function AddButton({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <TouchableOpacity style={styles.addBtn} onPress={onPress}>
      <Text style={styles.addBtnText}>{label}</Text>
    </TouchableOpacity>
  );
}

function EventoCard({
  index, item, onRemove, onChange,
}: {
  index: number;
  item: EventoItem;
  onRemove: () => void;
  onChange: (patch: Partial<EventoItem>) => void;
}) {
  return (
    <View style={styles.itemCard}>
      <View style={styles.itemCardHeader}>
        <Text style={styles.itemCardTitle}>Entrada {index + 1}</Text>
        <TouchableOpacity onPress={onRemove}>
          <Ionicons name={'trash-outline' as IoniconsName} size={18} color={colors.error} />
        </TouchableOpacity>
      </View>
      <View style={styles.row}>
        <TextInput style={[styles.input, { flex: 1, marginRight: 8 }]}
          placeholder="Data (ex.: 04/04/2026)" placeholderTextColor={colors.gray}
          value={item.data ?? ''} onChangeText={v => onChange({ data: v })} />
        <TextInput style={[styles.input, { flex: 1 }]}
          placeholder="Horário" placeholderTextColor={colors.gray}
          value={item.horario ?? ''} onChangeText={v => onChange({ horario: v })} />
      </View>
      <TextInput style={styles.input}
        placeholder="Local" placeholderTextColor={colors.gray}
        value={item.local ?? ''} onChangeText={v => onChange({ local: v })} />
      <TextInput style={[styles.input, styles.textarea]}
        placeholder="Observações (opcional)" placeholderTextColor={colors.gray}
        value={item.observacoes ?? ''} onChangeText={v => onChange({ observacoes: v })}
        multiline numberOfLines={2} />
    </View>
  );
}

function OutroComCard({
  index, item, onRemove, onChange,
}: {
  index: number;
  item: OutroItemComunidade;
  onRemove: () => void;
  onChange: (patch: Partial<OutroItemComunidade>) => void;
}) {
  return (
    <View style={styles.itemCard}>
      <View style={styles.itemCardHeader}>
        <Text style={styles.itemCardTitle}>Compromisso {index + 1}</Text>
        <TouchableOpacity onPress={onRemove}>
          <Ionicons name={'trash-outline' as IoniconsName} size={18} color={colors.error} />
        </TouchableOpacity>
      </View>
      <TextInput style={styles.input}
        placeholder="Título do compromisso" placeholderTextColor={colors.gray}
        value={item.titulo ?? ''} onChangeText={v => onChange({ titulo: v })} />
      <TextInput style={[styles.input, styles.textarea]}
        placeholder="Descrição" placeholderTextColor={colors.gray}
        value={item.descricao ?? ''} onChangeText={v => onChange({ descricao: v })}
        multiline numberOfLines={2} />
      <TextInput style={styles.input}
        placeholder="Local" placeholderTextColor={colors.gray}
        value={item.local ?? ''} onChangeText={v => onChange({ local: v })} />
      <View style={styles.row}>
        <TextInput style={[styles.input, { flex: 1, marginRight: 8 }]}
          placeholder="Data" placeholderTextColor={colors.gray}
          value={item.data ?? ''} onChangeText={v => onChange({ data: v })} />
        <TextInput style={[styles.input, { flex: 1 }]}
          placeholder="Horário" placeholderTextColor={colors.gray}
          value={item.horario ?? ''} onChangeText={v => onChange({ horario: v })} />
      </View>
    </View>
  );
}

function CuidadoCard({
  index, item, onRemove, onChange,
}: {
  index: number;
  item: CuidadoEventoItem;
  onRemove: () => void;
  onChange: (patch: Partial<CuidadoEventoItem>) => void;
}) {
  return (
    <View style={styles.itemCard}>
      <View style={styles.itemCardHeader}>
        <Text style={styles.itemCardTitle}>Entrada {index + 1}</Text>
        <TouchableOpacity onPress={onRemove}>
          <Ionicons name={'trash-outline' as IoniconsName} size={18} color={colors.error} />
        </TouchableOpacity>
      </View>
      <View style={styles.row}>
        <TextInput style={[styles.input, { flex: 1, marginRight: 8 }]}
          placeholder="Data" placeholderTextColor={colors.gray}
          value={item.data ?? ''} onChangeText={v => onChange({ data: v })} />
        <TextInput style={[styles.input, { flex: 1 }]}
          placeholder="Horário" placeholderTextColor={colors.gray}
          value={item.horario ?? ''} onChangeText={v => onChange({ horario: v })} />
      </View>
      <TextInput style={styles.input}
        placeholder="Local" placeholderTextColor={colors.gray}
        value={item.local ?? ''} onChangeText={v => onChange({ local: v })} />
      <TextInput style={[styles.input, styles.textarea]}
        placeholder="Descrição (opcional)" placeholderTextColor={colors.gray}
        value={item.descricao ?? ''} onChangeText={v => onChange({ descricao: v })}
        multiline numberOfLines={2} />
    </View>
  );
}

function OutroCuidadoCard({
  index, item, onRemove, onChange,
}: {
  index: number;
  item: OutroItemCuidado;
  onRemove: () => void;
  onChange: (patch: Partial<OutroItemCuidado>) => void;
}) {
  return (
    <View style={styles.itemCard}>
      <View style={styles.itemCardHeader}>
        <Text style={styles.itemCardTitle}>Compromisso {index + 1}</Text>
        <TouchableOpacity onPress={onRemove}>
          <Ionicons name={'trash-outline' as IoniconsName} size={18} color={colors.error} />
        </TouchableOpacity>
      </View>
      <TextInput style={styles.input}
        placeholder="Título" placeholderTextColor={colors.gray}
        value={item.titulo ?? ''} onChangeText={v => onChange({ titulo: v })} />
      <TextInput style={[styles.input, styles.textarea]}
        placeholder="Descrição" placeholderTextColor={colors.gray}
        value={item.descricao ?? ''} onChangeText={v => onChange({ descricao: v })}
        multiline numberOfLines={2} />
      <TextInput style={styles.input}
        placeholder="Local" placeholderTextColor={colors.gray}
        value={item.local ?? ''} onChangeText={v => onChange({ local: v })} />
      <View style={styles.row}>
        <TextInput style={[styles.input, { flex: 1, marginRight: 8 }]}
          placeholder="Data" placeholderTextColor={colors.gray}
          value={item.data ?? ''} onChangeText={v => onChange({ data: v })} />
        <TextInput style={[styles.input, { flex: 1 }]}
          placeholder="Horário" placeholderTextColor={colors.gray}
          value={item.horario ?? ''} onChangeText={v => onChange({ horario: v })} />
      </View>
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9fafb' },
  stepBar: { flexDirection: 'row', justifyContent: 'center', gap: 5, paddingVertical: 10, backgroundColor: colors.white, borderBottomWidth: 1, borderColor: colors.border },
  stepDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.border },
  stepDotActive: { backgroundColor: colors.primary, width: 18 },
  stepDotDone: { backgroundColor: colors.primaryLight },
  stepHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 12, backgroundColor: colors.white },
  stepTitle: { fontSize: 18, fontWeight: '700', color: colors.dark },
  stepCounter: { fontSize: 13, color: colors.gray },
  stepContent: { padding: 20 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: colors.dark, marginBottom: 4, marginTop: 4 },
  fieldLabel: { fontSize: 14, fontWeight: '600', color: colors.dark, marginBottom: 4 },
  fieldHint: { fontSize: 12, color: colors.gray, marginBottom: 12, lineHeight: 17 },
  separator: { height: 1, backgroundColor: colors.border, marginVertical: 20 },
  input: { backgroundColor: colors.white, borderWidth: 1, borderColor: colors.border, borderRadius: 10, padding: 12, fontSize: 15, color: colors.dark, marginBottom: 10 },
  textarea: { height: 80, textAlignVertical: 'top' },
  row: { flexDirection: 'row' },
  chipRow: { flexDirection: 'row', gap: 8, paddingHorizontal: 2 },
  chip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.white },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { fontSize: 13, color: colors.gray },
  chipTextActive: { color: colors.white, fontWeight: '600' },
  itemCard: { backgroundColor: colors.white, borderRadius: 12, padding: 14, marginBottom: 12, borderWidth: 1, borderColor: colors.border },
  itemCardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  itemCardTitle: { fontSize: 14, fontWeight: '600', color: colors.dark },
  addBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 14, borderRadius: 12, borderWidth: 1.5, borderColor: colors.primary, borderStyle: 'dashed', marginBottom: 4 },
  addBtnText: { fontSize: 14, color: colors.primary, fontWeight: '600' },
  summaryCard: { backgroundColor: colors.primaryLight, borderRadius: 14, padding: 20, marginBottom: 20, gap: 8 },
  summaryTitle: { fontSize: 20, fontWeight: '700', color: colors.primary, marginBottom: 8 },
  summaryItem: { fontSize: 15, color: colors.dark },
  errorBox: { backgroundColor: '#fef2f2', borderColor: '#fecaca', borderWidth: 1, borderRadius: 10, padding: 12, marginBottom: 12 },
  errorText: { color: '#dc2626', fontSize: 14 },
  saveBtn: { backgroundColor: colors.primary, borderRadius: 12, padding: 18, alignItems: 'center', marginTop: 8 },
  saveBtnText: { color: colors.white, fontSize: 16, fontWeight: '700' },
  navRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, backgroundColor: colors.white, borderTopWidth: 1, borderColor: colors.border },
  navBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 10, paddingHorizontal: 16, borderRadius: 10 },
  navBtnBack: { borderWidth: 1, borderColor: colors.border },
  navBtnBackText: { fontSize: 15, color: colors.primary, fontWeight: '600' },
  navBtnNext: { backgroundColor: colors.primary, flex: 1, marginLeft: 12, justifyContent: 'center' },
  navBtnNextText: { fontSize: 15, color: colors.white, fontWeight: '600' },
  // Intro
  introQuoteCard: { backgroundColor: colors.goldLight, borderRadius: 14, padding: 20, marginBottom: 20, alignItems: 'center', borderWidth: 1, borderColor: '#fde68a' },
  introQuoteText: { fontSize: 16, color: colors.gold, fontStyle: 'italic', textAlign: 'center', lineHeight: 24 },
  introSubtitle: { fontSize: 15, color: colors.gray, textAlign: 'center', marginBottom: 20, lineHeight: 22 },
  privacyCard: { backgroundColor: colors.primaryLight, borderRadius: 12, padding: 16, alignItems: 'center', borderWidth: 1, borderColor: '#b2dce6' },
  privacyTitle: { fontSize: 14, fontWeight: '700', color: colors.primary, marginBottom: 6 },
  privacyText: { fontSize: 13, color: '#1e6a7d', textAlign: 'center', lineHeight: 18 },
  // PIN / Privacidade
  privacyFullCard: { backgroundColor: colors.primaryLight, borderRadius: 14, padding: 18, marginBottom: 24, borderWidth: 1, borderColor: '#b2dce6' },
  privacyFullTitle: { fontSize: 17, fontWeight: '700', color: colors.dark, marginBottom: 12 },
  privacyFullText: { fontSize: 14, color: colors.dark, lineHeight: 21, marginBottom: 12 },
  privacyWarning: { flexDirection: 'row', gap: 8, backgroundColor: colors.goldLight, borderRadius: 10, padding: 12, marginBottom: 12, alignItems: 'flex-start' },
  privacyWarningText: { fontSize: 13, color: colors.gold, flex: 1, lineHeight: 18 },
  privacyItems: { gap: 8 },
  privacyItem: { flexDirection: 'row', gap: 8, alignItems: 'flex-start' },
  privacyItemText: { fontSize: 13, color: colors.dark, flex: 1, lineHeight: 18 },
  // Oração — Comunhão Comunitária
  comunhaoCard: { backgroundColor: '#f97316', borderRadius: 14, padding: 18, marginBottom: 20 },
  comunhaoLabel: { fontSize: 11, fontWeight: '700', color: 'rgba(255,255,255,0.8)', letterSpacing: 1, marginBottom: 6 },
  comunhaoTitle: { fontSize: 16, fontWeight: '700', color: colors.white, marginBottom: 10 },
  comunhaoText: { fontSize: 14, color: 'rgba(255,255,255,0.95)', lineHeight: 21 },
  comunhaoEmphasis: { fontWeight: '700' },
});
