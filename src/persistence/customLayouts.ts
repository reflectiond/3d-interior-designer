/**
 * F14 (v1.14.0) — пользовательские планировки.
 *
 * Управляет списком импортированных пользователем layout-JSON. Список
 * хранится в `localStorage` под ключом `3d-interior-designer-custom-layouts`
 * как массив `CustomLayoutEntry`. Все строковые поля санитизуются через
 * DOMPurify (F14.5, повторное использование SEC-1 паттерна).
 *
 * `layout.id` из JSON может коллизировать со встроенными (1, 2, 3) — на
 * импорте мы переприсваиваем такие коллизии на уникальный numeric id
 * (`Date.now() + index`). `entryId` (string с префиксом `custom_`)
 * используется как стабильный ключ для удаления и React-key.
 */

import DOMPurify from 'dompurify';
import { z } from 'zod/v4';
import { LayoutSchema } from '../domain/geometry/types';
import type { Layout } from '../domain/geometry/types';

const STORAGE_KEY = '3d-interior-designer-custom-layouts';
export const MAX_CUSTOM_LAYOUTS = 50;
const BUILTIN_IDS = new Set<number>([1, 2, 3]);

export interface CustomLayoutEntry {
  /** Стабильный ключ для удаления / React-key (не layout.id). */
  entryId: string;
  /** Сама планировка с уникальным `layout.id` (никогда не 1/2/3). */
  layout: Layout;
  /** ISO-строка времени импорта, отображается в UI. */
  importedAt: string;
}

const StoredEntrySchema = z.object({
  entryId: z.string(),
  layout: LayoutSchema,
  importedAt: z.string(),
});

function sanitizeStrings<T>(obj: T): T {
  if (typeof obj === 'string') return DOMPurify.sanitize(obj) as T;
  if (Array.isArray(obj)) return obj.map(sanitizeStrings) as T;
  if (obj && typeof obj === 'object') {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj)) {
      result[key] = sanitizeStrings(value);
    }
    return result as T;
  }
  return obj;
}

/**
 * Прочитать сохранённый список. Невалидные/мусорные записи отфильтровываются
 * молча — устойчивость к localStorage tampering (SEC-4).
 */
export function loadCustomLayouts(): CustomLayoutEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const valid: CustomLayoutEntry[] = [];
    for (const item of parsed) {
      const r = StoredEntrySchema.safeParse(item);
      if (r.success) valid.push(r.data);
    }
    return valid;
  } catch {
    return [];
  }
}

function persist(entries: CustomLayoutEntry[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
}

export type ImportResult =
  | { ok: true; entry: CustomLayoutEntry }
  | { ok: false; reason: 'invalid' | 'limit' };

/**
 * Импортировать JSON-планировку: валидация → санитизация → разрешение
 * коллизий id со встроенными → запись в localStorage. Возвращает либо
 * новый `entry`, либо причину отказа для отображения пользователю.
 */
export function importCustomLayout(rawJson: unknown): ImportResult {
  const parsed = LayoutSchema.safeParse(rawJson);
  if (!parsed.success) return { ok: false, reason: 'invalid' };

  const entries = loadCustomLayouts();
  if (entries.length >= MAX_CUSTOM_LAYOUTS) return { ok: false, reason: 'limit' };

  const sanitized = sanitizeStrings(parsed.data);

  // Коллизия с встроенными id → переприсваиваем уникальный numeric id.
  // `Date.now()` + смещение по числу уже сохранённых даёт глобальную уникальность.
  let layoutId = sanitized.id;
  if (BUILTIN_IDS.has(layoutId) || entries.some((e) => e.layout.id === layoutId)) {
    layoutId = Date.now() + entries.length;
  }
  const layout: Layout = { ...sanitized, id: layoutId };

  const entry: CustomLayoutEntry = {
    entryId: `custom_${layoutId}_${Math.random().toString(36).slice(2, 8)}`,
    layout,
    importedAt: new Date().toISOString(),
  };
  persist([...entries, entry]);
  return { ok: true, entry };
}

export function deleteCustomLayout(entryId: string): void {
  const entries = loadCustomLayouts().filter((e) => e.entryId !== entryId);
  persist(entries);
}
