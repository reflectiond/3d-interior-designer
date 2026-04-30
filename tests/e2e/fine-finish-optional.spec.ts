import { test, expect, type Page } from '@playwright/test';

// E2E-21 (v1.9.0, F3.1.3 + F3.2.5) — «Без покрытия» — значение по умолчанию
// и для пола, и для стен. Если на Stage 3 ничего не трогать, в смете на Stage 4
// не должно быть ни одной строки чистовой отделки пола или стен.

async function gotoStage4(page: Page) {
  await page.goto('/');
  await page.getByRole('button', { name: /Выбрать Планировка 1/ }).click();
  await page.locator('nav[aria-label="Этапы"] button').nth(3).click();
  await expect(page.getByText('Итоговая смета')).toBeVisible();
}

test.describe('Optional fine finish — «Без покрытия» по умолчанию (F3.1.3 / F3.2.5)', () => {
  test('E2E-21: untouched Stage 3 → estimate has no floor/wall covering rows', async ({ page }) => {
    await gotoStage4(page);

    // Раздел «Чистовая отделка» должен отсутствовать ИЛИ существовать только для
    // furniture-групп (мы вообще не заходим на Stage 3 → мебели тоже нет, так что
    // раздел не должен рендериться).
    await expect(page.getByRole('heading', { name: 'Чистовая отделка' })).toHaveCount(0);

    // Stage 4 перечисляет группы по типу работ; со всеми комнатами на `none`
    // ни одной группы покрытий пола или стен появиться не должно.
    const fineLabels = ['Линолеум', 'Ламинат', 'Плитка', 'Кварцвинил', 'Покраска', 'Обои'];
    for (const label of fineLabels) {
      const occurences = await page.getByText(label, { exact: false }).count();
      expect(occurences, `unexpected fine-finish entry for ${label}`).toBe(0);
    }

    // Черновая отделка должна остаться (она обязательная)
    await expect(page.getByRole('heading', { name: 'Черновая отделка' })).toBeVisible();
  });

  test('E2E-21b: switching one room back to laminate brings the fine-finish row back', async ({
    page,
  }) => {
    // Начинаем на Stage 3 → «Покрытие пола»
    await page.goto('/');
    await page.getByRole('button', { name: /Выбрать Планировка 1/ }).click();
    await page.locator('nav[aria-label="Этапы"] button').nth(2).click();
    await expect(page.getByText('Покрытие пола')).toBeVisible();

    // По умолчанию «Без покрытия» (`none`); выбираем ламинат для первой комнаты
    await page.locator('select').first().selectOption('laminate');

    // Переходим на Stage 4 и проверяем, что группа «Ламинат» появилась в разделе «Чистовая отделка»
    await page.locator('nav[aria-label="Этапы"] button').nth(3).click();
    await expect(page.getByRole('heading', { name: 'Чистовая отделка' })).toBeVisible();
    await expect(page.getByText('Ламинат').first()).toBeVisible();
  });
});
