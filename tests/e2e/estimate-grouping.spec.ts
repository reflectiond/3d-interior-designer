import { test, expect } from '@playwright/test';

test.describe('Estimate grouping (F9.1)', () => {
  test('E2E-13: clicking a group toggles detail rows; default state is collapsed', async ({
    page,
  }) => {
    await page.goto('/');
    await page.getByRole('button', { name: /Выбрать Планировка 1/ }).click();

    // Stage 4
    await page.locator('nav[aria-label="Этапы"] button').nth(3).click(); // переход на этап 4
    await expect(page.getByRole('heading', { name: 'Итоговая смета' })).toBeVisible();

    // F9.1.5 — первая строка в разделе «Черновая отделка» должна быть «Стяжка пола»
    const screedRow = page.getByRole('button', { name: /Стяжка пола/ });
    await expect(screedRow).toBeVisible();
    await expect(screedRow).toHaveAttribute('aria-expanded', 'false');

    // Строки-детали не должны быть видимы, пока группа свёрнута
    await expect(page.getByText(/Стяжка пола — /)).not.toBeVisible();

    // Клик → развёрнуто; строки-детали под «Стяжка пола» становятся видимыми
    await screedRow.click();
    await expect(screedRow).toHaveAttribute('aria-expanded', 'true');
    await expect(page.getByText(/Стяжка пола — /).first()).toBeVisible();

    // Клик снова → свёрнуто; строки-детали скрыты
    await screedRow.click();
    await expect(screedRow).toHaveAttribute('aria-expanded', 'false');
    await expect(page.getByText(/Стяжка пола — /)).not.toBeVisible();
  });

  test('F9.1.6: grand total ribbon is present after grouping', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: /Выбрать Планировка 1/ }).click();
    await page.locator('nav[aria-label="Этапы"] button').nth(3).click();

    // Лента итога содержит «Итого:» и хотя бы два числа в формате ₽
    await expect(page.getByText('Итого:')).toBeVisible();
    const rubles = page.getByText(/₽/);
    expect(await rubles.count()).toBeGreaterThanOrEqual(2);
  });
});
