import { test, expect } from '@playwright/test';

async function gotoStage3Furniture(page: import('@playwright/test').Page) {
  await page.goto('/');
  await page.getByRole('button', { name: /Выбрать Планировка 1/ }).click();
  await page.locator('nav[aria-label="Этапы"] button').nth(2).click();
  await expect(page.getByText('Покрытие пола')).toBeVisible();
  await page.getByRole('button', { name: 'Мебель', exact: true }).click();
}

test.describe('Mirror furniture (F8.2)', () => {
  test('F8.4.2: clicking mirror button changes the canvas (label flips)', async ({ page }) => {
    await gotoStage3Furniture(page);

    // Ставим диван — 8×4 тайла, можно зеркалить, разрешён в living/bedroom.
    // bedroom_2 в Layout 1 покрывает тайлы (0..12, 15..32); целимся в (~3, ~19),
    // чтобы 8×4 footprint помещался чисто.
    await page.getByRole('button', { name: /Диван/ }).first().click();
    const canvas = page.locator('.konvajs-content canvas').first();
    const box = await canvas.boundingBox();
    expect(box).not.toBeNull();
    await page.mouse.click(box!.x + box!.width * 0.1, box!.y + box!.height * 0.4);
    await page.keyboard.press('Escape');
    await page.waitForTimeout(150);

    // Убеждаемся, что диван попал в список размещённой мебели (там появляется кнопка mirror)
    await expect(page.getByText('Размещённая мебель')).toBeVisible();

    // Снимаем состояние канвы до зеркалирования
    const before = await page.evaluate(() => {
      const c = document.querySelector('.konvajs-content canvas') as HTMLCanvasElement | null;
      return c ? c.toDataURL() : null;
    });
    expect(before).not.toBeNull();

    // Кликаем «Отзеркалить» рядом с диваном в списке размещённой мебели
    const mirrorBtn = page.getByRole('button', { name: 'Отзеркалить' }).first();
    await expect(mirrorBtn).toBeVisible();
    await mirrorBtn.click();
    await page.waitForTimeout(200);

    const after = await page.evaluate(() => {
      const c = document.querySelector('.konvajs-content canvas') as HTMLCanvasElement | null;
      return c ? c.toDataURL() : null;
    });
    // Mirror инвертирует подпись внутри прямоугольника, поэтому data URL канвы должен измениться
    expect(after).not.toBe(before);

    // Жмём ещё раз, чтобы перевернуть обратно — должны вернуться близко к оригиналу
    await mirrorBtn.click();
    await page.waitForTimeout(200);
    const restored = await page.evaluate(() => {
      const c = document.querySelector('.konvajs-content canvas') as HTMLCanvasElement | null;
      return c ? c.toDataURL() : null;
    });
    expect(restored).toBe(before);
  });
});
