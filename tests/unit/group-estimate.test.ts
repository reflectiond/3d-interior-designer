import { describe, it, expect } from 'vitest';
import {
  groupEstimateByWorkType,
  splitWorkAndDetail,
  parseQuantity,
  formatGroupQuantity,
} from '../../src/domain/pricing/groupEstimate';
import type { EstimateLineItem } from '../../src/domain/pricing/estimator';

function lineItem(
  category: 'rough' | 'fine' | 'furniture',
  name: string,
  quantity: string,
  priceMin: number,
  priceMax: number,
): EstimateLineItem {
  return { category, name, quantity, priceMin, priceMax };
}

describe('splitWorkAndDetail', () => {
  it('splits "Стяжка пола — Гостиная" on the em-dash separator', () => {
    expect(splitWorkAndDetail('Стяжка пола — Гостиная')).toEqual({
      workType: 'Стяжка пола',
      detail: 'Гостиная',
    });
  });

  it('returns whole name as workType when no separator present', () => {
    expect(splitWorkAndDetail('Электропроводка')).toEqual({
      workType: 'Электропроводка',
      detail: null,
    });
  });
});

describe('parseQuantity', () => {
  it('parses "12.5 м²"', () => {
    expect(parseQuantity('12.5 м²')).toEqual({ value: 12.5, unit: 'м²' });
  });

  it('parses "8 м"', () => {
    expect(parseQuantity('8 м')).toEqual({ value: 8, unit: 'м' });
  });

  it('parses "1 шт."', () => {
    expect(parseQuantity('1 шт.')).toEqual({ value: 1, unit: 'шт.' });
  });

  it('returns null for unrecognised formats', () => {
    expect(parseQuantity('garbage')).toBeNull();
    expect(parseQuantity('5 кг')).toBeNull();
  });
});

describe('groupEstimateByWorkType', () => {
  it('aggregates "Стяжка пола" across rooms into a single group', () => {
    const groups = groupEstimateByWorkType([
      lineItem('rough', 'Стяжка пола — Гостиная', '20.0 м²', 30000, 50000),
      lineItem('rough', 'Стяжка пола — Спальня', '12.5 м²', 18750, 31250),
      lineItem('rough', 'Стяжка пола — Кухня', '8.0 м²', 12000, 20000),
    ]);

    expect(groups).toHaveLength(1);
    const g = groups[0];
    expect(g.workType).toBe('Стяжка пола');
    expect(g.unit).toBe('м²');
    expect(g.totalQuantity).toBeCloseTo(40.5);
    expect(g.totalPriceMin).toBe(60750);
    expect(g.totalPriceMax).toBe(101250);
    expect(g.items).toHaveLength(3);
  });

  it('keeps single-row aggregate work types (no separator) as their own group', () => {
    const groups = groupEstimateByWorkType([
      lineItem('rough', 'Электропроводка', '8.0 м', 6400, 12000),
      lineItem('rough', 'Штукатурка стен', '120.0 м²', 72000, 144000),
    ]);

    expect(groups.map((g) => g.workType)).toEqual(['Электропроводка', 'Штукатурка стен']);
    expect(groups[0].totalQuantity).toBeCloseTo(8.0);
    expect(groups[1].totalQuantity).toBeCloseTo(120);
  });

  it('preserves the technological order from the input (F9.1.5)', () => {
    const groups = groupEstimateByWorkType([
      lineItem('rough', 'Стяжка пола — A', '10 м²', 1, 2),
      lineItem('rough', 'Натяжной потолок — A', '10 м²', 1, 2),
      lineItem('rough', 'Стяжка пола — B', '5 м²', 1, 2),
      lineItem('fine', 'Ламинат — A', '10 м²', 1, 2),
    ]);

    expect(groups.map((g) => g.workType)).toEqual(['Стяжка пола', 'Натяжной потолок', 'Ламинат']);
  });

  it('groups identical furniture items by catalog name', () => {
    const groups = groupEstimateByWorkType([
      lineItem('furniture', 'Стул', '1 шт.', 5000, 12000),
      lineItem('furniture', 'Стул', '1 шт.', 5000, 12000),
      lineItem('furniture', 'Стул', '1 шт.', 5000, 12000),
    ]);

    expect(groups).toHaveLength(1);
    const g = groups[0];
    expect(g.workType).toBe('Стул');
    expect(g.unit).toBe('шт.');
    expect(g.totalQuantity).toBe(3);
    expect(g.totalPriceMin).toBe(15000);
    expect(g.totalPriceMax).toBe(36000);
  });

  it('preserves the F4.4 grand total — sum of group totals matches sum of items', () => {
    const items = [
      lineItem('rough', 'Стяжка пола — A', '10 м²', 15000, 25000),
      lineItem('rough', 'Электропроводка', '5 м', 4000, 7500),
      lineItem('fine', 'Плитка — A', '4 м²', 6000, 18000),
      lineItem('furniture', 'Диван', '1 шт.', 30000, 120000),
    ];
    const itemsMin = items.reduce((s, i) => s + i.priceMin, 0);
    const itemsMax = items.reduce((s, i) => s + i.priceMax, 0);

    const groups = groupEstimateByWorkType(items);
    const groupsMin = groups.reduce((s, g) => s + g.totalPriceMin, 0);
    const groupsMax = groups.reduce((s, g) => s + g.totalPriceMax, 0);

    expect(groupsMin).toBe(itemsMin);
    expect(groupsMax).toBe(itemsMax);
  });

  it('ignores quantity unit drift inside a group (price still aggregates)', () => {
    const groups = groupEstimateByWorkType([
      lineItem('rough', 'Какая-то работа — A', '10 м²', 1000, 2000),
      // Same workType but ridiculously different unit (shouldn't normally happen)
      lineItem('rough', 'Какая-то работа — B', '3 м', 500, 800),
    ]);
    expect(groups).toHaveLength(1);
    expect(groups[0].unit).toBe('м²');
    expect(groups[0].totalQuantity).toBeCloseTo(10);
    expect(groups[0].totalPriceMin).toBe(1500);
    expect(groups[0].totalPriceMax).toBe(2800);
  });
});

describe('formatGroupQuantity', () => {
  it('formats м² with one decimal', () => {
    expect(
      formatGroupQuantity({
        workType: 'X',
        category: 'rough',
        unit: 'м²',
        totalQuantity: 12.345,
        totalPriceMin: 0,
        totalPriceMax: 0,
        items: [],
      }),
    ).toBe('12.3 м²');
  });

  it('formats шт. as integer', () => {
    expect(
      formatGroupQuantity({
        workType: 'X',
        category: 'furniture',
        unit: 'шт.',
        totalQuantity: 3,
        totalPriceMin: 0,
        totalPriceMax: 0,
        items: [],
      }),
    ).toBe('3 шт.');
  });
});
