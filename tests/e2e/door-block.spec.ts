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

test.describe('Door swing block (F7.3.4)', () => {
  test('E2E-15: hovering a chair over a door swing tile shows the invalid highlight', async ({
    page,
  }) => {
    await gotoStage3Furniture(page);

    // Pick a chair (allowed_rooms=null so room-type alone never rejects)
    await page.getByRole('button', { name: /Стул/ }).first().click();

    const canvas = page.locator('.konvajs-content canvas').first();
    const box = await canvas.boundingBox();
    expect(box).not.toBeNull();

    // Layout 1 has door_bedroom1_corridor at x=12, y=10..13. Buffer inside
    // bedroom_1 covers tile (11, 10..12). At SCALE=30, stage coords (11, 10)
    // bottom-left → cursor x=11.5*30=345, y=(32-10.5)*30=645 in stage units.
    // Canvas may be CSS-scaled; use proportions.
    const stageW = 1080;
    const stageH = 960;
    const stageCx = 11.5 * 30;
    const stageCy = (32 - 11.5) * 30;
    const cx = box!.x + (stageCx / stageW) * box!.width;
    const cy = box!.y + (stageCy / stageH) * box!.height;
    await page.mouse.move(cx, cy);
    await page.waitForTimeout(150);

    // PALETTE.placement_highlight.invalid = #E53935 (rgb 229, 57, 53). The
    // highlight is a solid-stroke + opacity-0.35-fill rect; the stroke pixels
    // along the perimeter retain near-pure red. Match those.
    const strongRed = await countTintedPixels(page, { r: 229, g: 57, b: 53 }, 50);
    expect(strongRed).toBeGreaterThan(20);
  });
});
