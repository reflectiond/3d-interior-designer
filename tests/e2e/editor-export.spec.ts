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
    await dragTile(page, { x: 2, y: 2 }, { x: 11, y: 11 });
    await page.getByTestId('tool-panel').click();
    await clickTile(page, 5, 5);

    await page.getByTestId('tool-window').click();
    // Both endpoints inside the room interior — not on a wall
    await clickTile(page, 4, 6);
    await clickTile(page, 8, 6);

    await expect(page.getByTestId('validation-panel')).toContainText('не лежит на стене');
    await expect(page.getByTestId('export-json')).toBeDisabled();
  });

  test('E2E-18: minimal valid layout exports JSON that parses with LayoutSchema (F11.3.2)', async ({
    page,
  }) => {
    await openEditor(page);

    // Draw a single 8×8 bedroom in the upper-left
    await page.getByTestId('tool-room').click();
    await dragTile(page, { x: 0, y: 0 }, { x: 7, y: 7 });

    // Place the panel inside the bedroom
    await page.getByTestId('tool-panel').click();
    await clickTile(page, 2, 2);

    // Validation should be clean and the export button enabled
    await expect(page.getByTestId('validation-status')).toContainText('всё ок');
    await expect(page.getByTestId('export-json')).toBeEnabled();

    // Trigger the download and inspect the JSON
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

    // Two adjacent rooms, panel in one, an internal door, an external window.
    await page.getByTestId('tool-room').click();
    await dragTile(page, { x: 0, y: 0 }, { x: 7, y: 11 });
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
