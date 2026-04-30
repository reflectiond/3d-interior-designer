import { describe, it, expect } from 'vitest';
import {
  expandRect,
  tilesArea,
  tileToWorld,
  layoutRoomToRoom,
  TILE_SIZE,
  TILE_AREA,
} from '../../src/domain/geometry/tiles';

describe('tiles utilities', () => {
  it('TILE_SIZE is 0.25', () => {
    expect(TILE_SIZE).toBe(0.25);
  });

  it('TILE_AREA is 0.0625', () => {
    expect(TILE_AREA).toBe(0.0625);
  });

  describe('expandRect', () => {
    it('expands 2x3 rect into 6 tiles', () => {
      const tiles = expandRect(0, 0, 2, 3);
      expect(tiles).toHaveLength(6);
      expect(tiles).toContainEqual({ x: 0, y: 0 });
      expect(tiles).toContainEqual({ x: 1, y: 2 });
    });

    it('respects offset', () => {
      const tiles = expandRect(5, 10, 1, 1);
      expect(tiles).toEqual([{ x: 5, y: 10 }]);
    });

    it('returns empty for zero-size', () => {
      expect(expandRect(0, 0, 0, 1)).toHaveLength(0);
      expect(expandRect(0, 0, 1, 0)).toHaveLength(0);
    });
  });

  describe('tilesArea', () => {
    it('converts tile count to m²', () => {
      expect(tilesArea(16)).toBe(1.0); // 16 тайлов = 1 м²
      expect(tilesArea(0)).toBe(0);
      expect(tilesArea(160)).toBe(10.0);
    });
  });

  describe('tileToWorld', () => {
    it('converts tile (0,0) to origin', () => {
      expect(tileToWorld({ x: 0, y: 0 })).toEqual({ x: 0, z: 0 });
    });

    it('converts tile (4,4) to (1.0, 1.0)', () => {
      expect(tileToWorld({ x: 4, y: 4 })).toEqual({ x: 1.0, z: 1.0 });
    });
  });

  describe('layoutRoomToRoom', () => {
    it('converts layout room to runtime room', () => {
      const lr = {
        id: 'test',
        type: 'bedroom' as const,
        name: 'Test Room',
        x: 0,
        y: 0,
        width: 4,
        height: 4,
      };
      const room = layoutRoomToRoom(lr);
      expect(room.id).toBe('test');
      expect(room.tiles).toHaveLength(16);
      expect(room.area).toBe(1.0);
      expect(room.rect).toEqual({ x: 0, y: 0, width: 4, height: 4 });
    });
  });
});
