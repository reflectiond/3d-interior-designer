import { test, expect, type Page } from '@playwright/test';

// F13.1 (v1.11.0) — measurement rulers toggle on the 2D canvas. Rulers
// render as SVG strips outside the Konva Stage, so they don't appear in
// `stage.toDataURL()` exports. Toggle state persists in localStorage.

const STORAGE_KEY = '3d-interior-designer-rulers-enabled';

async function gotoStage1WithLayout1(page: Page) {
  await page.goto('/');
  await page.getByRole('button', { name: /Выбрать Планировка 1/ }).click();
  await expect(page.locator('.konvajs-content canvas').first()).toBeVisible();
}

test.describe('Measurement rulers (F13.1 v1.11.0)', () => {
  test('F13.1.3: toggle flips state and persists to localStorage', async ({ page }) => {
    await gotoStage1WithLayout1(page);

    // Default: rulers off → no SVG strips visible
    await expect(page.getByTestId('view2d-ruler-horizontal')).toHaveCount(0);
    await expect(page.getByTestId('view2d-ruler-vertical')).toHaveCount(0);

    // Toggle on
    await page.getByTestId('view2d-rulers-toggle').click();
    await expect(page.getByTestId('view2d-ruler-horizontal')).toBeVisible();
    await expect(page.getByTestId('view2d-ruler-vertical')).toBeVisible();

    // localStorage holds the new value (F13.1.3)
    const stored = await page.evaluate((key) => localStorage.getItem(key), STORAGE_KEY);
    expect(stored).toBe('1');

    // Toggle off again and the rulers disappear
    await page.getByTestId('view2d-rulers-toggle').click();
    await expect(page.getByTestId('view2d-ruler-horizontal')).toHaveCount(0);
    const storedOff = await page.evaluate((key) => localStorage.getItem(key), STORAGE_KEY);
    expect(storedOff).toBe('0');
  });

  test('F13.1.2: horizontal ruler labels every metre', async ({ page }) => {
    // Pre-set the storage so rulers come up enabled on first paint
    await page.addInitScript((key) => localStorage.setItem(key, '1'), STORAGE_KEY);
    await gotoStage1WithLayout1(page);

    // Layout 1 grid is 36 tiles wide × 0.25 m = 9 m. Expect labels 0 м … 9 м.
    const horiz = page.getByTestId('view2d-ruler-horizontal');
    await expect(horiz).toContainText('0 м');
    await expect(horiz).toContainText('1 м');
    await expect(horiz).toContainText('5 м');
    await expect(horiz).toContainText('9 м');
  });

  test('F13.1.1: editor canvas also gets rulers under the same toggle', async ({ page }) => {
    const TOKEN = 'dev-only-token-replace-in-prod';
    await page.addInitScript((key) => localStorage.setItem(key, '1'), STORAGE_KEY);
    await page.goto(`/?editor=1&token=${TOKEN}`);
    await expect(page.getByTestId('layout-editor-canvas')).toBeVisible();
    await expect(page.getByTestId('editor-ruler-horizontal')).toBeVisible();
    await expect(page.getByTestId('editor-ruler-vertical')).toBeVisible();
  });
});
