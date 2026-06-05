/**
 * Input Component — redesenhado com dark mode + Nunito
 * API 100% retrocompatível.
 */

import React, { useState } from 'react';
import {
  View,
  TextInput,
  Text,
  StyleSheet,
  TextInputProps,
  TouchableOpacity,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/theme';

interface InputProps extends TextInputProps {
  label?: string;
  error?: string;
  hint?: string;
  leftIcon?: keyof typeof Ionicons.glyphMap;
  rightIcon?: keyof typeof Ionicons.glyphMap;
  onRightIconPress?: () => void;
}

export function Input({
  label,
  error,
  hint,
  leftIcon,
  rightIcon,
  onRightIconPress,
  secureTextEntry,
  style,
  ...props
}: InputProps) {
  const { t, r } = useTheme();
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const [isFocused, setIsFocused] = useState(false);

  const showPasswordToggle = secureTextEntry !== undefined;
  const actualSecureEntry = secureTextEntry && !isPasswordVisible;

  const borderColor = error
    ? t.status.error
    : isFocused
    ? t.border.focus
    : t.border.subtle;

  return (
    <View style={styles.container}>
      {label && (
        <Text style={[styles.label, { color: t.text.primary }]}>
          {label}
        </Text>
      )}

      <View
        style={[
          styles.inputContainer,
          {
            backgroundColor: isFocused ? t.bg.elevated : t.bg.surface,
            borderRadius: r.lg,
            borderColor,
          },
        ]}
      >
        {leftIcon && (
          <Ionicons
            name={leftIcon}
            size={20}
            color={t.text.tertiary}
            style={styles.leftIcon}
          />
        )}

        <TextInput
          style={[styles.input, { color: t.text.primary }, style]}
          placeholderTextColor={t.text.tertiary}
          secureTextEntry={actualSecureEntry}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          {...props}
        />

        {showPasswordToggle && (
          <TouchableOpacity
            onPress={() => setIsPasswordVisible(!isPasswordVisible)}
            style={styles.rightIcon}
          >
            <Ionicons
              name={isPasswordVisible ? 'eye-off-outline' : 'eye-outline'}
              size={20}
              color={t.text.tertiary}
            />
          </TouchableOpacity>
        )}

        {rightIcon && !showPasswordToggle && (
          <TouchableOpacity
            onPress={onRightIconPress}
            style={styles.rightIcon}
            disabled={!onRightIconPress}
          >
            <Ionicons
              name={rightIcon}
              size={20}
              color={t.text.tertiary}
            />
          </TouchableOpacity>
        )}
      </View>

      {error && (
        <Text style={[styles.hint, { color: t.status.error }]}>
          {error}
        </Text>
      )}
      {hint && !error && (
        <Text style={[styles.hint, { color: t.text.tertiary }]}>
          {hint}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 16,
  },
  label: {
    fontSize: 13,
    fontFamily: 'Nunito-SemiBold',
    marginBottom: 4,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
  },
  input: {
    flex: 1,
    paddingVertical: 13,
    paddingHorizontal: 14,
    fontSize: 15,
    fontFamily: 'Nunito-Regular',
  },
  leftIcon: {
    marginLeft: 14,
  },
  rightIcon: {
    padding: 14,
  },
  hint: {
    fontSize: 12,
    fontFamily: 'Nunito-Regular',
    marginTop: 4,
  },
});
