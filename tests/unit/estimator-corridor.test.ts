import { describe, it, expect } from 'vitest';
import { computeEstimate } from '../../src/domain/pricing/estimator';
import { LayoutSchema } from '../../src/domain/geometry/types';
import type { Room, FloorCovering, WallCovering } from '../../src/domain/geometry/types';
import type { CatalogItem } from '../../src/domain/furniture/placement';
import layout1 from '../../src/data/layouts/layout1.json';
import layout2 from '../../src/data/layouts/layout2.json';
import layout3 from '../../src/data/layouts/layout3.json';

// F12.2 / F12.4 (v1.9.0) — corridor and wardrobe must show up in the
// estimator output now that they're no longer filtered from the panels.

const TILE_AREA_M2 = 0.0625;

function expandRooms(layout: {
  rooms: {
    id: string;
    type: string;
    name: string;
    x: number;
    y: number;
    width: number;
    height: number;
  }[];
}): Room[] {
  return layout.rooms.map((r) => ({
    id: r.id,
    type: r.type as Room['type'],
    name: r.name,
    rect: { x: r.x, y: r.y, width: r.width, height: r.height },
    area: r.width * r.height * TILE_AREA_M2,
  }));
}

function runEstimate(
  layoutData: unknown,
  opts: { floor?: FloorCovering; wall?: WallCovering } = {},
) {
  const layout = LayoutSchema.parse(layoutData);
  const rooms = expandRooms(layout);
  const flooring = Object.fromEntries(rooms.map((r) => [r.id, 'screed' as const]));
  const ceiling = Object.fromEntries(rooms.map((r) => [r.id, 'stretch' as const]));
  const floorCovering = opts.floor ? Object.fromEntries(rooms.map((r) => [r.id, opts.floor!])) : {};
  const wallCovering = opts.wall ? Object.fromEntries(rooms.map((r) => [r.id, opts.wall!])) : {};
  const catalog = new Map<string, CatalogItem>();
  return {
    layout,
    rooms,
    estimate: computeEstimate(
      rooms,
      flooring,
      ceiling,
      floorCovering,
      wallCovering,
      [],
      [],
      catalog,
      layout.windows,
      layout.doors,
    ),
  };
}

describe('Estimator (F12.2 / F12.4) — corridor + wardrobe inclusion', () => {
  for (const [name, data] of [
    ['layout 1', layout1],
    ['layout 2', layout2],
    ['layout 3', layout3],
  ] as const) {
    describe(name, () => {
      it('lists screed for every corridor room', () => {
        const { rooms, estimate } = runEstimate(data);
        const corridors = rooms.filter((r) => r.type === 'corridor');
        for (const c of corridors) {
          const hit = estimate.items.find(
            (i) => i.name.endsWith(`— ${c.name}`) && i.name.startsWith('Стяжка'),
          );
          expect(hit, `expected screed line for ${c.name}`).toBeDefined();
        }
      });

      it('lists screed for every wardrobe room', () => {
        const { rooms, estimate } = runEstimate(data);
        const wardrobes = rooms.filter((r) => r.type === 'wardrobe');
        for (const w of wardrobes) {
          const hit = estimate.items.find(
            (i) => i.name.endsWith(`— ${w.name}`) && i.name.startsWith('Стяжка'),
          );
          expect(hit, `expected screed line for ${w.name}`).toBeDefined();
        }
      });

      it('lists ceiling for every corridor and wardrobe', () => {
        const { rooms, estimate } = runEstimate(data);
        const targets = rooms.filter((r) => r.type === 'corridor' || r.type === 'wardrobe');
        for (const r of targets) {
          const hit = estimate.items.find(
            (i) =>
              i.name.endsWith(`— ${r.name}`) &&
              (i.name.startsWith('Натяжной потолок') || i.name.startsWith('Гипсокартон')),
          );
          expect(hit, `expected ceiling line for ${r.name}`).toBeDefined();
        }
      });

      it('lists tile floor covering for corridor and wardrobe when set', () => {
        const { rooms, estimate } = runEstimate(data, { floor: 'tile' });
        const targets = rooms.filter((r) => r.type === 'corridor' || r.type === 'wardrobe');
        for (const r of targets) {
          const hit = estimate.items.find((i) => i.name === `Плитка — ${r.name}`);
          expect(hit, `expected tile floor for ${r.name}`).toBeDefined();
        }
      });

      it('lists paint wall covering for corridor and wardrobe when set', () => {
        const { rooms, estimate } = runEstimate(data, { wall: 'paint' });
        const targets = rooms.filter((r) => r.type === 'corridor' || r.type === 'wardrobe');
        for (const r of targets) {
          const hit = estimate.items.find((i) => i.name === `Покраска — ${r.name}`);
          expect(hit, `expected paint wall for ${r.name}`).toBeDefined();
        }
      });
    });
  }
});
