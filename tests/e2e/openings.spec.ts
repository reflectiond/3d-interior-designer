import { test, expect } from '@playwright/test';

async function gotoStage1WithLayout1(page: import('@playwright/test').Page) {
  await page.goto('/');
  await page.getByRole('button', { name: /Выбрать Планировка 1/ }).click();
  // Ждём, пока смонтируется 2D-канва
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
 * Считает пиксели, похожие на «чернила» дуги двери / рамы окна. Все три цвета —
 * тёмно-средне-серые с лёгким холодным оттенком:
 *   PALETTE.openings.door_arc      = #888888
 *   PALETTE.openings.window_frame  = #3D5A6C
 *   PALETTE.openings.door_frame    = #6B5C45
 * Собираем любой пиксель около-#888, которых пунктир дуги двери даёт в избытке.
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
      // Около-#888 (средне-серый) — дуга двери / створка
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

    // В голой layout 1 есть 4 окна (линии рам) и 5 дверей (дуги + створки) —
    // пунктир door_arc даёт много средне-серых пикселей, которых не даёт ни один
    // другой слой в этой сцене. Без проёмов счёт стабильно ниже 10.
    const arcPixels = await countDoorArcPixels(page);
    expect(arcPixels).toBeGreaterThan(40);

    // Снапшот должен быть валидным data URL (канва не упала)
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

    // Переходим на вкладку электрики
    await page.getByRole('button', { name: 'Электрика' }).click();
    // Кликаем по точке канвы, которая мапится внутрь спальни рядом с окном —
    // BFS-pathfinder должен до неё добраться.
    const canvas = page.locator('.konvajs-content canvas').first();
    const box = await canvas.boundingBox();
    expect(box).not.toBeNull();
    // На северной стене bedroom_1 есть окно на x=3..7. Кликаем внутри bedroom_1 рядом с ним.
    await page.mouse.click(box!.x + box!.width * 0.13, box!.y + box!.height * 0.05);
    await page.waitForTimeout(200);

    // Канва всё ещё рендерится (добавление электроточки не упало)
    const snapshot = await readKonvaCanvas(page);
    expect(snapshot).not.toBeNull();
  });
});
