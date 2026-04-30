import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// F14 (v1.14.0) — пользовательские планировки: импорт JSON через UI на
// Stage 1, persistence в localStorage, отображение наравне со встроенными,
// удаление через крестик.

const layout1Path = resolve(process.cwd(), 'src/data/layouts/layout1.json');
const layout1Json = readFileSync(layout1Path, 'utf8');

test.describe('F14 — Custom layouts import', () => {
  test('F14.1, F14.3: import valid JSON adds a card with «Своя» badge', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('button', { name: /Выбрать Планировка 1/ })).toBeVisible();

    // Изменим имя в импортируемой копии чтобы не путалась со встроенной №1.
    const json = JSON.parse(layout1Json);
    json.name = 'Моя планировка';

    const fileChooserPromise = page.waitForEvent('filechooser');
    await page.getByTestId('import-layout-btn').click();
    const fileChooser = await fileChooserPromise;
    await fileChooser.setFiles({
      name: 'my-layout.json',
      mimeType: 'application/json',
      buffer: Buffer.from(JSON.stringify(json), 'utf8'),
    });

    // Карточка появилась со «Своя» badge.
    await expect(page.getByText('Своя', { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: /Выбрать Моя планировка/ })).toBeVisible();
  });

  test('F14.7: import → select → reload preserves the custom layout', async ({ page }) => {
    await page.goto('/');

    const json = JSON.parse(layout1Json);
    json.name = 'Сохранённая планировка';

    const fileChooserPromise = page.waitForEvent('filechooser');
    await page.getByTestId('import-layout-btn').click();
    const fileChooser = await fileChooserPromise;
    await fileChooser.setFiles({
      name: 'saved.json',
      mimeType: 'application/json',
      buffer: Buffer.from(JSON.stringify(json), 'utf8'),
    });

    await expect(
      page.getByRole('button', { name: /Выбрать Сохранённая планировка/ }),
    ).toBeVisible();

    // Reload — карточка снова появляется (persistence через localStorage).
    await page.reload();
    await expect(
      page.getByRole('button', { name: /Выбрать Сохранённая планировка/ }),
    ).toBeVisible();
  });

  test('F14.4: «×» удаляет импортированную карточку после confirm', async ({ page }) => {
    await page.goto('/');

    const json = JSON.parse(layout1Json);
    json.name = 'Удаляемая';

    const fileChooserPromise = page.waitForEvent('filechooser');
    await page.getByTestId('import-layout-btn').click();
    const fileChooser = await fileChooserPromise;
    await fileChooser.setFiles({
      name: 'del.json',
      mimeType: 'application/json',
      buffer: Buffer.from(JSON.stringify(json), 'utf8'),
    });
    await expect(page.getByRole('button', { name: /Выбрать Удаляемая/ })).toBeVisible();

    // Подтверждаем confirm-диалог автоматически.
    page.once('dialog', (d) => d.accept());
    await page.getByTestId('layout-card-delete').click();

    await expect(page.getByRole('button', { name: /Выбрать Удаляемая/ })).toHaveCount(0);
  });

  test('F14.1: невалидный JSON показывает alert и не создаёт карточку', async ({ page }) => {
    await page.goto('/');
    const initialCardCount = await page.getByText('Своя', { exact: true }).count();

    page.once('dialog', (d) => d.accept());

    const fileChooserPromise = page.waitForEvent('filechooser');
    await page.getByTestId('import-layout-btn').click();
    const fileChooser = await fileChooserPromise;
    await fileChooser.setFiles({
      name: 'broken.json',
      mimeType: 'application/json',
      buffer: Buffer.from('{"id":1}', 'utf8'), // отсутствуют обязательные поля
    });

    // Никаких новых «Своя» badge.
    await expect(page.getByText('Своя', { exact: true })).toHaveCount(initialCardCount);
  });
});
