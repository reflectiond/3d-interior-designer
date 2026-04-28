import { test, expect } from '@playwright/test';

// E2E-12 (F8.4.1) — full drag-to-move round-trip. Konva's drag system listens
// for pointer events on the .konvajs-content wrapper, but Playwright's
// `page.mouse.*` API does not always cross Konva's drag-distance threshold
// reliably in headless Chromium. We dispatch synthetic PointerEvents directly
// on the wrapper, which Konva picks up deterministically.

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
 * Drives Konva's drag-to-move pipeline by firing the same events the real
 * pointer events would fire. Playwright's synthetic mouse events do not
 * deterministically cross Konva's drag-distance threshold in headless
 * Chromium, so we go through Konva's public Node.fire / Stage APIs directly.
 *
 * The View2D handlers store progress in React state (dragState) between
 * dragstart, dragmove and dragend, so we must let React flush after each
 * event — otherwise dragend reads a stale (null) dragState and bails out.
 */
async function konvaDragFurniture(
  page: import('@playwright/test').Page,
  furnitureIndex: number,
  targetCanvasInternal: { x: number; y: number },
) {
  // Step 1 — pin pointer position and fire dragstart
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
  // Let React flush state from dragstart so the dragmove/end closures see it
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

    // «Стул» — 2×2 tiles, allowed_rooms: null (fits anywhere inside a room)
    await page.getByRole('button', { name: /Стул/ }).first().click();
    const canvas = page.locator('.konvajs-content canvas').first();
    const box = await canvas.boundingBox();
    expect(box).not.toBeNull();

    // Place chair near layout-1 living-room area (right-center of the canvas)
    const placeX = box!.x + box!.width * 0.7;
    const placeY = box!.y + box!.height * 0.4;
    await page.mouse.click(placeX, placeY);
    await page.keyboard.press('Escape');
    // Confirm the chair landed in the placed-furniture list before checking storage
    await expect(page.getByText('Размещённая мебель')).toBeVisible();
    // Auto-save is debounced 500 ms — wait through it
    await page.waitForTimeout(700);

    const before = await readFurniture(page);
    expect(before).not.toBeNull();
    expect(before!.length).toBe(1);
    const startPos = before![0].position;

    // Drag chair to a new tile. Layout 1 living room covers x=20..36, y=6..32
    // (in tile coords). Aim at internal canvas pos that maps to tile (22, 12):
    //   internal x = 22 * SCALE + chair.w/2*SCALE = 22*30 + 30 = 690
    //   internal y = (32 - 12 - 1) * SCALE = 19 * 30 = 570
    // (View2D inverts Y; ty = round(gridHeight - posY/SCALE - h/2))
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

    // Drag toward the top-left edge of the canvas — beyond layout 1 grid
    // (layout 1 covers tiles 0..36, 0..32; corners outside any room → invalid).
    // Aim very close to top-left to land outside any rooms.
    // Aim outside layout 1 grid (gridWidth*SCALE=1080, gridHeight*SCALE=960).
    // Internal pos (-200, -200) lands far above and left of any room.
    await konvaDragFurniture(page, 0, { x: -200, y: -200 });
    // 500 ms invalid-flash + 500 ms debounced save
    await page.waitForTimeout(1100);

    const after = await readFurniture(page);
    // Invalid drop must leave the position unchanged
    expect(after![0].position).toEqual(startPos);
  });
});
