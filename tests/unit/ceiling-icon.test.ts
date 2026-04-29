import { describe, it, expect } from 'vitest';
import {
  pickCeilingIconAnchor,
  CEILING_ICON_SIZE_TILES,
  CEILING_ICON_INSET_TILES,
  CEILING_ICON_LABEL_WIDTH_FACTOR,
} from '../../src/views/ceilingIcon';
import type { Room, FurnitureInstance } from '../../src/domain/geometry/types';
import type { CatalogItem } from '../../src/domain/furniture/placement';

const SOFA: CatalogItem = {
  id: 'sofa',
  name: 'Диван',
  size_tiles: { w: 8, h: 4 },
  allowed_rooms: ['living', 'bedroom'],
  color_key: 'sofa',
  height_m: 0.85,
  rotatable: true,
  mirrorable: true,
  price_min: 30000,
  price_max: 120000,
};

const catalogMap = new Map<string, CatalogItem>([['sofa', SOFA]]);

function makeRoom(x: number, y: number, w: number, h: number): Room {
  return {
    id: `room-${x}-${y}`,
    type: 'living',
    name: 'Гостиная',
    rect: { x, y, width: w, height: h },
    area: w * h * 0.0625,
  };
}

function makeFurniture(
  px: number,
  py: number,
  rotation: 0 | 90 | 180 | 270 = 0,
): FurnitureInstance {
  return {
    id: `f-${px}-${py}`,
    catalogId: 'sofa',
    position: { x: px, y: py },
    rotation,
    mirrored: false,
  };
}

describe('pickCeilingIconAnchor', () => {
  it('places icon at top-right by default when no furniture', () => {
    const room = makeRoom(0, 0, 20, 16);
    const a = pickCeilingIconAnchor(room, [], catalogMap);
    expect(a.corner).toBe('TR');
    // top-right tile-up coords
    const expectedTx = 20 - CEILING_ICON_SIZE_TILES - CEILING_ICON_INSET_TILES;
    const expectedTy = 16 - CEILING_ICON_SIZE_TILES - CEILING_ICON_INSET_TILES;
    expect(a.tx).toBeCloseTo(expectedTx);
    expect(a.ty).toBeCloseTo(expectedTy);
  });

  it('falls back to BR when furniture blocks TR', () => {
    const room = makeRoom(0, 0, 20, 16);
    // Sofa 8×4 at top-right corner
    const sofa = makeFurniture(12, 12);
    const a = pickCeilingIconAnchor(room, [sofa], catalogMap);
    expect(a.corner).toBe('BR');
  });

  it('falls back to BL when TR and BR blocked', () => {
    const room = makeRoom(0, 0, 20, 16);
    // Two sofas occupy top-right and bottom-right
    const a = pickCeilingIconAnchor(
      room,
      [makeFurniture(12, 12), makeFurniture(12, 0)],
      catalogMap,
    );
    expect(a.corner).toBe('BL');
  });

  it('falls back to TL when only TL is free', () => {
    const room = makeRoom(0, 0, 20, 16);
    const a = pickCeilingIconAnchor(
      room,
      [makeFurniture(12, 12), makeFurniture(12, 0), makeFurniture(0, 0)],
      catalogMap,
    );
    expect(a.corner).toBe('TL');
  });

  it('returns TR fallback when every corner is blocked', () => {
    const room = makeRoom(0, 0, 20, 16);
    // Furniture in every corner
    const a = pickCeilingIconAnchor(
      room,
      [
        makeFurniture(12, 12), // TR
        makeFurniture(12, 0), // BR
        makeFurniture(0, 0), // BL
        makeFurniture(0, 12), // TL
      ],
      catalogMap,
    );
    expect(a.corner).toBe('TR');
  });

  it('ignores furniture in other rooms (not overlapping the candidate corner)', () => {
    const room = makeRoom(20, 0, 16, 16);
    // Sofa entirely outside this room
    const sofa = makeFurniture(0, 0);
    const a = pickCeilingIconAnchor(room, [sofa], catalogMap);
    expect(a.corner).toBe('TR');
  });

  it('respects furniture rotation when checking collision', () => {
    const room = makeRoom(0, 0, 20, 16);
    // Sofa 8×4 rotated 90° becomes 4×8 (taller). Place at (16, 8) so it occupies
    // x[16..20], y[8..16] — overlaps the TR icon. BR is unaffected since y range
    // is far below.
    const sofa = makeFurniture(16, 8, 90);
    const a = pickCeilingIconAnchor(room, [sofa], catalogMap);
    expect(a.corner).toBe('BR');
  });

  it('F6.3.6 (v1.8.1): icon + LABEL_WIDTH_FACTOR×size label fits inside a 4×4-tile room', () => {
    // Smallest typical room: 4×4 tiles (1×1 m). Label is centered on icon.
    // For factor=4, iconSize=0.6, inset=1.0:
    //   icon center at inset + iconSize/2 = 1.3 from each wall
    //   label half-width = (4 × 0.6) / 2 = 1.2
    //   slack to closest wall = 1.3 − 1.2 = 0.1 tile (~3 px)
    const room = makeRoom(0, 0, 4, 4);
    const a = pickCeilingIconAnchor(room, [], catalogMap);
    const labelHalfWidth = (CEILING_ICON_LABEL_WIDTH_FACTOR * CEILING_ICON_SIZE_TILES) / 2;
    const iconCenterTx = a.tx + CEILING_ICON_SIZE_TILES / 2;
    expect(iconCenterTx - labelHalfWidth).toBeGreaterThanOrEqual(room.rect.x);
    expect(iconCenterTx + labelHalfWidth).toBeLessThanOrEqual(room.rect.x + room.rect.width);
    expect(a.ty).toBeGreaterThanOrEqual(room.rect.y);
    expect(a.ty + CEILING_ICON_SIZE_TILES).toBeLessThanOrEqual(room.rect.y + room.rect.height);
  });
});
