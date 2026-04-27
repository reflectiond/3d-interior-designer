import type { Estimate } from '../domain/pricing/estimator';
import { PALETTE } from '../theme/palette';
import { buildExportFilename } from './sanitizeFilename';

const PNG_WIDTH = 1920;
const PNG_HEIGHT = 1080;
const PLAN_HALF = 540;
const PADDING = 32;

const CATEGORIES = [
  { key: 'rough', title: 'Черновая отделка' },
  { key: 'fine', title: 'Чистовая отделка' },
  { key: 'furniture', title: 'Мебель' },
] as const;

function formatPrice(n: number): string {
  return n.toLocaleString('ru-RU') + ' ₽';
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Failed to load 2D snapshot for PNG export'));
    img.src = src;
  });
}

function drawPlan(ctx: CanvasRenderingContext2D, img: HTMLImageElement) {
  const aspect = img.width / img.height;
  const maxWidth = PNG_WIDTH - PADDING * 2;
  const maxHeight = PLAN_HALF - PADDING;
  let drawW = maxWidth;
  let drawH = drawW / aspect;
  if (drawH > maxHeight) {
    drawH = maxHeight;
    drawW = drawH * aspect;
  }
  const x = (PNG_WIDTH - drawW) / 2;
  const y = (PLAN_HALF - drawH) / 2;
  ctx.drawImage(img, x, y, drawW, drawH);
}

function drawEstimate(ctx: CanvasRenderingContext2D, estimate: Estimate) {
  const startY = PLAN_HALF + PADDING;
  ctx.fillStyle = PALETTE.text.primary;
  ctx.textBaseline = 'top';

  ctx.font = 'bold 28px Arial, sans-serif';
  ctx.fillText('Смета', PADDING, startY);

  ctx.font = '16px Arial, sans-serif';
  let y = startY + 44;
  const lineHeight = 22;
  const groupGap = 12;
  const bottomLimit = PNG_HEIGHT - PADDING - 40;

  for (const cat of CATEGORIES) {
    const items = estimate.items.filter((i) => i.category === cat.key);
    if (items.length === 0) continue;
    if (y > bottomLimit) break;

    ctx.font = 'bold 18px Arial, sans-serif';
    ctx.fillText(cat.title, PADDING, y);
    y += lineHeight + 2;

    ctx.font = '15px Arial, sans-serif';
    for (const item of items) {
      if (y > bottomLimit) break;
      ctx.fillText(item.name, PADDING + 16, y);
      ctx.fillText(item.quantity, PADDING + 600, y);
      ctx.fillText(
        `${formatPrice(item.priceMin)} — ${formatPrice(item.priceMax)}`,
        PADDING + 900,
        y,
      );
      y += lineHeight;
    }
    y += groupGap;
  }

  ctx.font = 'bold 22px Arial, sans-serif';
  ctx.fillText(
    `Итого: ${formatPrice(estimate.totalMin)} — ${formatPrice(estimate.totalMax)}`,
    PADDING,
    PNG_HEIGHT - PADDING - 28,
  );
}

function triggerDownload(canvas: HTMLCanvasElement, filename: string): Promise<void> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error('Failed to encode PNG blob'));
        return;
      }
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
      resolve();
    }, 'image/png');
  });
}

export async function exportPNG(
  snapshot2D: string | null,
  estimate: Estimate,
  projectId?: string | null,
): Promise<void> {
  const canvas = document.createElement('canvas');
  canvas.width = PNG_WIDTH;
  canvas.height = PNG_HEIGHT;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Cannot create 2D context for PNG export');

  ctx.fillStyle = PALETTE.walls.paint;
  ctx.fillRect(0, 0, PNG_WIDTH, PNG_HEIGHT);

  if (snapshot2D) {
    const img = await loadImage(snapshot2D);
    drawPlan(ctx, img);
  } else {
    ctx.fillStyle = PALETTE.text.secondary;
    ctx.font = '24px Arial, sans-serif';
    ctx.textBaseline = 'top';
    ctx.fillText('2D-схема недоступна', PADDING, PADDING);
  }

  drawEstimate(ctx, estimate);
  await triggerDownload(canvas, buildExportFilename('interior_design', projectId, 'png'));
}
