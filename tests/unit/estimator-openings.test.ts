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
    const rooms = [makeRoom('r1', 20, 16)]; // 5 × 4 м
    const baseline = computeEstimate(rooms, {}, {}, {}, {}, [], [], emptyCatalog);
    const expected = 2 * (5 + 4) * 2.7; // периметр × высота
    expect(plaster(baseline).area).toBeCloseTo(expected, 1);
  });

  it('window on a wall subtracts its area from plaster total (F2.3.4 v1.9.0)', () => {
    const rooms = [makeRoom('r1', 20, 16)];
    const baseline = computeEstimate(rooms, {}, {}, {}, {}, [], [], emptyCatalog);
    // Окно на южной стене (y=0): 1.5 м шир. × 1.5 м выс. = 2.25 м²
    const win = WindowSchema.parse({ id: 'w', start: { x: 0, y: 0 }, end: { x: 6, y: 0 } });
    const withWindow = computeEstimate(rooms, {}, {}, {}, {}, [], [], emptyCatalog, [win]);
    expect(plaster(baseline).area - plaster(withWindow).area).toBeCloseTo(2.25, 1);
  });

  it('door on a wall subtracts its area from plaster total', () => {
    const rooms = [makeRoom('r1', 20, 16)];
    const baseline = computeEstimate(rooms, {}, {}, {}, {}, [], [], emptyCatalog);
    // дверь 0.75 м шир. × 2.1 м — 1.575 м²
    const door = DoorSchema.parse({ id: 'd', start: { x: 0, y: 0 }, end: { x: 3, y: 0 } });
    const withDoor = computeEstimate(rooms, {}, {}, {}, {}, [], [], emptyCatalog, [], [door]);
    expect(plaster(baseline).area - plaster(withDoor).area).toBeCloseTo(1.575, 1);
  });

  it('opening that does not lie on any room wall is ignored (F2.3.4 v1.9.0)', () => {
    const rooms = [makeRoom('r1', 20, 16)];
    const baseline = computeEstimate(rooms, {}, {}, {}, {}, [], [], emptyCatalog);
    // Проём «плавает» внутри комнаты (y=5 — не стена) — на штукатурку влиять не должен.
    const stray = WindowSchema.parse({ id: 'w', start: { x: 0, y: 5 }, end: { x: 6, y: 5 } });
    const result = computeEstimate(rooms, {}, {}, {}, {}, [], [], emptyCatalog, [stray]);
    expect(plaster(result).area).toBeCloseTo(plaster(baseline).area);
  });

  it('per-room wall area never goes below zero (F2.3.4 v1.9.0 clamp)', () => {
    const rooms = [makeRoom('r1', 20, 16)]; // голая площадь стен = 37.8 м²
    // Южная стена 5 м × 2.7 м = 13.5 м². Покрываем всю стену проёмом высотой 3 м
    // (> высоты стены) → wallAreaForRoom должна clamp'ить до ≥ 0, а итоговая
    // штукатурка должна оставаться неотрицательной.
    const massive = WindowSchema.parse({
      id: 'w',
      start: { x: 0, y: 0 },
      end: { x: 20, y: 0 },
      height_m: 3,
    });
    const result = computeEstimate(rooms, {}, {}, {}, {}, [], [], emptyCatalog, [massive]);
    expect(plaster(result).area).toBeGreaterThanOrEqual(0);
    expect(plaster(result).priceMin).toBeGreaterThanOrEqual(0);
  });
});
