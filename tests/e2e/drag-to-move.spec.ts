import { test, expect } from '@playwright/test';

// E2E-12 (F8.4.1) — полный round-trip drag-to-move. Синтетические pointer-события
// Playwright ненадёжно пересекают drag-distance threshold Konva в headless
// Chromium, поэтому хелпер пробрасывает drag-пайплайн напрямую через
// `Konva.stages[0].find(...)` + `node.fire(...)`. Подробности — в doc-комментарии
// `konvaDragFurniture`.

const STORE_KEY = '3d-interior-designer-project';

async function gotoStage3Furniture(page: import('@playwright/test').Page) {
  await page.goto('/');
  await page.getByRole('button', { name: /Выбрать Планировка 1/ }).click();
  await page.locator('nav[aria-label="Этапы"] button').nth(2).click();
  await expect(page.getByText('Покрытие пола')).toBeVisible();
  await page.getByRole('button', { name: 'Мебель', exact: true }).click();
}

async function readFurniture(page: import('@playwright/test').Page) {
  return page.evaluate((key) => {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed.furniture ?? null;
  }, STORE_KEY);
}

/**
 * Прогоняет drag-to-move пайплайн Konva, эмитируя те же события, что и реальные
 * pointer-события. Синтетические события мыши Playwright не детерминированно
 * пересекают drag-distance threshold Konva в headless Chromium, поэтому идём
 * напрямую через публичные Node.fire / Stage API Konva.
 *
 * Обработчики View2D хранят прогресс в React-состоянии (dragState) между
 * dragstart, dragmove и dragend, поэтому нужно дать React сделать flush после
 * каждого события — иначе dragend прочитает устаревший (null) dragState и выйдет.
 */
async function konvaDragFurniture(
  page: import('@playwright/test').Page,
  furnitureIndex: number,
  targetCanvasInternal: { x: number; y: number },
) {
  // Шаг 1 — фиксируем позицию указателя и эмитим dragstart
  await page.evaluate(
    ({ index, target }) => {
      type AnyNode = { fire: (evt: string, e?: object, bubble?: boolean) => void };
      type Stage = AnyNode & {
        find: (sel: string) => Array<AnyNode & { draggable: () => boolean }>;
        getPointerPosition: () => { x: number; y: number } | null;
      };
      const Konva = (window as unknown as { Konva: { stages: Stage[] } }).Konva;
      const stage = Konva.stages[0];
      const draggable = stage.find('Group').filter((g) => g.draggable());
      const node = draggable[index];
      if (!node) throw new Error(`No draggable group at index ${index}`);
      stage.getPointerPosition = () => ({ x: target.x, y: target.y });
      (window as unknown as { __dragNode: AnyNode }).__dragNode = node;
      node.fire('dragstart', { target: node }, true);
    },
    { index: furnitureIndex, target: targetCanvasInternal },
  );
  // Даём React сделать flush после dragstart, чтобы замыкания dragmove/end увидели обновлённое состояние
  await page.waitForTimeout(80);
  await page.evaluate(() => {
    const node = (
      window as unknown as {
        __dragNode: { fire: (evt: string, e?: object, bubble?: boolean) => void };
      }
    ).__dragNode;
    node.fire('dragmove', { target: node }, true);
  });
  await page.waitForTimeout(80);
  await page.evaluate(() => {
    const node = (
      window as unknown as {
        __dragNode: { fire: (evt: string, e?: object, bubble?: boolean) => void };
      }
    ).__dragNode;
    node.fire('dragend', { target: node }, true);
  });
}

test.describe('Drag-to-move (F8.1, E2E-12)', () => {
  test('E2E-12a: dragging to a valid tile commits the new position', async ({ page }) => {
    await gotoStage3Furniture(page);

    // «Стул» — 2×2 тайла, allowed_rooms: null (помещается в любой комнате)
    await page.getByRole('button', { name: /Стул/ }).first().click();
    const canvas = page.locator('.konvajs-content canvas').first();
    const box = await canvas.boundingBox();
    expect(box).not.toBeNull();

    // Ставим стул в области гостиной layout-1 (справа по центру канвы)
    const placeX = box!.x + box!.width * 0.7;
    const placeY = box!.y + box!.height * 0.4;
    await page.mouse.click(placeX, placeY);
    await page.keyboard.press('Escape');
    // Убеждаемся, что стул попал в список размещённой мебели до проверки storage
    await expect(page.getByText('Размещённая мебель')).toBeVisible();
    // Автосохранение debounced на 500 мс — выжидаем
    await page.waitForTimeout(700);

    const before = await readFurniture(page);
    expect(before).not.toBeNull();
    expect(before!.length).toBe(1);
    const startPos = before![0].position;

    // Тащим стул в новый тайл. Гостиная Layout 1 — x=20..36, y=6..32 (в координатах
    // тайлов). Целимся в внутреннюю позицию канвы, которая мапится в тайл (22, 12):
    //   internal x = 22 * SCALE + chair.w/2*SCALE = 22*30 + 30 = 690
    //   internal y = (32 - 12 - 1) * SCALE = 19 * 30 = 570
    // (View2D инвертирует Y; ty = round(gridHeight - posY/SCALE - h/2))
    await konvaDragFurniture(page, 0, { x: 690, y: 570 });
    await page.waitForTimeout(750);

    const after = await readFurniture(page);
    expect(after).not.toBeNull();
    expect(after!.length).toBe(1);
    expect(after![0].position).not.toEqual(startPos);
  });

  test('E2E-12b: dragging outside the layout rejects and keeps the original position', async ({
    page,
  }) => {
    await gotoStage3Furniture(page);

    await page.getByRole('button', { name: /Стул/ }).first().click();
    const canvas = page.locator('.konvajs-content canvas').first();
    const box = await canvas.boundingBox();
    expect(box).not.toBeNull();

    const placeX = box!.x + box!.width * 0.7;
    const placeY = box!.y + box!.height * 0.4;
    await page.mouse.click(placeX, placeY);
    await page.keyboard.press('Escape');
    await expect(page.getByText('Размещённая мебель')).toBeVisible();
    await page.waitForTimeout(700);

    const before = await readFurniture(page);
    expect(before).not.toBeNull();
    expect(before!.length).toBe(1);
    const startPos = before![0].position;

    // Тащим к верхне-левому краю канвы — за сетку Layout 1 (Layout 1 покрывает
    // тайлы 0..36, 0..32; углы вне любой комнаты → invalid). Целимся очень близко
    // к верхнему левому углу, чтобы попасть вне всех комнат.
    // Целимся за сетку Layout 1 (gridWidth*SCALE=1080, gridHeight*SCALE=960).
    // Внутренняя позиция (-200, -200) лежит сильно выше и левее любой комнаты.
    await konvaDragFurniture(page, 0, { x: -200, y: -200 });
    // 500 мс invalid-вспышка + 500 мс debounced-сохранения
    await page.waitForTimeout(1100);

    const after = await readFurniture(page);
    // Невалидный drop должен оставить позицию без изменений
    expect(after![0].position).toEqual(startPos);
  });
});
