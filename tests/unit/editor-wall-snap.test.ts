import { describe, it, expect } from 'vitest';
import {
  findNearestWall,
  pickDoorSwingSide,
  projectOntoWall,
  roomWalls,
  WALL_SNAP_RADIUS,
} from '../../src/editor/wallSnap';
import type { EditorRoom } from '../../src/editor/state';

function room(id: string, x: number, y: number, w: number, h: number): EditorRoom {
  return { id, type: 'bedroom', name: id, x, y, width: w, height: h };
}

describe('roomWalls', () => {
  it('returns 4 walls in west/east/south/north order', () => {
    const r = room('r', 0, 0, 12, 8);
    const walls = roomWalls(r);
    expect(walls).toHaveLength(4);
    expect(walls[0]).toEqual({ axis: 'v', line: 0, rangeMin: 0, rangeMax: 8 });
    expect(walls[1]).toEqual({ axis: 'v', line: 12, rangeMin: 0, rangeMax: 8 });
    expect(walls[2]).toEqual({ axis: 'h', line: 0, rangeMin: 0, rangeMax: 12 });
    expect(walls[3]).toEqual({ axis: 'h', line: 8, rangeMin: 0, rangeMax: 12 });
  });
});

describe('projectOntoWall', () => {
  it('clamps a point onto a vertical wall', () => {
    const wall = { axis: 'v' as const, line: 12, rangeMin: 5, rangeMax: 15 };
    expect(projectOntoWall({ x: 14, y: 8 }, wall)).toEqual({ x: 12, y: 8 });
    expect(projectOntoWall({ x: 14, y: 2 }, wall)).toEqual({ x: 12, y: 5 });
    expect(projectOntoWall({ x: 14, y: 20 }, wall)).toEqual({ x: 12, y: 15 });
  });

  it('clamps a point onto a horizontal wall', () => {
    const wall = { axis: 'h' as const, line: 8, rangeMin: 0, rangeMax: 12 };
    expect(projectOntoWall({ x: 6, y: 5 }, wall)).toEqual({ x: 6, y: 8 });
    expect(projectOntoWall({ x: -3, y: 5 }, wall)).toEqual({ x: 0, y: 8 });
    expect(projectOntoWall({ x: 99, y: 5 }, wall)).toEqual({ x: 12, y: 8 });
  });
});

describe('findNearestWall (F11.2.8 v1.10.0)', () => {
  it('snaps a click near a wall to the wall line', () => {
    const r = room('r', 0, 0, 12, 8);
    // Клик на 1 тайл внутри восточной стены; должен прилипнуть к x=12, y без изменений.
    const result = findNearestWall({ x: 11, y: 5 }, [r]);
    expect(result?.snapped).toEqual({ x: 12, y: 5 });
    expect(result?.wall.axis).toBe('v');
    expect(result?.wall.line).toBe(12);
  });

  it('returns null when click is far from any wall', () => {
    const r = room('r', 0, 0, 20, 20);
    // Клик в центре комнаты 20×20 — ближайшая стена в 10 тайлах,
    // за пределами WALL_SNAP_RADIUS.
    const result = findNearestWall({ x: 10, y: 10 }, [r]);
    expect(result).toBeNull();
    expect(WALL_SNAP_RADIUS).toBe(3);
  });

  it('picks the closest wall when multiple rooms share a boundary', () => {
    const a = room('a', 0, 0, 12, 8);
    const b = room('b', 12, 0, 8, 8);
    // Клик чуть внутри комнаты A, рядом с общей east/west стеной на x=12.
    const result = findNearestWall({ x: 11, y: 4 }, [a, b]);
    expect(result?.snapped.x).toBe(12);
    expect(result?.wall.axis).toBe('v');
    expect(result?.wall.line).toBe(12);
  });

  it('returns null with an empty rooms array', () => {
    expect(findNearestWall({ x: 5, y: 5 }, [])).toBeNull();
  });
});

describe('pickDoorSwingSide (F11.2.8 v1.10.0)', () => {
  it("picks 'left' when the left side is inside a room and right is empty", () => {
    const r = room('r', 0, 0, 12, 8);
    // Вертикальная дверь на восточной стене x=12, y=2..5. Левая сторона — внутри
    // комнаты (x<12), правая — снаружи планировки. Створка должна распахиваться
    // В комнату (left).
    const swing = pickDoorSwingSide({ start: { x: 12, y: 2 }, end: { x: 12, y: 5 } }, [r]);
    expect(swing).toBe('left');
  });

  it("picks 'right' when only the right side has a room", () => {
    const r = room('r', 12, 0, 8, 8);
    // Вертикальная дверь на западной стене x=12 комнаты. Правая сторона (x>=12) —
    // комната, левая (x<12) — пусто. Створка распахивается вправо В комнату.
    const swing = pickDoorSwingSide({ start: { x: 12, y: 2 }, end: { x: 12, y: 5 } }, [r]);
    expect(swing).toBe('right');
  });

  it("defaults to 'left' for an internal door with rooms on both sides", () => {
    const a = room('a', 0, 0, 12, 8);
    const b = room('b', 12, 0, 8, 8);
    // С обеих сторон — комнаты, явных предпочтений нет, дефолт 'left'.
    const swing = pickDoorSwingSide({ start: { x: 12, y: 2 }, end: { x: 12, y: 5 } }, [a, b]);
    expect(swing).toBe('left');
  });

  it("defaults to 'left' when no rooms are nearby", () => {
    const swing = pickDoorSwingSide({ start: { x: 0, y: 0 }, end: { x: 4, y: 0 } }, []);
    expect(swing).toBe('left');
  });

  it('handles horizontal doors on north/south walls', () => {
    const r = room('r', 0, 0, 12, 8);
    // Дверь на южной стене y=0, x=2..6. Комната снизу (y>0), снаружи планировки сверху.
    const swing = pickDoorSwingSide({ start: { x: 2, y: 0 }, end: { x: 6, y: 0 } }, [r]);
    // Для start→end по +x с dx=4,dy=0: ux=0, uy=4/4=1. Mid=(4, 0).
    // leftProbe = floor(4 + 0*0.5, 0 + 1*0.5) = (4, 0) → внутри комнаты (y>=0 ∧ y<8). ✓
    // rightProbe = floor(4, 0 - 0.5) = (4, -1) → снаружи.
    expect(swing).toBe('left');
  });
});
