import type { TileCoord } from '../domain/geometry/types';
import type { EditorRoom } from './state';

/**
 * F11.2.8 (v1.10.0) — snap helpers for window/door placement in the layout
 * editor. The two-click flow used to free-form snap to either horizontal or
 * vertical based on cursor delta; openings then floated mid-room when the
 * user wasn't precise. Now the first click snaps to the nearest room wall
 * and locks an axis; the second click is constrained to the same wall.
 */

export type WallAxis = 'h' | 'v';

/** A single straight wall segment of a room rectangle. */
export interface WallSegment {
  /** 'h' = horizontal (y is fixed), 'v' = vertical (x is fixed). */
  axis: WallAxis;
  /** Coordinate value along the fixed axis (y for 'h', x for 'v'). */
  line: number;
  /** Range along the varying axis. */
  rangeMin: number;
  rangeMax: number;
}

/** Maximum tile distance considered "on a wall" — beyond this we don't snap. */
export const WALL_SNAP_RADIUS = 3;

export function roomWalls(room: EditorRoom): WallSegment[] {
  const { x, y, width, height } = room;
  return [
    { axis: 'v', line: x, rangeMin: y, rangeMax: y + height }, // west
    { axis: 'v', line: x + width, rangeMin: y, rangeMax: y + height }, // east
    { axis: 'h', line: y, rangeMin: x, rangeMax: x + width }, // south
    { axis: 'h', line: y + height, rangeMin: x, rangeMax: x + width }, // north
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
 * F11.2.8 — pick the door's swing side so the leaf opens INTO an adjacent
 * room rather than into the wall thickness or empty space. We probe one
 * tile to each perpendicular side of the segment midpoint; if exactly one
 * side lands inside a room, that side becomes the swing direction. With
 * rooms on both sides (internal door) or no rooms (free-floating door)
 * we default to `'left'` — the user can flip it via the dropdown.
 */
export function pickDoorSwingSide(
  segment: { start: TileCoord; end: TileCoord },
  rooms: EditorRoom[],
): 'left' | 'right' {
  const dx = segment.end.x - segment.start.x;
  const dy = segment.end.y - segment.start.y;
  const len = Math.hypot(dx, dy);
  if (len === 0) return 'left';
  // Unit perpendicular vector for the 'left' swing (CCW rotation of segment dir).
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
 * Find the nearest room wall to the given tile, within {@link WALL_SNAP_RADIUS}
 * tiles. Returns the wall and the projected (snapped) tile, or null when the
 * cursor is too far from any wall — the editor falls back to free-form snap
 * in that case so empty layouts can still bootstrap an opening.
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
