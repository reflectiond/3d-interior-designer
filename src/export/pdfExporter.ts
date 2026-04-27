import { jsPDF } from 'jspdf';
import type { Estimate } from '../domain/pricing/estimator';
import {
  groupEstimateByWorkType,
  formatGroupQuantity,
  type EstimateGroup,
} from '../domain/pricing/groupEstimate';
import { registerPTSans, PT_SANS_FAMILY } from './fonts/ptSans';
import { buildExportFilename } from './sanitizeFilename';

const PAGE_WIDTH_MM = 297;
const PAGE_HEIGHT_MM = 210;
const PAGE_MARGIN_MM = 10;
const HEADER_FONT_SIZE = 14;
const HEADER_BASELINE_MM = 18;
const IMAGE_TOP_MM = 24;

function formatPrice(n: number): string {
  return n.toLocaleString('ru-RU') + ' ₽';
}

function fitImage(naturalAspect: number, maxWidth: number, maxHeight: number) {
  let imgWidth = maxWidth;
  let imgHeight = imgWidth / naturalAspect;
  if (imgHeight > maxHeight) {
    imgHeight = maxHeight;
    imgWidth = imgHeight * naturalAspect;
  }
  return { imgWidth, imgHeight };
}

function getDataUrlAspect(dataUrl: string): number {
  // jsPDF embeds the image at exact pixel ratio when w*h are specified.
  // We do not need actual decoded pixel dims here — caller supplies a square-ish snapshot
  // via Konva.Stage.toDataURL or R3F gl.domElement.toDataURL. Default to canvas-typical 4:3.
  // For deterministic sizing we read width/height from base64 PNG header (8-byte signature + IHDR).
  if (!dataUrl.startsWith('data:image/png;base64,')) return 4 / 3;
  const b64 = dataUrl.slice('data:image/png;base64,'.length, 'data:image/png;base64,'.length + 64);
  const bin = atob(b64);
  // PNG IHDR width is at offset 16..19, height at 20..23 (big-endian uint32)
  const u = (i: number) =>
    (bin.charCodeAt(i) << 24) |
    (bin.charCodeAt(i + 1) << 16) |
    (bin.charCodeAt(i + 2) << 8) |
    bin.charCodeAt(i + 3);
  const w = u(16) >>> 0;
  const h = u(20) >>> 0;
  if (!w || !h) return 4 / 3;
  return w / h;
}

function drawImagePage(doc: jsPDF, title: string, dataUrl: string | null, fallback: string): void {
  doc.setFont(PT_SANS_FAMILY, 'bold');
  doc.setFontSize(HEADER_FONT_SIZE);
  doc.text(title, PAGE_MARGIN_MM, HEADER_BASELINE_MM);

  if (!dataUrl) {
    doc.setFont(PT_SANS_FAMILY, 'normal');
    doc.setFontSize(10);
    doc.text(fallback, PAGE_MARGIN_MM, HEADER_BASELINE_MM + 12);
    return;
  }

  const maxWidth = PAGE_WIDTH_MM - PAGE_MARGIN_MM * 2;
  const maxHeight = PAGE_HEIGHT_MM - IMAGE_TOP_MM - PAGE_MARGIN_MM;
  const aspect = getDataUrlAspect(dataUrl);
  const { imgWidth, imgHeight } = fitImage(aspect, maxWidth, maxHeight);
  const x = (PAGE_WIDTH_MM - imgWidth) / 2;
  doc.addImage(dataUrl, 'PNG', x, IMAGE_TOP_MM, imgWidth, imgHeight);
}

export async function exportPDF(
  estimate: Estimate,
  snapshot2D: string | null,
  snapshot3D: string | null,
  projectId?: string | null,
) {
  const doc = new jsPDF('l', 'mm', 'a4');
  await registerPTSans(doc);

  // Page 1: 2D Plan
  drawImagePage(doc, '3D Interior Designer — План 2D', snapshot2D, '(2D-схема недоступна)');

  // Page 2: 3D View
  doc.addPage();
  drawImagePage(doc, '3D Interior Designer — Вид 3D', snapshot3D, '(3D-сцена недоступна)');

  // Page 3: Estimate
  doc.addPage();
  doc.setFont(PT_SANS_FAMILY, 'bold');
  doc.setFontSize(HEADER_FONT_SIZE);
  doc.text('3D Interior Designer — Смета', PAGE_MARGIN_MM, HEADER_BASELINE_MM);

  // F9.2 — render the estimate grouped by work type.
  // F9.2.1: groups in bold, detail rows in regular weight indented to the right.
  // F9.2.2: groups are expanded by default (we always print detail rows).
  const groups = groupEstimateByWorkType(estimate.items);
  const categories = [
    { key: 'rough' as const, title: 'Черновая отделка' },
    { key: 'fine' as const, title: 'Чистовая отделка' },
    { key: 'furniture' as const, title: 'Мебель' },
  ];
  const lineHeight = 6;
  const detailLineHeight = 5;
  const detailIndentMm = 6; // ~12 pt at 72 dpi
  const colQty = PAGE_MARGIN_MM + 100;
  const colPrice = PAGE_MARGIN_MM + 140;

  let y = HEADER_BASELINE_MM + 12;

  function ensureRoom(needed: number) {
    if (y + needed > PAGE_HEIGHT_MM - PAGE_MARGIN_MM) {
      doc.addPage();
      y = HEADER_BASELINE_MM;
    }
  }

  function drawGroup(group: EstimateGroup) {
    ensureRoom(lineHeight);
    doc.setFontSize(10);
    doc.setFont(PT_SANS_FAMILY, 'bold');
    doc.text(group.workType, PAGE_MARGIN_MM, y);
    doc.text(formatGroupQuantity(group), colQty, y);
    doc.text(
      `${formatPrice(group.totalPriceMin)} — ${formatPrice(group.totalPriceMax)}`,
      colPrice,
      y,
    );
    y += lineHeight;

    // Skip detail when there's only one underlying line — the group row
    // already says everything.
    if (group.items.length <= 1) return;

    doc.setFontSize(9);
    doc.setFont(PT_SANS_FAMILY, 'normal');
    for (const item of group.items) {
      ensureRoom(detailLineHeight);
      doc.text(item.name, PAGE_MARGIN_MM + detailIndentMm, y);
      doc.text(item.quantity, colQty, y);
      doc.text(`${formatPrice(item.priceMin)} — ${formatPrice(item.priceMax)}`, colPrice, y);
      y += detailLineHeight;
    }
  }

  for (const cat of categories) {
    const catGroups = groups.filter((g) => g.category === cat.key);
    if (catGroups.length === 0) continue;

    ensureRoom(lineHeight + 2);
    doc.setFontSize(12);
    doc.setFont(PT_SANS_FAMILY, 'bold');
    doc.text(cat.title, PAGE_MARGIN_MM, y);
    y += lineHeight + 2;

    for (const group of catGroups) {
      drawGroup(group);
    }

    y += 4;
  }

  // Total
  y += 4;
  doc.setFontSize(12);
  doc.setFont(PT_SANS_FAMILY, 'bold');
  doc.text(
    `Итого: ${formatPrice(estimate.totalMin)} — ${formatPrice(estimate.totalMax)}`,
    PAGE_MARGIN_MM,
    y,
  );

  doc.save(buildExportFilename('interior_design', projectId, 'pdf'));
}
