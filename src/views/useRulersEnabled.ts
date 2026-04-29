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
  try {
    return localStorage.getItem(STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}
