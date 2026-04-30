import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';

const TOKEN = 'dev-only-token-replace-in-prod';

async function openEditor(page: Page) {
  // viewport-fixed (v1.17.0) — большая высота нужна для канвы редактора 32×32
  // тайла × 24 px/tile = 768 px, плюс UI вокруг.
  await page.setViewportSize({ width: 1280, height: 1300 });
  await page.goto(`/?editor=1&token=${TOKEN}`);
  await expect(page.getByTestId('layout-editor')).toBeVisible();
  await expect(page.getByTestId('layout-editor-canvas')).toBeVisible();
}

/**
 * SCALE в EditorCanvas — 24 px/тайл, дефолтная сетка 32×32 → 768×768.
 * Тайл (tx,ty) маппится в stage-пиксельный прямоугольник [(tx*24, ty*24), ((tx+1)*24, (ty+1)*24)).
 * Целимся в центр (tx*24+12, ty*24+12).
 */
const SCALE = 24;
function tilePoint(tx: number, ty: number) {
  return { x: tx * SCALE + SCALE / 2, y: ty * SCALE + SCALE / 2 };
}

async function clickTile(page: Page, tx: number, ty: number, opts?: { shift?: boolean }) {
  const canvas = page.getByTestId('layout-editor-canvas').locator('canvas').first();
  const box = await canvas.boundingBox();
  if (!box) throw new Error('canvas has no bounding box');
  const p = tilePoint(tx, ty);
  if (opts?.shift) {
    await page.keyboard.down('Shift');
    await page.mouse.move(box.x + p.x, box.y + p.y);
    await page.mouse.down();
    await page.mouse.up();
    await page.keyboard.up('Shift');
  } else {
    await page.mouse.click(box.x + p.x, box.y + p.y);
  }
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

async function countTintedPixels(
  page: Page,
  rgb: { r: number; g: number; b: number },
  tolerance = 40,
) {
  return page.evaluate(
    ({ target, tol }) => {
      // Konva рендерит каждый Layer в собственный <canvas>; суммируем пиксели по всем
      const canvases = document.querySelectorAll<HTMLCanvasElement>(
        '[data-testid="layout-editor-canvas"] canvas',
      );
      if (canvases.length === 0) return -1;
      let count = 0;
      for (const canvas of canvases) {
        const ctx = canvas.getContext('2d');
        if (!ctx) continue;
        const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);
        for (let i = 0; i < data.length; i += 4) {
          const dr = data[i] - target.r;
          const dg = data[i + 1] - target.g;
          const db = data[i + 2] - target.b;
          if (Math.sqrt(dr * dr + dg * dg + db * db) < tol) count++;
        }
      }
      return count;
    },
    { target: rgb, tol: tolerance },
  );
}

test.describe('Layout editor — drawing tools (F11.2.x)', () => {
  test('F11.2.2: room tool drags a rectangle which then renders as a selected room', async ({
    page,
  }) => {
    await openEditor(page);
    await page.getByTestId('tool-room').click();
    await dragTile(page, { x: 2, y: 2 }, { x: 11, y: 9 });

    // Панель свойств показывает новую комнату (дефолтный тип — bedroom)
    await expect(page.getByTestId('properties-panel')).toContainText('bedroom_1');
    await expect(page.getByTestId('room-type-select')).toBeVisible();
  });

  test('F11.2.2: panel tool places the electrical panel at the clicked tile', async ({ page }) => {
    await openEditor(page);
    await page.getByTestId('tool-panel').click();
    await clickTile(page, 5, 5);

    // PALETTE.electrical.panel — #D32F2F (rgb 211, 47, 47), насыщенно-красные пиксели.
    const red = await countTintedPixels(page, { r: 211, g: 47, b: 47 }, 50);
    expect(red).toBeGreaterThan(50);
    await expect(page.getByTestId('properties-panel')).toContainText('Электрощиток');
  });

  test('F11.2.2: window tool draws a 4-tile window with two clicks', async ({ page }) => {
    await openEditor(page);
    await page.getByTestId('tool-window').click();
    await clickTile(page, 4, 0);
    await clickTile(page, 8, 0);
    await expect(page.getByTestId('properties-panel')).toContainText('win_1');
  });

  test('F11.2.2: door tool draws a door and exposes hinge / swing dropdowns', async ({ page }) => {
    await openEditor(page);
    await page.getByTestId('tool-door').click();
    await clickTile(page, 12, 5);
    await clickTile(page, 12, 8);

    await expect(page.getByTestId('properties-panel')).toContainText('door_1');
    await expect(page.getByTestId('door-hinge-select')).toBeVisible();
    await expect(page.getByTestId('door-swing-select')).toBeVisible();
  });

  test('F11.2.3: shift+click on the panel removes it', async ({ page }) => {
    await openEditor(page);
    await page.getByTestId('tool-panel').click();
    await clickTile(page, 6, 6);
    await expect(page.getByTestId('properties-panel')).toContainText('Электрощиток');

    const redBefore = await countTintedPixels(page, { r: 211, g: 47, b: 47 }, 50);
    expect(redBefore).toBeGreaterThan(50);

    // Переключаемся обратно на select, потом shift+click по тайлу со щитом.
    await page.getByTestId('tool-select').click();
    await clickTile(page, 6, 6, { shift: true });

    // Главный сигнал: panel state очищен. Панель свойств — DOM-уровень,
    // обновляется сразу при React commit'е.
    await expect(page.getByTestId('properties-panel')).toContainText('Объект не выбран');

    // Konva рендерит на canvas в отдельном фрейме после React commit'а.
    // Без короткого ожидания countTintedPixels иногда читает старый
    // фрейм (с панелью), и счётчик не падает достаточно. RAF-tick гарантирует,
    // что canvas обновлён.
    await page.evaluate(
      () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => r(null)))),
    );

    // Второй сигнал: количество красных пикселей резко падает.
    const redAfter = await countTintedPixels(page, { r: 211, g: 47, b: 47 }, 50);
    expect(redAfter).toBeLessThan(redBefore / 4);
  });

  test('F11.2.3: 🗑 button in properties panel removes the selected room', async ({ page }) => {
    await openEditor(page);
    await page.getByTestId('tool-room').click();
    await dragTile(page, { x: 2, y: 2 }, { x: 9, y: 9 });
    await expect(page.getByTestId('properties-panel')).toContainText('bedroom_1');

    await page.getByTestId('delete-selected').click();
    await expect(page.getByTestId('properties-panel')).toContainText('Объект не выбран');
  });

  test('E2E-25: tool auto-resets to «select» after a successful placement (F11.2.9)', async ({
    page,
  }) => {
    await openEditor(page);

    // 1) Инструмент room — один drag коммитит комнату. Single-shot возвращает на select.
    await page.getByTestId('tool-room').click();
    await dragTile(page, { x: 2, y: 2 }, { x: 9, y: 9 });
    await expect(page.getByTestId('properties-panel')).toContainText('bedroom_1');
    // Второй drag по пустому месту инструментом (теперь — select) просто
    // снимает выделение — bedroom_2 не должна создаться.
    await dragTile(page, { x: 20, y: 20 }, { x: 27, y: 27 });
    await expect(page.getByTestId('properties-panel')).toContainText('Объект не выбран');
    await expect(page.getByTestId('properties-panel')).not.toContainText('bedroom_2');

    // 2) Инструмент panel — один клик коммитит, single-shot возвращает на select.
    await page.getByTestId('tool-panel').click();
    await clickTile(page, 14, 14);
    await expect(page.getByTestId('properties-panel')).toContainText('Электрощиток');
    // Второй клик по другому пустому тайлу не должен переносить щит.
    await clickTile(page, 25, 25);
    // После клика по пустому месту в режиме select выделение panel снимается,
    // но сам щит всё ещё на тайле (14, 14) — проверяем повторным выбором.
    await clickTile(page, 14, 14);
    await expect(page.getByTestId('properties-panel')).toContainText('14, 14');
  });

  test('F13.2 (v1.11.0): live-HUD shows metric dimensions while drawing a room', async ({
    page,
  }) => {
    await openEditor(page);

    const canvas = page.getByTestId('layout-editor-canvas').locator('canvas').first();
    const box = await canvas.boundingBox();
    if (!box) throw new Error('canvas has no bounding box');

    // F11.3 (v1.14.0): минимум 4 м² — drag 8×8 (= 4 м² ровно). Меньшие
    // прямоугольники теперь подсвечиваются warning-цветом, не selection.
    // HUD показывает "2.0 × 2.0 м = 4.0 м²".
    await page.getByTestId('tool-room').click();
    const start = tilePoint(4, 4);
    const end = tilePoint(11, 11);
    await page.mouse.move(box.x + start.x, box.y + start.y);
    await page.mouse.down();
    await page.mouse.move(box.x + end.x, box.y + end.y, { steps: 10 });
    await page.waitForTimeout(150); // дать React+Konva отрисовать HUD

    // Konva Text-узел живёт внутри Stage canvas; читаем его через проверку
    // пиксельных данных, сэмплируя текст. Konva-Text не выдаёт DOM-селекторов,
    // поэтому HUD проверяем по характерному синему пикселю обводки HUD
    // (PALETTE.editor.selection = #1565C0 → rgb(21, 101, 192)) рядом с позицией курсора.
    const hudPixels = await page.evaluate(
      ({ targetX, targetY }) => {
        const canvases = document.querySelectorAll<HTMLCanvasElement>(
          '[data-testid="layout-editor-canvas"] canvas',
        );
        let count = 0;
        for (const c of canvases) {
          const ctx = c.getContext('2d');
          if (!ctx) continue;
          // Сэмплируем область 200×40 вокруг позиции HUD
          const x = Math.max(0, targetX - 5);
          const y = Math.max(0, targetY - 5);
          const w = Math.min(c.width - x, 200);
          const h = Math.min(c.height - y, 40);
          if (w <= 0 || h <= 0) continue;
          const { data } = ctx.getImageData(x, y, w, h);
          for (let i = 0; i < data.length; i += 4) {
            // Близко к PALETTE.editor.selection #1565C0
            if (data[i] < 60 && data[i + 1] >= 80 && data[i + 1] <= 130 && data[i + 2] >= 170) {
              count++;
            }
          }
        }
        return count;
      },
      { targetX: end.x, targetY: end.y },
    );

    // Даже с anti-aliasing'ом обводка HUD + текст дают много синих пикселей.
    expect(hudPixels).toBeGreaterThan(20);

    // Отпускаем drag — HUD пропадает, комната коммитится
    await page.mouse.up();
    await expect(page.getByTestId('properties-panel')).toContainText('bedroom_1');
  });

  test('F11.2.6: editor never writes the main app keys to localStorage', async ({ page }) => {
    await openEditor(page);
    await page.getByTestId('tool-room').click();
    await dragTile(page, { x: 1, y: 1 }, { x: 8, y: 8 });
    await page.getByTestId('tool-panel').click();
    await clickTile(page, 4, 4);
    // Даём времени debounce-автосохранению сработать, если оно вообще запускается
    await page.waitForTimeout(700);

    const projectKey = await page.evaluate(() =>
      localStorage.getItem('3d-interior-designer-project'),
    );
    expect(projectKey).toBeNull();
  });
});
