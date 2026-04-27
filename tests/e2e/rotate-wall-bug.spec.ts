import { test, expect } from '@playwright/test';

async function gotoStage3Furniture(page: import('@playwright/test').Page) {
  await page.goto('/');
  await page.getByRole('button', { name: /Выбрать Планировка 1/ }).click();
  await page.locator('nav[aria-label="Этапы"] button').nth(2).click();
  await expect(page.getByText('Покрытие пола')).toBeVisible();
  await page.getByRole('button', { name: 'Мебель', exact: true }).click();
}

test.describe('Furniture rotation validation (bug fix)', () => {
  test('rotating an 8×4 sofa whose 4×8 footprint would cross a wall is a no-op', async ({
    page,
  }) => {
    await gotoStage3Furniture(page);

    // Place a sofa in bedroom_2 (layout 1: x=0..12, y=15..32) snug against the
    // right wall — pos (4, 19) means the sofa occupies x[4..12), y[19..23),
    // ending exactly at the right wall x=12. Rotating to 4×8 would extend
    // y to 27 (still inside 32) but rotation swaps w↔h around the same
    // bottom-left, leaving x[4..8), y[19..27) — fits in this case.
    //
    // Instead place the sofa at pos (5, 28). 8×4 occupies x[5..13),
    // y[28..32). x=5..13 — extends to 13 but bedroom_2 is x=0..12,
    // so this would actually be invalid placement to begin with. Use
    // (4, 28) — x[4..12), y[28..32) inside bedroom_2.
    // After rotate to 4×8: x[4..8), y[28..36) — y exceeds gridHeight=32.
    // findContainingRoom returns null → rotation must be rejected.
    await page.getByRole('button', { name: /Диван/ }).first().click();
    const canvas = page.locator('.konvajs-content canvas').first();
    const box = await canvas.boundingBox();
    expect(box).not.toBeNull();

    // Layout1: 36 cols × 32 rows, canvas is rendered at full stage size.
    // Click at stage coords (4 + 4, 32 - 28 - 2) * SCALE = (8, 2) * 30 = (240, 60)
    // → tileX=8, tileY=30, but pos = floor(8, 30) → (8, 30); sofa occupies
    // x[8..16), y[30..34). x=8..16 crosses bedroom_2 right wall at 12.
    //
    // Better: click at canvas relative position that lands the sofa flush
    // against the bottom of bedroom_2.
    // Stage coords for pos=(4, 28): cursor at floor cursor → cursor.x=120,
    // cursor.y=(32 - 28) * 30 = 120. Use stage coords (124, 124).
    const stageCx = 124;
    const stageCy = 124;
    await page.mouse.click(
      box!.x + (stageCx / 1080) * box!.width,
      box!.y + (stageCy / 960) * box!.height,
    );
    await page.keyboard.press('Escape');
    await page.waitForTimeout(200);

    // Sofa must have been placed
    await expect(page.getByText('Размещённая мебель')).toBeVisible();

    // Capture the canvas state with sofa in 0° rotation
    const beforeRotate = await page.evaluate(() => {
      const c = document.querySelector('.konvajs-content canvas') as HTMLCanvasElement | null;
      return c ? c.toDataURL() : null;
    });
    expect(beforeRotate).not.toBeNull();

    // Click rotate. The 4×8 rotated footprint goes outside the room
    // (or crosses into another room) so the rotation must be silently rejected
    // and the canvas must stay identical.
    const rotateBtn = page.getByRole('button', { name: 'Повернуть' }).first();
    await expect(rotateBtn).toBeVisible();
    await rotateBtn.click();
    await page.waitForTimeout(200);

    const afterRotate = await page.evaluate(() => {
      const c = document.querySelector('.konvajs-content canvas') as HTMLCanvasElement | null;
      return c ? c.toDataURL() : null;
    });
    // Bug behaviour: canvas would change because rotation succeeded into a
    // wall-crossing position. After the fix: rotation is rejected → canvas equal.
    expect(afterRotate).toBe(beforeRotate);
  });
});
