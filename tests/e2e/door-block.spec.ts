import { test, expect } from '@playwright/test';

async function gotoStage3Furniture(page: import('@playwright/test').Page) {
  await page.goto('/');
  await page.getByRole('button', { name: /Выбрать Планировка 1/ }).click();
  await page.locator('nav[aria-label="Этапы"] button').nth(2).click();
  await expect(page.getByText('Покрытие пола')).toBeVisible();
  await page.getByRole('button', { name: 'Мебель', exact: true }).click();
}

async function countTintedPixels(
  page: import('@playwright/test').Page,
  rgb: { r: number; g: number; b: number },
  tolerance = 60,
) {
  return page.evaluate(
    ({ target, tol }) => {
      const canvas = document.querySelector('.konvajs-content canvas') as HTMLCanvasElement | null;
      if (!canvas) return -1;
      const ctx = canvas.getContext('2d');
      if (!ctx) return -1;
      const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);
      let count = 0;
      for (let i = 0; i < data.length; i += 4) {
        const dr = data[i] - target.r;
        const dg = data[i + 1] - target.g;
        const db = data[i + 2] - target.b;
        if (Math.sqrt(dr * dr + dg * dg + db * db) < tol) count++;
      }
      return count;
    },
    { target: rgb, tol: tolerance },
  );
}

test.describe('Door swing area (F7.3.4 → relaxed in v1.13.0 / F8.7)', () => {
  test('F8.7 (v1.13.0): hovering a chair over a door swing tile is now VALID', async ({ page }) => {
    await gotoStage3Furniture(page);

    // Базовый счёт красных пикселей (электрощит + фон) ДО выбора стула.
    const baselineRed = await countTintedPixels(page, { r: 229, g: 57, b: 53 }, 50);

    // Берём стул (свободное размещение)
    await page.getByRole('button', { name: /Стул/ }).first().click();

    const canvas = page.locator('.konvajs-content canvas').first();
    const box = await canvas.boundingBox();
    expect(box).not.toBeNull();

    // В Layout 1 есть door_bedroom1_corridor на x=12, y=10..13. До 1.13
    // буфер в (11, 10..12) делал размещение invalid → красная подсветка
    // добавляла большой прямоугольник пикселей #E53935. После F8.7 (v1.13.0)
    // буфер у двери больше не блокирует → hover по этому тайлу показывает
    // ЗЕЛЁНУЮ valid-подсветку, дополнительного красного поверх baseline нет.
    const stageW = 1080;
    const stageH = 960;
    const stageCx = 11.5 * 30;
    const stageCy = (32 - 11.5) * 30;
    const cx = box!.x + (stageCx / stageW) * box!.width;
    const cy = box!.y + (stageCy / stageH) * box!.height;
    await page.mouse.move(cx, cy);
    await page.waitForTimeout(150);

    const afterRed = await countTintedPixels(page, { r: 229, g: 57, b: 53 }, 50);
    // Никаких дополнительных красных пикселей от hover'а → буфер у двери больше
    // не блокирует. Допускаем небольшой anti-aliasing-зазор поверх baseline'а.
    expect(afterRed - baselineRed).toBeLessThan(50);
  });
});
