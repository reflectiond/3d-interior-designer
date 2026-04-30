import type { Room, Window, Door } from '../geometry/types';
import { TILE_SIZE } from '../geometry/tiles';
import { openingAreaM2 } from '../geometry/openings';

const ROOM_HEIGHT = 2.7;

/** Голая площадь стен комнаты — периметр × высота помещения, в квадратных метрах. */
export function wallAreaBare(room: Room): number {
  const w = room.rect.width * TILE_SIZE;
  const h = room.rect.height * TILE_SIZE;
  return 2 * (w + h) * ROOM_HEIGHT;
}

/**
 * F2.3.4 / F3.2.7 (v1.9.0) — площадь стен одной комнаты с вычетом окон и дверей,
 * лежащих на её периметре.
 *
 * Каждый проём кодируется как осесимметричный сегмент тайлов вдоль одной стены
 * (start.x === end.x → вертикальная стена, start.y === end.y → горизонтальная).
 * Чтобы проём принадлежал *этой* комнате, сегмент должен идти вдоль одной из её
 * четырёх стен и не выходить за границы комнаты по этой стене.
 *
 * Внутренние проёмы (дверь между двумя смежными комнатами) принадлежат ОБЕИМ
 * комнатам — `wallAreaForRoom` вычитает их из площади каждой комнаты независимо.
 * Сумма по всем комнатам вычтёт внутренний проём дважды (по разу с каждой стороны),
 * что соответствует реальности: штукатурки нет с обеих сторон стены. Внешние окна
 * принадлежат одной комнате и вычитаются однократно.
 */
export function wallAreaForRoom(room: Room, windows: Window[], doors: Door[]): number {
  const base = wallAreaBare(room);
  let opening = 0;
  for (const op of [...windows, ...doors]) {
    if (openingBelongsToRoom(op, room)) {
      opening += openingAreaM2(op, TILE_SIZE);
    }
  }
  return Math.max(0, base - opening);
}

function openingBelongsToRoom(
  op: { start: { x: number; y: number }; end: { x: number; y: number } },
  room: Room,
): boolean {
  const xMin = Math.min(op.start.x, op.end.x);
  const xMax = Math.max(op.start.x, op.end.x);
  const yMin = Math.min(op.start.y, op.end.y);
  const yMax = Math.max(op.start.y, op.end.y);
  const r = room.rect;
  // Вертикальный проём: x = const, идёт вдоль y. Должен лежать на западной или
  // восточной стене комнаты и находиться в её вертикальных границах.
  if (op.start.x === op.end.x) {
    const onWest = op.start.x === r.x;
    const onEast = op.start.x === r.x + r.width;
    return (onWest || onEast) && yMin >= r.y && yMax <= r.y + r.height;
  }
  // Горизонтальный проём: y = const, идёт вдоль x. Должен лежать на южной/северной стене.
  if (op.start.y === op.end.y) {
    const onSouth = op.start.y === r.y;
    const onNorth = op.start.y === r.y + r.height;
    return (onSouth || onNorth) && xMin >= r.x && xMax <= r.x + r.width;
  }
  return false;
}

/** Суммарная площадь штукатурки по проекту — сумма площадей стен по комнатам. */
export function totalPlasterArea(rooms: Room[], windows: Window[], doors: Door[]): number {
  let total = 0;
  for (const room of rooms) {
    total += wallAreaForRoom(room, windows, doors);
  }
  return total;
}
