import { useCallback, useEffect, useState } from 'react';

const STORAGE_KEY = '3d-interior-designer-rulers-enabled';

/**
 * F13.1.3 (v1.11.0) — toggle for the measurement rulers around 2D canvases.
 * Persisted in localStorage so the user keeps their preference across reloads.
 * Multiple `useRulersEnabled` consumers in the same session stay in sync via
 * a `storage` event listener.
 */
export function useRulersEnabled(): { enabled: boolean; toggle: () => void } {
  const [enabled, setEnabled] = useState<boolean>(() => readStored());

  useEffect(() => {
    function onStorage(e: StorageEvent) {
      if (e.key === STORAGE_KEY) {
        setEnabled(readStored());
      }
    }
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const toggle = useCallback(() => {
    setEnabled((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(STORAGE_KEY, next ? '1' : '0');
      } catch {
        // localStorage unavailable — keep state in memory
      }
      return next;
    });
  }, []);

  return { enabled, toggle };
}

function readStored(): boolean {
  // F13.1.6 (v1.12.0): rulers are ON by default for fresh users. The user's
  // previously persisted choice still wins — toggling off and reloading keeps
  // them off. Only the absence of any value defaults to ON.
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw === null) return true;
    return raw === '1';
  } catch {
    return true;
  }
}
