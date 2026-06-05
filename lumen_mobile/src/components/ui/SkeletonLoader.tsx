/**
 * SkeletonLoader
 * ==============
 * Placeholder animado (shimmer) para estados de carregamento.
 * Sem dependências externas — usa Reanimated puro.
 * SOMENTE visual.
 */

import React from 'react';
import { View, ViewStyle, StyleSheet } from 'react-native';
import Animated, { useAnimatedStyle, interpolateColor } from 'react-native-reanimated';
import { useShimmer } from '@/hooks/useAnimations';
import { useTheme } from '@/theme';

interface SkeletonProps {
  width?: number | `${number}%`;
  height?: number;
  borderRadius?: number;
  style?: ViewStyle;
}

export function Skeleton({ width = '100%', height = 16, borderRadius = 8, style }: SkeletonProps) {
  const { t, isDark } = useTheme();
  const progress = useShimmer();

  const baseColor    = isDark ? t.bg.elevated  : '#e8edf2';
  const shimmerColor = isDark ? t.bg.surface   : '#f0f4f8';

  const animatedStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(
      progress.value,
      [0, 0.5, 1],
      [baseColor, shimmerColor, baseColor],
    ),
  }));

  return (
    <Animated.View
      style={[
        animatedStyle,
        { width, height, borderRadius },
        style,
      ]}
    />
  );
}

// Preset: linha de texto
export function SkeletonText({ lines = 2, style }: { lines?: number; style?: ViewStyle }) {
  return (
    <View style={[{ gap: 8 }, style]}>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton
          key={i}
          width={i === lines - 1 && lines > 1 ? '65%' : '100%'}
          height={14}
          borderRadius={7}
        />
      ))}
    </View>
  );
}

// Preset: card completo
export function SkeletonCard({ style }: { style?: ViewStyle }) {
  const { t } = useTheme();
  return (
    <View style={[styles.card, { backgroundColor: t.bg.elevated }, style]}>
      <View style={styles.cardHeader}>
        <Skeleton width={40} height={40} borderRadius={20} />
        <View style={{ flex: 1, gap: 6 }}>
          <Skeleton height={14} borderRadius={7} width="60%" />
          <Skeleton height={11} borderRadius={6} width="40%" />
        </View>
      </View>
      <SkeletonText lines={3} style={{ marginTop: 12 }} />
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: 16,
    borderRadius: 14,
    gap: 0,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
});
