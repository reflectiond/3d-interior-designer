import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useLazyImage } from '../../src/views/useLazyImage';

// F15.2 (v1.16.0) — useLazyImage возвращает null до загрузки/при ошибке;
// HTMLImageElement после `onload`. Реальная загрузка ассета — в e2e
// (jsdom/happy-dom не запускают image-loader для data-URL надёжно).

describe('useLazyImage — F15.2', () => {
  it('возвращает null при undefined URL', () => {
    const { result } = renderHook(() => useLazyImage(undefined));
    expect(result.current).toBeNull();
  });

  it('возвращает null сразу после монтирования (до onload)', () => {
    const { result } = renderHook(() => useLazyImage('/sprites/hypothetical.png'));
    // Hook synchronously returns null; onload fires asynchronously, не ждём.
    expect(result.current).toBeNull();
  });

  it('возвращает null при пустом URL', () => {
    const { result } = renderHook(() => useLazyImage(''));
    expect(result.current).toBeNull();
  });
});
