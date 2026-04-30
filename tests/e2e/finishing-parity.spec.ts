import { test, expect } from '@playwright/test';

// Вся математика семплинга/HSV выполняется внутри page.evaluate, чтобы видеть реальные DOM-канвы.
// Маленький бандл-помощник передаём вторым аргументом.

// Берёт доминирующий hue с канвы: RGB → HSV по пикселям, отбрасываем около-серое
// (стены, потолок, подписи комнат) и очень тёмное/очень светлое (текст, блики),
// затем считаем оставшиеся пиксели в 10°-бины hue и возвращаем центр бина с
// максимальным счётом. Так выделяется hue напольного покрытия из фонового шума.
async function dominantFloorHue(
  page: import('@playwright/test').Page,
  selector: string,
): Promise<number | null> {
  return page.evaluate((sel) => {
    const canvas = document.querySelector(sel) as HTMLCanvasElement | null;
    if (!canvas || !canvas.width || !canvas.height) return null;

    const tmp = document.createElement('canvas');
    tmp.width = canvas.width;
    tmp.height = canvas.height;
    const tctx = tmp.getContext('2d');
    if (!tctx) return null;
    tctx.drawImage(canvas, 0, 0);
    const { data } = tctx.getImageData(0, 0, canvas.width, canvas.height);

    const bins = new Array(36).fill(0);
    for (let i = 0; i < data.length; i += 4) {
      if (data[i + 3] < 128) continue;
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const max = Math.max(r, g, b);
      const min = Math.min(r, g, b);
      // Пропускаем почти-серые (saturation guard) и пиксели с экстремальной яркостью
      if (max - min < 20) continue;
      if (max < 60 || max > 245) continue;
      const d = max - min;
      let h: number;
      if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
      else if (max === g) h = (b - r) / d + 2;
      else h = (r - g) / d + 4;
      h *= 60;
      if (h < 0) h += 360;
      bins[Math.floor(h / 10) % 36]++;
    }

    let maxCount = 0;
    let maxIdx = -1;
    for (let i = 0; i < bins.length; i++) {
      if (bins[i] > maxCount) {
        maxCount = bins[i];
        maxIdx = i;
      }
    }
    if (maxIdx < 0 || maxCount < 50) return null;
    return maxIdx * 10 + 5;
  }, selector);
}

function hueDelta(h1: number, h2: number): number {
  const d = Math.abs(h1 - h2) % 360;
  return d > 180 ? 360 - d : d;
}

test.describe('Finishing visualization — z-order & cross-view parity (F6.4)', () => {
  test('F6.2.7: 2D and 3D render quartz_vinyl with hue delta ≤ 15°', async ({
    page,
    browserName,
  }) => {
    // F7.6 (v1.15.0): Firefox+headless не отрисовывает первый кадр live-канвы
    // достаточно быстро для пиксельной выборки. Production не страдает.
    test.skip(
      browserName === 'firefox',
      'F7.6: Firefox headless WebGL не успевает к dominantFloorHue() сэмплингу',
    );
    await page.goto('/');
    await page.getByRole('button', { name: /Выбрать Планировка 1/ }).click();

    // Stage 3: вкладка покрытия пола
    await page.locator('nav[aria-label="Этапы"] button').nth(2).click();
    await expect(page.getByText('Покрытие пола')).toBeVisible();

    // Ставим quartz_vinyl на все видимые комнаты, чтобы пол покрывал большую часть
    // области семплинга на обоих представлениях и доминирующий цвет был цветом пола.
    const selects = await page.locator('select').all();
    for (const s of selects) {
      await s.selectOption('quartz_vinyl');
    }
    await page.waitForTimeout(250);

    // Доминирующий hue с 2D Konva-канвы — pattern-fill'ы и пастельные заливки комнат
    // отфильтрованы saturation guard'ом, остаётся тёплый коричневый quartz-vinyl.
    const hue2D = await dominantFloorHue(page, '.konvajs-content canvas');
    expect(hue2D).not.toBeNull();

    // Переключаемся в 3D и ждём сигнала первого кадра (F7.6.1).
    // Заменяет прежнее «слепое» ожидание 800 мс — Firefox иногда не успевал
    // нарисовать кадр к этому моменту, и `hue3D === null` флакалось.
    await page.getByText('Посмотреть в 3D').click();
    await page.waitForSelector('[data-testid="view3d"][data-3d-ready="1"]');

    const hue3D = await dominantFloorHue(page, 'canvas[data-engine], canvas');
    expect(hue3D).not.toBeNull();

    // База quartz-vinyl #8B7355 — hue ≈ 33° (тёплый коричневый). Спека F6.2.7 допускает
    // дрифт ≤ 15° между рендерами Konva и Three.js.
    expect(hueDelta(hue2D!, hue3D!)).toBeLessThanOrEqual(15);
  });

  test('F6.4.1: heated floor + tile + ceiling icon all render together without crashing', async ({
    page,
  }) => {
    await page.goto('/');
    await page.getByRole('button', { name: /Выбрать Планировка 1/ }).click();

    // Stage 2 — включаем тёплый пол для первой комнаты
    await page.getByText('Далее →').click();
    await expect(page.getByText('Стяжка пола')).toBeVisible();
    await page.getByRole('radio', { name: 'Тёплый пол' }).first().check();
    // Переключаем тип потолка на гипсокартон в первой комнате
    await page.getByRole('button', { name: 'Потолок' }).click();
    await page.getByRole('radio', { name: 'Гипсокартон' }).first().check();

    // Stage 3 — ставим плиточное покрытие в первой комнате
    await page.locator('nav[aria-label="Этапы"] button').nth(2).click();
    await expect(page.getByText('Покрытие пола')).toBeVisible();
    await page.locator('select').first().selectOption('tile');
    await page.waitForTimeout(200);

    // Канва всё ещё рендерится (не пустая), и цвет плитки присутствует
    const tilePixels = await page.evaluate(() => {
      const canvas = document.querySelector('.konvajs-content canvas') as HTMLCanvasElement | null;
      if (!canvas) return -1;
      const ctx = canvas.getContext('2d');
      if (!ctx) return -1;
      const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);
      let count = 0;
      for (let i = 0; i < data.length; i += 4) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        if (r >= 222 && r <= 240 && g >= 222 && g <= 240 && b >= 222 && b <= 240) count++;
      }
      return count;
    });
    // Здесь комната — небольшая спальня, иконка потолка и оверлей тёплого пола
    // съедают часть пикселей цвета плитки — 150+ это устойчивый порог.
    expect(tilePixels).toBeGreaterThan(150);
  });
});
