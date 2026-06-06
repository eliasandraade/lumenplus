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
