import type { Window, Door, TileCoord } from './types';

/** True если два осесимметричных сегмента проёмов лежат на одной стене и перекрываются. */
export function openingsOverlap(a: Window | Door, b: Window | Door): boolean {
  // Вертикальные сегменты на одном x
  if (a.start.x === a.end.x && b.start.x === b.end.x && a.start.x === b.start.x) {
    const aMin = Math.min(a.start.y, a.end.y);
    const aMax = Math.max(a.start.y, a.end.y);
    const bMin = Math.min(b.start.y, b.end.y);
    const bMax = Math.max(b.start.y, b.end.y);
    return aMin < bMax && aMax > bMin;
  }
  // Горизонтальные сегменты на одном y
  if (a.start.y === a.end.y && b.start.y === b.end.y && a.start.y === b.start.y) {
    const aMin = Math.min(a.start.x, a.end.x);
    const aMax = Math.max(a.start.x, a.end.x);
    const bMin = Math.min(b.start.x, b.end.x);
    const bMax = Math.max(b.start.x, b.end.x);
    return aMin < bMax && aMax > bMin;
  }
  return false;
}

/** Возвращает непустой массив сообщений об ошибках, если какие-либо проёмы пересекаются. */
export function validateNoOverlaps(windows: Window[], doors: Door[]): string[] {
  const all: (Window | Door)[] = [...windows, ...doors];
  const errors: string[] = [];
  for (let i = 0; i < all.length; i++) {
    for (let j = i + 1; j < all.length; j++) {
      if (openingsOverlap(all[i], all[j])) {
        errors.push(`Opening "${all[i].id}" overlaps with "${all[j].id}" on the same wall`);
      }
    }
  }
  return errors;
}

/** Длина сегмента в тайлах (манхэттен). */
export function segmentLength(seg: { start: TileCoord; end: TileCoord }): number {
  return Math.abs(seg.start.x - seg.end.x) + Math.abs(seg.start.y - seg.end.y);
}

/** Все целочисленные координаты тайлов, занятых проёмом вдоль стены. */
export function openingTiles(seg: { start: TileCoord; end: TileCoord }): TileCoord[] {
  const tiles: TileCoord[] = [];
  if (seg.start.x === seg.end.x) {
    const x = seg.start.x;
    const yFrom = Math.min(seg.start.y, seg.end.y);
    const yTo = Math.max(seg.start.y, seg.end.y);
    for (let y = yFrom; y < yTo; y++) tiles.push({ x, y });
  } else if (seg.start.y === seg.end.y) {
    const y = seg.start.y;
    const xFrom = Math.min(seg.start.x, seg.end.x);
    const xTo = Math.max(seg.start.x, seg.end.x);
    for (let x = xFrom; x < xTo; x++) tiles.push({ x, y });
  }
  return tiles;
}

/** Площадь окна/двери в м², используется в смете (длина × высота × размер тайла). */
export function openingAreaM2(
  seg: { start: TileCoord; end: TileCoord; height_m: number },
  tileSizeM: number,
): number {
  return segmentLength(seg) * tileSizeM * seg.height_m;
}

/**
 * F7.3.4 — тайлы, которые дверь резервирует, чтобы мебель не блокировала её распахивание.
 * Для каждой двери блокируем сами тайлы сегмента плюс по одному тайлу в каждом
 * перпендикулярном направлении (буфер с обеих сторон стены).
 */
export function getDoorBlockedTiles(doors: Door[]): TileCoord[] {
  const blocked: TileCoord[] = [];
  for (const door of doors) {
    const segTiles = openingTiles(door);
    for (const t of segTiles) blocked.push(t);
    if (door.start.x === door.end.x) {
      // вертикальный сегмент (стена смотрит по ±x) — буфер по ±x
      for (const t of segTiles) {
        blocked.push({ x: t.x - 1, y: t.y });
        blocked.push({ x: t.x + 1, y: t.y });
      }
    } else {
      // горизонтальный сегмент (стена смотрит по ±y) — буфер по ±y
      for (const t of segTiles) {
        blocked.push({ x: t.x, y: t.y - 1 });
        blocked.push({ x: t.x, y: t.y + 1 });
      }
    }
  }
  return blocked;
}

/** True, если какой-либо тайл из `a` совпадает с каким-либо тайлом из `blocked`. */
export function tilesIntersect(a: TileCoord[], blocked: TileCoord[]): boolean {
  if (blocked.length === 0) return false;
  const blockedSet = new Set(blocked.map((t) => `${t.x},${t.y}`));
  for (const t of a) {
    if (blockedSet.has(`${t.x},${t.y}`)) return true;
  }
  return false;
}
