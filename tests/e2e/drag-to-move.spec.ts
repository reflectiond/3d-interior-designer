import { test, expect } from '@playwright/test';

// Note: Konva's drag system uses pointer events and is notoriously sensitive to
// Playwright's synthetic mouse events in headless Chromium — `page.mouse.down`
// followed by `move/up` does not always trigger `onDragStart` deterministically.
// E2E-12 (drag-to-move full visual round-trip) is therefore deferred to the
// dedicated test-coverage sprint v1.7.0, where we can wire up a Konva-aware
// driver. For now we keep a smoke test that exercises the wiring up to the
// drag handlers without asserting a visual outcome.

async function gotoStage3Furniture(page: import('@playwright/test').Page) {
  await page.goto('/');
  await page.getByRole('button', { name: /Выбрать Планировка 1/ }).click();
  await page.locator('nav[aria-label="Этапы"] button').nth(2).click();
  await expect(page.getByText('Покрытие пола')).toBeVisible();
  await page.getByRole('button', { name: 'Мебель', exact: true }).click();
}

test.describe('Drag-to-move (F8.1) — smoke', () => {
  test('placing furniture then mousing over it does not crash the canvas', async ({ page }) => {
    await gotoStage3Furniture(page);

    await page.getByRole('button', { name: /Стул/ }).first().click();
    const canvas = page.locator('.konvajs-content canvas').first();
    const box = await canvas.boundingBox();
    expect(box).not.toBeNull();

    // Place a chair near canvas centre
    await page.mouse.click(box!.x + box!.width / 2, box!.y + box!.height / 2);
    await page.keyboard.press('Escape');
    await page.waitForTimeout(120);

    // Mouse-down/move/up over the just-placed chair — exercises drag handlers
    // without asserting a visual outcome (see file header).
    const cx = box!.x + box!.width / 2;
    const cy = box!.y + box!.height / 2;
    await page.mouse.move(cx, cy);
    await page.mouse.down();
    await page.mouse.move(cx + 40, cy + 40, { steps: 5 });
    await page.mouse.up();
    await page.waitForTimeout(150);

    // Canvas must still be present and rendering
    const dataUrl = await page.evaluate(() => {
      const c = document.querySelector('.konvajs-content canvas') as HTMLCanvasElement | null;
      return c ? c.toDataURL().length : 0;
    });
    expect(dataUrl).toBeGreaterThan(1000);
  });
});
