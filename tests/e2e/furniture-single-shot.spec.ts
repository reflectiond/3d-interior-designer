import { test, expect, type Page } from '@playwright/test';

// F8.6 (v1.12.0) — режим размещения автоматически сбрасывается после успешного
// commit'а — зеркалит single-shot поведение редактора (F11.2.9).

const STORE_KEY = '3d-interior-designer-project';

async function gotoStage3Furniture(page: Page) {
  // Канва Layout-1 плюс полосы линеек (F13.1) выходят за стандартный viewport
  // 720 px, скрывая нижнюю половину. Делаем viewport достаточно высоким, чтобы
  // тестовые клики всегда попадали внутрь.
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

test.describe('Furniture single-shot (F8.6 v1.12.0)', () => {
  test('placing one chair clears placement mode — second click does not spawn another', async ({
    page,
  }) => {
    await gotoStage3Furniture(page);

    await page.getByRole('button', { name: /Стул/ }).first().click();
    const canvas = page.locator('.konvajs-content canvas').first();
    const box = await canvas.boundingBox();
    expect(box).not.toBeNull();

    // Первый клик — стул размещён
    await page.mouse.click(box!.x + box!.width * 0.7, box!.y + box!.height * 0.4);
    await expect(page.getByText('Размещённая мебель')).toBeVisible();
    await page.waitForTimeout(700);
    const afterFirst = await readFurniture(page);
    expect(afterFirst).toHaveLength(1);

    // Подсказка о режиме размещения должна исчезнуть (placingItem теперь null)
    await expect(page.getByText(/Кликните на 2D-схему, чтобы разместить «Стул»/)).toHaveCount(0);

    // Второй клик по другому пустому тайлу — не должен добавить второй стул
    await page.mouse.click(box!.x + box!.width * 0.3, box!.y + box!.height * 0.6);
    await page.waitForTimeout(700);
    const afterSecond = await readFurniture(page);
    expect(afterSecond).toHaveLength(1);
  });

  test('placing two chairs requires re-clicking the catalog button', async ({ page }) => {
    await gotoStage3Furniture(page);

    const chairBtn = page.getByRole('button', { name: /Стул/ }).first();
    const canvas = page.locator('.konvajs-content canvas').first();
    const box = await canvas.boundingBox();
    expect(box).not.toBeNull();

    // Ставим первый
    await chairBtn.click();
    await expect(page.getByText(/Кликните на 2D-схему/)).toBeVisible();
    await page.mouse.click(box!.x + box!.width * 0.7, box!.y + box!.height * 0.4);
    await expect(page.getByText('Размещённая мебель')).toBeVisible();

    // Снова берём из каталога, чтобы поставить второй — ждём подсказку, чтобы убедиться,
    // что React перерисовался. Позиция выбрана так, чтобы обойти буфер двери layout-1
    // на x=11 (door_bedroom1_corridor).
    await chairBtn.click();
    await expect(page.getByText(/Кликните на 2D-схему/)).toBeVisible();
    await page.mouse.click(box!.x + box!.width * 0.1, box!.y + box!.height * 0.8);
    await page.waitForTimeout(700);

    const state = await readFurniture(page);
    expect(state).toHaveLength(2);
  });
});
