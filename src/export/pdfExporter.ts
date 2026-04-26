import { jsPDF } from 'jspdf';
import type { Estimate } from '../domain/pricing/estimator';

function formatPrice(n: number): string {
  return n.toLocaleString('ru-RU') + ' ₽';
}

export async function exportPDF(
  estimate: Estimate,
  canvas2DElement: HTMLCanvasElement | null,
  canvas3DElement: HTMLCanvasElement | null,
) {
  const doc = new jsPDF('p', 'mm', 'a4');
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 15;
  const contentWidth = pageWidth - margin * 2;

  // Page 1: 2D Plan
  doc.setFontSize(16);
  doc.text('3D Interior Designer — План 2D', margin, 20);

  if (canvas2DElement) {
    try {
      const imgData = canvas2DElement.toDataURL('image/png');
      const imgAspect = canvas2DElement.width / canvas2DElement.height;
      const imgWidth = Math.min(contentWidth, 170);
      const imgHeight = imgWidth / imgAspect;
      doc.addImage(imgData, 'PNG', margin, 30, imgWidth, imgHeight);
    } catch {
      doc.setFontSize(10);
      doc.text('(2D-схема недоступна)', margin, 40);
    }
  }

  // Page 2: 3D View
  doc.addPage();
  doc.setFontSize(16);
  doc.text('3D Interior Designer — Вид 3D', margin, 20);

  if (canvas3DElement) {
    try {
      const imgData = canvas3DElement.toDataURL('image/png');
      const imgAspect = canvas3DElement.width / canvas3DElement.height;
      const imgWidth = Math.min(contentWidth, 170);
      const imgHeight = imgWidth / imgAspect;
      doc.addImage(imgData, 'PNG', margin, 30, imgWidth, imgHeight);
    } catch {
      doc.setFontSize(10);
      doc.text('(3D-сцена недоступна)', margin, 40);
    }
  }

  // Page 3: Estimate
  doc.addPage();
  doc.setFontSize(16);
  doc.text('3D Interior Designer — Смета', margin, 20);

  let y = 35;
  const lineHeight = 6;

  const categories = [
    { key: 'rough', title: 'Черновая отделка' },
    { key: 'fine', title: 'Чистовая отделка' },
    { key: 'furniture', title: 'Мебель' },
  ] as const;

  for (const cat of categories) {
    const items = estimate.items.filter((i) => i.category === cat.key);
    if (items.length === 0) continue;

    if (y > 260) {
      doc.addPage();
      y = 20;
    }

    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text(cat.title, margin, y);
    y += lineHeight + 2;

    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');

    for (const item of items) {
      if (y > 275) {
        doc.addPage();
        y = 20;
      }
      doc.text(item.name, margin, y);
      doc.text(item.quantity, margin + 90, y);
      doc.text(`${formatPrice(item.priceMin)} — ${formatPrice(item.priceMax)}`, margin + 120, y);
      y += lineHeight;
    }

    y += 4;
  }

  // Total
  y += 4;
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text(
    `Итого: ${formatPrice(estimate.totalMin)} — ${formatPrice(estimate.totalMax)}`,
    margin,
    y,
  );

  doc.save('interior-project.pdf');
}
