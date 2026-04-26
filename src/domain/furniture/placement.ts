import type { TileCoord, Room, FurnitureInstance } from '../geometry/types';

export interface CatalogItem {
  id: string;
  name: string;
  size_tiles: { w: number; h: number };
  allowed_rooms: string[] | null;
  color_key: string;
  height_m: number;
  rotatable: boolean;
  mirrorable: boolean;
  price_min: number;
  price_max: number;
}

/** Get effective width/height after rotation */
export function getEffectiveSize(
  item: CatalogItem,
  rotation: 0 | 90 | 180 | 270,
): { w: number; h: number } {
  if (rotation === 90 || rotation === 270) {
    return { w: item.size_tiles.h, h: item.size_tiles.w };
  }
  return { w: item.size_tiles.w, h: item.size_tiles.h };
}

/** Get all tiles occupied by a furniture instance */
export function getFurnitureTiles(
  position: TileCoord,
  item: CatalogItem,
  rotation: 0 | 90 | 180 | 270,
): TileCoord[] {
  const { w, h } = getEffectiveSize(item, rotation);
  const tiles: TileCoord[] = [];
  for (let dy = 0; dy < h; dy++) {
    for (let dx = 0; dx < w; dx++) {
      tiles.push({ x: position.x + dx, y: position.y + dy });
    }
  }
  return tiles;
}

/** Check if all tiles of furniture are within a single room */
export function isInsideRoom(tiles: TileCoord[], room: Room): boolean {
  return tiles.every(
    (t) =>
      t.x >= room.rect.x &&
      t.x < room.rect.x + room.rect.width &&
      t.y >= room.rect.y &&
      t.y < room.rect.y + room.rect.height,
  );
}

/** Find which room contains all tiles (or null if spans multiple / outside) */
export function findContainingRoom(tiles: TileCoord[], rooms: Room[]): Room | null {
  for (const room of rooms) {
    if (isInsideRoom(tiles, room)) return room;
  }
  return null;
}

/** Check if furniture is allowed in the given room type */
export function isAllowedInRoom(item: CatalogItem, roomType: string): boolean {
  if (item.allowed_rooms === null) return true;
  return item.allowed_rooms.includes(roomType);
}

/** Check if furniture tiles overlap with any existing furniture */
export function hasCollision(
  tiles: TileCoord[],
  existingFurniture: FurnitureInstance[],
  catalog: Map<string, CatalogItem>,
  excludeId?: string,
): boolean {
  const newSet = new Set(tiles.map((t) => `${t.x},${t.y}`));

  for (const f of existingFurniture) {
    if (f.id === excludeId) continue;
    const item = catalog.get(f.catalogId);
    if (!item) continue;
    const fTiles = getFurnitureTiles(f.position, item, f.rotation);
    for (const t of fTiles) {
      if (newSet.has(`${t.x},${t.y}`)) return true;
    }
  }
  return false;
}

export interface PlacementResult {
  valid: boolean;
  reason?: string;
}

/** Full validation of furniture placement */
export function validatePlacement(
  position: TileCoord,
  item: CatalogItem,
  rotation: 0 | 90 | 180 | 270,
  rooms: Room[],
  existingFurniture: FurnitureInstance[],
  catalog: Map<string, CatalogItem>,
  excludeId?: string,
): PlacementResult {
  const tiles = getFurnitureTiles(position, item, rotation);

  const room = findContainingRoom(tiles, rooms);
  if (!room) {
    return { valid: false, reason: 'Мебель выходит за пределы комнаты' };
  }

  if (!isAllowedInRoom(item, room.type)) {
    return { valid: false, reason: `${item.name} нельзя разместить в «${room.name}»` };
  }

  if (hasCollision(tiles, existingFurniture, catalog, excludeId)) {
    return { valid: false, reason: 'Пересечение с другой мебелью' };
  }

  return { valid: true };
}
