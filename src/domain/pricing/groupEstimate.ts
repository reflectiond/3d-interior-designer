import type { EstimateLineItem } from './estimator';

export type WorkUnit = 'м²' | 'м' | 'шт.';

export interface EstimateGroup {
  /** Common work type (e.g. "Стяжка пола", "Ламинат", "Электропроводка"). */
  workType: string;
  category: 'rough' | 'fine' | 'furniture';
  unit: WorkUnit;
  totalQuantity: number;
  totalPriceMin: number;
  totalPriceMax: number;
  /** Original detail rows under this group, in their original order. */
  items: EstimateLineItem[];
}

const NAME_SEPARATOR = ' — ';

/**
 * Splits "{work} — {room}" into its components. Items without a separator are
 * single-room/aggregate work types like "Штукатурка стен" or "Электропроводка"
 * — those become their own group with no detail.
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
 * Parses "12.5 м²" / "8 м" / "1 шт." into a numeric value and the unit. Returns
 * null when the format is unrecognised.
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
 * Groups flat estimate items by their work type (the prefix before " — ").
 * Group ordering follows the first occurrence in the input — this preserves
 * the technological order assembled by `computeEstimate` (F4.3 / F9.1.5).
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
      // Unit mismatch within a group — keep the first-seen unit and skip aggregation
      // for this row. Prices still aggregate, quantity just under-counts which is
      // surfaced in the per-item detail.
    }
    group.totalPriceMin += item.priceMin;
    group.totalPriceMax += item.priceMax;
    group.items.push(item);
  }

  return Array.from(groups.values());
}

/** Format a group's aggregate quantity with one decimal for м/м² and integer for шт. */
export function formatGroupQuantity(group: EstimateGroup): string {
  const qty =
    group.unit === 'шт.' ? Math.round(group.totalQuantity) : group.totalQuantity.toFixed(1);
  return `${qty} ${group.unit}`;
}
