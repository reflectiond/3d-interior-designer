import { PALETTE } from '../theme/palette';
import type { FloorMaterial } from '../domain/geometry/types';

const PIXELS_PER_METER = 240;

function pxFromM(m: number): number {
  return Math.round(m * PIXELS_PER_METER);
}

interface PatternSpec {
  unitWidthM: number;
  unitHeightM: number;
  /** Базовый цвет используется только когда {@link renderFloorPattern} вызван с
   *  `withBackground=true` (3D-путь, см. {@link getFloorPatternCanvas}). Для 2D
   *  канва остаётся прозрачной, а швы накладываются поверх заливки комнаты (F6.2.8). */
  fillColor: string;
  /** Декоративный проход поверх (опциональной) базовой заливки. Стиль обводки и
   *  прозрачность задаёт вызывающий код; значения opacity — по F6.2.10 (0.6–0.7). */
  draw?: (ctx: CanvasRenderingContext2D, w: number, h: number) => void;
}

const SPECS: Record<FloorMaterial, PatternSpec> = {
  // F6.2.2 (v1.8.0): вместо сплошной заливки линолеум получает мягкие две точки —
  // так он отличим от «без покрытия» в 2D, но всё ещё читается как гладкая поверхность.
  linoleum: {
    unitWidthM: 0.25,
    unitHeightM: 0.25,
    fillColor: PALETTE.floor.linoleum,
    draw: (ctx, w, h) => {
      ctx.fillStyle = PALETTE.floor_pattern_seam.linoleum;
      ctx.globalAlpha = 0.6;
      const dot = Math.max(2, Math.round(w * 0.04));
      // Две детерминированные точки внутри юнита, расположены так, чтобы плитка стыковалась чисто
      ctx.fillRect(Math.round(w * 0.25) - dot / 2, Math.round(h * 0.4) - dot / 2, dot, dot);
      ctx.fillRect(Math.round(w * 0.7) - dot / 2, Math.round(h * 0.75) - dot / 2, dot, dot);
    },
  },
  // F6.2.3 — длинные доски 1.0 × 0.25 м, шов по правому и нижнему краю юнита
  laminate: {
    unitWidthM: 1.0,
    unitHeightM: 0.25,
    fillColor: PALETTE.floor.laminate,
    draw: (ctx, w, h) => {
      ctx.strokeStyle = PALETTE.floor_pattern_seam.laminate;
      ctx.globalAlpha = 0.65;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(w - 0.5, 0);
      ctx.lineTo(w - 0.5, h);
      ctx.moveTo(0, h - 0.5);
      ctx.lineTo(w, h - 0.5);
      ctx.stroke();
    },
  },
  // F6.2.4 — квадратная сетка 0.5 × 0.5 м
  tile: {
    unitWidthM: 0.5,
    unitHeightM: 0.5,
    fillColor: PALETTE.floor.tile,
    draw: (ctx, w, h) => {
      ctx.strokeStyle = PALETTE.floor_pattern_seam.tile;
      ctx.globalAlpha = 0.7;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(w - 0.5, 0);
      ctx.lineTo(w - 0.5, h);
      ctx.moveTo(0, h - 0.5);
      ctx.lineTo(w, h - 0.5);
      ctx.stroke();
    },
  },
  // F6.2.5 — ёлочка, юнит 0.6 × 0.6 м с V-образной формой, направленной вверх
  quartz_vinyl: {
    unitWidthM: 0.6,
    unitHeightM: 0.6,
    fillColor: PALETTE.floor.quartz_vinyl,
    draw: (ctx, w, h) => {
      ctx.strokeStyle = PALETTE.floor_pattern_seam.quartz_vinyl;
      ctx.globalAlpha = 0.65;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, h);
      ctx.lineTo(w / 2, 0);
      ctx.lineTo(w, h);
      ctx.stroke();
    },
  },
};

export function getPatternUnitSize(type: FloorMaterial): { widthM: number; heightM: number } {
  const s = SPECS[type];
  return { widthM: s.unitWidthM, heightM: s.unitHeightM };
}

export interface FloorPatternOptions {
  /** Если true — канва юнита сначала заливается базовым цветом пола, затем поверх
   *  рисуются швы. Используется в 3D-сцене, где у меша пола нет другого источника цвета.
   *  Если false (по умолчанию — F6.2.8), канва остаётся прозрачной, и швы накладываются
   *  на то, что отрисовано под Rect'ом узора (пастельная заливка комнаты в 2D). */
  withBackground?: boolean;
}

export function renderFloorPattern(
  type: FloorMaterial,
  opts: FloorPatternOptions = {},
): HTMLCanvasElement {
  const spec = SPECS[type];
  const canvas = document.createElement('canvas');
  canvas.width = pxFromM(spec.unitWidthM);
  canvas.height = pxFromM(spec.unitHeightM);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Cannot create 2D context for floor pattern');
  if (opts.withBackground) {
    ctx.fillStyle = spec.fillColor;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }
  spec.draw?.(ctx, canvas.width, canvas.height);
  return canvas;
}

const cache: Partial<Record<string, HTMLCanvasElement>> = {};

export function getFloorPatternCanvas(
  type: FloorMaterial,
  opts: FloorPatternOptions = {},
): HTMLCanvasElement {
  const withBg = !!opts.withBackground;
  const key = `${type}:${withBg ? 'bg' : 'overlay'}`;
  let canvas = cache[key];
  if (!canvas) {
    canvas = renderFloorPattern(type, { withBackground: withBg });
    cache[key] = canvas;
  }
  return canvas;
}

export function _resetFloorPatternCacheForTests(): void {
  for (const k of Object.keys(cache)) {
    delete cache[k];
  }
}
