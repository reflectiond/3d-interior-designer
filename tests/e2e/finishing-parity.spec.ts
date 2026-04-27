import { test, expect } from '@playwright/test';

// All sampling/HSV math runs inside page.evaluate so it sees the real DOM canvases.
// We pass a small helper bundle as the second arg.

// Picks the dominant hue from a canvas: RGB → HSV per pixel, drop near-grayscale
// (walls, ceiling, room labels) and very dark/very bright (text, highlights),
// then count remaining pixels into 10° hue bins and return the bin centre with
// the highest count. This isolates the floor-covering hue from background noise.
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
      // Skip near-grayscale (saturation guard) and extreme value pixels
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
  test('F6.2.7: 2D and 3D render quartz_vinyl with hue delta ≤ 15°', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: /Выбрать Планировка 1/ }).click();

    // Stage 3: floor covering tab
    await page.locator('nav[aria-label="Этапы"] button').nth(2).click();
    await expect(page.getByText('Покрытие пола')).toBeVisible();

    // Set every visible room to quartz_vinyl so the floor covers most of the
    // sampling area on both views and the dominant color is the floor color.
    const selects = await page.locator('select').all();
    for (const s of selects) {
      await s.selectOption('quartz_vinyl');
    }
    await page.waitForTimeout(250);

    // Dominant hue from the 2D Konva canvas — pattern fills + room pastels are filtered
    // out by saturation guard, leaving the warm-brown quartz-vinyl base.
    const hue2D = await dominantFloorHue(page, '.konvajs-content canvas');
    expect(hue2D).not.toBeNull();

    // Switch to 3D and let R3F initialize + render the first frame
    await page.getByText('Посмотреть в 3D').click();
    await page.waitForTimeout(800);

    const hue3D = await dominantFloorHue(page, 'canvas[data-engine], canvas');
    expect(hue3D).not.toBeNull();

    // Quartz-vinyl base #8B7355 is hue ≈ 33° (warm brown). Spec F6.2.7 allows
    // ≤ 15° drift between Konva and Three.js renders.
    expect(hueDelta(hue2D!, hue3D!)).toBeLessThanOrEqual(15);
  });

  test('F6.4.1: heated floor + tile + ceiling icon all render together without crashing', async ({
    page,
  }) => {
    await page.goto('/');
    await page.getByRole('button', { name: /Выбрать Планировка 1/ }).click();

    // Stage 2 — turn on heated floor for the first room
    await page.getByText('Далее →').click();
    await expect(page.getByText('Стяжка пола')).toBeVisible();
    await page.getByRole('radio', { name: 'Тёплый пол' }).first().check();
    // Switch ceiling type to drywall on the first room
    await page.getByRole('button', { name: 'Потолок' }).click();
    await page.getByRole('radio', { name: 'Гипсокартон' }).first().check();

    // Stage 3 — set tile covering for the first room
    await page.locator('nav[aria-label="Этапы"] button').nth(2).click();
    await expect(page.getByText('Покрытие пола')).toBeVisible();
    await page.locator('select').first().selectOption('tile');
    await page.waitForTimeout(200);

    // Canvas still renders (non-empty) and the tile color is present
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
    // The room here is a smaller bedroom and ceiling icon + heat overlay shave off
    // some tile-color pixels — 150+ is a stable threshold.
    expect(tilePixels).toBeGreaterThan(150);
  });
});
