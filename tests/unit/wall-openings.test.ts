import { describe, it, expect } from 'vitest';
import { holesForWall, buildWallGeometry } from '../../src/views/View3D/wallOpenings';
import type { Room, Window, Door } from '../../src/domain/geometry/types';

// F7.5 (v1.15.0) — wallOpenings вычисляет, какие проёмы лежат на каждой
// стороне комнаты, и строит ShapeGeometry с прямоугольными вырезами.

function makeRoom(x: number, y: number, w: number, h: number): Room {
  const tiles = [];
  for (let dx = 0; dx < w; dx++)
    for (let dy = 0; dy < h; dy++) tiles.push({ x: x + dx, y: y + dy });
  return {
    id: 'r1',
    type: 'bedroom',
    name: 'Test',
    tiles,
    area: w * h * 0.0625,
    rect: { x, y, width: w, height: h },
  };
}

function win(start: { x: number; y: number }, end: { x: number; y: number }): Window {
  return { id: 'w1', start, end, sill_height_m: 0.9, height_m: 1.5 };
}

function door(start: { x: number; y: number }, end: { x: number; y: number }): Door {
  return { id: 'd1', start, end, height_m: 2.1, hinge: 'start', swing_side: 'left' };
}

describe('holesForWall — F7.5', () => {
  const room = makeRoom(0, 0, 8, 8); // 2×2 м

  it('окно на северной стене → один hole в правильных u/v координатах', () => {
    const w = win({ x: 2, y: 0 }, { x: 5, y: 0 }); // 3 тайла = 0.75м, на y=0 (север)
    const holes = holesForWall('north', room, { windows: [w], doors: [] });
    expect(holes).toHaveLength(1);
    expect(holes[0].uStart).toBeCloseTo(0.5); // (2 - 0) * 0.25
    expect(holes[0].uEnd).toBeCloseTo(1.25); // (5 - 0) * 0.25
    expect(holes[0].vStart).toBe(0.9);
    expect(holes[0].vEnd).toBeCloseTo(0.9 + 1.5);
  });

  it('дверь на восточной стене → hole с vStart=0', () => {
    const d = door({ x: 8, y: 2 }, { x: 8, y: 5 }); // на x=8 (восток)
    const holes = holesForWall('east', room, { windows: [], doors: [d] });
    expect(holes).toHaveLength(1);
    expect(holes[0].vStart).toBe(0);
    expect(holes[0].vEnd).toBe(2.1);
  });

  it('окно не на этой стене не попадает в hole-список', () => {
    const w = win({ x: 0, y: 4 }, { x: 0, y: 7 }); // на западе
    const holes = holesForWall('north', room, { windows: [w], doors: [] });
    expect(holes).toHaveLength(0);
  });

  it('окно за пределами span стены не попадает', () => {
    // комната x=0..8, окно на y=0 в x=10..12 — не пересекается со стеной
    const w = win({ x: 10, y: 0 }, { x: 12, y: 0 });
    const holes = holesForWall('north', room, { windows: [w], doors: [] });
    expect(holes).toHaveLength(0);
  });
});

describe('buildWallGeometry — F7.5', () => {
  it('без вырезов даёт прямоугольную геометрию', () => {
    const geom = buildWallGeometry(2, 2.7, []);
    expect(geom).toBeDefined();
    // ShapeGeometry без holes имеет 4 вершины
    expect(geom.attributes.position.count).toBeGreaterThanOrEqual(4);
  });

  it('с одним вырезом увеличивает число вершин (триангуляция вокруг hole)', () => {
    const empty = buildWallGeometry(2, 2.7, []);
    const withHole = buildWallGeometry(2, 2.7, [
      { uStart: 0.5, uEnd: 1.5, vStart: 0.9, vEnd: 2.4 },
    ]);
    expect(withHole.attributes.position.count).toBeGreaterThan(empty.attributes.position.count);
  });
});
