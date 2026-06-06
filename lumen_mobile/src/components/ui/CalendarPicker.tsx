import { useState, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, Modal, StyleSheet,
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
  const [curMes, setCurMes] = useState(() => {
    const parsed = parseDDMMYYYY(value);
    if (parsed) return parsed.getMonth();
    return mes ? mes - 1 : hoje.getMonth();
  });
  const [curAno, setCurAno] = useState(() => {
    const parsed = parseDDMMYYYY(value);
    if (parsed) return parsed.getFullYear();
    return ano ?? hoje.getFullYear();
  });

  useEffect(() => {
    if (typeof document === 'undefined' || !open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open]);

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
        style={[
          styles.trigger,
          {
            backgroundColor: t.bg.surface,
            borderRadius: r.md,
            borderColor: t.border.subtle,
          },
        ]}
        onPress={() => setOpen(true)}
        activeOpacity={0.7}
      >
        <Ionicons name="calendar-outline" size={16} color={value ? t.text.primary : t.text.tertiary} style={{ marginRight: 8 }} />
        <Text style={[styles.triggerText, { color: value ? t.text.primary : t.text.tertiary }]}>
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
          style={styles.overlay}
          activeOpacity={1}
          onPress={() => setOpen(false)}
        >
          <TouchableOpacity activeOpacity={1} onPress={() => {}}>
            <View style={[styles.modal, { backgroundColor: t.bg.elevated, borderRadius: r.xl }]}>
              {/* Cabeçalho de navegação */}
              <View style={styles.navRow}>
                <TouchableOpacity onPress={prevMes} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <Ionicons name="chevron-back" size={22} color={t.brand.primary} />
                </TouchableOpacity>
                <Text style={[styles.monthLabel, { color: t.text.primary }]}>
                  {MESES_PT[curMes]} {curAno}
                </Text>
                <TouchableOpacity onPress={nextMes} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <Ionicons name="chevron-forward" size={22} color={t.brand.primary} />
                </TouchableOpacity>
              </View>

              {/* Labels de dia da semana */}
              <View style={styles.weekRow}>
                {DIAS_SEMANA_LABELS.map(d => (
                  <Text key={d} style={[styles.weekLabel, { color: t.text.tertiary }]}>{d}</Text>
                ))}
              </View>

              {/* Grade de dias */}
              {Array.from({ length: cells.length / 7 }, (_, row) => (
                <View key={row} style={styles.gridRow}>
                  {cells.slice(row * 7, row * 7 + 7).map((day, col) => (
                    <TouchableOpacity
                      key={col}
                      style={[
                        styles.dayCell,
                        day && isSelected(day)
                          ? { backgroundColor: t.brand.primary }
                          : null,
                        day && isHoje(day) && !isSelected(day)
                          ? { borderWidth: 1, borderColor: t.brand.primary }
                          : null,
                        !day ? { opacity: 0 } : null,
                      ]}
                      onPress={() => day && selectDay(day)}
                      disabled={!day}
                      activeOpacity={0.7}
                    >
                      <Text style={[
                        styles.dayText,
                        {
                          fontFamily: day && isSelected(day) ? 'Nunito-Bold' : 'Nunito-Regular',
                          color: day && isSelected(day) ? '#ffffff' : t.text.primary,
                        },
                      ]}>
                        {day ?? ''}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              ))}

              {/* Botão cancelar */}
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => setOpen(false)}
              >
                <Text style={[styles.cancelText, { color: t.text.secondary }]}>
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

const styles = StyleSheet.create({
  trigger: {
    borderWidth: StyleSheet.hairlineWidth,
    padding: 12,
    minHeight: 48,
    justifyContent: 'center',
    flexDirection: 'row',
    alignItems: 'center',
  },
  triggerText: {
    flex: 1,
    fontSize: 15,
    fontFamily: 'Nunito-Regular',
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modal: {
    padding: 20,
    width: 320,
  },
  navRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  monthLabel: {
    fontSize: 15,
    fontFamily: 'Nunito-Bold',
  },
  weekRow: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  weekLabel: {
    flex: 1,
    textAlign: 'center',
    fontSize: 11,
    fontFamily: 'Nunito-Bold',
  },
  gridRow: {
    flexDirection: 'row',
    marginBottom: 4,
  },
  dayCell: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    height: 36,
    borderRadius: 18,
  },
  dayText: {
    fontSize: 14,
  },
  cancelBtn: {
    marginTop: 12,
    alignItems: 'center',
    padding: 8,
  },
  cancelText: {
    fontSize: 14,
    fontFamily: 'Nunito-SemiBold',
  },
});
