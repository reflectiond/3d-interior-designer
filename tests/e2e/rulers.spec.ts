import { test, expect, type Page } from '@playwright/test';

// F13.1 (v1.11.0) — переключатель измерительных линеек на 2D-канве. Линейки
// рендерятся SVG-полосами снаружи Konva Stage, поэтому не попадают в
// экспорт `stage.toDataURL()`. Состояние переключателя сохраняется в localStorage.

const STORAGE_KEY = '3d-interior-designer-rulers-enabled';

async function gotoStage1WithLayout1(page: Page) {
  await page.goto('/');
  await page.getByRole('button', { name: /Выбрать Планировка 1/ }).click();
  await expect(page.locator('.konvajs-content canvas').first()).toBeVisible();
}

test.describe('Measurement rulers (F13.1 v1.11.0+)', () => {
  test('F13.1.6 (v1.12.0): rulers are ON by default for a fresh user', async ({ page }) => {
    await gotoStage1WithLayout1(page);
    // Никакого прежнего значения в localStorage → линейки сразу видимы.
    await expect(page.getByTestId('view2d-ruler-horizontal')).toBeVisible();
    await expect(page.getByTestId('view2d-ruler-vertical')).toBeVisible();
  });

  test('F13.1.3: toggle flips state and persists to localStorage', async ({ page }) => {
    await gotoStage1WithLayout1(page);

    // F13.1.6: по умолчанию ON → линейки видимы изначально.
    await expect(page.getByTestId('view2d-ruler-horizontal')).toBeVisible();

    // Выключаем
    await page.getByTestId('view2d-rulers-toggle').click();
    await expect(page.getByTestId('view2d-ruler-horizontal')).toHaveCount(0);
    await expect(page.getByTestId('view2d-ruler-vertical')).toHaveCount(0);

    // В localStorage лежит «0»
    const storedOff = await page.evaluate((key) => localStorage.getItem(key), STORAGE_KEY);
    expect(storedOff).toBe('0');

    // Включаем обратно
    await page.getByTestId('view2d-rulers-toggle').click();
    await expect(page.getByTestId('view2d-ruler-horizontal')).toBeVisible();
    const storedOn = await page.evaluate((key) => localStorage.getItem(key), STORAGE_KEY);
    expect(storedOn).toBe('1');
  });

  test('F13.1.2: horizontal ruler labels every metre', async ({ page }) => {
    // Заранее ставим storage, чтобы линейки были включены при первом рендере
    await page.addInitScript((key) => localStorage.setItem(key, '1'), STORAGE_KEY);
    await gotoStage1WithLayout1(page);

    // Сетка Layout 1 — 36 тайлов в ширину × 0.25 м = 9 м. Ожидаем подписи 0 м … 9 м.
    const horiz = page.getByTestId('view2d-ruler-horizontal');
    await expect(horiz).toContainText('0 м');
    await expect(horiz).toContainText('1 м');
    await expect(horiz).toContainText('5 м');
    await expect(horiz).toContainText('9 м');
  });

  test('F13.1.1: editor canvas also gets rulers under the same toggle', async ({ page }) => {
    const TOKEN = 'dev-only-token-replace-in-prod';
    await page.addInitScript((key) => localStorage.setItem(key, '1'), STORAGE_KEY);
    await page.goto(`/?editor=1&token=${TOKEN}`);
    await expect(page.getByTestId('layout-editor-canvas')).toBeVisible();
    await expect(page.getByTestId('editor-ruler-horizontal')).toBeVisible();
    await expect(page.getByTestId('editor-ruler-vertical')).toBeVisible();
  });
});
