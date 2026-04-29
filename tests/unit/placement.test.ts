import { describe, it, expect } from 'vitest';
import {
  getEffectiveSize,
  getFurnitureTiles,
  isInsideRoom,
  isAllowedInRoom,
  hasCollision,
  validatePlacement,
} from '../../src/domain/furniture/placement';
import type { CatalogItem } from '../../src/domain/furniture/placement';
import type { Room, FurnitureInstance } from '../../src/domain/geometry/types';

const sofa: CatalogItem = {
  id: 'sofa',
  name: 'Диван',
  size_tiles: { w: 8, h: 4 },
  height_m: 0.85,
  rotatable: true,
  mirrorable: true,
  color_key: 'sofa',
  allowed_rooms: ['living', 'bedroom'],
  price_min: 30000,
  price_max: 120000,
};

const toilet: CatalogItem = {
  id: 'toilet',
  name: 'Унитаз',
  size_tiles: { w: 3, h: 2 },
  height_m: 0.4,
  rotatable: true,
  mirrorable: false,
  color_key: 'toilet',
  allowed_rooms: ['bathroom'],
  price_min: 6000,
  price_max: 30000,
};

const chair: CatalogItem = {
  id: 'chair',
  name: 'Стул',
  size_tiles: { w: 2, h: 2 },
  height_m: 0.9,
  rotatable: true,
  mirrorable: false,
  color_key: 'chair',
  allowed_rooms: null,
  price_min: 2500,
  price_max: 15000,
};

const livingRoom: Room = {
  id: 'living',
  type: 'living',
  name: 'Гостиная',
  tiles: [],
  area: 25.0,
  rect: { x: 0, y: 0, width: 20, height: 20 },
};

const kitchen: Room = {
  id: 'kitchen',
  type: 'kitchen',
  name: 'Кухня',
  tiles: [],
  area: 10.0,
  rect: { x: 20, y: 0, width: 10, height: 16 },
};

const bathroom: Room = {
  id: 'bathroom',
  type: 'bathroom',
  name: 'Ванная',
  tiles: [],
  area: 4.0,
  rect: { x: 20, y: 16, width: 10, height: 4 },
};

const rooms = [livingRoom, kitchen, bathroom];
const catalogMap = new Map<string, CatalogItem>([
  ['sofa', sofa],
  ['toilet', toilet],
  ['chair', chair],
]);

describe('getEffectiveSize', () => {
  it('returns original size at 0°', () => {
    expect(getEffectiveSize(sofa, 0)).toEqual({ w: 8, h: 4 });
  });

  it('swaps w/h at 90°', () => {
    expect(getEffectiveSize(sofa, 90)).toEqual({ w: 4, h: 8 });
  });

  it('returns original at 180°', () => {
    expect(getEffectiveSize(sofa, 180)).toEqual({ w: 8, h: 4 });
  });

  it('swaps at 270°', () => {
    expect(getEffectiveSize(sofa, 270)).toEqual({ w: 4, h: 8 });
  });
});

describe('getFurnitureTiles', () => {
  it('generates correct tile count', () => {
    const tiles = getFurnitureTiles({ x: 0, y: 0 }, sofa, 0);
    expect(tiles).toHaveLength(32); // 8×4
  });

  it('respects rotation', () => {
    const tiles = getFurnitureTiles({ x: 0, y: 0 }, sofa, 90);
    expect(tiles).toHaveLength(32); // 4×8
    // Check bounds
    const maxX = Math.max(...tiles.map((t) => t.x));
    const maxY = Math.max(...tiles.map((t) => t.y));
    expect(maxX).toBe(3); // w=4 after rotation
    expect(maxY).toBe(7); // h=8 after rotation
  });
});

describe('isInsideRoom', () => {
  it('returns true for tiles inside room', () => {
    const tiles = getFurnitureTiles({ x: 1, y: 1 }, sofa, 0);
    expect(isInsideRoom(tiles, livingRoom)).toBe(true);
  });

  it('returns false when tiles exceed room bounds', () => {
    const tiles = getFurnitureTiles({ x: 15, y: 0 }, sofa, 0); // x goes to 22, room ends at 20
    expect(isInsideRoom(tiles, livingRoom)).toBe(false);
  });
});

describe('isAllowedInRoom', () => {
  it('allows sofa in living room', () => {
    expect(isAllowedInRoom(sofa, 'living')).toBe(true);
  });

  it('denies toilet in kitchen', () => {
    expect(isAllowedInRoom(toilet, 'kitchen')).toBe(false);
  });

  it('allows toilet in bathroom', () => {
    expect(isAllowedInRoom(toilet, 'bathroom')).toBe(true);
  });

  it('allows chair anywhere (null allowed_rooms)', () => {
    expect(isAllowedInRoom(chair, 'kitchen')).toBe(true);
    expect(isAllowedInRoom(chair, 'bathroom')).toBe(true);
    expect(isAllowedInRoom(chair, 'living')).toBe(true);
  });
});

describe('hasCollision', () => {
  it('detects overlap', () => {
    const existing: FurnitureInstance[] = [
      { id: 'f1', catalogId: 'sofa', position: { x: 0, y: 0 }, rotation: 0, mirrored: false },
    ];
    const newTiles = getFurnitureTiles({ x: 4, y: 0 }, sofa, 0); // overlaps at x=4..7
    expect(hasCollision(newTiles, existing, catalogMap)).toBe(true);
  });

  it('no collision when apart', () => {
    const existing: FurnitureInstance[] = [
      { id: 'f1', catalogId: 'sofa', position: { x: 0, y: 0 }, rotation: 0, mirrored: false },
    ];
    const newTiles = getFurnitureTiles({ x: 10, y: 0 }, sofa, 0);
    expect(hasCollision(newTiles, existing, catalogMap)).toBe(false);
  });

  it('excludes self when checking', () => {
    const existing: FurnitureInstance[] = [
      { id: 'f1', catalogId: 'sofa', position: { x: 0, y: 0 }, rotation: 0, mirrored: false },
    ];
    const tiles = getFurnitureTiles({ x: 0, y: 0 }, sofa, 0);
    expect(hasCollision(tiles, existing, catalogMap, 'f1')).toBe(false);
  });
});

describe('validatePlacement', () => {
  it('valid placement in correct room', () => {
    const result = validatePlacement({ x: 1, y: 1 }, sofa, 0, rooms, [], catalogMap);
    expect(result.valid).toBe(true);
  });

  it('rejects when outside all rooms', () => {
    const result = validatePlacement({ x: 50, y: 50 }, sofa, 0, rooms, [], catalogMap);
    expect(result.valid).toBe(false);
    expect(result.reason).toContain('за пределы');
  });

  it('F8.7 (v1.13.0): allows toilet in kitchen — no allowed_rooms filter', () => {
    const result = validatePlacement({ x: 21, y: 1 }, toilet, 0, rooms, [], catalogMap);
    expect(result.valid).toBe(true);
  });

  it('allows toilet in bathroom', () => {
    const result = validatePlacement({ x: 21, y: 17 }, toilet, 0, rooms, [], catalogMap);
    expect(result.valid).toBe(true);
  });

  it('rejects collision with existing furniture', () => {
    const existing: FurnitureInstance[] = [
      { id: 'f1', catalogId: 'sofa', position: { x: 1, y: 1 }, rotation: 0, mirrored: false },
    ];
    const result = validatePlacement({ x: 5, y: 1 }, sofa, 0, rooms, existing, catalogMap);
    expect(result.valid).toBe(false);
    expect(result.reason).toContain('Пересечение');
  });
});
