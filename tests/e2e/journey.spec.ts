import { test, expect, type Page } from '@playwright/test';

// Inherited integration scenarios from v1.0.0. These are intentionally
// broader than feature-specific specs (which test one F-ID at a time) — each
// case exercises a multi-step user journey end-to-end.

const STORE_KEY = '3d-interior-designer-project';

async function selectLayout1(page: Page) {
  await page.goto('/');
  await page.getByRole('button', { name: /Выбрать Планировка 1/ }).click();
  await expect(page.locator('.konvajs-content canvas').first()).toBeVisible();
}

async function gotoStage(page: Page, stage: 1 | 2 | 3 | 4) {
  await page
    .locator('nav[aria-label="Этапы"] button')
    .nth(stage - 1)
    .click();
}

async function gotoStage3Furniture(page: Page) {
  await gotoStage(page, 3);
  await expect(page.getByText('Покрытие пола')).toBeVisible();
  await page.getByRole('button', { name: 'Мебель', exact: true }).click();
}

async function readState(page: Page) {
  return page.evaluate((key) => {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  }, STORE_KEY);
}

test.describe('Inherited integration journeys (E2E-1..E2E-9)', () => {
  test('E2E-1: full sweep through stages 1→4 leaves a non-zero estimate', async ({ page }) => {
    await selectLayout1(page);

    // Stage 2 — leave defaults, just visit
    await gotoStage(page, 2);
    await expect(page.getByText('Стяжка пола')).toBeVisible();

    // Stage 3 — visit floor coverings tab
    await gotoStage(page, 3);
    await expect(page.getByText('Покрытие пола')).toBeVisible();

    // Stage 4 — totals appear
    await gotoStage(page, 4);
    await expect(page.getByText('Итоговая смета')).toBeVisible();
    await expect(page.getByText('Итого:')).toBeVisible();

    // Estimate must be non-zero (rough finish always contributes — every layout
    // has plaster/screed/ceiling work even with no electrical/furniture choices).
    const totalText = await page.locator('text=/^[0-9  ]+ ₽ — [0-9  ]+ ₽$/').first().textContent();
    expect(totalText).not.toBeNull();
    const minPart = totalText!.split('—')[0];
    const minNum = Number(minPart.replace(/[^0-9]/g, ''));
    expect(minNum).toBeGreaterThan(0);
  });

  test('E2E-3: five electrical points are persisted to the store', async ({ page }) => {
    // Layout-1 canvas is 1080×960; default 720-px viewport clips the lower
    // half. Make it tall enough so every test click lands inside the viewport.
    await page.setViewportSize({ width: 1280, height: 1200 });
    await selectLayout1(page);
    await gotoStage(page, 2);
    await page.getByRole('button', { name: 'Электрика' }).click();

    const canvas = page.locator('.konvajs-content canvas').first();
    const box = await canvas.boundingBox();
    expect(box).not.toBeNull();

    // findNearestWallEdge only matches edge tiles of a room. We target the
    // east wall of bedroom_1/bedroom_2 (tile column x=11, an internal wall)
    // at five distinct y positions — all comfortably inside the 1280×1200
    // viewport set above.
    const SCALE = 30;
    const targets = [
      [11, 5],
      [11, 10],
      [11, 18],
      [11, 24],
      [11, 28],
    ] as const;
    for (const [tx, ty] of targets) {
      const sx = box!.x + (tx + 0.5) * SCALE;
      const sy = box!.y + (32 - ty - 0.5) * SCALE;
      await page.mouse.click(sx, sy);
      await page.waitForTimeout(120);
    }
    await page.waitForTimeout(700); // debounced autosave

    const state = await readState(page);
    expect(state).not.toBeNull();
    expect(state!.electricalPoints.length).toBeGreaterThanOrEqual(5);
  });

  test('F8.7 (v1.13.0): «Унитаз» can now be placed in any room', async ({ page }) => {
    // F8.7 inverts E2E-4 — `allowed_rooms` filter is removed, so a toilet
    // dropped into the living room is accepted. Pre-1.13 this was rejected.
    await selectLayout1(page);
    await gotoStage3Furniture(page);

    await page
      .getByRole('button', { name: /Унитаз/ })
      .first()
      .click();
    const canvas = page.locator('.konvajs-content canvas').first();
    const box = await canvas.boundingBox();
    expect(box).not.toBeNull();

    // Click in living-room area (right side of layout 1).
    await page.mouse.click(box!.x + box!.width * 0.7, box!.y + box!.height * 0.4);
    await page.waitForTimeout(700);

    const state = await readState(page);
    expect(state).not.toBeNull();
    expect(
      state!.furniture.filter((f: { catalogId: string }) => f.catalogId === 'toilet'),
    ).toHaveLength(1);
  });

  test('E2E-5: furniture cannot be placed outside any room', async ({ page }) => {
    await selectLayout1(page);
    await gotoStage3Furniture(page);

    await page.getByRole('button', { name: /Стул/ }).first().click();
    const canvas = page.locator('.konvajs-content canvas').first();
    const box = await canvas.boundingBox();
    expect(box).not.toBeNull();

    // Layout 1 grid is 36×32 tiles; tile (35, 33) is outside the grid → outside any room.
    // Click near the very bottom-right corner of the canvas.
    await page.mouse.click(box!.x + box!.width * 0.99, box!.y + box!.height * 0.99);
    await page.keyboard.press('Escape');
    await page.waitForTimeout(700);

    const state = await readState(page);
    expect(state).not.toBeNull();
    expect(state!.furniture).toHaveLength(0);
  });

  test('E2E-6: rotating a chair four times returns it to 0°', async ({ page }) => {
    await selectLayout1(page);
    await gotoStage3Furniture(page);

    await page.getByRole('button', { name: /Стул/ }).first().click();
    const canvas = page.locator('.konvajs-content canvas').first();
    const box = await canvas.boundingBox();
    await page.mouse.click(box!.x + box!.width * 0.7, box!.y + box!.height * 0.4);
    await page.keyboard.press('Escape');
    await expect(page.getByText('Размещённая мебель')).toBeVisible();
    await page.waitForTimeout(700);

    const stateBefore = await readState(page);
    expect(stateBefore!.furniture).toHaveLength(1);
    expect(stateBefore!.furniture[0].rotation).toBe(0);

    const rotateBtn = page.getByRole('button', { name: 'Повернуть' }).first();
    for (let i = 0; i < 4; i++) {
      await rotateBtn.click();
      await page.waitForTimeout(60);
    }
    await page.waitForTimeout(700);

    const stateAfter = await readState(page);
    // Chair is symmetric (2×2) so all 4 rotations validate; after ×4 it lands on 0°
    expect(stateAfter!.furniture[0].rotation).toBe(0);
  });

  test('E2E-8: project JSON round-trips through the store', async ({ page }) => {
    await selectLayout1(page);
    await gotoStage3Furniture(page);

    await page.getByRole('button', { name: /Стул/ }).first().click();
    const canvas = page.locator('.konvajs-content canvas').first();
    const box = await canvas.boundingBox();
    await page.mouse.click(box!.x + box!.width * 0.7, box!.y + box!.height * 0.4);
    await page.keyboard.press('Escape');
    await expect(page.getByText('Размещённая мебель')).toBeVisible();
    await page.waitForTimeout(700);

    const stateBefore = await readState(page);
    expect(stateBefore!.furniture).toHaveLength(1);
    const exportJSON = JSON.stringify(stateBefore);

    // Wipe localStorage and reload — state must be cleared
    await page.evaluate((key) => localStorage.removeItem(key), STORE_KEY);
    await page.reload();
    await expect(page.getByText('Выберите планировку')).toBeVisible();
    expect(await readState(page)).toBeNull();

    // Re-import the saved JSON via a temporary File on the «Загрузить проект»
    // button. Stage 4 hosts that control.
    await selectLayout1(page);
    await gotoStage(page, 4);
    const fileChooserPromise = page.waitForEvent('filechooser');
    await page.getByRole('button', { name: 'Загрузить проект' }).click();
    const fileChooser = await fileChooserPromise;
    await fileChooser.setFiles({
      name: 'project.json',
      mimeType: 'application/json',
      buffer: Buffer.from(exportJSON, 'utf8'),
    });
    await page.waitForTimeout(700);

    const stateAfter = await readState(page);
    expect(stateAfter).not.toBeNull();
    expect(stateAfter!.furniture).toHaveLength(1);
    expect(stateAfter!.furniture[0].catalogId).toBe('chair');
    expect(stateAfter!.furniture[0].position).toEqual(stateBefore!.furniture[0].position);
  });

  test('E2E-9: project state restores from localStorage on page reload', async ({ page }) => {
    await selectLayout1(page);
    await gotoStage3Furniture(page);

    await page.getByRole('button', { name: /Стул/ }).first().click();
    const canvas = page.locator('.konvajs-content canvas').first();
    const box = await canvas.boundingBox();
    await page.mouse.click(box!.x + box!.width * 0.7, box!.y + box!.height * 0.4);
    await page.keyboard.press('Escape');
    await expect(page.getByText('Размещённая мебель')).toBeVisible();
    await page.waitForTimeout(700);

    const before = await readState(page);
    expect(before!.furniture).toHaveLength(1);
    expect(before!.layoutId).toBe(1);

    await page.reload();
    // Restore puts us back on Stage 3 (its default tab is Покрытие пола), but
    // the in-page Furniture tab state is not persisted — re-open it.
    await expect(page.getByText('Покрытие пола')).toBeVisible();
    await page.getByRole('button', { name: 'Мебель', exact: true }).click();
    await expect(page.getByText('Размещённая мебель')).toBeVisible();
    const after = await readState(page);
    expect(after!.layoutId).toBe(1);
    expect(after!.furniture).toHaveLength(1);
    expect(after!.furniture[0].catalogId).toBe('chair');
  });
});
