/**
 * Loading Component — redesenhado com dark mode
 * API 100% retrocompatível.
 */

import React from 'react';
import { View, ActivityIndicator, Text, StyleSheet } from 'react-native';
import { useTheme } from '@/theme';

interface LoadingProps {
  message?: string;
  fullScreen?: boolean;
}

export function Loading({ message, fullScreen = false }: LoadingProps) {
  const { t } = useTheme();

  const content = (
    <View style={styles.container}>
      <ActivityIndicator size="large" color={t.brand.primary} />
      {message && (
        <Text style={[styles.message, { color: t.text.secondary }]}>
          {message}
        </Text>
      )}
    </View>
  );

  if (fullScreen) {
    return (
      <View style={[styles.fullScreen, { backgroundColor: t.bg.screen }]}>
        {content}
      </View>
    );
  }

  return content;
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  fullScreen: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  message: {
    marginTop: 16,
    fontSize: 15,
    fontFamily: 'Nunito-Regular',
  },
});
