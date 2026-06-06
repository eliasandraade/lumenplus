// lumen_mobile/src/components/ui/HorarioInput.tsx
import { useState, useEffect } from 'react';
import { View, TextInput, Text, StyleSheet } from 'react-native';
import type { StyleProp, TextStyle } from 'react-native';
import { useTheme } from '@/theme';

export function formatarHorario(raw: string): string {
  const digits = raw.replace(/\D/g, '').slice(0, 4);
  if (digits.length <= 2) return digits;
  return `${digits.slice(0, 2)}:${digits.slice(2)}`;
}

export function horarioValido(v: string): boolean {
  if (v === '') return true;
  if (!/^\d{2}:\d{2}$/.test(v)) return false;
  const [h, m] = v.split(':').map(Number);
  return h >= 0 && h <= 23 && m >= 0 && m <= 59;
}

interface HorarioInputProps {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  style?: StyleProp<TextStyle>;
}

export function HorarioInput({ value, onChange, placeholder = 'HH:MM', style }: HorarioInputProps) {
  const { t, r } = useTheme();
  const [erro, setErro] = useState(false);
  const [isFocused, setIsFocused] = useState(false);

  useEffect(() => {
    if (value === '') setErro(false);
  }, [value]);

  const handleChange = (raw: string) => {
    setErro(false);
    onChange(formatarHorario(raw));
  };

  const handleBlur = () => {
    setIsFocused(false);
    if (!horarioValido(value)) {
      setErro(true);
      onChange('');
    }
  };

  const borderColor = erro ? t.status.error : isFocused ? t.border.focus : t.border.subtle;

  return (
    <View>
      <TextInput
        style={[
          styles.input,
          {
            backgroundColor: t.bg.surface,
            borderRadius: r.md,
            borderColor,
            color: t.text.primary,
          },
          style,
        ]}
        value={value}
        onChangeText={handleChange}
        onFocus={() => setIsFocused(true)}
        onBlur={handleBlur}
        placeholder={placeholder}
        placeholderTextColor={t.text.tertiary}
        keyboardType="numeric"
        maxLength={5}
      />
      {erro && (
        <Text style={[styles.errorText, { color: t.status.error }]}>
          Horário inválido — use o formato HH:MM (ex.: 07:30)
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  input: {
    borderWidth: StyleSheet.hairlineWidth,
    padding: 12,
    fontSize: 15,
    fontFamily: 'Nunito-Regular',
    minHeight: 48,
  },
  errorText: {
    fontSize: 11,
    fontFamily: 'Nunito-Regular',
    marginTop: 3,
  },
});
