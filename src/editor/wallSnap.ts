import type { TileCoord } from '../domain/geometry/types';
import type { EditorRoom } from './state';

/**
 * F11.2.8 (v1.10.0) — хелперы snap'а для размещения окон и дверей в редакторе
 * планировок. Раньше двухкликовая схема free-form snap'ила к горизонтали или
 * вертикали по дельте курсора; в результате проёмы могли «плавать» в середине
 * комнаты, если пользователь промахивался. Теперь первый клик прилипает к
 * ближайшей стене и фиксирует ось; второй клик ограничен той же стеной.
 */

export type WallAxis = 'h' | 'v';

/** Прямой сегмент стены прямоугольника комнаты. */
export interface WallSegment {
  /** 'h' = горизонталь (y фиксирован), 'v' = вертикаль (x фиксирован). */
  axis: WallAxis;
  /** Значение координаты вдоль фиксированной оси (y для 'h', x для 'v'). */
  line: number;
  /** Диапазон вдоль изменяющейся оси. */
  rangeMin: number;
  rangeMax: number;
}

/** Максимальное расстояние в тайлах, при котором считаем «на стене» — дальше snap не срабатывает. */
export const WALL_SNAP_RADIUS = 3;

export function roomWalls(room: EditorRoom): WallSegment[] {
  const { x, y, width, height } = room;
  return [
    { axis: 'v', line: x, rangeMin: y, rangeMax: y + height }, // запад
    { axis: 'v', line: x + width, rangeMin: y, rangeMax: y + height }, // восток
    { axis: 'h', line: y, rangeMin: x, rangeMax: x + width }, // юг
    { axis: 'h', line: y + height, rangeMin: x, rangeMax: x + width }, // север
  ];
}

export function distanceToWall(tile: TileCoord, wall: WallSegment): number {
  if (wall.axis === 'v') {
    const clampedY = Math.max(wall.rangeMin, Math.min(wall.rangeMax, tile.y));
    return Math.hypot(tile.x - wall.line, tile.y - clampedY);
  }
  const clampedX = Math.max(wall.rangeMin, Math.min(wall.rangeMax, tile.x));
  return Math.hypot(tile.x - clampedX, tile.y - wall.line);
}

export function projectOntoWall(tile: TileCoord, wall: WallSegment): TileCoord {
  if (wall.axis === 'v') {
    return { x: wall.line, y: Math.max(wall.rangeMin, Math.min(wall.rangeMax, tile.y)) };
  }
  return { x: Math.max(wall.rangeMin, Math.min(wall.rangeMax, tile.x)), y: wall.line };
}

/**
 * F11.2.8 — выбираем сторону распахивания двери так, чтобы створка открывалась
 * В смежную комнату, а не в толщу стены или пустое пространство. Тестируем по
 * одному тайлу с каждой перпендикулярной стороны от середины сегмента; если
 * ровно одна сторона попадает внутрь комнаты — она становится направлением
 * распахивания. Если комнаты с обеих сторон (внутренняя дверь) или ни с одной
 * (свободно стоящая дверь), по умолчанию возвращаем `'left'` — пользователь
 * может переключить через выпадающий список.
 */
export function pickDoorSwingSide(
  segment: { start: TileCoord; end: TileCoord },
  rooms: EditorRoom[],
): 'left' | 'right' {
  const dx = segment.end.x - segment.start.x;
  const dy = segment.end.y - segment.start.y;
  const len = Math.hypot(dx, dy);
  if (len === 0) return 'left';
  // Единичный перпендикулярный вектор для распахивания 'left' (CCW поворот направления сегмента).
  const ux = -dy / len;
  const uy = dx / len;
  const midX = (segment.start.x + segment.end.x) / 2;
  const midY = (segment.start.y + segment.end.y) / 2;
  const leftProbe = { x: Math.floor(midX + ux * 0.5), y: Math.floor(midY + uy * 0.5) };
  const rightProbe = { x: Math.floor(midX - ux * 0.5), y: Math.floor(midY - uy * 0.5) };
  const leftIn = roomContaining(leftProbe, rooms) !== null;
  const rightIn = roomContaining(rightProbe, rooms) !== null;
  if (leftIn && !rightIn) return 'left';
  if (rightIn && !leftIn) return 'right';
  return 'left';
}

function roomContaining(tile: TileCoord, rooms: EditorRoom[]): EditorRoom | null {
  for (const r of rooms) {
    if (tile.x >= r.x && tile.x < r.x + r.width && tile.y >= r.y && tile.y < r.y + r.height) {
      return r;
    }
  }
  return null;
}

/**
 * Находит ближайшую к заданному тайлу стену комнаты в пределах {@link WALL_SNAP_RADIUS}
 * тайлов. Возвращает стену и спроецированный (snapped) тайл, либо null, если курсор
 * слишком далеко от любой стены — в этом случае редактор откатывается к free-form
 * snap'у, чтобы на пустых планировках всё-таки можно было поставить первый проём.
 */
export function findNearestWall(
  tile: TileCoord,
  rooms: EditorRoom[],
): { wall: WallSegment; snapped: TileCoord } | null {
  let best: { wall: WallSegment; snapped: TileCoord; dist: number } | null = null;
  for (const room of rooms) {
    for (const wall of roomWalls(room)) {
      const dist = distanceToWall(tile, wall);
      if (best === null || dist < best.dist) {
        best = { wall, snapped: projectOntoWall(tile, wall), dist };
      }
    }
  }
  if (best === null || best.dist > WALL_SNAP_RADIUS) return null;
  return { wall: best.wall, snapped: best.snapped };
}
