import { test, expect, type Page } from '@playwright/test';

// F8.6 (v1.12.0) — placement mode auto-resets after a successful commit,
// mirroring the editor's single-shot tool behaviour (F11.2.9).

const STORE_KEY = '3d-interior-designer-project';

async function gotoStage3Furniture(page: Page) {
  // Layout-1 canvas plus ruler strips (F13.1) overflow the default 720-px
  // viewport, hiding the bottom half. Make the viewport tall enough so test
  // clicks always land inside it.
  await page.setViewportSize({ width: 1280, height: 1300 });
  await page.goto('/');
  await page.getByRole('button', { name: /Выбрать Планировка 1/ }).click();
  await page.locator('nav[aria-label="Этапы"] button').nth(2).click();
  await expect(page.getByText('Покрытие пола')).toBeVisible();
  await page.getByRole('button', { name: 'Мебель', exact: true }).click();
}

async function readFurniture(page: Page) {
  return page.evaluate((key) => {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw).furniture ?? null;
  }, STORE_KEY);
}

test.describe('Furniture single-shot (F8.6 v1.12.0)', () => {
  test('placing one chair clears placement mode — second click does not spawn another', async ({
    page,
  }) => {
    await gotoStage3Furniture(page);

    await page.getByRole('button', { name: /Стул/ }).first().click();
    const canvas = page.locator('.konvajs-content canvas').first();
    const box = await canvas.boundingBox();
    expect(box).not.toBeNull();

    // First click — chair placed
    await page.mouse.click(box!.x + box!.width * 0.7, box!.y + box!.height * 0.4);
    await expect(page.getByText('Размещённая мебель')).toBeVisible();
    await page.waitForTimeout(700);
    const afterFirst = await readFurniture(page);
    expect(afterFirst).toHaveLength(1);

    // Hint about placement mode should disappear (placingItem is now null)
    await expect(page.getByText(/Кликните на 2D-схему, чтобы разместить «Стул»/)).toHaveCount(0);

    // Second click on a different empty tile — must NOT add a 2nd chair
    await page.mouse.click(box!.x + box!.width * 0.3, box!.y + box!.height * 0.6);
    await page.waitForTimeout(700);
    const afterSecond = await readFurniture(page);
    expect(afterSecond).toHaveLength(1);
  });

  test('placing two chairs requires re-clicking the catalog button', async ({ page }) => {
    await gotoStage3Furniture(page);

    const chairBtn = page.getByRole('button', { name: /Стул/ }).first();
    const canvas = page.locator('.konvajs-content canvas').first();
    const box = await canvas.boundingBox();
    expect(box).not.toBeNull();

    // Place first
    await chairBtn.click();
    await expect(page.getByText(/Кликните на 2D-схему/)).toBeVisible();
    await page.mouse.click(box!.x + box!.width * 0.7, box!.y + box!.height * 0.4);
    await expect(page.getByText('Размещённая мебель')).toBeVisible();

    // Re-pick to place second — wait for placement hint to confirm React re-rendered.
    // Position picked to clear layout-1's door swing buffer at x=11 (door_bedroom1_corridor).
    await chairBtn.click();
    await expect(page.getByText(/Кликните на 2D-схему/)).toBeVisible();
    await page.mouse.click(box!.x + box!.width * 0.1, box!.y + box!.height * 0.8);
    await page.waitForTimeout(700);

    const state = await readFurniture(page);
    expect(state).toHaveLength(2);
  });
});
