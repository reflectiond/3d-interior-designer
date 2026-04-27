import { PALETTE } from '../theme/palette';
import type { FloorCovering } from '../domain/geometry/types';

const PIXELS_PER_METER = 240;

function pxFromM(m: number): number {
  return Math.round(m * PIXELS_PER_METER);
}

interface PatternSpec {
  unitWidthM: number;
  unitHeightM: number;
  fillColor: string;
  // Optional decorative pass on top of the base fill
  draw?: (ctx: CanvasRenderingContext2D, w: number, h: number) => void;
}

const SPECS: Record<FloorCovering, PatternSpec> = {
  // F6.2.2 — solid fill, no seams
  linoleum: {
    unitWidthM: 0.25,
    unitHeightM: 0.25,
    fillColor: PALETTE.floor.linoleum,
  },
  // F6.2.3 — long boards 1.0 × 0.25 m, seam at right edge and bottom edge of unit
  laminate: {
    unitWidthM: 1.0,
    unitHeightM: 0.25,
    fillColor: PALETTE.floor.laminate,
    draw: (ctx, w, h) => {
      ctx.strokeStyle = PALETTE.floor_pattern_seam.laminate;
      ctx.globalAlpha = 0.3;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(w - 0.5, 0);
      ctx.lineTo(w - 0.5, h);
      ctx.moveTo(0, h - 0.5);
      ctx.lineTo(w, h - 0.5);
      ctx.stroke();
    },
  },
  // F6.2.4 — square grid 0.5 × 0.5 m
  tile: {
    unitWidthM: 0.5,
    unitHeightM: 0.5,
    fillColor: PALETTE.floor.tile,
    draw: (ctx, w, h) => {
      ctx.strokeStyle = PALETTE.floor_pattern_seam.tile;
      ctx.globalAlpha = 0.5;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(w - 0.5, 0);
      ctx.lineTo(w - 0.5, h);
      ctx.moveTo(0, h - 0.5);
      ctx.lineTo(w, h - 0.5);
      ctx.stroke();
    },
  },
  // F6.2.5 — chevron, 0.6 × 0.6 m unit with V-shape pointing up
  quartz_vinyl: {
    unitWidthM: 0.6,
    unitHeightM: 0.6,
    fillColor: PALETTE.floor.quartz_vinyl,
    draw: (ctx, w, h) => {
      ctx.strokeStyle = PALETTE.floor_pattern_seam.quartz_vinyl;
      ctx.globalAlpha = 0.4;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, h);
      ctx.lineTo(w / 2, 0);
      ctx.lineTo(w, h);
      ctx.stroke();
    },
  },
};

export function getPatternUnitSize(type: FloorCovering): { widthM: number; heightM: number } {
  const s = SPECS[type];
  return { widthM: s.unitWidthM, heightM: s.unitHeightM };
}

export function renderFloorPattern(type: FloorCovering): HTMLCanvasElement {
  const spec = SPECS[type];
  const canvas = document.createElement('canvas');
  canvas.width = pxFromM(spec.unitWidthM);
  canvas.height = pxFromM(spec.unitHeightM);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Cannot create 2D context for floor pattern');
  ctx.fillStyle = spec.fillColor;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  spec.draw?.(ctx, canvas.width, canvas.height);
  return canvas;
}

const cache: Partial<Record<FloorCovering, HTMLCanvasElement>> = {};

export function getFloorPatternCanvas(type: FloorCovering): HTMLCanvasElement {
  let canvas = cache[type];
  if (!canvas) {
    canvas = renderFloorPattern(type);
    cache[type] = canvas;
  }
  return canvas;
}

export function _resetFloorPatternCacheForTests(): void {
  for (const k of Object.keys(cache) as FloorCovering[]) {
    delete cache[k];
  }
}
