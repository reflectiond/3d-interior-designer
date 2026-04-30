import { useEffect, useState } from 'react';

/**
 * F15.2 (v1.16.0) — lazy-load PNG спрайта мебели для Konva `<Image>`.
 *
 * Хук создаёт `HTMLImageElement` для `url`, ждёт `onload`/`onerror`.
 * Возвращает готовый image-элемент или `null` (грузится / ошибка) —
 * вызывающий код в этом случае показывает fallback-`<Rect>`.
 *
 * URL передаётся как обычный путь (например `/sprites/sofa.png`); кэш
 * браузера переиспользует одни и те же спрайты между несколькими
 * экземплярами мебели.
 */
export function useLazyImage(url: string | undefined): HTMLImageElement | null {
  const [image, setImage] = useState<HTMLImageElement | null>(null);

  useEffect(() => {
    if (!url) return;
    const img = new Image();
    let cancelled = false;
    img.onload = () => {
      if (!cancelled) setImage(img);
    };
    img.onerror = () => {
      if (!cancelled) setImage(null);
    };
    img.src = url;
    return () => {
      cancelled = true;
      img.onload = null;
      img.onerror = null;
    };
  }, [url]);

  // url отсутствует → null, не показываем устаревший image от прошлого URL.
  // При смене URL возможна короткая пауза, пока новый onload не сработает.
  return url ? image : null;
}
