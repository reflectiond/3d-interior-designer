import type { Room, Window, Door } from '../geometry/types';
import { TILE_SIZE } from '../geometry/tiles';
import { openingAreaM2 } from '../geometry/openings';

const ROOM_HEIGHT = 2.7;

/** Bare wall area for the room — perimeter × room height, in square meters. */
export function wallAreaBare(room: Room): number {
  const w = room.rect.width * TILE_SIZE;
  const h = room.rect.height * TILE_SIZE;
  return 2 * (w + h) * ROOM_HEIGHT;
}

/**
 * F2.3.4 / F3.2.7 (v1.9.0) — wall area for a single room with windows and
 * doors that lie on its perimeter subtracted out.
 *
 * Each opening is encoded as an axis-aligned tile segment along a single
 * wall (start.x === end.x → vertical wall, start.y === end.y → horizontal).
 * For an opening to belong to *this* room, the segment must run along one
 * of the room's four walls and stay within the room's extent on that wall.
 *
 * Internal openings (a door between two adjacent rooms) belong to BOTH
 * rooms — `wallAreaForRoom` subtracts them from each room's surface
 * independently. Summing the result over all rooms therefore subtracts an
 * internal opening twice (once per side), which matches reality: plaster
 * is missing on both sides of the wall. External windows belong to a
 * single room and are subtracted once.
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
  // Vertical opening: stays on x = const, runs along y. Must sit on the
  // room's west or east wall and lie within the room's vertical extent.
  if (op.start.x === op.end.x) {
    const onWest = op.start.x === r.x;
    const onEast = op.start.x === r.x + r.width;
    return (onWest || onEast) && yMin >= r.y && yMax <= r.y + r.height;
  }
  // Horizontal opening: y = const, runs along x. Must sit on south/north wall.
  if (op.start.y === op.end.y) {
    const onSouth = op.start.y === r.y;
    const onNorth = op.start.y === r.y + r.height;
    return (onSouth || onNorth) && xMin >= r.x && xMax <= r.x + r.width;
  }
  return false;
}

/** Total plaster surface across the project — sum of per-room wall area. */
export function totalPlasterArea(rooms: Room[], windows: Window[], doors: Door[]): number {
  let total = 0;
  for (const room of rooms) {
    total += wallAreaForRoom(room, windows, doors);
  }
  return total;
}
