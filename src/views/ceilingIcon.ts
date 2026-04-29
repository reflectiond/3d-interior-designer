import type { Room, FurnitureInstance } from '../domain/geometry/types';
import type { CatalogItem } from '../domain/furniture/placement';
import { getEffectiveSize } from '../domain/furniture/placement';

export const CEILING_ICON_SIZE_TILES = 0.6; // 0.15 m diameter (F6.3.1) plus padding for label
// F6.3.6 (v1.8.0): bumped from 0.4 → 1.0 tile (= 0.25 m). The label text under
// the icon is rendered with width 3 × icon_size (1.8 tiles) centered on the
// icon center, so it overflows the room rectangle by (3 × iconSize − iconSize) / 2
// = iconSize tiles on the side closest to the wall. With inset = 1.0 the
// label and icon together stay inside the room with a small visual margin
// (≥ (1.0 − iconSize) = 0.4 tile from the nearest wall).
export const CEILING_ICON_INSET_TILES = 1.0;

export type CornerName = 'TR' | 'BR' | 'BL' | 'TL';

export interface CeilingIconAnchor {
  /** Tile-space coordinates of the icon's bottom-left corner (y-up) */
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
 * Picks a corner inside the room for the ceiling type icon. Tries top-right
 * first, then BR, BL, TL (clockwise per F6.3.3). Falls back to TR if every
 * corner overlaps with furniture.
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
