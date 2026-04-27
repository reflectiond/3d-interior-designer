import { test, expect } from '@playwright/test';

async function gotoStage3Furniture(page: import('@playwright/test').Page) {
  await page.goto('/');
  await page.getByRole('button', { name: /Выбрать Планировка 1/ }).click();
  await page.locator('nav[aria-label="Этапы"] button').nth(2).click();
  await expect(page.getByText('Покрытие пола')).toBeVisible();
  await page.getByRole('button', { name: 'Мебель', exact: true }).click();
}

test.describe('Mirror furniture (F8.2)', () => {
  test('F8.4.2: clicking mirror button changes the canvas (label flips)', async ({ page }) => {
    await gotoStage3Furniture(page);

    // Place a sofa — 8×4 tiles, mirrorable, allowed in living/bedroom.
    // Layout 1's bedroom_2 covers tiles (0..12, 15..32); aim at (~3, ~19) so
    // the 8×4 footprint fits cleanly.
    await page.getByRole('button', { name: /Диван/ }).first().click();
    const canvas = page.locator('.konvajs-content canvas').first();
    const box = await canvas.boundingBox();
    expect(box).not.toBeNull();
    await page.mouse.click(box!.x + box!.width * 0.1, box!.y + box!.height * 0.4);
    await page.keyboard.press('Escape');
    await page.waitForTimeout(150);

    // Verify the sofa landed in the placed-furniture list (mirror UI surfaces)
    await expect(page.getByText('Размещённая мебель')).toBeVisible();

    // Capture the canvas before mirror
    const before = await page.evaluate(() => {
      const c = document.querySelector('.konvajs-content canvas') as HTMLCanvasElement | null;
      return c ? c.toDataURL() : null;
    });
    expect(before).not.toBeNull();

    // Click the «Отзеркалить» button next to the sofa in the placed-furniture list
    const mirrorBtn = page.getByRole('button', { name: 'Отзеркалить' }).first();
    await expect(mirrorBtn).toBeVisible();
    await mirrorBtn.click();
    await page.waitForTimeout(200);

    const after = await page.evaluate(() => {
      const c = document.querySelector('.konvajs-content canvas') as HTMLCanvasElement | null;
      return c ? c.toDataURL() : null;
    });
    // Mirroring inverts the in-rect text label so the canvas data URL must differ
    expect(after).not.toBe(before);

    // Click again to flip back — should return close to the original
    await mirrorBtn.click();
    await page.waitForTimeout(200);
    const restored = await page.evaluate(() => {
      const c = document.querySelector('.konvajs-content canvas') as HTMLCanvasElement | null;
      return c ? c.toDataURL() : null;
    });
    expect(restored).toBe(before);
  });
});
