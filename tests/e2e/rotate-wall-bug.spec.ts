import { test, expect } from '@playwright/test';

async function gotoStage3Furniture(page: import('@playwright/test').Page) {
  await page.goto('/');
  await page.getByRole('button', { name: /Выбрать Планировка 1/ }).click();
  await page.locator('nav[aria-label="Этапы"] button').nth(2).click();
  await expect(page.getByText('Покрытие пола')).toBeVisible();
  await page.getByRole('button', { name: 'Мебель', exact: true }).click();
}

test.describe('Furniture rotation validation (bug fix)', () => {
  test('rotating an 8×4 sofa whose 4×8 footprint would cross a wall is a no-op', async ({
    page,
  }) => {
    await gotoStage3Furniture(page);

    // Ставим диван в bedroom_2 (layout 1: x=0..12, y=15..32) вплотную к правой
    // стене — pos (4, 19) даёт диван x[4..12), y[19..23), оканчивающийся ровно
    // на правой стене x=12. После поворота в 4×8 y расширился бы до 27 (всё ещё
    // внутри 32), но поворот меняет w↔h вокруг того же bottom-left, и получится
    // x[4..8), y[19..27) — в этом случае помещается.
    //
    // Поэтому ставим диван в pos (5, 28). 8×4 занимает x[5..13), y[28..32).
    // x=5..13 — выходит до 13, но bedroom_2 это x=0..12, так что эта позиция
    // изначально была бы invalid. Используем (4, 28) — x[4..12), y[28..32)
    // внутри bedroom_2. После поворота в 4×8: x[4..8), y[28..36) — y превышает
    // gridHeight=32. findContainingRoom возвращает null → поворот должен быть отклонён.
    await page.getByRole('button', { name: /Диван/ }).first().click();
    const canvas = page.locator('.konvajs-content canvas').first();
    const box = await canvas.boundingBox();
    expect(box).not.toBeNull();

    // Layout1: 36 столбцов × 32 строки, канва рендерится в полном размере stage.
    // Клик в stage-координатах (4 + 4, 32 - 28 - 2) * SCALE = (8, 2) * 30 = (240, 60)
    // → tileX=8, tileY=30, но pos = floor(8, 30) → (8, 30); диван занимает
    // x[8..16), y[30..34). x=8..16 пересекает правую стену bedroom_2 на 12.
    //
    // Лучше: кликаем в относительную позицию канвы, которая ставит диван
    // вплотную к низу bedroom_2.
    // Stage-координаты для pos=(4, 28): cursor.x=120,
    // cursor.y=(32 - 28) * 30 = 120. Используем stage-координаты (124, 124).
    const stageCx = 124;
    const stageCy = 124;
    await page.mouse.click(
      box!.x + (stageCx / 1080) * box!.width,
      box!.y + (stageCy / 960) * box!.height,
    );
    await page.keyboard.press('Escape');
    await page.waitForTimeout(200);

    // Диван должен быть размещён
    await expect(page.getByText('Размещённая мебель')).toBeVisible();

    // Снимаем состояние канвы с диваном в повороте 0°
    const beforeRotate = await page.evaluate(() => {
      const c = document.querySelector('.konvajs-content canvas') as HTMLCanvasElement | null;
      return c ? c.toDataURL() : null;
    });
    expect(beforeRotate).not.toBeNull();

    // Клик «Повернуть». 4×8 footprint после поворота выходит за пределы комнаты
    // (или пересекает другую комнату), поэтому поворот должен быть молча отклонён
    // и канва должна остаться идентичной.
    const rotateBtn = page.getByRole('button', { name: 'Повернуть' }).first();
    await expect(rotateBtn).toBeVisible();
    await rotateBtn.click();
    await page.waitForTimeout(200);

    const afterRotate = await page.evaluate(() => {
      const c = document.querySelector('.konvajs-content canvas') as HTMLCanvasElement | null;
      return c ? c.toDataURL() : null;
    });
    // Поведение с багом: канва бы изменилась, потому что поворот удался в
    // wall-crossing позицию. После фикса: поворот отклонён → канва равна.
    expect(afterRotate).toBe(beforeRotate);
  });
});
