import { describe, it, expect } from 'vitest';
import { wallAreaBare, wallAreaForRoom, totalPlasterArea } from '../../src/domain/pricing/wallArea';
import type { Room } from '../../src/domain/geometry/types';
import { WindowSchema, DoorSchema, LayoutSchema } from '../../src/domain/geometry/types';
import layout1 from '../../src/data/layouts/layout1.json';
import layout2 from '../../src/data/layouts/layout2.json';
import layout3 from '../../src/data/layouts/layout3.json';

const TILE_AREA_M2 = 0.0625;

function makeRoom(x: number, y: number, w: number, h: number): Room {
  return {
    id: `r-${x}-${y}`,
    type: 'living',
    name: 'R',
    rect: { x, y, width: w, height: h },
    area: w * h * TILE_AREA_M2,
  };
}

describe('wallAreaBare', () => {
  it('is perimeter × room height', () => {
    const r = makeRoom(0, 0, 12, 16); // 3 × 4 m
    // perimeter = 2 × (3 + 4) = 14 m, area = 14 × 2.7 = 37.8 m²
    expect(wallAreaBare(r)).toBeCloseTo(37.8);
  });
});

describe('wallAreaForRoom (F2.3.4 / F3.2.7)', () => {
  const room = makeRoom(0, 0, 12, 16); // x∈[0..12], y∈[0..16]; perimeter 14 m

  it('subtracts a window on the west wall', () => {
    const win = WindowSchema.parse({
      id: 'w',
      start: { x: 0, y: 4 },
      end: { x: 0, y: 8 }, // 4 tiles = 1 m long; default height 1.5 m → 1.5 m²
    });
    const expected = wallAreaBare(room) - 1.5;
    expect(wallAreaForRoom(room, [win], [])).toBeCloseTo(expected);
  });

  it('subtracts a door on the east wall', () => {
    const door = DoorSchema.parse({
      id: 'd',
      start: { x: 12, y: 6 },
      end: { x: 12, y: 9 }, // 3 tiles = 0.75 m; default height 2.1 m → 1.575 m²
    });
    const expected = wallAreaBare(room) - 0.75 * 2.1;
    expect(wallAreaForRoom(room, [], [door])).toBeCloseTo(expected);
  });

  it('ignores an opening that does not lie on the room perimeter', () => {
    // An opening at x=20 is far outside the room
    const win = WindowSchema.parse({
      id: 'w',
      start: { x: 20, y: 4 },
      end: { x: 20, y: 8 },
    });
    expect(wallAreaForRoom(room, [win], [])).toBeCloseTo(wallAreaBare(room));
  });

  it('subtracts opening on south and north walls', () => {
    const winS = WindowSchema.parse({
      id: 'w1',
      start: { x: 2, y: 0 }, // south wall
      end: { x: 6, y: 0 }, // 4 tiles = 1 m; 1 × 1.5 = 1.5 m²
    });
    const winN = WindowSchema.parse({
      id: 'w2',
      start: { x: 2, y: 16 }, // north wall
      end: { x: 6, y: 16 },
    });
    const expected = wallAreaBare(room) - 1.5 - 1.5;
    expect(wallAreaForRoom(room, [winS, winN], [])).toBeCloseTo(expected);
  });
});

describe('totalPlasterArea — internal door is subtracted twice (F2.3.4)', () => {
  // Two adjacent rooms sharing the wall x = 12, with a door cut into it.
  // The door has length 3 tiles (0.75 m) × 2.1 m = 1.575 m². Plaster is missing
  // on both sides of the wall, so the total reduction is 2 × 1.575 = 3.15 m².
  const roomA = makeRoom(0, 0, 12, 16);
  const roomB = makeRoom(12, 0, 8, 16);
  const door = DoorSchema.parse({
    id: 'd',
    start: { x: 12, y: 6 },
    end: { x: 12, y: 9 },
  });

  it('subtracts the door area twice in totalPlasterArea', () => {
    const baseTotal = wallAreaBare(roomA) + wallAreaBare(roomB);
    const observed = totalPlasterArea([roomA, roomB], [], [door]);
    const reduction = baseTotal - observed;
    expect(reduction).toBeCloseTo(2 * 0.75 * 2.1);
  });

  it('subtracts an external window only once', () => {
    // Window on roomA's west wall — outside any other room.
    const win = WindowSchema.parse({
      id: 'w',
      start: { x: 0, y: 4 },
      end: { x: 0, y: 8 },
    });
    const baseTotal = wallAreaBare(roomA) + wallAreaBare(roomB);
    const observed = totalPlasterArea([roomA, roomB], [win], []);
    const reduction = baseTotal - observed;
    // 4 tiles × 0.25 m × 1.5 m = 1.5 m²
    expect(reduction).toBeCloseTo(1.5);
  });
});

describe('layout 1/2/3 — plaster total is positive and bounded by bare area', () => {
  const TILE_AREA = 0.0625;
  function expandRooms(layout: { rooms: Room[] }) {
    return layout.rooms.map(
      (r: {
        id: string;
        type: string;
        name: string;
        x: number;
        y: number;
        width: number;
        height: number;
      }) => ({
        id: r.id,
        type: r.type as Room['type'],
        name: r.name,
        rect: { x: r.x, y: r.y, width: r.width, height: r.height },
        area: r.width * r.height * TILE_AREA,
      }),
    );
  }

  for (const [name, raw] of [
    ['layout 1', layout1],
    ['layout 2', layout2],
    ['layout 3', layout3],
  ] as const) {
    it(`${name} subtracts ≥ 1 m² of openings (F2.3.4)`, () => {
      const layout = LayoutSchema.parse(raw);
      const rooms = expandRooms(
        layout as unknown as {
          rooms: {
            id: string;
            type: string;
            name: string;
            x: number;
            y: number;
            width: number;
            height: number;
          }[];
        },
      );
      const bare = rooms.reduce((s, r) => s + wallAreaBare(r), 0);
      const total = totalPlasterArea(rooms, layout.windows, layout.doors);
      expect(total).toBeGreaterThan(0);
      expect(total).toBeLessThan(bare);
      // openings always reduce plaster — at least 1 m² since each layout has
      // multiple windows/doors at minimum 1 m × 1.5 m
      expect(bare - total).toBeGreaterThan(1);
    });
  }
});
