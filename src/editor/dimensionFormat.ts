import { TILE_SIZE } from '../domain/geometry/tiles';

/**
 * F13.2.4 (v1.11.0) — formatting helpers for the live-HUD shown next to the
 * cursor while drawing in the layout editor.
 *
 * Tile-coordinates (tx, ty, w, h) come from the editor's drag/click flow.
 * Conversion to metres uses {@link TILE_SIZE} = 0.25.
 */

/** Format a single tile-length as "N.N м" (1 decimal place). */
export function formatLength(tiles: number): string {
  const m = tiles * TILE_SIZE;
  return `${m.toFixed(1)} м`;
}

/** Format an area as "A.A м²" (1 decimal place). */
export function formatArea(tilesArea: number): string {
  const m2 = tilesArea * TILE_SIZE * TILE_SIZE;
  return `${m2.toFixed(1)} м²`;
}

/**
 * Format a "W × H = A м²" label for a rectangular footprint, e.g. while
 * drag-creating a room. `widthTiles` and `heightTiles` are inclusive
 * dimensions in tiles (`Math.abs(end.x - start.x) + 1` etc.).
 */
export function formatRectDimensions(widthTiles: number, heightTiles: number): string {
  const w = (widthTiles * TILE_SIZE).toFixed(1);
  const h = (heightTiles * TILE_SIZE).toFixed(1);
  const area = (widthTiles * heightTiles * TILE_SIZE * TILE_SIZE).toFixed(1);
  return `${w} × ${h} м = ${area} м²`;
}

/** Format an opening segment length: "L = N.N м". */
export function formatOpeningLength(tiles: number): string {
  return `L = ${formatLength(tiles)}`;
}
