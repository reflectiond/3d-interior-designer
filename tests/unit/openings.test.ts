import { describe, it, expect } from 'vitest';
import {
  WindowSchema,
  DoorSchema,
  LayoutSchema,
  type Window,
  type Door,
} from '../../src/domain/geometry/types';
import {
  openingsOverlap,
  validateNoOverlaps,
  segmentLength,
  openingTiles,
  openingAreaM2,
  getDoorBlockedTiles,
  tilesIntersect,
} from '../../src/domain/geometry/openings';

const minimalLayout = {
  id: 1,
  name: 'L1',
  gridWidth: 20,
  gridHeight: 20,
  rooms: [{ id: 'r1', type: 'living', name: 'Living', x: 0, y: 0, width: 10, height: 10 }],
  electricalPanel: { x: 1, y: 1 },
};

describe('WindowSchema', () => {
  it('parses a valid horizontal window with defaults applied', () => {
    const parsed = WindowSchema.parse({
      id: 'win1',
      start: { x: 4, y: 10 },
      end: { x: 10, y: 10 },
    });
    expect(parsed.sill_height_m).toBe(0.9);
    expect(parsed.height_m).toBe(1.5);
  });

  it('parses a valid vertical window', () => {
    const parsed = WindowSchema.parse({
      id: 'win2',
      start: { x: 10, y: 0 },
      end: { x: 10, y: 6 },
    });
    expect(parsed.start.x).toBe(parsed.end.x);
  });

  it('rejects a non-axis-aligned segment', () => {
    expect(() =>
      WindowSchema.parse({ id: 'bad', start: { x: 0, y: 0 }, end: { x: 4, y: 6 } }),
    ).toThrow(/axis-aligned/);
  });

  it('rejects a zero-length segment', () => {
    expect(() =>
      WindowSchema.parse({ id: 'bad', start: { x: 5, y: 5 }, end: { x: 5, y: 5 } }),
    ).toThrow(/non-zero length/);
  });

  it('rejects sill_height_m above 3 m', () => {
    expect(() =>
      WindowSchema.parse({
        id: 'bad',
        start: { x: 0, y: 0 },
        end: { x: 4, y: 0 },
        sill_height_m: 5,
      }),
    ).toThrow();
  });
});

describe('DoorSchema', () => {
  it('parses a valid door with defaults', () => {
    const parsed = DoorSchema.parse({
      id: 'door1',
      start: { x: 12, y: 5 },
      end: { x: 15, y: 5 },
    });
    expect(parsed.height_m).toBe(2.1);
    expect(parsed.hinge).toBe('start');
    expect(parsed.swing_side).toBe('left');
  });

  it('accepts hinge=end, swing_side=right', () => {
    const parsed = DoorSchema.parse({
      id: 'door2',
      start: { x: 0, y: 5 },
      end: { x: 4, y: 5 },
      hinge: 'end',
      swing_side: 'right',
    });
    expect(parsed.hinge).toBe('end');
    expect(parsed.swing_side).toBe('right');
  });
});

describe('LayoutSchema windows/doors', () => {
  it('defaults windows and doors to empty arrays for backward compat', () => {
    const parsed = LayoutSchema.parse(minimalLayout);
    expect(parsed.windows).toEqual([]);
    expect(parsed.doors).toEqual([]);
  });

  it('preserves provided windows and doors', () => {
    const parsed = LayoutSchema.parse({
      ...minimalLayout,
      windows: [{ id: 'w1', start: { x: 0, y: 5 }, end: { x: 4, y: 5 } }],
      doors: [{ id: 'd1', start: { x: 10, y: 0 }, end: { x: 13, y: 0 } }],
    });
    expect(parsed.windows).toHaveLength(1);
    expect(parsed.doors).toHaveLength(1);
  });
});

describe('openingsOverlap', () => {
  function w(id: string, x1: number, y1: number, x2: number, y2: number): Window {
    return WindowSchema.parse({ id, start: { x: x1, y: y1 }, end: { x: x2, y: y2 } });
  }

  it('detects two overlapping horizontal windows on the same wall', () => {
    const a = w('a', 0, 5, 6, 5);
    const b = w('b', 4, 5, 10, 5);
    expect(openingsOverlap(a, b)).toBe(true);
  });

  it('detects two touching-but-non-overlapping windows as non-overlapping', () => {
    const a = w('a', 0, 5, 4, 5);
    const b = w('b', 4, 5, 8, 5);
    expect(openingsOverlap(a, b)).toBe(false);
  });

  it('treats different walls (different y) as non-overlapping', () => {
    const a = w('a', 0, 5, 6, 5);
    const b = w('b', 0, 6, 6, 6);
    expect(openingsOverlap(a, b)).toBe(false);
  });

  it('detects overlap between a window and a door on the same wall', () => {
    const win: Window = w('win', 0, 5, 6, 5);
    const door: Door = DoorSchema.parse({
      id: 'door',
      start: { x: 4, y: 5 },
      end: { x: 8, y: 5 },
    });
    expect(openingsOverlap(win, door)).toBe(true);
  });
});

describe('validateNoOverlaps', () => {
  it('returns empty array when no overlaps', () => {
    const wins = [WindowSchema.parse({ id: 'w', start: { x: 0, y: 5 }, end: { x: 4, y: 5 } })];
    const doors = [DoorSchema.parse({ id: 'd', start: { x: 5, y: 5 }, end: { x: 8, y: 5 } })];
    expect(validateNoOverlaps(wins, doors)).toEqual([]);
  });

  it('returns one error for each overlapping pair', () => {
    const wins = [
      WindowSchema.parse({ id: 'w1', start: { x: 0, y: 5 }, end: { x: 6, y: 5 } }),
      WindowSchema.parse({ id: 'w2', start: { x: 4, y: 5 }, end: { x: 10, y: 5 } }),
    ];
    const errors = validateNoOverlaps(wins, []);
    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain('w1');
    expect(errors[0]).toContain('w2');
  });
});

describe('openingTiles & helpers', () => {
  it('lists tiles along a horizontal opening', () => {
    const tiles = openingTiles({ start: { x: 4, y: 10 }, end: { x: 7, y: 10 } });
    expect(tiles).toEqual([
      { x: 4, y: 10 },
      { x: 5, y: 10 },
      { x: 6, y: 10 },
    ]);
  });

  it('lists tiles along a vertical opening', () => {
    const tiles = openingTiles({ start: { x: 4, y: 10 }, end: { x: 4, y: 13 } });
    expect(tiles).toEqual([
      { x: 4, y: 10 },
      { x: 4, y: 11 },
      { x: 4, y: 12 },
    ]);
  });

  it('segmentLength is Manhattan distance', () => {
    expect(segmentLength({ start: { x: 4, y: 10 }, end: { x: 10, y: 10 } })).toBe(6);
    expect(segmentLength({ start: { x: 0, y: 0 }, end: { x: 0, y: 4 } })).toBe(4);
  });

  it('openingAreaM2 multiplies length × height × tile size', () => {
    const door = DoorSchema.parse({
      id: 'd',
      start: { x: 0, y: 0 },
      end: { x: 4, y: 0 },
    });
    // 4 тайла × 0.25 м × 2.1 м = 2.1 м²
    expect(openingAreaM2(door, 0.25)).toBeCloseTo(2.1);
  });
});

describe('getDoorBlockedTiles (F7.3.4)', () => {
  it('blocks the segment tiles plus a 1-tile buffer perpendicular to a horizontal door', () => {
    const door = DoorSchema.parse({
      id: 'd',
      start: { x: 4, y: 10 },
      end: { x: 7, y: 10 },
    });
    const blocked = getDoorBlockedTiles([door]);
    // 3 тайла сегмента + 6 тайлов буфера (3 сверху + 3 снизу)
    expect(blocked).toHaveLength(9);
    const set = new Set(blocked.map((t) => `${t.x},${t.y}`));
    expect(set.has('4,10')).toBe(true);
    expect(set.has('5,10')).toBe(true);
    expect(set.has('6,10')).toBe(true);
    expect(set.has('4,9')).toBe(true); // буфер с юга
    expect(set.has('5,11')).toBe(true); // буфер с севера
  });

  it('blocks the segment tiles plus a 1-tile buffer perpendicular to a vertical door', () => {
    const door = DoorSchema.parse({
      id: 'd',
      start: { x: 10, y: 4 },
      end: { x: 10, y: 7 },
    });
    const blocked = getDoorBlockedTiles([door]);
    expect(blocked).toHaveLength(9);
    const set = new Set(blocked.map((t) => `${t.x},${t.y}`));
    expect(set.has('10,4')).toBe(true);
    expect(set.has('9,4')).toBe(true); // буфер с запада
    expect(set.has('11,5')).toBe(true); // буфер с востока
  });

  it('returns an empty array when there are no doors', () => {
    expect(getDoorBlockedTiles([])).toEqual([]);
  });
});

describe('tilesIntersect', () => {
  it('returns false when no tiles overlap', () => {
    const a = [{ x: 0, y: 0 }];
    const b = [{ x: 1, y: 1 }];
    expect(tilesIntersect(a, b)).toBe(false);
  });

  it('returns true when at least one tile is shared', () => {
    const a = [
      { x: 0, y: 0 },
      { x: 1, y: 0 },
    ];
    const b = [{ x: 1, y: 0 }];
    expect(tilesIntersect(a, b)).toBe(true);
  });

  it('returns false when blocked is empty', () => {
    expect(tilesIntersect([{ x: 0, y: 0 }], [])).toBe(false);
  });
});
