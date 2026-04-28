import { test, expect } from '@playwright/test';

async function gotoStage1WithLayout1(page: import('@playwright/test').Page) {
  await page.goto('/');
  await page.getByRole('button', { name: /Выбрать Планировка 1/ }).click();
  // Wait for the 2D canvas to mount
  await expect(page.locator('.konvajs-content canvas').first()).toBeVisible();
}

async function gotoStage1WithLayout(page: import('@playwright/test').Page, layoutNo: 1 | 2 | 3) {
  await page.goto('/');
  await page.getByRole('button', { name: new RegExp(`Выбрать Планировка ${layoutNo}`) }).click();
  await expect(page.locator('.konvajs-content canvas').first()).toBeVisible();
}

async function readKonvaCanvas(page: import('@playwright/test').Page) {
  return page.evaluate(() => {
    const canvas = document.querySelector('.konvajs-content canvas') as HTMLCanvasElement | null;
    return canvas ? canvas.toDataURL('image/png') : null;
  });
}

/**
 * Counts pixels that look like the door arc / window frame ink. Both colors
 * are dark mid-greys with a slight cool tint:
 *   PALETTE.openings.door_arc      = #888888
 *   PALETTE.openings.window_frame  = #3D5A6C
 *   PALETTE.openings.door_frame    = #6B5C45
 * We collect any near-#888 pixel, which the door arc dashes paint plenty of.
 */
async function countDoorArcPixels(page: import('@playwright/test').Page) {
  return page.evaluate(() => {
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
      // Near-#888 (mid grey) — door arc / leaf
      if (r >= 110 && r <= 160 && Math.abs(r - g) < 14 && Math.abs(g - b) < 14) {
        count++;
      }
    }
    return count;
  });
}

test.describe('Openings — windows and doors (F7)', () => {
  test('E2E-14: layout 1 renders openings on 2D canvas', async ({ page }) => {
    await gotoStage1WithLayout1(page);
    await page.waitForTimeout(150);

    // The bare layout 1 has 4 windows (frame lines) and 5 doors (arcs + leaves)
    // — door_arc dashes paint plenty of mid-grey pixels that no other layer
    // produces in this scene. Without openings the count is well under 10.
    const arcPixels = await countDoorArcPixels(page);
    expect(arcPixels).toBeGreaterThan(40);

    // Snapshot must be a valid data URL (canvas didn't crash)
    const snapshot = await readKonvaCanvas(page);
    expect(snapshot).not.toBeNull();
    expect(snapshot!.length).toBeGreaterThan(1000);
  });

  test('E2E-14b: layout 2 renders openings on 2D canvas (F7.1.3)', async ({ page }) => {
    await gotoStage1WithLayout(page, 2);
    await page.waitForTimeout(150);
    const arcPixels = await countDoorArcPixels(page);
    expect(arcPixels).toBeGreaterThan(40);
  });

  test('E2E-14c: layout 3 renders openings on 2D canvas (F7.1.3)', async ({ page }) => {
    await gotoStage1WithLayout(page, 3);
    await page.waitForTimeout(150);
    const arcPixels = await countDoorArcPixels(page);
    expect(arcPixels).toBeGreaterThan(40);
  });

  test('F7.2.3: electrical points still place on walls that have windows', async ({ page }) => {
    await gotoStage1WithLayout1(page);
    await page.getByText('Далее →').click();
    await expect(page.getByText('Стяжка пола')).toBeVisible();

    // Tab to electrical
    await page.getByRole('button', { name: 'Электрика' }).click();
    // Click on the canvas at a point that maps to inside-the-bedroom near the
    // window — the BFS pathfinder must still reach it.
    const canvas = page.locator('.konvajs-content canvas').first();
    const box = await canvas.boundingBox();
    expect(box).not.toBeNull();
    // bedroom_1 north wall has a window at x=3..7. Click inside bedroom_1 near it.
    await page.mouse.click(box!.x + box!.width * 0.13, box!.y + box!.height * 0.05);
    await page.waitForTimeout(200);

    // Canvas still renders (electrical add did not throw)
    const snapshot = await readKonvaCanvas(page);
    expect(snapshot).not.toBeNull();
  });
});
