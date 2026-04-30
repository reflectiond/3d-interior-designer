import { test, expect } from '@playwright/test';

async function gotoStage3Furniture(page: import('@playwright/test').Page) {
  // viewport-fixed layout (v1.17.0) ограничивает канву окном; нужен запас по
  // высоте чтобы pixel-сэмплинг ловил заметную область превью.
  await page.setViewportSize({ width: 1280, height: 1300 });
  await page.goto('/');
  await page.getByRole('button', { name: /Выбрать Планировка 1/ }).click();
  await page.locator('nav[aria-label="Этапы"] button').nth(2).click();
  await expect(page.getByText('Покрытие пола')).toBeVisible();
  await page.getByRole('button', { name: 'Мебель', exact: true }).click();
}

async function countTintedPixels(
  page: import('@playwright/test').Page,
  rgb: { r: number; g: number; b: number },
) {
  return page.evaluate((target) => {
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
      // The highlight is rendered at opacity 0.35 over pastel room fills, so the
      // dominant channel still bias matches the chosen target.
      const dr = r - target.r;
      const dg = g - target.g;
      const db = b - target.b;
      const dist = Math.sqrt(dr * dr + dg * dg + db * db);
      if (dist < 60) count++;
    }
    return count;
  }, rgb);
}

test.describe('Placement highlight (F8.3)', () => {
  test('clicking a catalog item paints validity highlight under the cursor', async ({ page }) => {
    await gotoStage3Furniture(page);

    // Pick a piece without strict allowed_rooms so most positions are valid:
    // «Стул» (chair) has allowed_rooms = null in catalog.
    const chairBtn = page.getByRole('button', { name: /Стул/ }).first();
    await chairBtn.click();

    // Hover roughly the center of the 2D canvas
    const canvas = page.locator('.konvajs-content canvas').first();
    const box = await canvas.boundingBox();
    expect(box).not.toBeNull();
    const cx = box!.x + box!.width / 2;
    const cy = box!.y + box!.height / 2;
    await page.mouse.move(cx, cy);
    await page.waitForTimeout(150);

    // PALETTE.placement_highlight.valid = #4CAF50 → rgb(76, 175, 80)
    // at opacity 0.35 over pastel rooms it blends to roughly (165, 200, 155)
    // (saturation drops but hue stays distinctly green).
    const greenish = await countTintedPixels(page, { r: 165, g: 200, b: 155 });
    // PALETTE.placement_highlight.invalid = #E53935 → rgb(229, 57, 53)
    const redish = await countTintedPixels(page, { r: 215, g: 130, b: 130 });

    // Either valid (green) or invalid (red) should appear in non-trivial amounts.
    expect(Math.max(greenish, redish)).toBeGreaterThan(80);
  });

  test('moving cursor over canvas shows placement highlight (green or red)', async ({ page }) => {
    // F8.7 (v1.13.0): allowed_rooms убран — туалет теперь валиден в любой
    // комнате. Тест переформулирован: hover preview ВСЕГДА показывает
    // подсветку (зелёную если в комнате, красную если на стене/снаружи).
    await gotoStage3Furniture(page);

    const toiletBtn = page.getByRole('button', { name: /Унитаз/ }).first();
    await toiletBtn.click();

    const canvas = page.locator('.konvajs-content canvas').first();
    const box = await canvas.boundingBox();
    expect(box).not.toBeNull();
    const x = box!.x + box!.width * 0.5;
    const y = box!.y + box!.height * 0.5;
    await page.mouse.move(x, y);
    await page.waitForTimeout(150);

    const greenish = await countTintedPixels(page, { r: 130, g: 215, b: 130 });
    const redish = await countTintedPixels(page, { r: 215, g: 130, b: 130 });
    expect(Math.max(greenish, redish)).toBeGreaterThan(50);
  });
});
