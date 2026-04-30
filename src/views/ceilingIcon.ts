import type { Room, FurnitureInstance } from '../domain/geometry/types';
import type { CatalogItem } from '../domain/furniture/placement';
import { getEffectiveSize } from '../domain/furniture/placement';

export const CEILING_ICON_SIZE_TILES = 0.6; // диаметр 0.15 м (F6.3.1) + отступ под подпись
// F6.3.6 (v1.8.0): увеличен с 0.4 → 1.0 тайла (= 0.25 м). Подпись под иконкой
// рендерится шириной LABEL_WIDTH_FACTOR × icon_size (по центру иконки), поэтому
// со стороны ближайшей стены она выходит за иконку на (factor − 1) × iconSize / 2.
// При factor = 4, iconSize = 0.6, inset = 1.0 подпись помещается в самой маленькой
// типичной комнате (4×4 тайла) с зазором ~0.1 тайла до ближайшей стены.
export const CEILING_ICON_INSET_TILES = 1.0;
// F6.3.6 (v1.8.1): увеличен с 3 → 4, чтобы «Гипсокартон» (11 кириллических символов
// при fontSize 10 ≈ 66 px) поместился в layout-бокс без переноса по словам. View2D
// сочетает это с `wrap="none"`, чтобы неожиданно длинная подпись обрезалась по
// горизонтали, а не уходила на вторую строку.
export const CEILING_ICON_LABEL_WIDTH_FACTOR = 4;

export type CornerName = 'TR' | 'BR' | 'BL' | 'TL';

export interface CeilingIconAnchor {
  /** Координаты левого нижнего угла иконки в tile-space (y-up). */
  tx: number;
  ty: number;
  corner: CornerName;
}

function rectsOverlap(
  ax: number,
  ay: number,
  aw: number,
  ah: number,
  bx: number,
  by: number,
  bw: number,
  bh: number,
): boolean {
  return ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;
}

function collidesWithFurniture(
  ax: number,
  ay: number,
  aw: number,
  ah: number,
  furniture: readonly FurnitureInstance[],
  catalogMap: Map<string, CatalogItem>,
): boolean {
  for (const f of furniture) {
    const item = catalogMap.get(f.catalogId);
    if (!item) continue;
    const { w, h } = getEffectiveSize(item, f.rotation);
    if (rectsOverlap(ax, ay, aw, ah, f.position.x, f.position.y, w, h)) {
      return true;
    }
  }
  return false;
}

/**
 * Выбирает угол внутри комнаты для иконки типа потолка. Сначала пробует
 * верхний правый, затем BR, BL, TL (по часовой стрелке, F6.3.3). Если все
 * углы перекрываются мебелью — возвращает TR.
 */
export function pickCeilingIconAnchor(
  room: Room,
  furniture: readonly FurnitureInstance[],
  catalogMap: Map<string, CatalogItem>,
  iconSize: number = CEILING_ICON_SIZE_TILES,
  inset: number = CEILING_ICON_INSET_TILES,
): CeilingIconAnchor {
  const { x, y, width, height } = room.rect;
  const candidates: CeilingIconAnchor[] = [
    {
      tx: x + width - iconSize - inset,
      ty: y + height - iconSize - inset,
      corner: 'TR',
    },
    {
      tx: x + width - iconSize - inset,
      ty: y + inset,
      corner: 'BR',
    },
    {
      tx: x + inset,
      ty: y + inset,
      corner: 'BL',
    },
    {
      tx: x + inset,
      ty: y + height - iconSize - inset,
      corner: 'TL',
    },
  ];

  for (const c of candidates) {
    if (!collidesWithFurniture(c.tx, c.ty, iconSize, iconSize, furniture, catalogMap)) {
      return c;
    }
  }
  return candidates[0];
}
