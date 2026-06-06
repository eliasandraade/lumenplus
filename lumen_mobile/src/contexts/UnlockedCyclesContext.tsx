import { createContext, useContext, useRef, useCallback, useEffect, type ReactNode } from 'react';
import { AppState, type AppStateStatus } from 'react-native';

const UNLOCK_TTL_MS = 15 * 60 * 1000; // 15 minutos

interface UnlockEntry {
  unlockedAt: number;
}

interface UnlockedCyclesContextValue {
  isUnlocked: (projetoId: string) => boolean;
  markUnlocked: (projetoId: string) => void;
  clearAll: () => void;
}

const UnlockedCyclesContext = createContext<UnlockedCyclesContextValue | null>(null);

export function UnlockedCyclesProvider({ children }: { children: ReactNode }) {
  const mapRef = useRef<Map<string, UnlockEntry>>(new Map());
  const backgroundEnteredAt = useRef<number | null>(null);

  // Invalida o contexto quando o app fica em background por mais de TTL.
  // useEffect + cleanup garante um único listener por montagem do provider.
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state: AppStateStatus) => {
      if (state === 'background' || state === 'inactive') {
        backgroundEnteredAt.current = Date.now();
      } else if (state === 'active' && backgroundEnteredAt.current !== null) {
        const elapsed = Date.now() - backgroundEnteredAt.current;
        if (elapsed >= UNLOCK_TTL_MS) {
          mapRef.current.clear();
        }
        backgroundEnteredAt.current = null;
      }
    });
    return () => subscription.remove();
  }, []);

  const isUnlocked = useCallback((projetoId: string): boolean => {
    const entry = mapRef.current.get(projetoId);
    if (!entry) return false;
    return Date.now() - entry.unlockedAt < UNLOCK_TTL_MS;
  }, []);

  const markUnlocked = useCallback((projetoId: string): void => {
    mapRef.current.set(projetoId, { unlockedAt: Date.now() });
  }, []);

  const clearAll = useCallback((): void => {
    mapRef.current.clear();
  }, []);

  return (
    <UnlockedCyclesContext.Provider value={{ isUnlocked, markUnlocked, clearAll }}>
      {children}
    </UnlockedCyclesContext.Provider>
  );
}

export function useUnlockedCycles(): UnlockedCyclesContextValue {
  const ctx = useContext(UnlockedCyclesContext);
  if (!ctx) throw new Error('useUnlockedCycles must be used within UnlockedCyclesProvider');
  return ctx;
}
