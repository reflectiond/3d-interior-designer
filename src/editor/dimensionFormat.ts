import { TILE_SIZE } from '../domain/geometry/tiles';

/**
 * F13.2.4 (v1.11.0) — хелперы форматирования для live-HUD, отображаемого рядом с
 * курсором при рисовании в редакторе планировок.
 *
 * Координаты тайлов (tx, ty, w, h) поступают из drag/click-флоу редактора.
 * Перевод в метры идёт через {@link TILE_SIZE} = 0.25.
 */

/** Форматирует длину в тайлах как «N.N м» (один знак после запятой). */
export function formatLength(tiles: number): string {
  const m = tiles * TILE_SIZE;
  return `${m.toFixed(1)} м`;
}

/** Форматирует площадь как «A.A м²» (один знак после запятой). */
export function formatArea(tilesArea: number): string {
  const m2 = tilesArea * TILE_SIZE * TILE_SIZE;
  return `${m2.toFixed(1)} м²`;
}

/**
 * Форматирует подпись «W × H = A м²» для прямоугольного контура, например при
 * drag-создании комнаты. `widthTiles` и `heightTiles` — включительные размеры
 * в тайлах (`Math.abs(end.x - start.x) + 1` и т. п.).
 */
export function formatRectDimensions(widthTiles: number, heightTiles: number): string {
  const w = (widthTiles * TILE_SIZE).toFixed(1);
  const h = (heightTiles * TILE_SIZE).toFixed(1);
  const area = (widthTiles * heightTiles * TILE_SIZE * TILE_SIZE).toFixed(1);
  return `${w} × ${h} м = ${area} м²`;
}

/** Форматирует длину сегмента проёма: «L = N.N м». */
export function formatOpeningLength(tiles: number): string {
  return `L = ${formatLength(tiles)}`;
}
