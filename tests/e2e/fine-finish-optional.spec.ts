import { test, expect, type Page } from '@playwright/test';

// E2E-21 (v1.9.0, F3.1.3 + F3.2.5) — «Без покрытия» is the default for both
// floor and wall covering. With nothing touched on Stage 3, the Stage 4
// estimate must not list any fine-finish floor or wall items.

async function gotoStage4(page: Page) {
  await page.goto('/');
  await page.getByRole('button', { name: /Выбрать Планировка 1/ }).click();
  await page.locator('nav[aria-label="Этапы"] button').nth(3).click();
  await expect(page.getByText('Итоговая смета')).toBeVisible();
}

test.describe('Optional fine finish — «Без покрытия» по умолчанию (F3.1.3 / F3.2.5)', () => {
  test('E2E-21: untouched Stage 3 → estimate has no floor/wall covering rows', async ({ page }) => {
    await gotoStage4(page);

    // The «Чистовая отделка» section should be absent OR exist only for furniture-type
    // groups (we never enter Stage 3 → no furniture either, so the section should not
    // render at all).
    await expect(page.getByRole('heading', { name: 'Чистовая отделка' })).toHaveCount(0);

    // Stage 4 lists each work-type group; with all rooms on `none` no
    // floor/wall covering group should appear at all.
    const fineLabels = ['Линолеум', 'Ламинат', 'Плитка', 'Кварцвинил', 'Покраска', 'Обои'];
    for (const label of fineLabels) {
      const occurences = await page.getByText(label, { exact: false }).count();
      expect(occurences, `unexpected fine-finish entry for ${label}`).toBe(0);
    }

    // Rough finish must still appear (it's mandatory)
    await expect(page.getByRole('heading', { name: 'Черновая отделка' })).toBeVisible();
  });

  test('E2E-21b: switching one room back to laminate brings the fine-finish row back', async ({
    page,
  }) => {
    // Start at Stage 3 → Покрытие пола
    await page.goto('/');
    await page.getByRole('button', { name: /Выбрать Планировка 1/ }).click();
    await page.locator('nav[aria-label="Этапы"] button').nth(2).click();
    await expect(page.getByText('Покрытие пола')).toBeVisible();

    // Default is «Без покрытия» (`none`); pick laminate for the first room
    await page.locator('select').first().selectOption('laminate');

    // Hop to Stage 4 and verify the laminate group is now in the «Чистовая отделка» section
    await page.locator('nav[aria-label="Этапы"] button').nth(3).click();
    await expect(page.getByRole('heading', { name: 'Чистовая отделка' })).toBeVisible();
    await expect(page.getByText('Ламинат').first()).toBeVisible();
  });
});
