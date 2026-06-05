/**
 * PressableScale
 * ==============
 * Wrapper Pressable com feedback de scale spring.
 * Substitui TouchableOpacity em toda a aplicação nova.
 * SOMENTE visual — zero lógica.
 */

import React from 'react';
import { Pressable, PressableProps, ViewStyle } from 'react-native';
import Animated from 'react-native-reanimated';
import { usePressableScale } from '@/hooks/useAnimations';

interface PressableScaleProps extends PressableProps {
  children: React.ReactNode;
  style?: ViewStyle | ViewStyle[];
  scaleTo?: number;
}

export function PressableScale({
  children,
  style,
  scaleTo = 0.96,
  onPress,
  disabled,
  ...rest
}: PressableScaleProps) {
  const { animatedStyle, onPressIn, onPressOut } = usePressableScale(scaleTo);

  return (
    <Animated.View style={[animatedStyle, style as ViewStyle]}>
      <Pressable
        onPress={onPress}
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        disabled={disabled}
        style={{ flex: 1 }}
        {...rest}
      >
        {children}
      </Pressable>
    </Animated.View>
  );
}
