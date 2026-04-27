import { test, expect } from '@playwright/test';

async function readKonvaCanvas(page: import('@playwright/test').Page) {
  return page.evaluate(() => {
    const canvas = document.querySelector('.konvajs-content canvas') as HTMLCanvasElement | null;
    return canvas ? canvas.toDataURL('image/png') : null;
  });
}

async function countTileBasePixels(page: import('@playwright/test').Page) {
  return page.evaluate(() => {
    const canvas = document.querySelector('.konvajs-content canvas') as HTMLCanvasElement | null;
    if (!canvas) return -1;
    const ctx = canvas.getContext('2d');
    if (!ctx) return -1;
    const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);
    // PALETTE.floor.tile = #E8E8E8 (rgb 232, 232, 232). The tile pattern fills rooms
    // with this near-white gray; nothing else in the scene uses it (room fills are
    // pastels, walls are darker greys). Count near-#E8E8E8 pixels as proxy for
    // tile-covered floor area.
    let count = 0;
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      if (
        r >= 222 &&
        r <= 240 &&
        g >= 222 &&
        g <= 240 &&
        b >= 222 &&
        b <= 240 &&
        Math.abs(r - g) < 6 &&
        Math.abs(g - b) < 6
      ) {
        count++;
      }
    }
    return count;
  });
}

test.describe('Floor patterns (F6.2)', () => {
  test('E2E-17: tile covering paints near-white gray fill on the 2D plan', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: /Выбрать Планировка 1/ }).click();
    // Jump to Stage 3 via stage navigator
    await page.locator('nav[aria-label="Этапы"] button').nth(2).click();
    await expect(page.getByText('Покрытие пола')).toBeVisible();

    // Snapshot before switching: room defaults are pastel, no tile gray expected
    const beforeTileCount = await countTileBasePixels(page);

    // Select tile for the first room
    await page.locator('select').first().selectOption('tile');
    await page.waitForTimeout(200);

    const afterDataUrl = await readKonvaCanvas(page);
    expect(afterDataUrl).not.toBeNull();

    const afterTileCount = await countTileBasePixels(page);
    // Switching to tile should add a substantial gray-tile fill region
    expect(afterTileCount).toBeGreaterThan(beforeTileCount + 500);
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
