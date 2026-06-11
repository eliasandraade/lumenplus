/**
 * Admin — Create Retreat
 * ======================
 * Formulário (página única) para criar um novo retiro (salvo como DRAFT).
 * Organizado em seções: Informações básicas · Datas e local · Vagas e acesso.
 */

import { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import type { IoniconsName } from '@/types/icons';
import api from '@/services/api';
import { CalendarPicker } from '@/components/ui/CalendarPicker';
import { useTheme } from '@/theme';
import type { SemanticTokens } from '@/theme';

const ADMIN_COLOR = '#7c3aed';

const TYPES = [
  { value: 'WEEKEND',   label: 'Fim de semana' },
  { value: 'DAY',       label: 'Dia único' },
  { value: 'FORMATION', label: 'Formação' },
];

const VISIBILITIES = [
  { value: 'ALL',      label: 'Todos os membros' },
  { value: 'SPECIFIC', label: 'Específico (setores/realidades)' },
];

export default function CreateRetreatScreen() {
  const { t } = useTheme();
  const styles = makeStyles(t);

  const [title, setTitle]         = useState('');
  const [description, setDesc]    = useState('');
  const [type, setType]           = useState('WEEKEND');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate]     = useState('');
  const [location, setLocation]   = useState('');
  const [address, setAddress]     = useState('');
  const [maxPart, setMaxPart]     = useState('');
  const [price, setPrice]         = useState('');
  const [visibility, setVis]      = useState('ALL');

  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState<string | null>(null);

  const parseDate = (str: string): string | null => {
    // Aceita dd/mm/aaaa e converte para ISO
    const match = str.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (!match) return null;
    return `${match[3]}-${match[2]}-${match[1]}T00:00:00`;
  };

  const handleCreate = async () => {
    if (!title.trim()) { setError('O título é obrigatório'); return; }
    const start = parseDate(startDate);
    const end   = parseDate(endDate);
    if (!start) { setError('Selecione a data de início'); return; }
    if (!end)   { setError('Selecione a data de término'); return; }

    setLoading(true);
    setError(null);
    try {
      await api.post('/admin/retreats', {
        title: title.trim(),
        description: description.trim() || null,
        retreat_type: type,
        start_date: start,
        end_date: end,
        location: location.trim() || null,
        address: address.trim() || null,
        max_participants: maxPart ? parseInt(maxPart, 10) : null,
        price_brl: price.trim() || null,
        visibility_type: visibility,
        eligibility_rules: [],
      });
      router.back();
    } catch (err: any) {
      setError(err?.response?.data?.detail?.message || 'Erro ao criar retiro');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      {error && (
        <View style={styles.errorBox}>
          <Ionicons name="alert-circle-outline" size={16} color={t.status.error} />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      <Section title="Informações básicas" icon="information-circle-outline" first styles={styles}>
        <Field label="Título *" styles={styles}>
          <TextInput style={styles.input} value={title} onChangeText={setTitle} placeholder="Ex: Retiro de Formação 2026" placeholderTextColor={t.text.tertiary} />
        </Field>

        <Field label="Descrição" styles={styles}>
          <TextInput
            style={[styles.input, styles.textarea]} value={description}
            onChangeText={setDesc} placeholder="Descreva o retiro..." placeholderTextColor={t.text.tertiary}
            multiline numberOfLines={4} textAlignVertical="top"
          />
        </Field>

        <Field label="Tipo" styles={styles}>
          <View style={styles.pills}>
            {TYPES.map(tp => (
              <TouchableOpacity
                key={tp.value}
                style={[styles.pill, type === tp.value && styles.pillActive]}
                onPress={() => setType(tp.value)}
              >
                <Text style={[styles.pillText, type === tp.value && styles.pillTextActive]}>
                  {tp.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </Field>
      </Section>

      <Section title="Datas e local" icon="calendar-outline" styles={styles}>
        <Field label="Data de início *" styles={styles}>
          <CalendarPicker value={startDate} onChange={setStartDate} label="Selecionar data de início" />
        </Field>

        <Field label="Data de término *" styles={styles}>
          <CalendarPicker value={endDate} onChange={setEndDate} label="Selecionar data de término" />
        </Field>

        <Field label="Local" styles={styles}>
          <TextInput style={styles.input} value={location} onChangeText={setLocation} placeholder="Ex: Casa de Retiros Nossa Senhora" placeholderTextColor={t.text.tertiary} />
        </Field>

        <Field label="Endereço completo" styles={styles}>
          <TextInput style={styles.input} value={address} onChangeText={setAddress} placeholder="Rua, número, cidade..." placeholderTextColor={t.text.tertiary} />
        </Field>
      </Section>

      <Section title="Vagas e acesso" icon="people-outline" styles={styles}>
        <Field label="Máximo de vagas" styles={styles}>
          <TextInput style={styles.input} value={maxPart} onChangeText={setMaxPart} placeholder="Deixe vazio para sem limite" placeholderTextColor={t.text.tertiary} keyboardType="numeric" />
        </Field>

        <Field label="Valor (R$)" styles={styles}>
          <TextInput style={styles.input} value={price} onChangeText={setPrice} placeholder="Ex: 120,00 · Vazio = gratuito" placeholderTextColor={t.text.tertiary} keyboardType="decimal-pad" />
        </Field>

        <Field label="Visibilidade" styles={styles}>
          <View style={styles.pills}>
            {VISIBILITIES.map(v => (
              <TouchableOpacity
                key={v.value}
                style={[styles.pill, visibility === v.value && styles.pillActive]}
                onPress={() => setVis(v.value)}
              >
                <Text style={[styles.pillText, visibility === v.value && styles.pillTextActive]}>
                  {v.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          {visibility === 'SPECIFIC' && (
            <Text style={styles.hint}>
              As regras de elegibilidade podem ser configuradas após criar o retiro.
            </Text>
          )}
        </Field>
      </Section>

      <TouchableOpacity
        style={[styles.createBtn, loading && { opacity: 0.6 }]}
        onPress={handleCreate}
        disabled={loading}
      >
        {loading
          ? <ActivityIndicator color={t.text.inverse} />
          : <>
              <Ionicons name="save-outline" size={20} color={t.text.inverse} />
              <Text style={styles.createBtnText}>Criar como Rascunho</Text>
            </>
        }
      </TouchableOpacity>
    </ScrollView>
  );
}

type Styles = ReturnType<typeof makeStyles>;

function Field({ label, children, styles }: { label: string; children: React.ReactNode; styles: Styles }) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      {children}
    </View>
  );
}

function Section(
  { title, icon, children, styles, first }:
  { title: string; icon: IoniconsName; children: React.ReactNode; styles: Styles; first?: boolean }
) {
  return (
    <View style={[styles.section, first && styles.sectionFirst]}>
      <View style={styles.sectionHeader}>
        <Ionicons name={icon} size={16} color={ADMIN_COLOR} />
        <Text style={styles.sectionTitle}>{title}</Text>
      </View>
      {children}
    </View>
  );
}

const makeStyles = (t: SemanticTokens) => StyleSheet.create({
  container: { flex: 1, backgroundColor: t.bg.elevated },
  content: { padding: 16, paddingBottom: 40, gap: 14 },
  errorBox: {
    flexDirection: 'row', gap: 8, backgroundColor: t.status.errorBg,
    borderRadius: 10, padding: 12, alignItems: 'center',
  },
  errorText: { color: t.status.error, fontSize: 13, flex: 1 },
  section: { gap: 14, paddingTop: 18, borderTopWidth: 1, borderTopColor: t.border.subtle },
  sectionFirst: { paddingTop: 0, borderTopWidth: 0 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  sectionTitle: { fontSize: 12, fontWeight: '800', color: t.text.secondary, textTransform: 'uppercase', letterSpacing: 0.6 },
  field: { gap: 6 },
  label: { fontSize: 13, fontWeight: '600', color: t.text.primary },
  input: {
    backgroundColor: t.bg.surface, borderRadius: 10, borderWidth: 1,
    borderColor: t.border.subtle, padding: 12, fontSize: 14, color: t.text.primary,
  },
  textarea: { minHeight: 90, textAlignVertical: 'top' },
  pills: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  pill: {
    borderWidth: 1.5, borderColor: t.border.subtle, borderRadius: 20,
    paddingHorizontal: 14, paddingVertical: 7,
  },
  pillActive: { backgroundColor: ADMIN_COLOR, borderColor: ADMIN_COLOR },
  pillText: { fontSize: 13, color: t.text.secondary, fontWeight: '500' },
  pillTextActive: { color: t.text.inverse, fontWeight: '700' },
  hint: { fontSize: 12, color: t.text.secondary, marginTop: 4, fontStyle: 'italic' },
  createBtn: {
    backgroundColor: ADMIN_COLOR, borderRadius: 14, padding: 16,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 8,
  },
  createBtnText: { color: t.text.inverse, fontSize: 16, fontWeight: '700' },
});
