import { useCallback, useEffect, useState } from 'react';

const STORAGE_KEY = '3d-interior-designer-rulers-enabled';

/**
 * F13.1.3 (v1.11.0) — переключатель измерительных линеек вокруг 2D-канв.
 * Сохраняется в localStorage, чтобы пользовательский выбор переживал перезагрузку.
 * Несколько потребителей `useRulersEnabled` в одной сессии синхронизируются
 * через listener события `storage`.
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
        // localStorage недоступен — держим состояние только в памяти
      }
      return next;
    });
  }, []);

  return { enabled, toggle };
}

function readStored(): boolean {
  // F13.1.6 (v1.12.0): для новых пользователей линейки включены по умолчанию.
  // Сохранённый ранее выбор пользователя всё равно побеждает — выключение и
  // перезагрузка оставляет их выключенными. Лишь отсутствие значения даёт ON.
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw === null) return true;
    return raw === '1';
  } catch {
    return true;
  }
}
