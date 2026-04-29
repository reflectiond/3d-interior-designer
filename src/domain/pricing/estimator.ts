import type {
  Room,
  FloorType,
  CeilingType,
  FloorCovering,
  WallCovering,
  ElectricalRoute,
  Window,
  Door,
} from '../geometry/types';
import type { FurnitureInstance } from '../geometry/types';
import { TILE_SIZE } from '../geometry/tiles';
import { openingAreaM2 } from '../geometry/openings';
import type { CatalogItem } from '../furniture/placement';
import pricingData from '../../data/pricing.default.json';

const ROOM_HEIGHT = 2.7;

export interface EstimateLineItem {
  category: 'rough' | 'fine' | 'furniture';
  name: string;
  quantity: string;
  priceMin: number;
  priceMax: number;
}

export interface Estimate {
  items: EstimateLineItem[];
  totalMin: number;
  totalMax: number;
}

const pricing = pricingData;

/** Calculate total wire length in meters from routes */
function wireLength(routes: ElectricalRoute[]): number {
  let total = 0;
  for (const route of routes) {
    if (route.path.length > 1) {
      total += (route.path.length - 1) * TILE_SIZE;
    }
  }
  return total;
}

/** Calculate wall area for a room (perimeter × height) */
function wallArea(room: Room): number {
  const w = room.rect.width * TILE_SIZE;
  const h = room.rect.height * TILE_SIZE;
  const perimeter = 2 * (w + h);
  return perimeter * ROOM_HEIGHT;
}

export function computeEstimate(
  rooms: Room[],
  flooring: Record<string, FloorType>,
  ceiling: Record<string, CeilingType>,
  floorCovering: Record<string, FloorCovering>,
  wallCovering: Record<string, WallCovering>,
  electricalRoutes: ElectricalRoute[],
  furniture: FurnitureInstance[],
  catalog: Map<string, CatalogItem>,
  windows: Window[] = [],
  doors: Door[] = [],
): Estimate {
  const items: EstimateLineItem[] = [];

  // --- Rough finish ---

  // 1. Screed
  for (const room of rooms) {
    if (room.type === 'corridor' || room.type === 'wardrobe') continue;
    const ft = flooring[room.id] ?? 'screed';
    const area = room.area;
    if (ft === 'screed_heated') {
      items.push({
        category: 'rough',
        name: `Стяжка с тёплым полом — ${room.name}`,
        quantity: `${area.toFixed(1)} м²`,
        priceMin: Math.round(area * pricing.rough_finish.screed_heated_per_m2.min),
        priceMax: Math.round(area * pricing.rough_finish.screed_heated_per_m2.max),
      });
    } else {
      items.push({
        category: 'rough',
        name: `Стяжка пола — ${room.name}`,
        quantity: `${area.toFixed(1)} м²`,
        priceMin: Math.round(area * pricing.rough_finish.screed_per_m2.min),
        priceMax: Math.round(area * pricing.rough_finish.screed_per_m2.max),
      });
    }
  }

  // 2. Electrical
  const wireLenM = wireLength(electricalRoutes);
  if (wireLenM > 0) {
    items.push({
      category: 'rough',
      name: 'Электропроводка',
      quantity: `${wireLenM.toFixed(1)} м`,
      priceMin: Math.round(wireLenM * pricing.rough_finish.electrical_per_m.min),
      priceMax: Math.round(wireLenM * pricing.rough_finish.electrical_per_m.max),
    });
  }

  // 3. Plaster (all rooms)
  let totalWallArea = 0;
  for (const room of rooms) {
    totalWallArea += wallArea(room);
  }
  // F7.2.4 + F7.3.5 — windows and doors reduce the plaster surface
  let openingAreaTotal = 0;
  for (const win of windows) openingAreaTotal += openingAreaM2(win, TILE_SIZE);
  for (const door of doors) openingAreaTotal += openingAreaM2(door, TILE_SIZE);
  totalWallArea = Math.max(0, totalWallArea - openingAreaTotal);
  items.push({
    category: 'rough',
    name: 'Штукатурка стен',
    quantity: `${totalWallArea.toFixed(1)} м²`,
    priceMin: Math.round(totalWallArea * pricing.rough_finish.plaster_per_m2.min),
    priceMax: Math.round(totalWallArea * pricing.rough_finish.plaster_per_m2.max),
  });

  // 4. Ceiling
  for (const room of rooms) {
    if (room.type === 'corridor' || room.type === 'wardrobe') continue;
    const ct = ceiling[room.id] ?? 'stretch';
    const area = room.area;
    const priceKey = ct === 'drywall' ? 'ceiling_drywall_per_m2' : 'ceiling_stretch_per_m2';
    const label = ct === 'drywall' ? 'Гипсокартон' : 'Натяжной потолок';
    items.push({
      category: 'rough',
      name: `${label} — ${room.name}`,
      quantity: `${area.toFixed(1)} м²`,
      priceMin: Math.round(area * pricing.rough_finish[priceKey].min),
      priceMax: Math.round(area * pricing.rough_finish[priceKey].max),
    });
  }

  // --- Fine finish ---

  // 5. Floor covering
  for (const room of rooms) {
    if (room.type === 'corridor' || room.type === 'wardrobe') continue;
    const fc = floorCovering[room.id];
    // F3.1.3 (v1.9.0): `none` and missing entries both skip the line item.
    if (!fc || fc === 'none') continue;
    const area = room.area;
    const priceKey = `floor_${fc}_per_m2` as keyof typeof pricing.fine_finish;
    const p = pricing.fine_finish[priceKey];
    if (!p) continue;
    const labels: Record<string, string> = {
      linoleum: 'Линолеум',
      laminate: 'Ламинат',
      tile: 'Плитка',
      quartz_vinyl: 'Кварцвинил',
    };
    items.push({
      category: 'fine',
      name: `${labels[fc] ?? fc} — ${room.name}`,
      quantity: `${area.toFixed(1)} м²`,
      priceMin: Math.round(area * p.min),
      priceMax: Math.round(area * p.max),
    });
  }

  // 6. Wall covering
  for (const room of rooms) {
    if (room.type === 'corridor' || room.type === 'wardrobe') continue;
    const wc = wallCovering[room.id];
    // F3.2.5 (v1.9.0): `none` and missing entries both skip the line item.
    if (!wc || wc === 'none') continue;
    const wa = wallArea(room);
    const priceKey = `wall_${wc}_per_m2` as keyof typeof pricing.fine_finish;
    const p = pricing.fine_finish[priceKey];
    if (!p) continue;
    const labels: Record<string, string> = { wallpaper: 'Обои', paint: 'Покраска' };
    items.push({
      category: 'fine',
      name: `${labels[wc] ?? wc} — ${room.name}`,
      quantity: `${wa.toFixed(1)} м²`,
      priceMin: Math.round(wa * p.min),
      priceMax: Math.round(wa * p.max),
    });
  }

  // 7. Furniture
  for (const f of furniture) {
    const item = catalog.get(f.catalogId);
    if (!item) continue;
    const fp = pricing.furniture[f.catalogId as keyof typeof pricing.furniture];
    if (!fp) continue;
    items.push({
      category: 'furniture',
      name: item.name,
      quantity: '1 шт.',
      priceMin: fp.min,
      priceMax: fp.max,
    });
  }

  const totalMin = items.reduce((s, i) => s + i.priceMin, 0);
  const totalMax = items.reduce((s, i) => s + i.priceMax, 0);

  return { items, totalMin, totalMax };
}
