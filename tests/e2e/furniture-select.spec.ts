import { test, expect, type Page } from '@playwright/test';

// F8.5 (v1.13.0) — режим selection для размещённой мебели на 2D-канве.

const STORE_KEY = '3d-interior-designer-project';

async function gotoStage3Furniture(page: Page) {
  // Layout-1 + полоса линеек + несколько строк мебели в боковой панели
  // выходят за стандартный viewport 720 px. Больший viewport удерживает
  // все тестовые клики внутри.
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

async function placeChair(page: Page, fracX: number, fracY: number) {
  await page.getByRole('button', { name: /Стул/ }).first().click();
  await expect(page.getByText(/Кликните на 2D-схему/)).toBeVisible();
  const canvas = page.locator('.konvajs-content canvas').first();
  const box = await canvas.boundingBox();
  if (!box) throw new Error('canvas has no bounding box');
  await page.mouse.click(box.x + box.width * fracX, box.y + box.height * fracY);
  await expect(page.getByText('Размещённая мебель')).toBeVisible();
  await page.waitForTimeout(700);
}

test.describe('Furniture canvas select (F8.5 v1.13.0)', () => {
  test('E2E-26: rotating with R only affects the selected piece', async ({ page }) => {
    await gotoStage3Furniture(page);

    // Ставим два стула в разных комнатах (свободное размещение, F8.7).
    await placeChair(page, 0.7, 0.4); // стул 1 — область гостиной
    await placeChair(page, 0.1, 0.8); // стул 2 — область спальни 1

    const before = await readFurniture(page);
    expect(before).toHaveLength(2);
    // Оба сразу после размещения имеют rotation 0.
    expect(before![0].rotation).toBe(0);
    expect(before![1].rotation).toBe(0);

    // Кликаем по первому стулу на канве для выделения.
    const canvas = page.locator('.konvajs-content canvas').first();
    const box = await canvas.boundingBox();
    if (!box) throw new Error('canvas has no bounding box');
    await page.mouse.click(box.x + box.width * 0.7, box.y + box.height * 0.4);
    await page.waitForTimeout(150);

    // Нажимаем R — у стула размер 2×2, поэтому поворот всегда валиден.
    await page.keyboard.press('r');
    await page.waitForTimeout(700);

    const after = await readFurniture(page);
    // Порядок в localStorage соответствует порядку размещения независимо от
    // того, по какому стулу кликнули — первый размещённый — это `before[0]`.
    const firstAfter = after!.find((f: { id: string }) => f.id === before![0].id);
    const secondAfter = after!.find((f: { id: string }) => f.id === before![1].id);
    expect(firstAfter.rotation).toBe(90);
    expect(secondAfter.rotation).toBe(0);
  });

  test('E2E-27: Delete key removes the selected piece', async ({ page }) => {
    await gotoStage3Furniture(page);

    await placeChair(page, 0.7, 0.4);
    const before = await readFurniture(page);
    expect(before).toHaveLength(1);

    // Кликаем по стулу для выбора.
    const canvas = page.locator('.konvajs-content canvas').first();
    const box = await canvas.boundingBox();
    if (!box) throw new Error('canvas has no bounding box');
    await page.mouse.click(box.x + box.width * 0.7, box.y + box.height * 0.4);
    await page.waitForTimeout(150);

    await page.keyboard.press('Delete');
    await page.waitForTimeout(700);

    const after = await readFurniture(page);
    expect(after).toHaveLength(0);
  });
});
