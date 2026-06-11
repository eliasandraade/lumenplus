/**
 * Cross-platform Alerts
 * ======================
 * `Alert.alert` do react-native-web é um no-op (`static alert() {}`), então
 * na web confirmações e mensagens baseadas em `Alert.alert` não funcionam.
 *
 * Este wrapper unifica o comportamento:
 *   - Mobile (iOS/Android): usa `Alert.alert` nativo.
 *   - Web: usa `window.alert` / `window.confirm` (fallback simples — RC).
 *
 * Objetivo do RC: funcionalidade e feedback corretos em ambos os alvos,
 * sem introduzir um sistema visual novo de toast/modal.
 */

import { Alert, Platform } from 'react-native';

/**
 * Alerta informativo (1 botão "OK").
 * Web: `window.alert`; nativo: `Alert.alert`.
 * `onClose` roda após o usuário fechar (ou imediatamente após o alert na web).
 */
export function showAlert(title: string, message?: string, onClose?: () => void): void {
  if (Platform.OS === 'web') {
    window.alert([title, message].filter(Boolean).join('\n\n'));
    onClose?.();
    return;
  }
  Alert.alert(title, message, onClose ? [{ text: 'OK', onPress: onClose }] : undefined);
}

export interface ConfirmOptions {
  title: string;
  message?: string;
  /** Texto do botão de confirmação. Default: 'Confirmar'. */
  confirmText?: string;
  /** Texto do botão de cancelar. Default: 'Cancelar'. */
  cancelText?: string;
  /** Estilo destrutivo do botão de confirmação (apenas nativo). */
  destructive?: boolean;
  onConfirm?: () => void | Promise<void>;
  onCancel?: () => void;
}

/**
 * Confirmação (2 botões). Retorna `true` se confirmado, `false` se cancelado.
 * Web: `window.confirm`; nativo: `Alert.alert` com dois botões.
 * A ação de confirmação (`onConfirm`) executa corretamente em ambos os alvos.
 */
export function showConfirm(opts: ConfirmOptions): Promise<boolean> {
  const {
    title,
    message,
    confirmText = 'Confirmar',
    cancelText = 'Cancelar',
    destructive,
    onConfirm,
    onCancel,
  } = opts;

  if (Platform.OS === 'web') {
    const ok = window.confirm([title, message].filter(Boolean).join('\n\n'));
    if (ok) {
      return Promise.resolve(onConfirm?.()).then(() => true);
    }
    onCancel?.();
    return Promise.resolve(false);
  }

  return new Promise<boolean>((resolve) => {
    Alert.alert(title, message, [
      {
        text: cancelText,
        style: 'cancel',
        onPress: () => {
          onCancel?.();
          resolve(false);
        },
      },
      {
        text: confirmText,
        style: destructive ? 'destructive' : 'default',
        onPress: async () => {
          await onConfirm?.();
          resolve(true);
        },
      },
    ]);
  });
}
