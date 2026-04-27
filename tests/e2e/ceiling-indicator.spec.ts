import { test, expect } from '@playwright/test';

async function readKonvaCanvas(page: import('@playwright/test').Page) {
  return page.evaluate(() => {
    const canvas = document.querySelector('.konvajs-content canvas') as HTMLCanvasElement | null;
    return canvas ? canvas.toDataURL('image/png') : null;
  });
}

test.describe('Ceiling type indicator (F6.3)', () => {
  test('F6.3.x: switching ceiling type re-renders the 2D plan', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: /Выбрать Планировка 1/ }).click();
    await page.getByText('Далее →').click();
    await expect(page.getByText('Стяжка пола')).toBeVisible();

    // Open ceiling tab
    await page.getByRole('button', { name: 'Потолок' }).click();
    await expect(page.getByRole('heading', { name: 'Потолок' })).toBeVisible();

    const stretchSnapshot = await readKonvaCanvas(page);
    expect(stretchSnapshot).not.toBeNull();

    // Flip the first room to drywall
    await page.getByRole('radio', { name: 'Гипсокартон' }).first().check();
    await page.waitForTimeout(200);

    const drywallSnapshot = await readKonvaCanvas(page);
    expect(drywallSnapshot).not.toBeNull();
    expect(drywallSnapshot).not.toBe(stretchSnapshot);
  });
});
