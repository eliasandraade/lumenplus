/**
 * useAnimations — Spring Physics & Entrance Animations
 * =====================================================
 * Hooks reutilizáveis para animações com react-native-reanimated.
 * SOMENTE visual — zero lógica de negócio.
 *
 * Filosofia: motion com propósito, nunca decorativo.
 * - Entradas: orientam o usuário no espaço
 * - Press: confirmam interatividade
 * - Transições: comunicam mudanças de estado
 */

import { useEffect } from 'react';
import {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  withDelay,
  Easing,
  interpolate,
  Extrapolation,
} from 'react-native-reanimated';

// ── Spring configs ─────────────────────────────────────────────────────────────

export const SPRING = {
  /** Cards, modais — movimento natural e gentil */
  gentle: { damping: 20, stiffness: 150, mass: 1 },
  /** Botões, tabs — resposta rápida e satisfatória */
  snappy: { damping: 15, stiffness: 280, mass: 0.8 },
  /** Overlays, drawers — entrada lenta e deliberada */
  slow:   { damping: 28, stiffness: 80,  mass: 1.2 },
  /** Bounce sutil — nunca exagerado */
  bounce: { damping: 12, stiffness: 200, mass: 0.9 },
} as const;

// ── Timing configs ─────────────────────────────────────────────────────────────

export const TIMING = {
  fast:   { duration: 150, easing: Easing.out(Easing.cubic) },
  normal: { duration: 250, easing: Easing.out(Easing.quad) },
  slow:   { duration: 400, easing: Easing.out(Easing.cubic) },
} as const;

// ── Stagger delay helper ───────────────────────────────────────────────────────

/**
 * Retorna delay em ms para stagger de listas.
 * Máx de maxIndex itens para não atrasar demais listas longas.
 */
export function staggerDelay(index: number, step = 55, maxIndex = 6): number {
  return Math.min(index, maxIndex) * step;
}

// ── Hook: pressable scale ──────────────────────────────────────────────────────

/**
 * Feedback de press com scale spring.
 * Aplique `style` no elemento animado e passe `onPressIn`/`onPressOut` ao Pressable.
 */
export function usePressableScale(scaleTo = 0.95) {
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const onPressIn = () => {
    scale.value = withSpring(scaleTo, SPRING.snappy);
  };

  const onPressOut = () => {
    scale.value = withSpring(1, SPRING.snappy);
  };

  return { animatedStyle, onPressIn, onPressOut };
}

// ── Hook: fade + slide de entrada ─────────────────────────────────────────────

/**
 * Animação de entrada: fade + translateY para baixo→cima.
 * @param delay Atraso em ms (use staggerDelay para listas)
 * @param distance Distância de deslocamento inicial em px
 */
export function useEntranceAnimation(delay = 0, distance = 14) {
  const opacity    = useSharedValue(0);
  const translateY = useSharedValue(distance);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }],
  }));

  useEffect(() => {
    opacity.value    = withDelay(delay, withTiming(1,         TIMING.normal));
    translateY.value = withDelay(delay, withSpring(0, SPRING.gentle));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [delay]);

  return animatedStyle;
}

// ── Hook: fade simples ────────────────────────────────────────────────────────

export function useFadeIn(delay = 0) {
  const opacity = useSharedValue(0);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  useEffect(() => {
    opacity.value = withDelay(delay, withTiming(1, TIMING.normal));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [delay]);

  return animatedStyle;
}

// ── Hook: scale de montagem ────────────────────────────────────────────────────

/**
 * Elemento monta com scale 0.88 → 1, util para cards e modais.
 */
export function useMountScale(delay = 0) {
  const scale   = useSharedValue(0.88);
  const opacity = useSharedValue(0);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ scale: scale.value }],
  }));

  useEffect(() => {
    scale.value   = withDelay(delay, withSpring(1,   SPRING.gentle));
    opacity.value = withDelay(delay, withTiming(1,   TIMING.normal));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [delay]);

  return animatedStyle;
}

// ── Hook: progresso animado ────────────────────────────────────────────────────

/**
 * Anima um valor de progresso de 0 a `progress` com spring.
 * Útil para progress bars, indicadores de passo.
 */
export function useProgressAnimation(progress: number) {
  const animatedProgress = useSharedValue(0);

  useEffect(() => {
    animatedProgress.value = withSpring(progress, SPRING.gentle);
  }, [progress]);

  const widthStyle = (totalWidth: number) =>
    useAnimatedStyle(() => ({
      width: interpolate(
        animatedProgress.value,
        [0, 1],
        [0, totalWidth],
        Extrapolation.CLAMP,
      ),
    }));

  return { animatedProgress, widthStyle };
}

// ── Hook: shimmer skeleton ────────────────────────────────────────────────────

/**
 * Animação de shimmer para skeleton loaders.
 * Retorna valor animado de 0→1 em loop.
 */
export function useShimmer() {
  const progress = useSharedValue(0);

  useEffect(() => {
    const animate = () => {
      progress.value = withTiming(1, { duration: 1000, easing: Easing.linear }, () => {
        progress.value = 0;
        animate();
      });
    };
    animate();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return progress;
}
