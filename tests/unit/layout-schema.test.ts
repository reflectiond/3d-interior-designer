import { describe, it, expect } from 'vitest';
import { LayoutSchema } from '../../src/domain/geometry/types';
import layout1 from '../../src/data/layouts/layout1.json';
import layout2 from '../../src/data/layouts/layout2.json';
import layout3 from '../../src/data/layouts/layout3.json';

describe('LayoutSchema validation', () => {
  it('validates layout1.json', () => {
    expect(() => LayoutSchema.parse(layout1)).not.toThrow();
  });

  it('validates layout2.json', () => {
    expect(() => LayoutSchema.parse(layout2)).not.toThrow();
  });

  it('validates layout3.json', () => {
    expect(() => LayoutSchema.parse(layout3)).not.toThrow();
  });

  it('rejects empty rooms array', () => {
    const bad = { ...layout1, rooms: [] };
    expect(() => LayoutSchema.parse(bad)).toThrow();
  });

  it('rejects unknown room type', () => {
    const bad = {
      ...layout1,
      rooms: [{ ...layout1.rooms[0], type: 'garage' }],
    };
    expect(() => LayoutSchema.parse(bad)).toThrow();
  });

  it('rejects room with width < 4 tiles', () => {
    const bad = {
      ...layout1,
      rooms: [{ ...layout1.rooms[0], width: 2 }],
    };
    expect(() => LayoutSchema.parse(bad)).toThrow();
  });

  it('rejects missing electricalPanel', () => {
    const { electricalPanel: _, ...bad } = layout1;
    void _;
    expect(() => LayoutSchema.parse(bad)).toThrow();
  });

  it('all rooms tile-cover the grid in layout1', () => {
    const layout = LayoutSchema.parse(layout1);
    const totalTiles = layout.rooms.reduce((s, r) => s + r.width * r.height, 0);
    expect(totalTiles).toBe(layout.gridWidth * layout.gridHeight);
  });

  it('all rooms tile-cover the grid in layout2', () => {
    const layout = LayoutSchema.parse(layout2);
    const totalTiles = layout.rooms.reduce((s, r) => s + r.width * r.height, 0);
    expect(totalTiles).toBe(layout.gridWidth * layout.gridHeight);
  });

  it('all rooms tile-cover the grid in layout3', () => {
    const layout = LayoutSchema.parse(layout3);
    const totalTiles = layout.rooms.reduce((s, r) => s + r.width * r.height, 0);
    expect(totalTiles).toBe(layout.gridWidth * layout.gridHeight);
  });

  it('no room overlaps in layout1', () => {
    const layout = LayoutSchema.parse(layout1);
    const occupied = new Set<string>();
    for (const room of layout.rooms) {
      for (let y = room.y; y < room.y + room.height; y++) {
        for (let x = room.x; x < room.x + room.width; x++) {
          const key = `${x},${y}`;
          expect(occupied.has(key), `Tile ${key} occupied twice`).toBe(false);
          occupied.add(key);
        }
      }
    }
  });
});
