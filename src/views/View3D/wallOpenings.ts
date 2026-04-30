import { Shape, ShapeGeometry } from 'three';
import { TILE_SIZE } from '../../domain/geometry/tiles';
import type { Door, Layout, Room, Window } from '../../domain/geometry/types';

/**
 * F7.5 (v1.15.0) — геометрия стен с вырезами под окна и двери.
 *
 * Стена комнаты — прямоугольник `lengthM × heightM` (метры), плоский в
 * локальном пространстве (u, v). Окна и двери, лежащие на этой стене,
 * вырезаются как прямоугольные отверстия в `Shape`, после чего
 * `ShapeGeometry` даёт полигон с дырками.
 *
 * Для дверей (F7.5.2) door-mesh больше не рисуется — вырез в стене и есть
 * вся 3D-репрезентация. Для окон (F7.5.3) стеклянная плоскость остаётся,
 * но смещается на ε внутрь комнаты, чтобы избежать z-fighting (F7.5.1).
 */

export const Z_OFFSET_INTO_ROOM = 0.005; // 5 мм — выносит стекло из плоскости стены
export const ROOM_HEIGHT_M = 2.7;

export type WallSide = 'north' | 'south' | 'west' | 'east';

interface OpeningRect {
  /** Координата вдоль стены (м) — начало (0..lengthM). */
  uStart: number;
  /** Конец вдоль стены (м). */
  uEnd: number;
  /** Координата по высоте (м) — низ. Для двери = 0, для окна = sill_height. */
  vStart: number;
  /** Высота — верх (м). */
  vEnd: number;
}

interface AnyOpening {
  start: { x: number; y: number };
  end: { x: number; y: number };
}

function isHorizontal(o: AnyOpening): boolean {
  return o.start.y === o.end.y;
}

/**
 * Проёмы (окно или дверь), лежащие на конкретной стене комнаты.
 *
 * Стена комнаты определяется парой (сторона, координата линии тайлов):
 *   - north: line = room.y, span = room.x..room.x+room.width (горизонталь);
 *   - south: line = room.y + room.height, span = тот же x;
 *   - west:  line = room.x, span = room.y..room.y+room.height (вертикаль);
 *   - east:  line = room.x + room.width, span = тот же y.
 *
 * Проём «на стене», если его ориентация совпадает с осью стены, его
 * линия совпадает с линией стены, и его span пересекается с span стены.
 */
function openingsOnSide(
  side: WallSide,
  room: Room,
  windows: readonly Window[],
  doors: readonly Door[],
): { wins: Window[]; drs: Door[] } {
  const r = room.rect;
  const wins: Window[] = [];
  const drs: Door[] = [];

  const horizontalSide = side === 'north' || side === 'south';
  const sideLine =
    side === 'north'
      ? r.y
      : side === 'south'
        ? r.y + r.height
        : side === 'west'
          ? r.x
          : r.x + r.width;
  const spanLo = horizontalSide ? r.x : r.y;
  const spanHi = horizontalSide ? r.x + r.width : r.y + r.height;

  function matches(o: AnyOpening): boolean {
    const horizontal = isHorizontal(o);
    if (horizontal !== horizontalSide) return false;
    const line = horizontal ? o.start.y : o.start.x;
    if (line !== sideLine) return false;
    const oLo = Math.min(horizontal ? o.start.x : o.start.y, horizontal ? o.end.x : o.end.y);
    const oHi = Math.max(horizontal ? o.start.x : o.start.y, horizontal ? o.end.x : o.end.y);
    return oHi > spanLo && oLo < spanHi;
  }

  for (const w of windows) if (matches(w)) wins.push(w);
  for (const d of doors) if (matches(d)) drs.push(d);
  return { wins, drs };
}

/**
 * Преобразует проём в локальные координаты стены `(uStart..uEnd, vStart..vEnd)`.
 * `originTile` — тайл-координата начала стены (в направлении u). Для каждой
 * стороны это конкретный угол комнаты:
 *   - north: (room.x, room.y) → u растёт по +x;
 *   - south: (room.x + width, room.y + height) → u растёт по −x (зеркально);
 *   - west:  (room.x, room.y + height) → u растёт по −y;
 *   - east:  (room.x + width, room.y) → u растёт по +y.
 *
 * Эти направления совпадают с тем, как `WallMeshes` ориентирует каждую
 * стену (face нормали смотрят внутрь комнаты).
 */
function openingToLocalRect(
  side: WallSide,
  room: Room,
  o: AnyOpening,
  vStart: number,
  vEnd: number,
): OpeningRect {
  const r = room.rect;
  const horizontal = isHorizontal(o);
  const oLo = Math.min(horizontal ? o.start.x : o.start.y, horizontal ? o.end.x : o.end.y);
  const oHi = Math.max(horizontal ? o.start.x : o.start.y, horizontal ? o.end.x : o.end.y);
  const spanLo = horizontal ? r.x : r.y;
  const spanHi = horizontal ? r.x + r.width : r.y + r.height;
  // Клампим к стене: проём, выходящий за угол, обрезается.
  const clampedLo = Math.max(oLo, spanLo);
  const clampedHi = Math.min(oHi, spanHi);
  // u всегда измеряется в положительном направлении вдоль стены: для south
  // и west стенки геометрии перевёрнуты, но мы строим Shape в той же системе
  // (длина стены = positive u), а WallMeshes сам поворачивает mesh.
  const uFromOrigin = (tile: number) => {
    if (side === 'north' || side === 'east') return (tile - spanLo) * TILE_SIZE;
    return (spanHi - tile) * TILE_SIZE;
  };
  const uA = uFromOrigin(clampedLo);
  const uB = uFromOrigin(clampedHi);
  return {
    uStart: Math.min(uA, uB),
    uEnd: Math.max(uA, uB),
    vStart,
    vEnd,
  };
}

/**
 * Строит `ShapeGeometry` стены с заданными прямоугольными вырезами.
 * Если выреза нет — это обычный прямоугольник `lengthM × heightM`.
 */
export function buildWallGeometry(
  lengthM: number,
  heightM: number,
  holes: readonly OpeningRect[],
): ShapeGeometry {
  const shape = new Shape();
  shape.moveTo(0, 0);
  shape.lineTo(lengthM, 0);
  shape.lineTo(lengthM, heightM);
  shape.lineTo(0, heightM);
  shape.lineTo(0, 0);

  for (const h of holes) {
    const hole = new Shape();
    hole.moveTo(h.uStart, h.vStart);
    hole.lineTo(h.uEnd, h.vStart);
    hole.lineTo(h.uEnd, h.vEnd);
    hole.lineTo(h.uStart, h.vEnd);
    hole.lineTo(h.uStart, h.vStart);
    shape.holes.push(hole);
  }

  // ShapeGeometry центрирует в (0,0) → (lengthM, heightM); нам нужно
  // сдвинуть так, чтобы центр был в (0,0) (mesh.position уже в центре стены).
  const geom = new ShapeGeometry(shape);
  geom.translate(-lengthM / 2, -heightM / 2, 0);
  return geom;
}

/**
 * Собирает все вырезы (windows + doors) для одной стены комнаты.
 * Окна — `(sill_height, sill_height + height)`, двери — `(0, height)`.
 */
export function holesForWall(
  side: WallSide,
  room: Room,
  layout: Pick<Layout, 'windows' | 'doors'>,
): OpeningRect[] {
  const { wins, drs } = openingsOnSide(side, room, layout.windows, layout.doors);
  const rects: OpeningRect[] = [];
  for (const w of wins) {
    rects.push(openingToLocalRect(side, room, w, w.sill_height_m, w.sill_height_m + w.height_m));
  }
  for (const d of drs) {
    rects.push(openingToLocalRect(side, room, d, 0, d.height_m));
  }
  return rects;
}
