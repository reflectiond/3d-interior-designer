import type { TileCoord, Room, Layout, LayoutRoom } from './types';

/** Размер тайла в метрах. */
export const TILE_SIZE = 0.25;

/** Площадь одного тайла в м². */
export const TILE_AREA = TILE_SIZE * TILE_SIZE; // 0.0625

/** Развернуть прямоугольное определение комнаты в список координат тайлов. */
export function expandRect(x: number, y: number, width: number, height: number): TileCoord[] {
  const tiles: TileCoord[] = [];
  for (let ty = y; ty < y + height; ty++) {
    for (let tx = x; tx < x + width; tx++) {
      tiles.push({ x: tx, y: ty });
    }
  }
  return tiles;
}

/** Вычислить площадь в м² по количеству тайлов. */
export function tilesArea(tileCount: number): number {
  return tileCount * TILE_AREA;
}

/** Преобразовать координату тайла в мировые метры (для 3D). */
export function tileToWorld(tile: TileCoord): { x: number; z: number } {
  return {
    x: tile.x * TILE_SIZE,
    z: tile.y * TILE_SIZE,
  };
}

/** Преобразовать LayoutRoom (на основе прямоугольника) в Room (на основе списка тайлов). */
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

/** Преобразовать все комнаты планировки в runtime-объекты Room. */
export function layoutToRooms(layout: Layout): Room[] {
  return layout.rooms.map(layoutRoomToRoom);
}
