import { test, expect } from '@playwright/test';

async function readKonvaCanvas(page: import('@playwright/test').Page) {
  return page.evaluate(() => {
    const canvas = document.querySelector('.konvajs-content canvas') as HTMLCanvasElement | null;
    return canvas ? canvas.toDataURL('image/png') : null;
  });
}

async function countHeatedPixels(page: import('@playwright/test').Page) {
  return page.evaluate(() => {
    const canvas = document.querySelector('.konvajs-content canvas') as HTMLCanvasElement | null;
    if (!canvas) return -1;
    const ctx = canvas.getContext('2d');
    if (!ctx) return -1;
    const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);
    // PALETTE.heated_floor.icon = #E64A19 → rgb(230, 74, 25). При opacity 0.4 поверх
    // пастельной заливки получаются тёплые красно-оранжевые пиксели. Считаем пиксели
    // в этом hue-диапазоне: красный доминирует, зелёный и синий заметно ниже.
    let count = 0;
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      if (r > 180 && g > 80 && g < 170 && b > 50 && b < 150 && r - g > 50) {
        count++;
      }
    }
    return count;
  });
}

test.describe('Heated floor (F6.1)', () => {
  test('E2E-16: enabling «Тёплый пол» repaints the 2D plan with coral overlay', async ({
    page,
  }) => {
    await page.goto('/');
    await page.getByRole('button', { name: /Выбрать Планировка 1/ }).click();
    await page.getByText('Далее →').click();

    // Ждём готовности Stage 2
    await expect(page.getByText('Стяжка пола')).toBeVisible();

    const before = await readKonvaCanvas(page);
    expect(before).not.toBeNull();

    // Включаем тёплый пол для первой комнаты
    const heatedRadios = page.getByRole('radio', { name: 'Тёплый пол' });
    await heatedRadios.first().check();

    // Даём Konva re-render
    await page.waitForTimeout(200);

    const after = await readKonvaCanvas(page);
    expect(after).not.toBeNull();
    expect(after).not.toBe(before);

    // Иконки тепла в активированной комнате должны дать заметное число тёплых пикселей
    const heatedPixelCount = await countHeatedPixels(page);
    expect(heatedPixelCount).toBeGreaterThan(20);
  });
});
