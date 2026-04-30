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
    const r = makeRoom(0, 0, 12, 16); // 3 × 4 м
    // периметр = 2 × (3 + 4) = 14 м, площадь = 14 × 2.7 = 37.8 м²
    expect(wallAreaBare(r)).toBeCloseTo(37.8);
  });
});

describe('wallAreaForRoom (F2.3.4 / F3.2.7)', () => {
  const room = makeRoom(0, 0, 12, 16); // x∈[0..12], y∈[0..16]; периметр 14 м

  it('subtracts a window on the west wall', () => {
    const win = WindowSchema.parse({
      id: 'w',
      start: { x: 0, y: 4 },
      end: { x: 0, y: 8 }, // 4 тайла = 1 м в длину; высота по умолчанию 1.5 м → 1.5 м²
    });
    const expected = wallAreaBare(room) - 1.5;
    expect(wallAreaForRoom(room, [win], [])).toBeCloseTo(expected);
  });

  it('subtracts a door on the east wall', () => {
    const door = DoorSchema.parse({
      id: 'd',
      start: { x: 12, y: 6 },
      end: { x: 12, y: 9 }, // 3 тайла = 0.75 м; высота по умолчанию 2.1 м → 1.575 м²
    });
    const expected = wallAreaBare(room) - 0.75 * 2.1;
    expect(wallAreaForRoom(room, [], [door])).toBeCloseTo(expected);
  });

  it('ignores an opening that does not lie on the room perimeter', () => {
    // Проём на x=20 далеко вне границ комнаты
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
      start: { x: 2, y: 0 }, // южная стена
      end: { x: 6, y: 0 }, // 4 тайла = 1 м; 1 × 1.5 = 1.5 м²
    });
    const winN = WindowSchema.parse({
      id: 'w2',
      start: { x: 2, y: 16 }, // северная стена
      end: { x: 6, y: 16 },
    });
    const expected = wallAreaBare(room) - 1.5 - 1.5;
    expect(wallAreaForRoom(room, [winS, winN], [])).toBeCloseTo(expected);
  });
});

describe('totalPlasterArea — internal door is subtracted twice (F2.3.4)', () => {
  // Две смежные комнаты с общей стеной x = 12, в которой прорезана дверь.
  // Длина двери 3 тайла (0.75 м) × 2.1 м = 1.575 м². Штукатурки нет с обеих
  // сторон стены, поэтому суммарное вычитание — 2 × 1.575 = 3.15 м².
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
    // Окно на западной стене roomA — вне любой другой комнаты.
    const win = WindowSchema.parse({
      id: 'w',
      start: { x: 0, y: 4 },
      end: { x: 0, y: 8 },
    });
    const baseTotal = wallAreaBare(roomA) + wallAreaBare(roomB);
    const observed = totalPlasterArea([roomA, roomB], [win], []);
    const reduction = baseTotal - observed;
    // 4 тайла × 0.25 м × 1.5 м = 1.5 м²
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
      // Проёмы всегда уменьшают штукатурку — минимум на 1 м², так как в каждой
      // планировке есть несколько окон/дверей размером не меньше 1 м × 1.5 м
      expect(bare - total).toBeGreaterThan(1);
    });
  }
});
