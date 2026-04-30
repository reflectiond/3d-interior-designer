import { describe, it, expect } from 'vitest';
import { getPatternUnitSize } from '../../src/views/floorPatterns';

// Примечание: renderFloorPattern() и getFloorPatternCanvas() задействуют Canvas 2D API,
// который недоступен в jsdom. Они покрыты e2e-тестами в
// tests/e2e/floor-patterns.spec.ts, где используется настоящий браузерный canvas.

describe('getPatternUnitSize', () => {
  it('linoleum unit is 0.25 × 0.25 m (1 tile; F6.2.2 + F6.2.9 v1.8.0 — speckle)', () => {
    expect(getPatternUnitSize('linoleum')).toEqual({ widthM: 0.25, heightM: 0.25 });
  });

  it('laminate unit is 1.0 × 0.25 m — 4×1 tile boards (F6.2.3)', () => {
    expect(getPatternUnitSize('laminate')).toEqual({ widthM: 1.0, heightM: 0.25 });
  });

  it('tile unit is 0.5 × 0.5 m — 2×2 tile grid (F6.2.4)', () => {
    expect(getPatternUnitSize('tile')).toEqual({ widthM: 0.5, heightM: 0.5 });
  });

  it('quartz_vinyl chevron unit is 0.6 × 0.6 m (F6.2.5)', () => {
    expect(getPatternUnitSize('quartz_vinyl')).toEqual({ widthM: 0.6, heightM: 0.6 });
  });

  it('all unit dimensions align to 0.05 m so they tile cleanly under 0.25 m tile grid', () => {
    const types = ['linoleum', 'laminate', 'tile', 'quartz_vinyl'] as const;
    for (const t of types) {
      const { widthM, heightM } = getPatternUnitSize(t);
      // Умножение на 20 должно дать целое число (т.е. юнит кратен 0.05 м)
      expect(Math.round(widthM * 20)).toBe(widthM * 20);
      expect(Math.round(heightM * 20)).toBe(heightM * 20);
    }
  });
});
