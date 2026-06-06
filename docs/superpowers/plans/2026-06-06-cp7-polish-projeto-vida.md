# CP7 — Polish UI do Projeto de Vida

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cinco melhorias de UX no módulo Projeto de Vida: tela de leitura do Semanal por dia, CalendarPicker para datas de compromissos, máscara HH:MM em campos de horário, texto do Ministério Bom Pastor e toggle de tema no Perfil.

**Architecture:** Dois componentes novos reutilizáveis (`HorarioInput`, `CalendarPicker`) alimentam mudanças em três telas existentes. Uma tela nova (`semanal-view`) usa dados já carregados pelo `getSemanal` existente. Nenhum endpoint novo, nenhuma migration.

**Tech Stack:** React Native 0.76, Expo Router 4, TypeScript, useTheme() via ThemeContext existente, projetoVidaMensalApi existente.

---

## Mapa de arquivos

| Arquivo | Ação | Responsabilidade |
|---------|------|-----------------|
| `lumen_mobile/src/components/ui/HorarioInput.tsx` | **Criar** | TextInput com máscara HH:MM e validação no blur |
| `lumen_mobile/src/components/ui/CalendarPicker.tsx` | **Criar** | Modal com grade mensal, sem dependência externa |
| `lumen_mobile/app/vida/semanal-view.tsx` | **Criar** | Tela de leitura do semanal organizada por dia |
| `lumen_mobile/app/vida/_layout.tsx` | Modificar | Registrar Screen `semanal-view` |
| `lumen_mobile/app/vida/semanal.tsx` | Modificar | Redirect para `semanal-view` + HorarioInput |
| `lumen_mobile/app/vida/ciclo.tsx` | Modificar | Dois botões: Ver semana / Editar semana |
| `lumen_mobile/app/vida/diario.tsx` | Modificar | Aceitar param `dia` + usar HorarioInput |
| `lumen_mobile/app/vida/wizard.tsx` | Modificar | CalendarPicker + HorarioInput + copy Bom Pastor |
| `lumen_mobile/app/(tabs)/profile.tsx` | Modificar | Toggle Dark/Light antes do botão Sair |

---

## Task 1: HorarioInput component

**Files:**
- Create: `lumen_mobile/src/components/ui/HorarioInput.tsx`

- [ ] **Step 1.1: Criar o componente HorarioInput**

```typescript
// lumen_mobile/src/components/ui/HorarioInput.tsx
import { useState } from 'react';
import { View, TextInput, Text, StyleSheet } from 'react-native';
import { useTheme } from '@/theme';

export function formatarHorario(raw: string): string {
  const digits = raw.replace(/\D/g, '').slice(0, 4);
  if (digits.length <= 2) return digits;
  return `${digits.slice(0, 2)}:${digits.slice(2)}`;
}

export function horarioValido(v: string): boolean {
  if (v === '') return true; // campo opcional
  if (!/^\d{2}:\d{2}$/.test(v)) return false;
  const [h, m] = v.split(':').map(Number);
  return h >= 0 && h <= 23 && m >= 0 && m <= 59;
}

interface HorarioInputProps {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  style?: object;
}

export function HorarioInput({ value, onChange, placeholder = 'HH:MM', style }: HorarioInputProps) {
  const { t, r } = useTheme();
  const [erro, setErro] = useState(false);

  const handleChange = (raw: string) => {
    setErro(false);
    onChange(formatarHorario(raw));
  };

  const handleBlur = () => {
    if (!horarioValido(value)) {
      setErro(true);
      onChange('');
    }
  };

  return (
    <View>
      <TextInput
        style={[
          {
            backgroundColor: t.bg.surface,
            borderRadius: r.md,
            borderWidth: StyleSheet.hairlineWidth,
            borderColor: erro ? t.status.error : t.border.subtle,
            padding: 12,
            fontSize: 15,
            fontFamily: 'Nunito-Regular',
            color: t.text.primary,
            minHeight: 48,
          },
          style,
        ]}
        value={value}
        onChangeText={handleChange}
        onBlur={handleBlur}
        placeholder={placeholder}
        placeholderTextColor={t.text.tertiary}
        keyboardType="numeric"
        maxLength={5}
      />
      {erro && (
        <Text style={{ fontSize: 11, fontFamily: 'Nunito-Regular', color: t.status.error, marginTop: 3 }}>
          Horário inválido — use o formato HH:MM (ex.: 07:30)
        </Text>
      )}
    </View>
  );
}
```

- [ ] **Step 1.2: Commit**

```bash
git add lumen_mobile/src/components/ui/HorarioInput.tsx
git commit -m "feat(ui): componente HorarioInput com máscara HH:MM e validação"
```

---

## Task 2: CalendarPicker component

**Files:**
- Create: `lumen_mobile/src/components/ui/CalendarPicker.tsx`

- [ ] **Step 2.1: Criar CalendarPicker**

```typescript
// lumen_mobile/src/components/ui/CalendarPicker.tsx
import { useState } from 'react';
import {
  View, Text, TouchableOpacity, Modal, StyleSheet, ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/theme';

export interface CalendarPickerProps {
  value: string;           // "DD/MM/YYYY" ou ""
  onChange: (v: string) => void;
  label?: string;
  mes?: number;            // 1-12, default: mês atual
  ano?: number;
}

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

function parseDDMMYYYY(s: string): Date | null {
  const m = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!m) return null;
  return new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]));
}

function formatDDMMYYYY(d: Date): string {
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
}

const MESES_PT = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];
const DIAS_SEMANA_LABELS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

export function CalendarPicker({ value, onChange, label, mes, ano }: CalendarPickerProps) {
  const { t, r } = useTheme();
  const hoje = new Date();
  const [open, setOpen] = useState(false);
  const [curMes, setCurMes] = useState(mes ? mes - 1 : hoje.getMonth()); // 0-based
  const [curAno, setCurAno] = useState(ano ?? hoje.getFullYear());

  const selected = parseDDMMYYYY(value);

  const prevMes = () => {
    if (curMes === 0) { setCurMes(11); setCurAno(a => a - 1); }
    else setCurMes(m => m - 1);
  };
  const nextMes = () => {
    if (curMes === 11) { setCurMes(0); setCurAno(a => a + 1); }
    else setCurMes(m => m + 1);
  };

  // Gerar grade do mês
  const primeiroDia = new Date(curAno, curMes, 1).getDay(); // 0=Dom
  const ultimoDia = new Date(curAno, curMes + 1, 0).getDate();
  const cells: (number | null)[] = [
    ...Array(primeiroDia).fill(null),
    ...Array.from({ length: ultimoDia }, (_, i) => i + 1),
  ];
  // Preencher para múltiplo de 7
  while (cells.length % 7 !== 0) cells.push(null);

  const selectDay = (day: number) => {
    onChange(formatDDMMYYYY(new Date(curAno, curMes, day)));
    setOpen(false);
  };

  const isSelected = (day: number) =>
    selected &&
    selected.getDate() === day &&
    selected.getMonth() === curMes &&
    selected.getFullYear() === curAno;

  const isHoje = (day: number) =>
    hoje.getDate() === day &&
    hoje.getMonth() === curMes &&
    hoje.getFullYear() === curAno;

  return (
    <>
      <TouchableOpacity
        style={{
          backgroundColor: t.bg.surface,
          borderRadius: r.md,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: t.border.subtle,
          padding: 12,
          minHeight: 48,
          justifyContent: 'center',
          flexDirection: 'row',
          alignItems: 'center',
        }}
        onPress={() => setOpen(true)}
        activeOpacity={0.7}
      >
        <Ionicons name="calendar-outline" size={16} color={value ? t.text.primary : t.text.tertiary} style={{ marginRight: 8 }} />
        <Text style={{
          flex: 1,
          fontSize: 15,
          fontFamily: 'Nunito-Regular',
          color: value ? t.text.primary : t.text.tertiary,
        }}>
          {value || (label ?? 'Selecionar data')}
        </Text>
        {value ? (
          <TouchableOpacity onPress={() => onChange('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons name="close-circle" size={16} color={t.text.tertiary} />
          </TouchableOpacity>
        ) : null}
      </TouchableOpacity>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <TouchableOpacity
          style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', alignItems: 'center' }}
          activeOpacity={1}
          onPress={() => setOpen(false)}
        >
          <TouchableOpacity activeOpacity={1} onPress={() => {}}>
            <View style={{
              backgroundColor: t.bg.elevated,
              borderRadius: r.xl,
              padding: 20,
              width: 320,
            }}>
              {/* Cabeçalho de navegação */}
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                <TouchableOpacity onPress={prevMes} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <Ionicons name="chevron-back" size={22} color={t.brand.primary} />
                </TouchableOpacity>
                <Text style={{ fontSize: 15, fontFamily: 'Nunito-Bold', color: t.text.primary }}>
                  {MESES_PT[curMes]} {curAno}
                </Text>
                <TouchableOpacity onPress={nextMes} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <Ionicons name="chevron-forward" size={22} color={t.brand.primary} />
                </TouchableOpacity>
              </View>

              {/* Labels de dia da semana */}
              <View style={{ flexDirection: 'row', marginBottom: 8 }}>
                {DIAS_SEMANA_LABELS.map(d => (
                  <Text key={d} style={{
                    flex: 1, textAlign: 'center', fontSize: 11,
                    fontFamily: 'Nunito-Bold', color: t.text.tertiary,
                  }}>{d}</Text>
                ))}
              </View>

              {/* Grade de dias */}
              {Array.from({ length: cells.length / 7 }, (_, row) => (
                <View key={row} style={{ flexDirection: 'row', marginBottom: 4 }}>
                  {cells.slice(row * 7, row * 7 + 7).map((day, col) => (
                    <TouchableOpacity
                      key={col}
                      style={{
                        flex: 1, alignItems: 'center', justifyContent: 'center',
                        height: 36, borderRadius: 18,
                        backgroundColor: day && isSelected(day) ? t.brand.primary : 'transparent',
                        borderWidth: day && isHoje(day) && !isSelected(day) ? 1 : 0,
                        borderColor: t.brand.primary,
                        opacity: day ? 1 : 0,
                      }}
                      onPress={() => day && selectDay(day)}
                      disabled={!day}
                      activeOpacity={0.7}
                    >
                      <Text style={{
                        fontSize: 14,
                        fontFamily: day && isSelected(day) ? 'Nunito-Bold' : 'Nunito-Regular',
                        color: day && isSelected(day) ? '#ffffff' : t.text.primary,
                      }}>
                        {day ?? ''}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              ))}

              {/* Botão cancelar */}
              <TouchableOpacity
                style={{ marginTop: 12, alignItems: 'center', padding: 8 }}
                onPress={() => setOpen(false)}
              >
                <Text style={{ fontSize: 14, fontFamily: 'Nunito-SemiBold', color: t.text.secondary }}>
                  Cancelar
                </Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </>
  );
}
```

- [ ] **Step 2.2: Commit**

```bash
git add lumen_mobile/src/components/ui/CalendarPicker.tsx
git commit -m "feat(ui): CalendarPicker — grade mensal sem dependência externa"
```

---

## Task 3: Tela semanal-view + registro no layout

**Files:**
- Create: `lumen_mobile/app/vida/semanal-view.tsx`
- Modify: `lumen_mobile/app/vida/_layout.tsx`

- [ ] **Step 3.1: Criar semanal-view.tsx**

```typescript
// lumen_mobile/app/vida/semanal-view.tsx
import { useState, useEffect, useCallback } from 'react';
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
import { useTheme } from '@/theme';

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
  return DIAS_SEMANA[(new Date().getDay() + 1) % 7];
}

export default function SemanaiViewScreen() {
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

  // Práticas planejadas para o dia ativo
  const vidaInterior = (semanal.vida_interior ?? {}) as Record<string, { dias?: string[]; horario?: string | null }>;
  const praticasHoje = Object.entries(vidaInterior)
    .filter(([, p]) => p?.dias?.includes(diaAtivo))
    .map(([key, p]) => ({ key, label: PRATICAS_LABELS[key] ?? key, horario: p.horario }));

  // Planejamento do dia (plano_diario)
  const plano = ((semanal.plano_diario ?? {}) as Record<string, PlanoDiarioItem>)[diaAtivo] ?? {};
  const temPlanoDiario = !!(
    plano.proposito || plano.missa || plano.oracao_manha ||
    plano.lectio || plano.terco || plano.leitura_espiritual || plano.evangelizacao
  );

  const resolvedSemanalId = semanalId ?? semanal.id;

  return (
    <View style={{ flex: 1, backgroundColor: t.bg.screen }}>
      {/* Cabeçalho */}
      <View style={{
        paddingHorizontal: 20, paddingTop: 16, paddingBottom: 12,
        backgroundColor: t.bg.elevated,
        borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: t.border.subtle,
      }}>
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
        <View style={{
          backgroundColor: t.bg.elevated, borderRadius: r.lg,
          borderWidth: StyleSheet.hairlineWidth, borderColor: t.border.subtle,
          padding: 16, marginBottom: 16,
        }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <Ionicons name={'sunny-outline' as IoniconsName} size={16} color={t.accent.spiritual} />
            <Text style={{ fontSize: 13, fontFamily: 'Nunito-Bold', color: t.text.secondary, textTransform: 'uppercase', letterSpacing: 0.8 }}>
              Práticas planejadas
            </Text>
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
        <View style={{
          backgroundColor: t.bg.elevated, borderRadius: r.lg,
          borderWidth: StyleSheet.hairlineWidth, borderColor: t.border.subtle,
          padding: 16, marginBottom: 16,
        }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <Ionicons name={'moon-outline' as IoniconsName} size={16} color={t.brand.primary} />
            <Text style={{ fontSize: 13, fontFamily: 'Nunito-Bold', color: t.text.secondary, textTransform: 'uppercase', letterSpacing: 0.8 }}>
              Amanhã com o Emanuel
            </Text>
          </View>

          {!temPlanoDiario ? (
            <>
              <Text style={{ fontSize: 14, fontFamily: 'Nunito-Italic', color: t.text.tertiary, marginBottom: 12 }}>
                Este dia ainda não foi planejado.
              </Text>
              <TouchableOpacity
                style={{
                  flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
                  gap: 8, padding: 12, borderRadius: r.lg,
                  backgroundColor: t.brand.primaryDim, borderWidth: 1, borderColor: t.brand.primary,
                }}
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
              {plano.proposito && <CampoView label="Propósito" value={plano.proposito} t={t} />}
              {plano.missa && (
                <CampoView
                  label="Missa"
                  value={plano.horario_missa ? `Sim — ${plano.horario_missa}` : 'Sim'}
                  t={t}
                />
              )}
              {plano.oracao_manha && <CampoView label="Oração da manhã" value={plano.oracao_manha} t={t} />}
              {plano.lectio && <CampoView label="Lectio Divina" value={plano.lectio} t={t} />}
              {plano.terco && (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                  <Ionicons name={'checkmark-circle' as IoniconsName} size={16} color={t.status.success} />
                  <Text style={{ fontSize: 14, fontFamily: 'Nunito-SemiBold', color: t.text.primary }}>Terço</Text>
                </View>
              )}
              {plano.leitura_espiritual && <CampoView label="Leitura Espiritual" value={plano.leitura_espiritual} t={t} />}
              {plano.evangelizacao && <CampoView label="Evangelização" value={plano.evangelizacao} t={t} />}

              <TouchableOpacity
                style={{
                  flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
                  gap: 8, padding: 10, borderRadius: r.md, marginTop: 8,
                  borderWidth: StyleSheet.hairlineWidth, borderColor: t.border.default,
                }}
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

      {/* Rodapé: botão Editar Semana */}
      <View style={{
        padding: 16, backgroundColor: t.bg.elevated,
        borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: t.border.subtle,
      }}>
        <TouchableOpacity
          style={{
            flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
            gap: 8, padding: 16, borderRadius: r.lg,
            borderWidth: 1, borderColor: t.border.default,
          }}
          onPress={() => router.push({
            pathname: '/vida/semanal',
            params: { projetoId: projetoId ?? '' },
          })}
          activeOpacity={0.8}
        >
          <Ionicons name={'pencil-outline' as IoniconsName} size={16} color={t.text.secondary} />
          <Text style={{ fontSize: 15, fontFamily: 'Nunito-SemiBold', color: t.text.secondary }}>
            Editar Semana
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

function CampoView({ label, value, t }: { label: string; value: string; t: any }) {
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
});
```

- [ ] **Step 3.2: Registrar `semanal-view` no layout**

Abrir `lumen_mobile/app/vida/_layout.tsx`. Após o `Stack.Screen name="diario"` (linha ~76), adicionar:

```typescript
      <Stack.Screen
        name="semanal-view"
        options={{
          header: () => <BreadcrumbHeader items={[VIDA, { label: 'Projeto Semanal' }]} />,
          headerShown: true,
        }}
      />
```

- [ ] **Step 3.3: Verificar que a tela compila**

```bash
cd lumen_mobile && npx tsc --noEmit 2>&1 | grep -i "semanal-view\|error" | head -20
```

Esperado: sem erros relacionados a `semanal-view`.

- [ ] **Step 3.4: Commit**

```bash
git add lumen_mobile/app/vida/semanal-view.tsx lumen_mobile/app/vida/_layout.tsx
git commit -m "feat(vida): tela de leitura do Projeto Semanal por dia"
```

---

## Task 4: semanal.tsx — redirect para semanal-view + HorarioInput

**Files:**
- Modify: `lumen_mobile/app/vida/semanal.tsx`

- [ ] **Step 4.1: Trocar redirect pós-save e aplicar HorarioInput**

Em `semanal.tsx`:

**1. Adicionar import do HorarioInput** (após os imports existentes):
```typescript
import { HorarioInput } from '@/components/ui/HorarioInput';
```

**2. Linha 185-188 — trocar redirect após createSemanal:**

Antes:
```typescript
      if (semanalExistente) {
        await projetoVidaMensalApi.updateSemanal(semanalExistente.id, payload);
      } else {
        await projetoVidaMensalApi.createSemanal(projetoId, payload);
      }

      router.replace({ pathname: '/vida/ciclo', params: { projetoId } });
```

Depois:
```typescript
      let semanalIdFinal: string;
      if (semanalExistente) {
        await projetoVidaMensalApi.updateSemanal(semanalExistente.id, payload);
        semanalIdFinal = semanalExistente.id;
      } else {
        const novo = await projetoVidaMensalApi.createSemanal(projetoId, payload);
        semanalIdFinal = novo.id;
      }

      router.replace({
        pathname: '/vida/semanal-view',
        params: { semanalId: semanalIdFinal, projetoId },
      });
```

**3. Linha 371-373 — substituir TextInput de horário por HorarioInput** (dentro do `PRATICAS_VIDA_INTERIOR.map`):

Antes:
```typescript
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
```

Depois:
```typescript
                      <HorarioInput
                        value={pratica.horario}
                        onChange={v => update({ praticas: { ...data.praticas, [key]: { ...pratica, horario: v } } })}
                        placeholder="Horário (ex.: 07:00)"
                      />
```

- [ ] **Step 4.2: Verificar tipos**

```bash
cd lumen_mobile && npx tsc --noEmit 2>&1 | grep "semanal\." | head -10
```

Esperado: sem erros.

- [ ] **Step 4.3: Commit**

```bash
git add lumen_mobile/app/vida/semanal.tsx
git commit -m "feat(vida): semanal redireciona para semanal-view + HorarioInput"
```

---

## Task 5: ciclo.tsx — Ver semana / Editar semana

**Files:**
- Modify: `lumen_mobile/app/vida/ciclo.tsx`

- [ ] **Step 5.1: Substituir o botão único por dois botões**

Em `ciclo.tsx`, localizar o bloco `{/* Acesso ao Projeto Semanal */}` (linhas 315–340).

Substituir **todo o bloco** por:

```tsx
      {/* Acesso ao Projeto Semanal */}
      <View style={{ paddingHorizontal: 20, paddingVertical: 16, flexDirection: 'row', gap: 10 }}>
        <TouchableOpacity
          style={{
            flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
            gap: 6, padding: 14, borderRadius: r.xl,
            backgroundColor: t.brand.primaryDim, borderWidth: 1.5, borderColor: t.brand.primary,
          }}
          onPress={() => router.push({
            pathname: '/vida/semanal-view',
            params: { projetoId },
          })}
          activeOpacity={0.8}
          accessibilityLabel="Ver Projeto Semanal"
          accessibilityRole="button"
        >
          <Ionicons name={'eye-outline' as IoniconsName} size={16} color={t.brand.primary} />
          <Text style={{ fontSize: 14, fontFamily: 'Nunito-Bold', color: t.brand.primary }}>
            Ver semana
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={{
            flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
            gap: 6, padding: 14, borderRadius: r.xl,
            backgroundColor: t.bg.elevated, borderWidth: 1, borderColor: t.border.default,
          }}
          onPress={() => router.push({
            pathname: '/vida/semanal',
            params: {
              projetoId,
              reflexaoEvangelizacao: projeto?.reflexao_evangelizacao ?? '',
            },
          })}
          activeOpacity={0.8}
          accessibilityLabel="Editar Projeto Semanal"
          accessibilityRole="button"
        >
          <Ionicons name={'pencil-outline' as IoniconsName} size={16} color={t.text.secondary} />
          <Text style={{ fontSize: 14, fontFamily: 'Nunito-SemiBold', color: t.text.secondary }}>
            Editar semana
          </Text>
        </TouchableOpacity>
      </View>
```

- [ ] **Step 5.2: Commit**

```bash
git add lumen_mobile/app/vida/ciclo.tsx
git commit -m "feat(vida): ciclo com botões 'Ver semana' e 'Editar semana'"
```

---

## Task 6: diario.tsx — parâmetro `dia` + HorarioInput

**Files:**
- Modify: `lumen_mobile/app/vida/diario.tsx`

- [ ] **Step 6.1: Adicionar import e aceitar param `dia`**

**1. Adicionar import do HorarioInput** após os imports existentes:
```typescript
import { HorarioInput } from '@/components/ui/HorarioInput';
```

**2. Linha 39 — adicionar `dia?` ao useLocalSearchParams:**

Antes:
```typescript
  const { semanalId } = useLocalSearchParams<{ semanalId?: string }>();
```

Depois:
```typescript
  const { semanalId, dia } = useLocalSearchParams<{ semanalId?: string; dia?: string }>();
```

**3. Linha 42 — usar `dia` se presente, senão calcular:**

Antes:
```typescript
  const [diaAtivo, setDiaAtivo] = useState<string>(getDiaSeguinte());
```

Depois:
```typescript
  const DIAS_SEMANA_SET = new Set(['seg', 'ter', 'qua', 'qui', 'sex', 'sab', 'dom']);
  const [diaAtivo, setDiaAtivo] = useState<string>(
    dia && DIAS_SEMANA_SET.has(dia) ? dia : getDiaSeguinte()
  );
```

**4. Linha 181–184 — substituir TextInput de horário_missa por HorarioInput:**

Antes:
```typescript
            <TextInput
              style={inputStyle}
              value={diaData.horario_missa ?? ''}
              onChangeText={v => update({ horario_missa: v || null })}
              placeholder="Horário da Missa (ex.: 07:00)"
              placeholderTextColor={t.text.tertiary}
            />
```

Depois:
```typescript
            <HorarioInput
              value={diaData.horario_missa ?? ''}
              onChange={v => update({ horario_missa: v || null })}
              placeholder="Horário da Missa (ex.: 07:00)"
              style={{ marginBottom: 12 }}
            />
```

- [ ] **Step 6.2: Verificar tipos**

```bash
cd lumen_mobile && npx tsc --noEmit 2>&1 | grep "diario\." | head -10
```

- [ ] **Step 6.3: Commit**

```bash
git add lumen_mobile/app/vida/diario.tsx
git commit -m "feat(vida): diario aceita param dia + HorarioInput em horario_missa"
```

---

## Task 7: wizard.tsx — CalendarPicker + HorarioInput + copy Bom Pastor

**Files:**
- Modify: `lumen_mobile/app/vida/wizard.tsx`

- [ ] **Step 7.1: Adicionar imports**

Após os imports existentes em `wizard.tsx`:
```typescript
import { HorarioInput } from '@/components/ui/HorarioInput';
import { CalendarPicker } from '@/components/ui/CalendarPicker';
```

- [ ] **Step 7.2: Trocar copy do Ministério Bom Pastor**

Localizar linha com (linha ~313):
```typescript
            descricaoOrientadora="Seu serviço e missão apostólica. Liste atividades pastorais, atendimentos e compromissos de serviço que você assume neste mês."
```

Substituir por:
```typescript
            descricaoOrientadora="O Ministério Bom Pastor é o coração apostólico do seu caminho. Registre o dia do seu encontro de acompanhamento — esse compromisso é sagrado. Se você também é acompanhador, registre os dias em que estará presente para os seus acompanhados."
```

- [ ] **Step 7.3: Substituir TextInput de `data` por CalendarPicker em `AreaMensalStep`**

Em `AreaMensalStep` (função a partir de linha ~698), dentro do `areaData.compromissos.map`, localizar:

```typescript
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <TextInput style={[inputStyle, { flex: 1 }]} placeholder="Data" placeholderTextColor={t.text.tertiary}
              value={c.data ?? ''} onChangeText={v => updateCompromisso(idx, { data: v })} />
            <TextInput style={[inputStyle, { flex: 1 }]} placeholder="Horário" placeholderTextColor={t.text.tertiary}
              value={c.horario ?? ''} onChangeText={v => updateCompromisso(idx, { horario: v })} />
          </View>
```

Substituir por:
```typescript
          <View style={{ flexDirection: 'row', gap: 8, marginBottom: 10 }}>
            <View style={{ flex: 1 }}>
              <CalendarPicker
                value={c.data ?? ''}
                onChange={v => updateCompromisso(idx, { data: v })}
                label="Selecionar data"
                mes={Number(data.mes) || undefined}
                ano={Number(data.ano) || undefined}
              />
            </View>
            <View style={{ flex: 1 }}>
              <HorarioInput
                value={c.horario ?? ''}
                onChange={v => updateCompromisso(idx, { horario: v })}
                placeholder="Horário"
              />
            </View>
          </View>
```

Nota: `data.mes` e `data.ano` são strings no estado do wizard (ver `interface WizardData`). `Number('06')` → `6`. Se `mes` for `''`, `Number('')` → `0`, então `|| undefined` garante fallback para mês atual no CalendarPicker.

- [ ] **Step 7.4: Verificar que `data.mes` e `data.ano` existem no estado**

```bash
grep -n "mes:\|ano:\|interface WizardData" lumen_mobile/app/vida/wizard.tsx | head -10
```

Esperado: ambos existem como campos do WizardData (declarados no wizard como strings do mês e ano do ciclo).

- [ ] **Step 7.5: Typecheck**

```bash
cd lumen_mobile && npx tsc --noEmit 2>&1 | grep "wizard\." | head -20
```

Esperado: sem erros.

- [ ] **Step 7.6: Commit**

```bash
git add lumen_mobile/app/vida/wizard.tsx
git commit -m "feat(vida): wizard — CalendarPicker, HorarioInput e copy Bom Pastor"
```

---

## Task 8: profile.tsx — toggle de tema

**Files:**
- Modify: `lumen_mobile/app/(tabs)/profile.tsx`

- [ ] **Step 8.1: Adicionar `isDark`, `setTheme` ao useTheme e inserir seção de aparência**

**1. Localizar a linha com `const { t } = useTheme();`** (~linha 111) e expandir:

```typescript
  const { t, isDark, setTheme } = useTheme();
```

**2. Localizar o bloco `{/* ── Sair ── */}`** (~linha 580) e inserir a seção antes:

```tsx
        {/* ── Aparência ── */}
        <View style={{
          marginHorizontal: 16, marginBottom: 16,
          backgroundColor: t.bg.elevated, borderRadius: 12,
          padding: 16,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: t.border.subtle,
        }}>
          <Text style={{
            fontSize: 13, fontFamily: 'Nunito-Bold', color: t.text.secondary,
            textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 12,
          }}>
            Aparência
          </Text>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <TouchableOpacity
              style={{
                flex: 1, paddingVertical: 12, borderRadius: 10, alignItems: 'center',
                backgroundColor: !isDark ? t.brand.primaryDim : t.bg.surface,
                borderWidth: 1,
                borderColor: !isDark ? t.brand.primary : t.border.subtle,
              }}
              onPress={() => setTheme('light')}
              activeOpacity={0.8}
            >
              <Text style={{
                fontFamily: !isDark ? 'Nunito-Bold' : 'Nunito-Regular',
                fontSize: 14,
                color: !isDark ? t.brand.primary : t.text.secondary,
              }}>
                Claro
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={{
                flex: 1, paddingVertical: 12, borderRadius: 10, alignItems: 'center',
                backgroundColor: isDark ? t.brand.primaryDim : t.bg.surface,
                borderWidth: 1,
                borderColor: isDark ? t.brand.primary : t.border.subtle,
              }}
              onPress={() => setTheme('dark')}
              activeOpacity={0.8}
            >
              <Text style={{
                fontFamily: isDark ? 'Nunito-Bold' : 'Nunito-Regular',
                fontSize: 14,
                color: isDark ? t.brand.primary : t.text.secondary,
              }}>
                Escuro
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* ── Sair ── */}
```

**Atenção:** Verificar se `StyleSheet` já está importado em `profile.tsx`. Se não estiver, adicionar ao import do React Native.

- [ ] **Step 8.2: Typecheck**

```bash
cd lumen_mobile && npx tsc --noEmit 2>&1 | grep "profile\." | head -10
```

Esperado: sem erros.

- [ ] **Step 8.3: Commit**

```bash
git add lumen_mobile/app/(tabs)/profile.tsx
git commit -m "feat(perfil): toggle Dark/Light na seção Aparência"
```

---

## Task 9: Typecheck final e push

- [ ] **Step 9.1: Typecheck completo**

```bash
cd lumen_mobile && npx tsc --noEmit 2>&1 | tail -5
```

Esperado: `0 errors`.

- [ ] **Step 9.2: Push**

```bash
git push origin main
```

Vercel deploya automaticamente após o push.

- [ ] **Step 9.3: Smoke test manual**

Após o deploy (~2 min):

1. Abrir `https://lumenplus.vercel.app`
2. Navegar para `/vida` → abrir ciclo → verificar botões "Ver semana" e "Editar semana"
3. Clicar "Ver semana" → confirmar tela de leitura com chips de dia
4. Trocar dias nos chips → confirmar que práticas e plano_diario mudam
5. Clicar "Planejar este dia" → confirmar que `diario.tsx` abre no dia correto
6. No wizard de ciclo mensal, step "Ministério Bom Pastor" → confirmar novo texto
7. Adicionar compromisso → confirmar que abre CalendarPicker ao clicar no campo de data
8. Navegar pelo calendário com as setas
9. Campo Horário → digitar "730" → confirmar que formata para "07:30"
10. Digitar "2560" → sair do campo → confirmar que limpa e mostra erro
11. Perfil → verificar seção Aparência com botões Claro / Escuro
12. Clicar Escuro → confirmar que o app muda para dark mode e persiste após reload

---

## Self-Review

**Cobertura do spec:**
- [x] Tela semanal-view com chips de dia — Task 3
- [x] Práticas do semanal por dia — Task 3 (seção `praticasHoje`)
- [x] plano_diario por dia — Task 3 (seção `temPlanoDiario`)
- [x] Botão "Planejar este dia" com param `dia` — Tasks 3 e 6
- [x] Enum DiaSemana + getDiaPadrao — Task 3
- [x] diario.tsx aceita param `dia` — Task 6
- [x] Redirect semanal → semanal-view após salvar — Task 4
- [x] ciclo.tsx dois botões Ver/Editar — Task 5
- [x] CalendarPicker sem dependência externa — Task 2
- [x] Datas fora do mês permitidas — CalendarPicker não restringe navegação
- [x] HorarioInput com formatação real-time e validação blur — Task 1
- [x] Casos explícitos de validação cobertos — Task 1 (`horarioValido`)
- [x] HorarioInput aplicado em wizard, semanal, diario — Tasks 4, 6, 7
- [x] Copy Bom Pastor — Task 7
- [x] Toggle tema no Perfil com `setTheme` — Task 8

**Tipos consistentes:**
- `DiaSemana` definido em Task 3, usado em Tasks 3 e 6
- `CalendarPickerProps` definido em Task 2, usado em Task 7
- `HorarioInputProps` definido em Task 1, usado em Tasks 4, 6, 7
- `projetoId` passado como string em todas as navegações
