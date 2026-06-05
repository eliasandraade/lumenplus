/**
 * Card Component — redesenhado com dark mode
 * API 100% retrocompatível.
 */

import React from 'react';
import { View, ViewStyle } from 'react-native';
import { useTheme } from '@/theme';

interface CardProps {
  children: React.ReactNode;
  style?: ViewStyle;
  variant?: 'elevated' | 'outlined' | 'filled';
}

export function Card({ children, style, variant = 'elevated' }: CardProps) {
  const { t, r } = useTheme();

  const variantStyle: ViewStyle = (() => {
    switch (variant) {
      case 'elevated':
        return {
          backgroundColor: t.bg.elevated,
          ...t.shadow.md,
        };
      case 'outlined':
        return {
          backgroundColor: t.bg.elevated,
          borderWidth: 1,
          borderColor: t.border.subtle,
        };
      case 'filled':
        return {
          backgroundColor: t.bg.surface,
        };
    }
  })();

  return (
    <View
      style={[
        {
          borderRadius: r.lg,
          padding: 16,
        },
        variantStyle,
        style,
      ]}
    >
      {children}
    </View>
  );
}
