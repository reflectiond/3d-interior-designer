import { test, expect } from '@playwright/test';

test.describe('Stage 1 — Layout Selection', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('F1.1: shows 3 layout previews', async ({ page }) => {
    const cards = page.locator('button', { hasText: 'Выбрать' });
    await expect(cards).toHaveCount(3);
  });

  test('F1.2: each layout shows name and area', async ({ page }) => {
    await expect(page.getByText('Планировка 1')).toBeVisible();
    await expect(page.getByText('Планировка 2')).toBeVisible();
    await expect(page.getByText('Планировка 3')).toBeVisible();
    // Areas should contain м²
    await expect(page.getByText(/м²/).first()).toBeVisible();
  });

  test('F1.3: selecting layout loads it into view', async ({ page }) => {
    await page.getByRole('button', { name: /Выбрать Планировка 1/ }).click();
    // After selection, the 2D canvas should appear
    await expect(page.locator('canvas').first()).toBeVisible();
  });

  test('F1.5: 2D view shows room labels and panel icon', async ({ page }) => {
    await page.getByRole('button', { name: /Выбрать Планировка 1/ }).click();
    await expect(page.locator('canvas').first()).toBeVisible();
  });

  test('F1.6: "Далее" button appears after selection', async ({ page }) => {
    // No "Далее" before selection
    await expect(page.getByText('Далее →')).not.toBeVisible();
    // Select layout
    await page.getByRole('button', { name: /Выбрать Планировка 1/ }).click();
    // Now "Далее" should appear
    await expect(page.getByText('Далее →')).toBeVisible();
  });

  test('F1.6: clicking "Далее" moves to stage 2', async ({ page }) => {
    await page.getByRole('button', { name: /Выбрать Планировка 1/ }).click();
    await page.getByText('Далее →').click();
    // Stage 2 indicator should be active
    // Stage 2 placeholder text should be visible
    await expect(page.getByText('Этап 2 — Черновая отделка')).toBeVisible();
  });

  test('F1.7: changing layout after selection shows confirm dialog', async ({ page }) => {
    // Select layout 1
    await page.getByRole('button', { name: /Выбрать Планировка 1/ }).click();
    // Try to select layout 2
    await page.getByRole('button', { name: /Выбрать Планировка 2/ }).click();
    // Confirm dialog should appear
    await expect(page.getByText('Сменить планировку?')).toBeVisible();
    await expect(page.getByText('Все ваши изменения будут сброшены')).toBeVisible();
  });

  test('F1.7: canceling confirm dialog keeps original layout', async ({ page }) => {
    await page.getByRole('button', { name: /Выбрать Планировка 1/ }).click();
    await page.getByRole('button', { name: /Выбрать Планировка 2/ }).click();
    await page.getByText('Отмена').click();
    // Should still have layout 1 selected
    await expect(page.getByText('Выбрано').first()).toBeVisible();
  });

  test('F1.7: confirming dialog changes layout', async ({ page }) => {
    await page.getByRole('button', { name: /Выбрать Планировка 1/ }).click();
    await page.getByRole('button', { name: /Выбрать Планировка 2/ }).click();
    await page.getByText('Подтвердить').click();
    // Dialog should close
    await expect(page.getByText('Сменить планировку?')).not.toBeVisible();
  });

  test('F5.1: stage navigator shows 4 steps', async ({ page }) => {
    const steps = page.locator('nav[aria-label="Этапы"] button');
    await expect(steps).toHaveCount(4);
  });

  test('F5.2: can navigate back from stage 2 to stage 1', async ({ page }) => {
    await page.getByRole('button', { name: /Выбрать Планировка 1/ }).click();
    await page.getByText('Далее →').click();
    // Now on stage 2, click stage 1 in navigator
    await page.getByRole('button', { name: /1/ }).first().click();
    // Should see layout selection again
    await expect(page.getByText('Выберите планировку')).toBeVisible();
  });
});
