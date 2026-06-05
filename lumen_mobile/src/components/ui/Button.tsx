/**
 * Button Component — redesenhado com Nunito + spring press + dark mode
 * =====================================================================
 * API 100% retrocompatível com a versão anterior.
 * SOMENTE visual — nenhuma lógica alterada.
 */

import React from 'react';
import {
  Pressable,
  Text,
  ActivityIndicator,
  ViewStyle,
  TextStyle,
  StyleSheet,
} from 'react-native';
import Animated from 'react-native-reanimated';
import { useTheme } from '@/theme';
import { usePressableScale } from '@/hooks/useAnimations';

interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  disabled?: boolean;
  loading?: boolean;
  fullWidth?: boolean;
  style?: ViewStyle;
  textStyle?: TextStyle;
  icon?: React.ReactNode;
}

export function Button({
  title,
  onPress,
  variant = 'primary',
  size = 'md',
  disabled = false,
  loading = false,
  fullWidth = false,
  style,
  textStyle,
  icon,
}: ButtonProps) {
  const { t } = useTheme();
  const isDisabled = disabled || loading;
  const { animatedStyle, onPressIn, onPressOut } = usePressableScale(0.96);

  // Cores dinâmicas por variante
  const variantStyles = {
    primary: {
      bg:           t.brand.primary,
      bgPressed:    t.brand.primary,
      text:         '#ffffff',
      border:       'transparent',
    },
    secondary: {
      bg:           t.brand.secondaryDim,
      bgPressed:    t.brand.secondaryDim,
      text:         t.brand.secondary,
      border:       'transparent',
    },
    outline: {
      bg:           'transparent',
      bgPressed:    t.brand.primaryDim,
      text:         t.brand.primary,
      border:       t.brand.primary,
    },
    ghost: {
      bg:           'transparent',
      bgPressed:    t.brand.primaryDim,
      text:         t.brand.primary,
      border:       'transparent',
    },
    danger: {
      bg:           t.status.errorBg,
      bgPressed:    t.status.errorBg,
      text:         t.status.error,
      border:       'transparent',
    },
  }[variant];

  const sizeStyles = {
    sm: { paddingVertical: 8,  paddingHorizontal: 14, fontSize: 13, minHeight: 36 },
    md: { paddingVertical: 13, paddingHorizontal: 20, fontSize: 15, minHeight: 48 },
    lg: { paddingVertical: 16, paddingHorizontal: 28, fontSize: 17, minHeight: 56 },
  }[size];

  return (
    <Animated.View style={[animatedStyle, fullWidth && { width: '100%' }, style]}>
      <Pressable
        onPress={onPress}
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        disabled={isDisabled}
        style={[
          styles.base,
          {
            backgroundColor:  variantStyles.bg,
            borderColor:      variantStyles.border,
            borderWidth:      variant === 'outline' ? 1.5 : 0,
            paddingVertical:  sizeStyles.paddingVertical,
            paddingHorizontal: sizeStyles.paddingHorizontal,
            minHeight:        sizeStyles.minHeight,
            opacity:          isDisabled ? 0.48 : 1,
          },
        ]}
      >
        {loading ? (
          <ActivityIndicator
            color={variant === 'primary' || variant === 'danger' ? '#ffffff' : t.brand.primary}
            size="small"
          />
        ) : (
          <>
            {icon && <>{icon}</>}
            <Text
              style={[
                styles.text,
                {
                  color:      variantStyles.text,
                  fontSize:   sizeStyles.fontSize,
                  fontFamily: 'Nunito-SemiBold',
                  marginLeft: icon ? 6 : 0,
                },
                textStyle,
              ]}
            >
              {title}
            </Text>
          </>
        )}
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  base: {
    flexDirection:  'row',
    alignItems:     'center',
    justifyContent: 'center',
    borderRadius:   14,
    overflow:       'hidden',
  },
  text: {
    letterSpacing: 0.1,
  },
});
