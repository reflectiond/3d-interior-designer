import type { Window, Door, TileCoord } from './types';

/** True if two axis-aligned opening segments share their wall and overlap on it. */
export function openingsOverlap(a: Window | Door, b: Window | Door): boolean {
  // Vertical segments on the same x
  if (a.start.x === a.end.x && b.start.x === b.end.x && a.start.x === b.start.x) {
    const aMin = Math.min(a.start.y, a.end.y);
    const aMax = Math.max(a.start.y, a.end.y);
    const bMin = Math.min(b.start.y, b.end.y);
    const bMax = Math.max(b.start.y, b.end.y);
    return aMin < bMax && aMax > bMin;
  }
  // Horizontal segments on the same y
  if (a.start.y === a.end.y && b.start.y === b.end.y && a.start.y === b.start.y) {
    const aMin = Math.min(a.start.x, a.end.x);
    const aMax = Math.max(a.start.x, a.end.x);
    const bMin = Math.min(b.start.x, b.end.x);
    const bMax = Math.max(b.start.x, b.end.x);
    return aMin < bMax && aMax > bMin;
  }
  return false;
}

/** Returns a non-empty array of error messages if any pair of openings overlap. */
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

/** Length of the segment in tiles (Manhattan). */
export function segmentLength(seg: { start: TileCoord; end: TileCoord }): number {
  return Math.abs(seg.start.x - seg.end.x) + Math.abs(seg.start.y - seg.end.y);
}

/** All integer tile coordinates the opening occupies along the wall. */
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

/** Window/door area in m² used by the estimator (length × height × tile-size). */
export function openingAreaM2(
  seg: { start: TileCoord; end: TileCoord; height_m: number },
  tileSizeM: number,
): number {
  return segmentLength(seg) * tileSizeM * seg.height_m;
}
