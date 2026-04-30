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
  /**
   * F15.1 (v1.16.0) — опциональные ассеты:
   * - `sprite2d`: путь к PNG-спрайту (обычно top-down view), который
   *   рендерится на 2D-канве вместо цветного Rect. Lazy `<img>`-load с
   *   фолбэком на текущий цветной Rect (F15.2).
   * - `model3d.url`: glTF/GLB модель для 3D-сцены. `useGLTF` lazy +
   *   Suspense с `<Box>`-фолбэком (F15.3).
   * - `model3d.rotation` (опц.): доп. вращение Y в радианах для
   *   модели (если её axis-up в файле не Y).
   * - `model3d.scaleY` (опц.): вертикальный scale для подгонки модели
   *   под `height_m` каталога (если модель не в метрах).
   *
   * Все ассеты должны быть CC0 / CC-BY (см. LICENSES.md).
   */
  sprite2d?: string;
  model3d?: { url: string; rotation?: number; scaleY?: number };
}

/** Получить эффективные width/height после поворота. */
export function getEffectiveSize(
  item: CatalogItem,
  rotation: 0 | 90 | 180 | 270,
): { w: number; h: number } {
  if (rotation === 90 || rotation === 270) {
    return { w: item.size_tiles.h, h: item.size_tiles.w };
  }
  return { w: item.size_tiles.w, h: item.size_tiles.h };
}

/** Получить все тайлы, занятые экземпляром мебели. */
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

/** Проверить, что все тайлы мебели помещаются внутри одной комнаты. */
export function isInsideRoom(tiles: TileCoord[], room: Room): boolean {
  return tiles.every(
    (t) =>
      t.x >= room.rect.x &&
      t.x < room.rect.x + room.rect.width &&
      t.y >= room.rect.y &&
      t.y < room.rect.y + room.rect.height,
  );
}

/** Найти комнату, содержащую все тайлы (или null, если мебель пересекает несколько комнат / выходит наружу). */
export function findContainingRoom(tiles: TileCoord[], rooms: Room[]): Room | null {
  for (const room of rooms) {
    if (isInsideRoom(tiles, room)) return room;
  }
  return null;
}

/** Проверить, пересекаются ли тайлы мебели с какой-либо уже размещённой. */
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

/**
 * Полная валидация размещения мебели.
 *
 * F8.7 (v1.13.0): фильтр `allowed_rooms` убран — любую мебель можно ставить
 * в любую комнату. Валидация требует, чтобы мебель целиком помещалась в одной
 * комнате, и отклоняет пересечения с уже размещёнными предметами.
 */
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

  if (hasCollision(tiles, existingFurniture, catalog, excludeId)) {
    return { valid: false, reason: 'Пересечение с другой мебелью' };
  }

  return { valid: true };
}
