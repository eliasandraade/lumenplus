/**
 * BreadcrumbHeader — redesenhado com dark mode + Nunito
 * API 100% retrocompatível.
 */

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { Href } from 'expo-router';
import { useTheme } from '@/theme';

export interface BreadcrumbItem {
  label: string;
  href?: Href;
}

interface Props {
  items: BreadcrumbItem[];
  right?: React.ReactNode;
}

export function BreadcrumbHeader({ items, right }: Props) {
  const insets = useSafeAreaInsets();
  const { t } = useTheme();

  return (
    <View
      style={[
        styles.wrapper,
        {
          backgroundColor: t.bg.elevated,
          borderBottomColor: t.border.subtle,
          paddingTop: insets.top,
        },
        Platform.select({
          web: { boxShadow: '0 1px 3px rgba(0,0,0,0.06)' } as any,
          default: t.shadow.sm,
        }),
      ]}
    >
      <View style={styles.row}>
        <TouchableOpacity
          onPress={() => (router.canGoBack() ? router.back() : router.replace('/(tabs)/home' as Href))}
          style={[styles.backBtn, { backgroundColor: t.bg.surface }]}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons name="chevron-back" size={20} color={t.text.secondary} />
        </TouchableOpacity>

        <View style={styles.crumbs}>
          <TouchableOpacity
            onPress={() => router.replace('/(tabs)/home' as Href)}
            hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
          >
            <Ionicons name="home" size={15} color={t.text.link} />
          </TouchableOpacity>

          {items.map((item, i) => (
            <View key={i} style={styles.item}>
              <Ionicons name="chevron-forward" size={12} color={t.text.tertiary} style={styles.sep} />
              {item.href ? (
                <TouchableOpacity onPress={() => router.push(item.href!)}>
                  <Text style={[styles.link, { color: t.text.link }]} numberOfLines={1}>
                    {item.label}
                  </Text>
                </TouchableOpacity>
              ) : (
                <Text style={[styles.current, { color: t.text.primary }]} numberOfLines={1}>
                  {item.label}
                </Text>
              )}
            </View>
          ))}
        </View>

        {right ? <View style={styles.right}>{right}</View> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    borderBottomWidth: 1,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 10,
    gap: 4,
  },
  backBtn: {
    padding: 4,
    borderRadius: 6,
  },
  right: {
    marginLeft: 'auto',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  crumbs: {
    flexDirection: 'row',
    alignItems: 'center',
    flexShrink: 1,
    flexWrap: 'nowrap',
    overflow: 'hidden',
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  sep: {
    marginHorizontal: 3,
  },
  link: {
    fontSize: 13,
    fontFamily: 'Nunito-SemiBold',
  },
  current: {
    fontSize: 13,
    fontFamily: 'Nunito-SemiBold',
  },
});
