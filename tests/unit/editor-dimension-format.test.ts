import { describe, it, expect } from 'vitest';
import {
  formatArea,
  formatLength,
  formatOpeningLength,
  formatRectDimensions,
} from '../../src/editor/dimensionFormat';

describe('formatLength', () => {
  it('4 tiles → 1.0 м', () => {
    expect(formatLength(4)).toBe('1.0 м');
  });
  it('1 tile → 0.3 м (0.25 rounded)', () => {
    expect(formatLength(1)).toBe('0.3 м');
  });
  it('10 tiles → 2.5 м', () => {
    expect(formatLength(10)).toBe('2.5 м');
  });
});

describe('formatArea', () => {
  it('80 tile² → 5.0 м²', () => {
    expect(formatArea(80)).toBe('5.0 м²');
  });
  it('16 tile² (4×4) → 1.0 м²', () => {
    expect(formatArea(16)).toBe('1.0 м²');
  });
});

describe('formatRectDimensions', () => {
  it('10 × 8 tiles → "2.5 × 2.0 м = 5.0 м²"', () => {
    expect(formatRectDimensions(10, 8)).toBe('2.5 × 2.0 м = 5.0 м²');
  });
  it('4 × 4 tiles → "1.0 × 1.0 м = 1.0 м²"', () => {
    expect(formatRectDimensions(4, 4)).toBe('1.0 × 1.0 м = 1.0 м²');
  });
});

describe('formatOpeningLength', () => {
  it('6 tiles → "L = 1.5 м"', () => {
    expect(formatOpeningLength(6)).toBe('L = 1.5 м');
  });
  it('3 tiles → "L = 0.8 м"', () => {
    expect(formatOpeningLength(3)).toBe('L = 0.8 м');
  });
});
