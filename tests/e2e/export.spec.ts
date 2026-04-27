import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
// pdfjs-dist legacy build works in Node-side test environments
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';

async function gotoStage4(page: import('@playwright/test').Page) {
  await page.goto('/');
  await page.getByRole('button', { name: /Выбрать Планировка 1/ }).click();
  await page.locator('nav[aria-label="Этапы"] button').nth(3).click();
}

async function downloadPdf(page: import('@playwright/test').Page) {
  await gotoStage4(page);

  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Сохранить как PDF' }).click();
  const download = await downloadPromise;

  const downloadPath = await download.path();
  expect(downloadPath).not.toBeNull();
  const buffer = await readFile(downloadPath!);
  return {
    pdf: await pdfjsLib.getDocument({ data: new Uint8Array(buffer) }).promise,
    filename: download.suggestedFilename(),
  };
}

async function pageHasImage(pdf: pdfjsLib.PDFDocumentProxy, pageNum: number): Promise<boolean> {
  const page = await pdf.getPage(pageNum);
  const ops = await page.getOperatorList();
  // pdfjs-dist exposes OPS.paintImageXObject which is emitted whenever an image is drawn
  return ops.fnArray.includes(pdfjsLib.OPS.paintImageXObject);
}

test.describe('Export — PDF', () => {
  test('E2E-10: generated PDF contains readable cyrillic «Стяжка пола»', async ({ page }) => {
    const { pdf } = await downloadPdf(page);

    expect(pdf.numPages).toBeGreaterThanOrEqual(3);

    const estimatePage = await pdf.getPage(3);
    const textContent = await estimatePage.getTextContent();
    const text = textContent.items.map((item) => ('str' in item ? item.str : '')).join(' ');

    expect(text).toContain('Стяжка пола');
  });

  test('F10.2.1/F10.2.4: PDF has 3 pages and embeds images on plan & 3D pages', async ({
    page,
  }) => {
    const { pdf } = await downloadPdf(page);

    expect(pdf.numPages).toBe(3);
    expect(await pageHasImage(pdf, 1)).toBe(true); // 2D plan
    expect(await pageHasImage(pdf, 2)).toBe(true); // 3D view
  });

  test('F10.2.5: page is A4 landscape (297×210 mm)', async ({ page }) => {
    const { pdf } = await downloadPdf(page);
    const firstPage = await pdf.getPage(1);
    const viewport = firstPage.getViewport({ scale: 1 });
    // A4 in points: 297mm = 841.89pt, 210mm = 595.28pt — landscape: width > height
    expect(viewport.width).toBeGreaterThan(viewport.height);
    expect(viewport.width).toBeGreaterThan(800);
    expect(viewport.width).toBeLessThan(900);
  });

  test('F10.4.1: PDF filename matches sanitized pattern', async ({ page }) => {
    const { filename } = await downloadPdf(page);
    expect(filename).toMatch(/^interior_design_layout1_\d{14}\.pdf$/);
  });
});

test.describe('Export — PNG', () => {
  test('E2E-11: PNG export downloads a valid PNG file', async ({ page }) => {
    await gotoStage4(page);

    const downloadPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Сохранить как PNG' }).click();
    const download = await downloadPromise;

    const downloadPath = await download.path();
    expect(downloadPath).not.toBeNull();
    const buffer = await readFile(downloadPath!);

    // PNG signature: 89 50 4E 47 0D 0A 1A 0A
    expect(buffer.length).toBeGreaterThan(1000);
    expect(buffer[0]).toBe(0x89);
    expect(buffer[1]).toBe(0x50);
    expect(buffer[2]).toBe(0x4e);
    expect(buffer[3]).toBe(0x47);
  });

  test('F10.4.1: PNG filename matches sanitized pattern', async ({ page }) => {
    await gotoStage4(page);

    const downloadPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Сохранить как PNG' }).click();
    const download = await downloadPromise;

    expect(download.suggestedFilename()).toMatch(/^interior_design_layout1_\d{14}\.png$/);
  });
});

test.describe('Export — filename safety (SEC-8)', () => {
  test('SEC-8: download filenames contain only safe characters', async ({ page }) => {
    await gotoStage4(page);

    // PDF
    const pdfPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Сохранить как PDF' }).click();
    const pdfName = (await pdfPromise).suggestedFilename();
    expect(pdfName).toMatch(/^[a-zA-Z0-9_.-]+$/);
    expect(pdfName).not.toContain('<');
    expect(pdfName).not.toContain('>');
    expect(pdfName).not.toContain('/');
    expect(pdfName).not.toContain('\\');

    // PNG
    const pngPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Сохранить как PNG' }).click();
    const pngName = (await pngPromise).suggestedFilename();
    expect(pngName).toMatch(/^[a-zA-Z0-9_.-]+$/);

    // JSON
    const jsonPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Сохранить проект (JSON)' }).click();
    const jsonName = (await jsonPromise).suggestedFilename();
    expect(jsonName).toMatch(/^[a-zA-Z0-9_.-]+$/);
  });
});
