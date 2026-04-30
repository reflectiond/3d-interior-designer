import type { EstimateLineItem } from './estimator';

export type WorkUnit = 'м²' | 'м' | 'шт.';

export interface EstimateGroup {
  /** Общий тип работы (например, «Стяжка пола», «Ламинат», «Электропроводка»). */
  workType: string;
  category: 'rough' | 'fine' | 'furniture';
  unit: WorkUnit;
  totalQuantity: number;
  totalPriceMin: number;
  totalPriceMax: number;
  /** Исходные строки-детали внутри группы, в исходном порядке. */
  items: EstimateLineItem[];
}

const NAME_SEPARATOR = ' — ';

/**
 * Разбирает "{работа} — {комната}" на компоненты. Строки без разделителя — это
 * однокомнатные/агрегатные виды работ вроде «Штукатурка стен» или «Электропроводка»;
 * они становятся отдельной группой без деталей.
 */
export function splitWorkAndDetail(name: string): { workType: string; detail: string | null } {
  const idx = name.indexOf(NAME_SEPARATOR);
  if (idx === -1) return { workType: name, detail: null };
  return {
    workType: name.slice(0, idx),
    detail: name.slice(idx + NAME_SEPARATOR.length),
  };
}

/**
 * Парсит «12.5 м²» / «8 м» / «1 шт.» в числовое значение и единицу. Возвращает
 * null, если формат не распознан.
 */
export function parseQuantity(raw: string): { value: number; unit: WorkUnit } | null {
  const m = raw.trim().match(/^([\d.,]+)\s*(м²|м|шт\.)$/);
  if (!m) return null;
  const value = parseFloat(m[1].replace(',', '.'));
  if (!Number.isFinite(value)) return null;
  const unit = m[2] as WorkUnit;
  return { value, unit };
}

/**
 * Группирует плоские строки сметы по типу работы (префиксу до « — »).
 * Порядок групп соответствует порядку первого появления во входе — это
 * сохраняет технологическую последовательность, заданную `computeEstimate` (F4.3 / F9.1.5).
 */
export function groupEstimateByWorkType(items: readonly EstimateLineItem[]): EstimateGroup[] {
  const groups = new Map<string, EstimateGroup>();

  for (const item of items) {
    const { workType } = splitWorkAndDetail(item.name);
    const parsed = parseQuantity(item.quantity);
    const unit: WorkUnit = parsed ? parsed.unit : 'шт.';

    let group = groups.get(workType);
    if (!group) {
      group = {
        workType,
        category: item.category,
        unit,
        totalQuantity: 0,
        totalPriceMin: 0,
        totalPriceMax: 0,
        items: [],
      };
      groups.set(workType, group);
    }
    if (parsed && parsed.unit === group.unit) {
      group.totalQuantity += parsed.value;
    } else if (parsed) {
      // Расхождение единиц внутри группы — оставляем первую встретившуюся единицу и
      // пропускаем агрегацию количества для этой строки. Цены агрегируются, количество
      // недосчитывается, что видно в детализации по позициям.
    }
    group.totalPriceMin += item.priceMin;
    group.totalPriceMax += item.priceMax;
    group.items.push(item);
  }

  return Array.from(groups.values());
}

/** Форматирует агрегатное количество группы с одним знаком после запятой для м/м² и целочисленно для шт. */
export function formatGroupQuantity(group: EstimateGroup): string {
  const qty =
    group.unit === 'шт.' ? Math.round(group.totalQuantity) : group.totalQuantity.toFixed(1);
  return `${qty} ${group.unit}`;
}
