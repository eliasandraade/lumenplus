// lumen_mobile/src/services/push.ts
import api from './api';

const AsyncStorage = () => require('@react-native-async-storage/async-storage').default;

const PUSH_DECISION_KEY = 'lumen_push_decision';

export async function getPushDecision(): Promise<string | null> {
  return AsyncStorage().getItem(PUSH_DECISION_KEY);
}

export async function savePushDecision(decision: 'granted' | 'denied' | 'later'): Promise<void> {
  return AsyncStorage().setItem(PUSH_DECISION_KEY, decision);
}

export async function registerPushSubscription(): Promise<boolean> {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    return false;
  }

  let vapidPublicKey: string;
  try {
    const res = await api.get<{ public_key: string }>('/push/vapid-public-key');
    vapidPublicKey = res.public_key;
  } catch {
    return false;
  }

  const registration = await navigator.serviceWorker.register('/sw.js');
  await navigator.serviceWorker.ready;

  const subscription = await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
  });

  const { endpoint, keys } = subscription.toJSON() as {
    endpoint: string;
    keys: { p256dh: string; auth: string };
  };

  await api.post('/push/subscribe', {
    endpoint,
    p256dh: keys.p256dh,
    auth: keys.auth,
    user_agent: navigator.userAgent,
  });

  await savePushDecision('granted');
  return true;
}

export async function requestAndRegisterPush(): Promise<'granted' | 'denied' | 'error'> {
  try {
    const permission = await Notification.requestPermission();
    if (permission === 'granted') {
      const ok = await registerPushSubscription();
      return ok ? 'granted' : 'error';
    }
    await savePushDecision('denied');
    return 'denied';
  } catch {
    return 'error';
  }
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)));
}
