// lumen_mobile/src/components/ui/CustomTabBar.tsx
import React, { useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/theme';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';

const TAB_HEIGHT = 62;
const PILL_SPRING = { damping: 20, stiffness: 260, overshootClamping: true };

export function CustomTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const { t, r } = useTheme();
  const insets = useSafeAreaInsets();
  const tabCount = state.routes.length;

  const [tabWidth, setTabWidth] = React.useState(0);
  const pillX = useSharedValue(0);

  useEffect(() => {
    if (tabWidth === 0) return;
    pillX.value = withSpring(state.index * tabWidth, PILL_SPRING);
  }, [state.index, tabWidth]);

  const pillStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: pillX.value }],
  }));

  const bottomPadding = insets.bottom > 0 ? insets.bottom : 8;

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: t.bg.elevated,
          borderTopColor: t.border.subtle,
          paddingBottom: bottomPadding,
          height: TAB_HEIGHT + bottomPadding,
          ...t.shadow.sm,
        },
      ]}
      onLayout={(e) => {
        const w = e.nativeEvent.layout.width / tabCount;
        setTabWidth(w);
        pillX.value = state.index * w;
      }}
    >
      {tabWidth > 0 && (
        <Animated.View
          style={[
            styles.pill,
            pillStyle,
            {
              width: tabWidth - 16,
              marginHorizontal: 8,
              backgroundColor: t.brand.primary,
              borderRadius: r.xl,
              height: TAB_HEIGHT - 16,
              top: 8,
            },
          ]}
        />
      )}

      <View style={styles.tabs}>
        {state.routes.map((route, index) => {
          const { options } = descriptors[route.key];
          const label = (options.tabBarLabel as string) ?? options.title ?? route.name;
          const isFocused = state.index === index;

          const iconColor = isFocused ? '#ffffff' : t.text.tertiary;
          const textColor = isFocused ? '#ffffff' : t.text.tertiary;

          const iconName = getIconName(route.name, isFocused);

          const onPress = () => {
            const event = navigation.emit({
              type: 'tabPress',
              target: route.key,
              canPreventDefault: true,
            });
            if (!isFocused && !event.defaultPrevented) {
              navigation.navigate(route.name);
            }
          };

          return (
            <TouchableOpacity
              key={route.key}
              accessibilityRole="button"
              accessibilityState={isFocused ? { selected: true } : {}}
              accessibilityLabel={label}
              onPress={onPress}
              style={styles.tab}
            >
              <Ionicons name={iconName} size={22} color={iconColor} />
              <Text
                style={[styles.label, { color: textColor }]}
                numberOfLines={1}
              >
                {label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

function getIconName(
  routeName: string,
  focused: boolean,
): React.ComponentProps<typeof Ionicons>['name'] {
  const map: Record<string, [string, string]> = {
    service:   ['book',    'book-outline'],
    community: ['people',  'people-outline'],
    home:      ['home',    'home-outline'],
    invites:   ['mail',    'mail-outline'],
    profile:   ['person',  'person-outline'],
  };
  const [active, inactive] = map[routeName] ?? ['ellipse', 'ellipse-outline'];
  return (focused ? active : inactive) as React.ComponentProps<typeof Ionicons>['name'];
}

const styles = StyleSheet.create({
  container: {
    position: 'relative',
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  pill: {
    position: 'absolute',
    zIndex: 0,
  },
  tabs: {
    flexDirection: 'row',
    height: TAB_HEIGHT,
    zIndex: 1,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
  },
  label: {
    fontSize: 10,
    fontFamily: 'Nunito-SemiBold',
  },
});
