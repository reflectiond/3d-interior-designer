import { describe, it, expect } from 'vitest';
import { computeEstimate } from '../../src/domain/pricing/estimator';
import type { Room } from '../../src/domain/geometry/types';
import { WindowSchema, DoorSchema } from '../../src/domain/geometry/types';
import type { CatalogItem } from '../../src/domain/furniture/placement';

function makeRoom(id: string, w: number, h: number): Room {
  return {
    id,
    type: 'living',
    name: 'L',
    rect: { x: 0, y: 0, width: w, height: h },
    area: w * h * 0.0625,
    tiles: [],
  };
}

const emptyCatalog = new Map<string, CatalogItem>();

function plaster(estimate: ReturnType<typeof computeEstimate>): {
  area: number;
  priceMin: number;
  priceMax: number;
} {
  const item = estimate.items.find((i) => i.name === 'Штукатурка стен');
  if (!item) throw new Error('plaster line missing');
  const num = parseFloat(item.quantity.replace(/[^\d.]/g, ''));
  return { area: num, priceMin: item.priceMin, priceMax: item.priceMax };
}

describe('computeEstimate — openings reduce plaster area (F7.2.4, F7.3.5)', () => {
  it('plaster area equals room perimeter × height when there are no openings', () => {
    const rooms = [makeRoom('r1', 20, 16)]; // 5 × 4 m
    const baseline = computeEstimate(rooms, {}, {}, {}, {}, [], [], emptyCatalog);
    const expected = 2 * (5 + 4) * 2.7; // perimeter × height
    expect(plaster(baseline).area).toBeCloseTo(expected, 1);
  });

  it('window subtracts its area from plaster total', () => {
    const rooms = [makeRoom('r1', 20, 16)];
    const baseline = computeEstimate(rooms, {}, {}, {}, {}, [], [], emptyCatalog);
    // 1.5 m wide × 1.5 m tall window — 2.25 m²
    const win = WindowSchema.parse({ id: 'w', start: { x: 0, y: 5 }, end: { x: 6, y: 5 } });
    const withWindow = computeEstimate(rooms, {}, {}, {}, {}, [], [], emptyCatalog, [win]);
    expect(plaster(baseline).area - plaster(withWindow).area).toBeCloseTo(2.25, 1);
  });

  it('door subtracts its area from plaster total', () => {
    const rooms = [makeRoom('r1', 20, 16)];
    const baseline = computeEstimate(rooms, {}, {}, {}, {}, [], [], emptyCatalog);
    // 0.75 m wide × 2.1 m door — 1.575 m²
    const door = DoorSchema.parse({ id: 'd', start: { x: 0, y: 0 }, end: { x: 3, y: 0 } });
    const withDoor = computeEstimate(rooms, {}, {}, {}, {}, [], [], emptyCatalog, [], [door]);
    expect(plaster(baseline).area - plaster(withDoor).area).toBeCloseTo(1.575, 1);
  });

  it('plaster area never goes below zero even with absurdly large openings', () => {
    const rooms = [makeRoom('r1', 20, 16)];
    const huge = WindowSchema.parse({
      id: 'w',
      start: { x: 0, y: 0 },
      end: { x: 80, y: 0 },
      height_m: 3,
    });
    const result = computeEstimate(rooms, {}, {}, {}, {}, [], [], emptyCatalog, [huge]);
    expect(plaster(result).area).toBe(0);
    expect(plaster(result).priceMin).toBe(0);
    expect(plaster(result).priceMax).toBe(0);
  });
});
