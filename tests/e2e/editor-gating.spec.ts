import { test, expect } from '@playwright/test';

// dev/preview-сборка использует значение из .env; тесты полагаются на то, что
// это известный dev-токен. Если он изменится — обнови здесь.
const TOKEN = 'dev-only-token-replace-in-prod';

test.describe('Layout editor — access gating (F11.1.x, SEC-7)', () => {
  test('F11.1.1: no query → main app loads, editor stays hidden', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('h1')).toContainText('3D Interior Designer');
    await expect(page.getByTestId('layout-editor')).toHaveCount(0);
  });

  test('F11.1.1: editor=1 with wrong token → main app loads, editor stays hidden', async ({
    page,
  }) => {
    await page.goto('/?editor=1&token=wrong');
    await expect(page.locator('h1')).toContainText('3D Interior Designer');
    await expect(page.getByTestId('layout-editor')).toHaveCount(0);
  });

  test('F11.1.1 + F11.1.4: missing editor flag → token alone is not enough', async ({ page }) => {
    await page.goto(`/?token=${TOKEN}`);
    await expect(page.locator('h1')).toContainText('3D Interior Designer');
    await expect(page.getByTestId('layout-editor')).toHaveCount(0);
  });

  test('F11.1.1: correct token opens the editor and hides the main app', async ({ page }) => {
    await page.goto(`/?editor=1&token=${TOKEN}`);
    await expect(page.getByTestId('layout-editor')).toBeVisible();
    // Основное приложение (StageNavigator) не должно рендериться рядом с редактором (F11.1.4)
    await expect(page.getByRole('navigation', { name: 'Этапы' })).toHaveCount(0);
    // Заголовок — редактора, а не основного приложения
    await expect(page.locator('h1')).toContainText('Редактор планировок');
  });

  test('SEC-7: empty token query value cannot unlock the editor', async ({ page }) => {
    await page.goto('/?editor=1&token=');
    await expect(page.getByTestId('layout-editor')).toHaveCount(0);
    await expect(page.locator('h1')).toContainText('3D Interior Designer');
  });
});
