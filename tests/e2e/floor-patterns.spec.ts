import { test, expect } from '@playwright/test';

async function readKonvaCanvas(page: import('@playwright/test').Page) {
  return page.evaluate(() => {
    const canvas = document.querySelector('.konvajs-content canvas') as HTMLCanvasElement | null;
    return canvas ? canvas.toDataURL('image/png') : null;
  });
}

async function countNearGreyPixels(page: import('@playwright/test').Page) {
  return page.evaluate(() => {
    const canvas = document.querySelector('.konvajs-content canvas') as HTMLCanvasElement | null;
    if (!canvas) return -1;
    const ctx = canvas.getContext('2d');
    if (!ctx) return -1;
    const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);
    // F6.2.10 (v1.8.0): швы плитки смешивают `PALETTE.floor_pattern_seam.tile = #A0A0A0`
    // (rgb 160,160,160) с opacity 0.7 поверх пастельных заливок комнат. Смешанные
    // пиксели швов попадают примерно в rgb(175–200, 175–195, 170–195) — десатурированный
    // средний тон, которого пастельные заливки не дают. Считаем такие пиксели
    // как прокси для «швы плитки видны».
    let count = 0;
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      if (
        r >= 170 &&
        r <= 210 &&
        g >= 170 &&
        g <= 210 &&
        b >= 165 &&
        b <= 210 &&
        Math.abs(r - g) < 16 &&
        Math.abs(g - b) < 16
      ) {
        count++;
      }
    }
    return count;
  });
}

async function countNearPastelPixels(page: import('@playwright/test').Page) {
  return page.evaluate(() => {
    const canvas = document.querySelector('.konvajs-content canvas') as HTMLCanvasElement | null;
    if (!canvas) return -1;
    const ctx = canvas.getContext('2d');
    if (!ctx) return -1;
    const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);
    // PALETTE.rooms.* — пастельные: высокий RGB (>= 220), тёплые/холодные оттенки.
    // Считаем пиксели, похожие на ЛЮБУЮ пастельную заливку комнаты: хотя бы один
    // канал ≥ 240, все каналы ≥ 220.
    let count = 0;
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const max = Math.max(r, g, b);
      const min = Math.min(r, g, b);
      if (max >= 240 && min >= 220) count++;
    }
    return count;
  });
}

test.describe('Floor patterns (F6.2)', () => {
  test('E2E-17: tile covering renders an overlay pattern on the 2D plan', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: /Выбрать Планировка 1/ }).click();
    await page.locator('nav[aria-label="Этапы"] button').nth(2).click();
    await expect(page.getByText('Покрытие пола')).toBeVisible();

    const beforeDataUrl = await readKonvaCanvas(page);
    const beforeGrey = await countNearGreyPixels(page);

    // Переключаем все комнаты на плитку, чтобы оверлей покрыл весь план
    const selects = page.locator('select');
    const total = await selects.count();
    for (let i = 0; i < total; i++) {
      await selects.nth(i).selectOption('tile');
    }
    await page.waitForTimeout(300);

    const afterDataUrl = await readKonvaCanvas(page);
    // F6.2.8 (v1.8.0): узор только overlay, но всё равно должен давать заметное
    // изменение на канве. Заливки комнат снизу остаются (E2E-19), поэтому
    // абсолютная дельта мала — достаточно diff'а data-URL.
    expect(afterDataUrl).not.toBeNull();
    expect(afterDataUrl).not.toBe(beforeDataUrl);

    // И всё ещё ожидаем хотя бы *немного* дополнительных средне-серых смешанных
    // пикселей — эмпирически ~200, порог занижен до 100 ради устойчивости к
    // дрожанию anti-aliasing'а.
    const afterGrey = await countNearGreyPixels(page);
    expect(afterGrey).toBeGreaterThan(beforeGrey + 100);
  });

  test('E2E-19: laminate overlay keeps the pastel room fill visible (F6.2.8)', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: /Выбрать Планировка 1/ }).click();
    await page.locator('nav[aria-label="Этапы"] button').nth(2).click();
    await expect(page.getByText('Покрытие пола')).toBeVisible();

    const beforePastel = await countNearPastelPixels(page);
    expect(beforePastel).toBeGreaterThan(0);

    // Переключаем все комнаты на ламинат
    const selects = page.locator('select');
    const total = await selects.count();
    for (let i = 0; i < total; i++) {
      await selects.nth(i).selectOption('laminate');
    }
    await page.waitForTimeout(300);

    const afterPastel = await countNearPastelPixels(page);
    // С overlay-узорами пастельные заливки должны занимать ≥ 70% от
    // прежнего footprint'а. (До v1.8 базовый цвет ламината #C9A678 вытирал
    // пастель → отношение падало до ~5%.)
    expect(afterPastel).toBeGreaterThan(beforePastel * 0.7);
  });

  test('F6.2.x: switching covering changes the 2D plan rendering', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: /Выбрать Планировка 1/ }).click();
    await page.locator('nav[aria-label="Этапы"] button').nth(2).click();
    await expect(page.getByText('Покрытие пола')).toBeVisible();

    await page.locator('select').first().selectOption('linoleum');
    await page.waitForTimeout(150);
    const linoleum = await readKonvaCanvas(page);

    await page.locator('select').first().selectOption('quartz_vinyl');
    await page.waitForTimeout(150);
    const quartz = await readKonvaCanvas(page);

    expect(linoleum).not.toBeNull();
    expect(quartz).not.toBeNull();
    expect(quartz).not.toBe(linoleum);
  });
});
