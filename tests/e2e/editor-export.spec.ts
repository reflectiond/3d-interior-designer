import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import * as fs from 'node:fs/promises';
import { LayoutSchema } from '../../src/domain/geometry/types';

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

async function clickTile(page: Page, tx: number, ty: number) {
  const canvas = page.getByTestId('layout-editor-canvas').locator('canvas').first();
  const box = await canvas.boundingBox();
  if (!box) throw new Error('canvas has no bounding box');
  const p = tilePoint(tx, ty);
  await page.mouse.click(box.x + p.x, box.y + p.y);
}

async function dragTile(
  page: Page,
  fromTile: { x: number; y: number },
  toTile: { x: number; y: number },
) {
  const canvas = page.getByTestId('layout-editor-canvas').locator('canvas').first();
  const box = await canvas.boundingBox();
  if (!box) throw new Error('canvas has no bounding box');
  const a = tilePoint(fromTile.x, fromTile.y);
  const b = tilePoint(toTile.x, toTile.y);
  await page.mouse.move(box.x + a.x, box.y + a.y);
  await page.mouse.down();
  await page.mouse.move(box.x + b.x, box.y + b.y, { steps: 10 });
  await page.mouse.up();
}

test.describe('Layout editor — validation + export (F11.2.4, F11.2.5)', () => {
  test('F11.2.4: empty editor reports "no rooms" and "no panel"; export is disabled', async ({
    page,
  }) => {
    await openEditor(page);
    await expect(page.getByTestId('validation-panel')).toContainText('хотя бы одна комната');
    await expect(page.getByTestId('validation-panel')).toContainText('Электрощиток не размещён');
    await expect(page.getByTestId('export-json')).toBeDisabled();
  });

  test('F11.2.4: window placed off any wall is flagged in real time', async ({ page }) => {
    await openEditor(page);
    await page.getByTestId('tool-room').click();
    // F11.2.8 (v1.10.0): wall snap работает в пределах ~3 тайлов, поэтому комната
    // должна быть достаточно большой, чтобы тестовый клик попал в истинный
    // интерьер — > 3 тайлов от каждой стены.
    await dragTile(page, { x: 2, y: 2 }, { x: 17, y: 17 });
    await page.getByTestId('tool-panel').click();
    await clickTile(page, 5, 5);

    await page.getByTestId('tool-window').click();
    // Обе концевые точки в глубоком интерьере — за пределами WALL_SNAP_RADIUS от любой стены.
    await clickTile(page, 9, 9);
    await clickTile(page, 12, 9);

    await expect(page.getByTestId('validation-panel')).toContainText('не лежит на стене');
    await expect(page.getByTestId('export-json')).toBeDisabled();
  });

  test('E2E-18: minimal valid layout exports JSON that parses with LayoutSchema (F11.3.2)', async ({
    page,
  }) => {
    await openEditor(page);

    // Рисуем одну спальню 8×8 в верхнем левом углу
    await page.getByTestId('tool-room').click();
    await dragTile(page, { x: 0, y: 0 }, { x: 7, y: 7 });

    // Ставим электрощит внутри спальни
    await page.getByTestId('tool-panel').click();
    await clickTile(page, 2, 2);

    // Валидация должна быть чистой, кнопка экспорта — доступной
    await expect(page.getByTestId('validation-status')).toContainText('всё ок');
    await expect(page.getByTestId('export-json')).toBeEnabled();

    // Триггерим скачивание и инспектируем JSON
    const downloadPromise = page.waitForEvent('download');
    await page.getByTestId('export-json').click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/^layout_99_.*\.json$/);

    const path = await download.path();
    const raw = await fs.readFile(path, 'utf-8');
    const parsed = LayoutSchema.parse(JSON.parse(raw));
    expect(parsed.rooms).toHaveLength(1);
    expect(parsed.rooms[0].type).toBe('bedroom');
    expect(parsed.electricalPanel).toEqual({ x: 2, y: 2 });
    expect(parsed.windows).toEqual([]);
    expect(parsed.doors).toEqual([]);
  });

  test('F11.2.5: a layout with windows and doors round-trips through the schema unchanged', async ({
    page,
  }) => {
    await openEditor(page);

    // Две смежные комнаты, щит в одной, внутренняя дверь, внешнее окно.
    // F11.2.9 (v1.10.0): каждое размещение возвращает в select (single-shot),
    // поэтому для второй комнаты нужно снова активировать инструмент room.
    await page.getByTestId('tool-room').click();
    await dragTile(page, { x: 0, y: 0 }, { x: 7, y: 11 });
    await page.getByTestId('tool-room').click();
    await dragTile(page, { x: 8, y: 0 }, { x: 15, y: 11 });

    await page.getByTestId('tool-panel').click();
    await clickTile(page, 2, 2);

    await page.getByTestId('tool-window').click();
    await clickTile(page, 2, 0);
    await clickTile(page, 5, 0);

    await page.getByTestId('tool-door').click();
    await clickTile(page, 8, 4);
    await clickTile(page, 8, 7);

    await expect(page.getByTestId('validation-status')).toContainText('всё ок');

    const downloadPromise = page.waitForEvent('download');
    await page.getByTestId('export-json').click();
    const download = await downloadPromise;
    const path = await download.path();
    const raw = await fs.readFile(path, 'utf-8');
    const parsed = LayoutSchema.parse(JSON.parse(raw));

    expect(parsed.rooms).toHaveLength(2);
    expect(parsed.windows).toHaveLength(1);
    expect(parsed.doors).toHaveLength(1);
    expect(parsed.windows[0].sill_height_m).toBe(0.9);
    expect(parsed.doors[0].height_m).toBe(2.1);
  });
});
