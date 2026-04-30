import { describe, it, expect, beforeEach } from 'vitest';
import {
  loadCustomLayouts,
  importCustomLayout,
  deleteCustomLayout,
  MAX_CUSTOM_LAYOUTS,
} from '../../src/persistence/customLayouts';
import layout1Data from '../../src/data/layouts/layout1.json';

const STORAGE_KEY = '3d-interior-designer-custom-layouts';

beforeEach(() => {
  localStorage.removeItem(STORAGE_KEY);
});

describe('customLayouts — F14', () => {
  it('loadCustomLayouts() возвращает [] на пустом storage', () => {
    expect(loadCustomLayouts()).toEqual([]);
  });

  it('importCustomLayout() сохраняет валидный JSON и возвращает entry', () => {
    const result = importCustomLayout(layout1Data);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.entry.entryId).toMatch(/^custom_\d+_/);
    expect(result.entry.layout.name).toBe('Планировка 1');
    expect(result.entry.importedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(loadCustomLayouts()).toHaveLength(1);
  });

  it('F14.3: коллизия id со встроенным (1) переприсваивает уникальный numeric id', () => {
    const result = importCustomLayout(layout1Data);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect([1, 2, 3]).not.toContain(result.entry.layout.id);
  });

  it('importCustomLayout() возвращает {ok:false, reason:"invalid"} на невалидной схеме', () => {
    const bad = { ...layout1Data, gridWidth: -1 };
    const result = importCustomLayout(bad);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe('invalid');
    expect(loadCustomLayouts()).toHaveLength(0);
  });

  it('F14.5: строковые поля санитизируются через DOMPurify', () => {
    const dirty = { ...layout1Data, name: 'Test<script>alert(1)</script>' };
    const result = importCustomLayout(dirty);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.entry.layout.name).not.toContain('<script>');
  });

  it('F14.6: лимит 50 записей — превышение возвращает {ok:false, reason:"limit"}', () => {
    // Заполняем storage 50 валидными записями (без 50 вызовов importCustomLayout
    // это было бы быстрее, но менее надёжно: текущий путь гарантирует, что lookup
    // проходит через актуальный runtime-формат).
    for (let i = 0; i < MAX_CUSTOM_LAYOUTS; i++) {
      const r = importCustomLayout(layout1Data);
      expect(r.ok).toBe(true);
    }
    expect(loadCustomLayouts()).toHaveLength(MAX_CUSTOM_LAYOUTS);

    const result = importCustomLayout(layout1Data);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe('limit');
  });

  it('deleteCustomLayout() удаляет по entryId', () => {
    const a = importCustomLayout(layout1Data);
    const b = importCustomLayout(layout1Data);
    expect(a.ok && b.ok).toBe(true);
    if (!a.ok || !b.ok) return;
    expect(loadCustomLayouts()).toHaveLength(2);

    deleteCustomLayout(a.entry.entryId);
    const after = loadCustomLayouts();
    expect(after).toHaveLength(1);
    expect(after[0].entryId).toBe(b.entry.entryId);
  });

  it('SEC-4: невалидные записи в localStorage отфильтровываются молча', () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify([
        { entryId: 'custom_1_xx', layout: { id: 1, name: 'broken' }, importedAt: 'bad' },
        'not-an-object',
        null,
      ]),
    );
    expect(loadCustomLayouts()).toEqual([]);
  });
});
