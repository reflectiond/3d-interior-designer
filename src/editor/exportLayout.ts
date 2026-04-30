/**
 * JSON-экспорт из редактора (F11.2.5).
 *
 * Сериализует состояние редактора в кандидатный `Layout`, валидирует его
 * той же `LayoutSchema`, что использует основное приложение, и при успехе
 * возвращает форматированную JSON-строку, готовую к скачиванию.
 */

import { LayoutSchema, type Layout } from '../domain/geometry/types';
import { sanitizeFilename } from '../export/sanitizeFilename';
import type { EditorState } from './state';

export function buildLayoutCandidate(state: EditorState) {
  return {
    id: state.layoutId,
    name: state.layoutName,
    gridWidth: state.gridWidth,
    gridHeight: state.gridHeight,
    rooms: state.rooms.map((r) => ({
      id: r.id,
      type: r.type,
      name: r.name,
      x: r.x,
      y: r.y,
      width: r.width,
      height: r.height,
    })),
    electricalPanel: state.electricalPanel ?? { x: 0, y: 0 },
    windows: state.windows.map((w) => ({
      id: w.id,
      start: w.start,
      end: w.end,
      sill_height_m: w.sill_height_m,
      height_m: w.height_m,
    })),
    doors: state.doors.map((d) => ({
      id: d.id,
      start: d.start,
      end: d.end,
      hinge: d.hinge,
      swing_side: d.swing_side,
      height_m: d.height_m,
    })),
  };
}

export type ExportResult =
  | { ok: true; layout: Layout; json: string; filename: string }
  | { ok: false; reason: 'schema'; messages: string[] };

export function exportLayout(state: EditorState): ExportResult {
  const candidate = buildLayoutCandidate(state);
  const result = LayoutSchema.safeParse(candidate);
  if (!result.success) {
    const messages = result.error.issues.map(
      (i) => `${i.path.join('.') || '<root>'}: ${i.message}`,
    );
    return { ok: false, reason: 'schema', messages };
  }
  const json = JSON.stringify(result.data, null, 2);
  const safeName = sanitizeFilename(`layout_${state.layoutId}_${state.layoutName}`) || 'layout';
  return { ok: true, layout: result.data, json, filename: `${safeName}.json` };
}

/**
 * Браузерная часть: инициирует скачивание файла. Вынесено отдельно от `exportLayout`,
 * чтобы чистая логика тестировалась без DOM-моков.
 */
export function downloadJsonFile(json: string, filename: string): void {
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  // Отзываем URL на следующем tick, чтобы click успел отработать.
  setTimeout(() => URL.revokeObjectURL(url), 0);
}
