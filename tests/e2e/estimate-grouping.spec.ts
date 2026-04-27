import { test, expect } from '@playwright/test';

test.describe('Estimate grouping (F9.1)', () => {
  test('E2E-13: clicking a group toggles detail rows; default state is collapsed', async ({
    page,
  }) => {
    await page.goto('/');
    await page.getByRole('button', { name: /Выбрать Планировка 1/ }).click();

    // Stage 4
    await page.locator('nav[aria-label="Этапы"] button').nth(3).click();
    await expect(page.getByRole('heading', { name: 'Итоговая смета' })).toBeVisible();

    // F9.1.5 — first row in the rough section should be «Стяжка пола»
    const screedRow = page.getByRole('button', { name: /Стяжка пола/ });
    await expect(screedRow).toBeVisible();
    await expect(screedRow).toHaveAttribute('aria-expanded', 'false');

    // Detail rows should not be visible while collapsed
    await expect(page.getByText(/Стяжка пола — /)).not.toBeVisible();

    // Click → expanded; detail rows under «Стяжка пола» become visible
    await screedRow.click();
    await expect(screedRow).toHaveAttribute('aria-expanded', 'true');
    await expect(page.getByText(/Стяжка пола — /).first()).toBeVisible();

    // Click again → collapsed; detail rows hidden
    await screedRow.click();
    await expect(screedRow).toHaveAttribute('aria-expanded', 'false');
    await expect(page.getByText(/Стяжка пола — /)).not.toBeVisible();
  });

  test('F9.1.6: grand total ribbon is present after grouping', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: /Выбрать Планировка 1/ }).click();
    await page.locator('nav[aria-label="Этапы"] button').nth(3).click();

    // The total ribbon contains «Итого:» and at least two ₽-formatted numbers
    await expect(page.getByText('Итого:')).toBeVisible();
    const rubles = page.getByText(/₽/);
    expect(await rubles.count()).toBeGreaterThanOrEqual(2);
  });
});
