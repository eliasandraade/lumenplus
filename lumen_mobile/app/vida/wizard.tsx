/**
 * Projeto de Vida Mensal — Wizard de Criação
 * ============================================
 * 6 passos: Ciclo → Comunidade → Cuidado → Compromissos → Oração → Confirmar
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
} from '@/services/projetoVidaMensal';

const colors = {
  primary: '#1A859B', primaryLight: '#E8F4F7',
  white: '#ffffff', gray: '#6b7280',
  lightGray: '#f3f4f6', dark: '#171717', border: '#e5e7eb', error: '#ef4444',
};

// ── Types ──────────────────────────────────────────────────────────────────

interface WizardData {
  mes: string;
  ano: string;
  tema: string;
  intencao: string;
  pin: string;
  comunidade: { partilha_acompanhador: string; encontro_familia: string; dias_grupo: string; outros: string };
  cuidado: { consultas: string; exames: string; descanso: string; outros: string };
  compromissos: CompromissoIn[];
  praticas: PraticaIn[];
}

const now = new Date();
const defaultData = (): WizardData => ({
  mes: String(now.getMonth() + 1),
  ano: String(now.getFullYear()),
  tema: '', intencao: '', pin: '',
  comunidade: { partilha_acompanhador: '', encontro_familia: '', dias_grupo: '', outros: '' },
  cuidado: { consultas: '', exames: '', descanso: '', outros: '' },
  compromissos: [],
  praticas: [],
});

const STEP_TITLES = ['Ciclo Mensal', 'Comunidade', 'Cuidado Pessoal', 'Compromissos', 'Oração Diária', 'Confirmar'];

// ── Main ───────────────────────────────────────────────────────────────────

export default function WizardScreen() {
  const [step, setStep] = useState(0);
  const [data, setData] = useState<WizardData>(defaultData());
  const [activeSemana, setActiveSemana] = useState('s1');
  const [activeDia, setActiveDia] = useState('seg');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const update = (partial: Partial<WizardData>) => setData(d => ({ ...d, ...partial }));

  const addCompromisso = () => {
    update({
      compromissos: [
        ...data.compromissos,
        { semana: activeSemana, titulo: '', dia: '', horario: '', obs: '', ordem: data.compromissos.length },
      ],
    });
  };

  const removeCompromisso = (idx: number) => {
    update({ compromissos: data.compromissos.filter((_, i) => i !== idx) });
  };

  const updateCompromisso = (idx: number, patch: Partial<CompromissoIn>) => {
    const list = [...data.compromissos];
    list[idx] = { ...list[idx], ...patch };
    update({ compromissos: list });
  };

  const addPratica = () => {
    update({
      praticas: [
        ...data.praticas,
        { dia_semana: activeDia, tipo: TIPOS_PRATICA[0], horario: '', duracao: '', obs: '', ordem: data.praticas.length },
      ],
    });
  };

  const removePratica = (idx: number) => {
    update({ praticas: data.praticas.filter((_, i) => i !== idx) });
  };

  const updatePratica = (idx: number, patch: Partial<PraticaIn>) => {
    const list = [...data.praticas];
    list[idx] = { ...list[idx], ...patch };
    update({ praticas: list });
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      const mes = parseInt(data.mes, 10);
      const ano = parseInt(data.ano, 10);
      const criado = await projetoVidaMensalApi.criar({
        mes, ano,
        tema: data.tema || null,
        intencao: data.intencao || null,
        pin: data.pin || null,
      });
      await projetoVidaMensalApi.update(criado.id, {
        comunidade: {
          partilha_acompanhador: data.comunidade.partilha_acompanhador || null,
          encontro_familia: data.comunidade.encontro_familia || null,
          dias_grupo: data.comunidade.dias_grupo || null,
          outros: data.comunidade.outros || null,
        },
        cuidado: {
          consultas: data.cuidado.consultas || null,
          exames: data.cuidado.exames || null,
          descanso: data.cuidado.descanso || null,
          outros: data.cuidado.outros || null,
        },
        compromissos: data.compromissos,
        praticas: data.praticas,
      });
      router.replace({ pathname: '/vida/ciclo', params: { projetoId: criado.id } });
    } catch (e: any) {
      const msg = e?.response?.data?.detail?.message ?? 'Erro ao salvar. Tente novamente.';
      setError(msg);
    } finally {
      setSaving(false);
    }
  };

  // ── Render steps ──────────────────────────────────────────────────────────

  const renderStep = () => {
    switch (step) {
      // ── Step 0: Ciclo Mensal ─────────────────────────────────────────────
      case 0:
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

            <Text style={styles.fieldLabel}>Tema do mês (opcional)</Text>
            <TextInput
              style={styles.input}
              value={data.tema}
              onChangeText={v => update({ tema: v })}
              placeholder="Ex: Conversão e perseverança"
              placeholderTextColor={colors.gray}
            />

            <Text style={styles.fieldLabel}>Intenção do mês (opcional)</Text>
            <TextInput
              style={[styles.input, styles.textarea]}
              value={data.intencao}
              onChangeText={v => update({ intencao: v })}
              placeholder="Qual a sua intenção principal neste ciclo?"
              placeholderTextColor={colors.gray}
              multiline
              numberOfLines={4}
            />

            <Text style={styles.fieldLabel}>PIN de proteção (4 dígitos, opcional)</Text>
            <TextInput
              style={styles.input}
              value={data.pin}
              onChangeText={v => update({ pin: v.replace(/\D/g, '').slice(0, 4) })}
              placeholder="Deixe em branco para sem PIN"
              placeholderTextColor={colors.gray}
              keyboardType="numeric"
              secureTextEntry
              maxLength={4}
            />
          </View>
        );

      // ── Step 1: Comunidade ───────────────────────────────────────────────
      case 1:
        return (
          <View style={styles.stepContent}>
            {(['partilha_acompanhador', 'encontro_familia', 'dias_grupo', 'outros'] as const).map((key) => {
              const labels: Record<string, string> = {
                partilha_acompanhador: 'Partilha com acompanhador',
                encontro_familia: 'Encontro com família',
                dias_grupo: 'Dias de grupo',
                outros: 'Outros',
              };
              return (
                <View key={key} style={{ marginBottom: 16 }}>
                  <Text style={styles.fieldLabel}>{labels[key]}</Text>
                  <TextInput
                    style={[styles.input, styles.textarea]}
                    value={data.comunidade[key]}
                    onChangeText={v => update({ comunidade: { ...data.comunidade, [key]: v } })}
                    multiline
                    numberOfLines={3}
                    placeholderTextColor={colors.gray}
                  />
                </View>
              );
            })}
          </View>
        );

      // ── Step 2: Cuidado Pessoal ──────────────────────────────────────────
      case 2:
        return (
          <View style={styles.stepContent}>
            {(['consultas', 'exames', 'descanso', 'outros'] as const).map((key) => {
              const labels: Record<string, string> = {
                consultas: 'Consultas médicas',
                exames: 'Exames',
                descanso: 'Descanso e lazer',
                outros: 'Outros cuidados',
              };
              return (
                <View key={key} style={{ marginBottom: 16 }}>
                  <Text style={styles.fieldLabel}>{labels[key]}</Text>
                  <TextInput
                    style={[styles.input, styles.textarea]}
                    value={data.cuidado[key]}
                    onChangeText={v => update({ cuidado: { ...data.cuidado, [key]: v } })}
                    multiline
                    numberOfLines={3}
                    placeholderTextColor={colors.gray}
                  />
                </View>
              );
            })}
          </View>
        );

      // ── Step 3: Compromissos semanais ────────────────────────────────────
      case 3:
        const semanaItems = data.compromissos.filter(c => c.semana === activeSemana);
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

            {semanaIndexes.map(({ c, i }) => (
              <View key={i} style={styles.itemCard}>
                <View style={styles.itemCardHeader}>
                  <Text style={styles.itemCardTitle}>Compromisso {semanaItems.indexOf(c) + 1}</Text>
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

            <TouchableOpacity style={styles.addBtn} onPress={addCompromisso}>
              <Ionicons name={'add-circle-outline' as IoniconsName} size={20} color={colors.primary} />
              <Text style={styles.addBtnText}>Adicionar compromisso em {SEMANA_LABELS[activeSemana]}</Text>
            </TouchableOpacity>
          </View>
        );

      // ── Step 4: Oração Diária ────────────────────────────────────────────
      case 4:
        const diaIndexes = data.praticas
          .map((p, i) => ({ p, i }))
          .filter(({ p }) => p.dia_semana === activeDia);
        return (
          <View style={styles.stepContent}>
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

            {diaIndexes.map(({ p, i }) => (
              <View key={i} style={styles.itemCard}>
                <View style={styles.itemCardHeader}>
                  <Text style={styles.itemCardTitle}>Prática {diaIndexes.indexOf({ p, i }) + 1}</Text>
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
                  <TextInput style={[styles.input, { flex: 1 }]} placeholder="Duração"
                    placeholderTextColor={colors.gray} value={p.duracao}
                    onChangeText={v => updatePratica(i, { duracao: v })} />
                </View>
                <TextInput style={[styles.input, styles.textarea]} placeholder="Observações"
                  placeholderTextColor={colors.gray} value={p.obs}
                  onChangeText={v => updatePratica(i, { obs: v })} multiline numberOfLines={2} />
              </View>
            ))}

            <TouchableOpacity style={styles.addBtn} onPress={addPratica}>
              <Ionicons name={'add-circle-outline' as IoniconsName} size={20} color={colors.primary} />
              <Text style={styles.addBtnText}>Adicionar prática em {DIA_LABELS[activeDia]}</Text>
            </TouchableOpacity>
          </View>
        );

      // ── Step 5: Confirmar ────────────────────────────────────────────────
      case 5:
        return (
          <View style={styles.stepContent}>
            <View style={styles.summaryCard}>
              <Text style={styles.summaryTitle}>
                {MESES[parseInt(data.mes, 10) - 1]} {data.ano}
              </Text>
              {data.tema ? <Text style={styles.summaryItem}>🎯 {data.tema}</Text> : null}
              {data.pin ? <Text style={styles.summaryItem}>🔒 PIN configurado</Text> : null}
              <Text style={styles.summaryItem}>
                📅 {data.compromissos.length} compromisso(s)
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
            <Text style={styles.navBtnNextText}>Próximo</Text>
            <Ionicons name={'chevron-forward' as IoniconsName} size={20} color={colors.white} />
          </TouchableOpacity>
        )}
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9fafb' },
  stepBar: { flexDirection: 'row', justifyContent: 'center', gap: 6, paddingVertical: 12, backgroundColor: colors.white, borderBottomWidth: 1, borderColor: colors.border },
  stepDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.border },
  stepDotActive: { backgroundColor: colors.primary, width: 20 },
  stepDotDone: { backgroundColor: colors.primaryLight },
  stepHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 12, backgroundColor: colors.white },
  stepTitle: { fontSize: 18, fontWeight: '700', color: colors.dark },
  stepCounter: { fontSize: 13, color: colors.gray },
  stepContent: { padding: 20 },
  fieldLabel: { fontSize: 14, fontWeight: '600', color: colors.dark, marginBottom: 6 },
  input: { backgroundColor: colors.white, borderWidth: 1, borderColor: colors.border, borderRadius: 10, padding: 12, fontSize: 15, color: colors.dark, marginBottom: 12 },
  textarea: { height: 90, textAlignVertical: 'top' },
  chipRow: { flexDirection: 'row', gap: 8, paddingHorizontal: 2 },
  chip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.white },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { fontSize: 13, color: colors.gray },
  chipTextActive: { color: colors.white, fontWeight: '600' },
  row: { flexDirection: 'row' },
  itemCard: { backgroundColor: colors.white, borderRadius: 12, padding: 14, marginBottom: 12, borderWidth: 1, borderColor: colors.border },
  itemCardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  itemCardTitle: { fontSize: 14, fontWeight: '600', color: colors.dark },
  addBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, padding: 14, borderRadius: 12, borderWidth: 1.5, borderColor: colors.primary, borderStyle: 'dashed' },
  addBtnText: { fontSize: 14, color: colors.primary, fontWeight: '600' },
  summaryCard: { backgroundColor: colors.primaryLight, borderRadius: 14, padding: 20, marginBottom: 20, gap: 8 },
  summaryTitle: { fontSize: 20, fontWeight: '700', color: colors.primary, marginBottom: 8 },
  summaryItem: { fontSize: 15, color: colors.dark },
  errorBox: { backgroundColor: '#fef2f2', borderColor: '#fecaca', borderWidth: 1, borderRadius: 10, padding: 12, marginBottom: 12 },
  errorText: { color: '#dc2626', fontSize: 14 },
  saveBtn: { backgroundColor: colors.primary, borderRadius: 12, padding: 18, alignItems: 'center', marginTop: 8 },
  saveBtnText: { color: colors.white, fontSize: 16, fontWeight: '700' },
  navRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, backgroundColor: colors.white, borderTopWidth: 1, borderColor: colors.border },
  navBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 10, paddingHorizontal: 20, borderRadius: 10 },
  navBtnBack: { borderWidth: 1, borderColor: colors.border },
  navBtnBackText: { fontSize: 15, color: colors.primary, fontWeight: '600' },
  navBtnNext: { backgroundColor: colors.primary },
  navBtnNextText: { fontSize: 15, color: colors.white, fontWeight: '600' },
});
