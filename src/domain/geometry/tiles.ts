import type { TileCoord, Room, Layout, LayoutRoom } from './types';

/** Tile size in meters */
export const TILE_SIZE = 0.25;

/** Area of one tile in m² */
export const TILE_AREA = TILE_SIZE * TILE_SIZE; // 0.0625

/** Expand a rectangular room definition into a list of tile coordinates */
export function expandRect(x: number, y: number, width: number, height: number): TileCoord[] {
  const tiles: TileCoord[] = [];
  for (let ty = y; ty < y + height; ty++) {
    for (let tx = x; tx < x + width; tx++) {
      tiles.push({ x: tx, y: ty });
    }
  }
  return tiles;
}

/** Calculate area in m² from tile count */
export function tilesArea(tileCount: number): number {
  return tileCount * TILE_AREA;
}

/** Convert tile coordinate to world meters (for 3D) */
export function tileToWorld(tile: TileCoord): { x: number; z: number } {
  return {
    x: tile.x * TILE_SIZE,
    z: tile.y * TILE_SIZE,
  };
}

/** Convert a LayoutRoom (rect-based) to a Room (tile-list-based) */
export function layoutRoomToRoom(lr: LayoutRoom): Room {
  const tiles = expandRect(lr.x, lr.y, lr.width, lr.height);
  return {
    id: lr.id,
    type: lr.type,
    name: lr.name,
    tiles,
    area: tilesArea(tiles.length),
    rect: { x: lr.x, y: lr.y, width: lr.width, height: lr.height },
  };
}

/** Convert all rooms in a layout to runtime Room objects */
export function layoutToRooms(layout: Layout): Room[] {
  return layout.rooms.map(layoutRoomToRoom);
}
