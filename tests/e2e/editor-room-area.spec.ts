import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';

// F11.3 (v1.14.0) — drag-create комнаты в редакторе:
// - минимум 4 м² (= 64 тайла² при TILE_SIZE = 0.25 м);
// - jшибочные drag'и (overlap, слишком мала) НЕ создают комнату;
// - mouseLeave не теряет anchor; release outside Stage = cancel.
//
// Konva рендерится в canvas — pixel-detection превью нестабилен (opacity
// 0.3 блендит цвет с фоном), поэтому критериями выбраны поведение через
// properties-panel и подсветка валидации (issue panel) уже размещённой
// комнаты.

const TOKEN = 'dev-only-token-replace-in-prod';
const SCALE = 24;

async function openEditor(page: Page) {
  await page.goto(`/?editor=1&token=${TOKEN}`);
  await expect(page.getByTestId('layout-editor')).toBeVisible();
  await expect(page.getByTestId('layout-editor-canvas')).toBeVisible();
}

function tilePoint(tx: number, ty: number) {
  return { x: tx * SCALE + SCALE / 2, y: ty * SCALE + SCALE / 2 };
}

async function canvasBox(page: Page) {
  const box = await page
    .getByTestId('layout-editor-canvas')
    .locator('canvas')
    .first()
    .boundingBox();
  if (!box) throw new Error('canvas has no bounding box');
  return box;
}

test.describe('Editor — minimum room area 4 m² (F11.3)', () => {
  test('F11.3.1: drag 4×4 (1 m²) НЕ создаёт комнату', async ({ page }) => {
    await openEditor(page);
    await page.getByTestId('tool-room').click();
    const box = await canvasBox(page);

    const a = tilePoint(2, 2);
    const b = tilePoint(5, 5); // 4×4 = 16 тайлов² = 1 м²
    await page.mouse.move(box.x + a.x, box.y + a.y);
    await page.mouse.down();
    await page.mouse.move(box.x + b.x, box.y + b.y, { steps: 10 });
    await page.mouse.up();

    // Комната не создана — selection пуст.
    await expect(page.getByTestId('properties-panel')).toContainText('Объект не выбран');
  });

  test('F11.3.1: drag 8×8 (4 m²) — комната создаётся', async ({ page }) => {
    await openEditor(page);
    await page.getByTestId('tool-room').click();
    const box = await canvasBox(page);

    const a = tilePoint(2, 2);
    const b = tilePoint(9, 9); // 8×8 = 64 тайла² = 4 м²
    await page.mouse.move(box.x + a.x, box.y + a.y);
    await page.mouse.down();
    await page.mouse.move(box.x + b.x, box.y + b.y, { steps: 10 });
    await page.mouse.up();

    await expect(page.getByTestId('properties-panel')).toContainText('bedroom_1');
  });

  test('F11.3.1: drag 4×16 (4 m², 1×4 м) — комната создаётся (геометрия не ограничена)', async ({
    page,
  }) => {
    await openEditor(page);
    await page.getByTestId('tool-room').click();
    const box = await canvasBox(page);

    const a = tilePoint(2, 2);
    const b = tilePoint(5, 17); // 4×16 = 64 тайла² = 4 м² (1 м × 4 м)
    await page.mouse.move(box.x + a.x, box.y + a.y);
    await page.mouse.down();
    await page.mouse.move(box.x + b.x, box.y + b.y, { steps: 10 });
    await page.mouse.up();

    await expect(page.getByTestId('properties-panel')).toContainText('bedroom_1');
  });

  test('F11.3.2: drag поверх существующей комнаты — новая не создаётся', async ({ page }) => {
    await openEditor(page);
    await page.getByTestId('tool-room').click();
    const box = await canvasBox(page);

    // Первая комната: 8×8 на [2..10, 2..10].
    const a1 = tilePoint(2, 2);
    const b1 = tilePoint(9, 9);
    await page.mouse.move(box.x + a1.x, box.y + a1.y);
    await page.mouse.down();
    await page.mouse.move(box.x + b1.x, box.y + b1.y, { steps: 10 });
    await page.mouse.up();
    await expect(page.getByTestId('properties-panel')).toContainText('bedroom_1');

    // Single-shot tool сбросил инструмент в select — повторно активируем room.
    await page.getByTestId('tool-room').click();

    // Второй drag — пересекает первую комнату.
    const a2 = tilePoint(5, 5);
    const b2 = tilePoint(15, 15);
    await page.mouse.move(box.x + a2.x, box.y + a2.y);
    await page.mouse.down();
    await page.mouse.move(box.x + b2.x, box.y + b2.y, { steps: 10 });
    await page.mouse.up();

    // bedroom_2 НЕ создаётся.
    await expect(page.getByTestId('properties-panel')).not.toContainText('bedroom_2');
  });

  test('F11.3.4: курсор уходит за канву и возвращается — anchor не теряется, комната создаётся', async ({
    page,
  }) => {
    await openEditor(page);
    await page.getByTestId('tool-room').click();
    const box = await canvasBox(page);

    const a = tilePoint(2, 2);
    const b = tilePoint(9, 9); // commit на 8×8 = 4 м²
    await page.mouse.move(box.x + a.x, box.y + a.y);
    await page.mouse.down();
    // Уходим за правую границу канвы.
    await page.mouse.move(box.x + box.width + 50, box.y + a.y, { steps: 5 });
    // Возвращаемся внутрь и отпускаем.
    await page.mouse.move(box.x + b.x, box.y + b.y, { steps: 10 });
    await page.mouse.up();

    await expect(page.getByTestId('properties-panel')).toContainText('bedroom_1');
  });

  test('F11.3.4: release снаружи канвы отменяет drag (комната не создаётся)', async ({ page }) => {
    await openEditor(page);
    await page.getByTestId('tool-room').click();
    const box = await canvasBox(page);

    const a = tilePoint(2, 2);
    await page.mouse.move(box.x + a.x, box.y + a.y);
    await page.mouse.down();
    // Уходим за границу и отпускаем там.
    await page.mouse.move(box.x + box.width + 50, box.y + box.height + 50, { steps: 10 });
    await page.mouse.up();

    await expect(page.getByTestId('properties-panel')).toContainText('Объект не выбран');
  });
});
