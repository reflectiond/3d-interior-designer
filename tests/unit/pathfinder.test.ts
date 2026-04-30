import { describe, it, expect } from 'vitest';
import { bfsPath, computeRoutes } from '../../src/domain/electrical/pathfinder';
import type { TileCoord } from '../../src/domain/geometry/types';

function makeGrid(w: number, h: number): Set<string> {
  const s = new Set<string>();
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      s.add(`${x},${y}`);
    }
  }
  return s;
}

describe('bfsPath', () => {
  it('returns single-tile path when source equals target', () => {
    const grid = makeGrid(5, 5);
    const path = bfsPath({ x: 2, y: 2 }, { x: 2, y: 2 }, grid);
    expect(path).toEqual([{ x: 2, y: 2 }]);
  });

  it('finds shortest path in open grid', () => {
    const grid = makeGrid(5, 5);
    const path = bfsPath({ x: 0, y: 0 }, { x: 4, y: 0 }, grid);
    expect(path).not.toBeNull();
    // Манхэттенское расстояние равно 4, поэтому длина пути — 5 (с обеими концевыми точками)
    expect(path!.length).toBe(5);
    expect(path![0]).toEqual({ x: 0, y: 0 });
    expect(path![4]).toEqual({ x: 4, y: 0 });
  });

  it('routes around obstacles', () => {
    const grid = makeGrid(5, 5);
    // Блокируем прямой путь по y=0
    grid.delete('1,0');
    grid.delete('2,0');
    grid.delete('3,0');
    const path = bfsPath({ x: 0, y: 0 }, { x: 4, y: 0 }, grid);
    expect(path).not.toBeNull();
    // Путь должен идти в обход, поэтому длиннее 5
    expect(path!.length).toBeGreaterThan(5);
    expect(path![0]).toEqual({ x: 0, y: 0 });
    expect(path![path!.length - 1]).toEqual({ x: 4, y: 0 });
  });

  it('returns null when target is unreachable', () => {
    const grid = makeGrid(5, 5);
    // Создаём стену, отделяющую левую часть от правой
    for (let y = 0; y < 5; y++) {
      grid.delete(`2,${y}`);
    }
    const path = bfsPath({ x: 0, y: 0 }, { x: 4, y: 0 }, grid);
    expect(path).toBeNull();
  });

  it('returns null when source is not in allowed set', () => {
    const grid = makeGrid(5, 5);
    grid.delete('0,0');
    const path = bfsPath({ x: 0, y: 0 }, { x: 4, y: 0 }, grid);
    expect(path).toBeNull();
  });

  it('returns null when target is not in allowed set', () => {
    const grid = makeGrid(5, 5);
    grid.delete('4,0');
    const path = bfsPath({ x: 0, y: 0 }, { x: 4, y: 0 }, grid);
    expect(path).toBeNull();
  });

  it('only moves in 4 directions (no diagonals)', () => {
    const grid = makeGrid(5, 5);
    const path = bfsPath({ x: 0, y: 0 }, { x: 2, y: 2 }, grid);
    expect(path).not.toBeNull();
    for (let i = 1; i < path!.length; i++) {
      const dx = Math.abs(path![i].x - path![i - 1].x);
      const dy = Math.abs(path![i].y - path![i - 1].y);
      expect(dx + dy).toBe(1); // Ровно один шаг в одном направлении
    }
  });
});

describe('computeRoutes', () => {
  it('returns empty for no points', () => {
    const grid = makeGrid(10, 10);
    const routes = computeRoutes({
      ceilingTiles: grid,
      panelPos: { x: 0, y: 0 },
      points: [],
    });
    expect(routes).toEqual([]);
  });

  it('routes a single point to the panel', () => {
    const grid = makeGrid(10, 10);
    const routes = computeRoutes({
      ceilingTiles: grid,
      panelPos: { x: 0, y: 0 },
      points: [{ id: 'p1', tile: { x: 5, y: 0 } }],
    });
    expect(routes).toHaveLength(1);
    expect(routes[0].pointId).toBe('p1');
    expect(routes[0].path.length).toBeGreaterThan(0);
    expect(routes[0].path[0]).toEqual({ x: 5, y: 0 }); // начинается в точке
  });

  it('routes to panel position directly', () => {
    const grid = makeGrid(10, 10);
    const routes = computeRoutes({
      ceilingTiles: grid,
      panelPos: { x: 5, y: 5 },
      points: [{ id: 'p1', tile: { x: 5, y: 5 } }],
    });
    expect(routes[0].path).toEqual([{ x: 5, y: 5 }]);
  });

  it('routes multiple points, reusing existing tree', () => {
    const grid = makeGrid(10, 10);
    const routes = computeRoutes({
      ceilingTiles: grid,
      panelPos: { x: 0, y: 0 },
      points: [
        { id: 'p1', tile: { x: 5, y: 0 } },
        { id: 'p2', tile: { x: 5, y: 5 } },
      ],
    });
    expect(routes).toHaveLength(2);
    // Обе должны иметь валидные пути
    expect(routes[0].path.length).toBeGreaterThan(0);
    expect(routes[1].path.length).toBeGreaterThan(0);
  });

  it('shares wiring — farther point reuses tree from closer point', () => {
    const grid = makeGrid(10, 1); // узкий коридор
    const routes = computeRoutes({
      ceilingTiles: grid,
      panelPos: { x: 0, y: 0 },
      points: [
        { id: 'p1', tile: { x: 9, y: 0 } },
        { id: 'p2', tile: { x: 5, y: 0 } },
      ],
    });
    // p2 (ближе к щиту) маршрутизируется первой: путь от 5 до 0 = 6 тайлов
    // p1 (дальше) затем маршрутизируется от 9 к дереву (где уже есть 0..5) = 5 тайлов
    const p1Route = routes.find((r) => r.pointId === 'p1')!;
    const p2Route = routes.find((r) => r.pointId === 'p2')!;
    expect(p2Route.path.length).toBe(6); // 5 → 0
    expect(p1Route.path.length).toBeLessThanOrEqual(5); // 9 → 5 (переиспользование дерева)
  });

  it('handles point deletion and recompute', () => {
    const grid = makeGrid(10, 10);
    // Маршрут на 5 точек
    const allPoints = [
      { id: 'p1', tile: { x: 3, y: 0 } as TileCoord },
      { id: 'p2', tile: { x: 6, y: 0 } as TileCoord },
      { id: 'p3', tile: { x: 3, y: 5 } as TileCoord },
      { id: 'p4', tile: { x: 6, y: 5 } as TileCoord },
      { id: 'p5', tile: { x: 9, y: 9 } as TileCoord },
    ];
    const routes1 = computeRoutes({
      ceilingTiles: grid,
      panelPos: { x: 0, y: 0 },
      points: allPoints,
    });
    expect(routes1).toHaveLength(5);

    // Удаляем третью точку и пересчитываем
    const reducedPoints = allPoints.filter((p) => p.id !== 'p3');
    const routes2 = computeRoutes({
      ceilingTiles: grid,
      panelPos: { x: 0, y: 0 },
      points: reducedPoints,
    });
    expect(routes2).toHaveLength(4);
    expect(routes2.find((r) => r.pointId === 'p3')).toBeUndefined();
  });

  it('produces no duplicate wire tiles within a single route', () => {
    const grid = makeGrid(10, 10);
    const routes = computeRoutes({
      ceilingTiles: grid,
      panelPos: { x: 0, y: 0 },
      points: [
        { id: 'p1', tile: { x: 5, y: 5 } },
        { id: 'p2', tile: { x: 8, y: 3 } },
      ],
    });
    for (const route of routes) {
      const keys = route.path.map((t) => `${t.x},${t.y}`);
      expect(new Set(keys).size).toBe(keys.length);
    }
  });
});
