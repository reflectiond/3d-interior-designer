import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
// pdfjs-dist legacy build works in Node-side test environments
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';

test.describe('Export — PDF', () => {
  test('E2E-10: generated PDF contains readable cyrillic «Стяжка пола»', async ({ page }) => {
    await page.goto('/');

    // Select layout 1 to populate the project state
    await page.getByRole('button', { name: /Выбрать Планировка 1/ }).click();

    // Jump straight to Stage 4 via the stage navigator
    await page.locator('nav[aria-label="Этапы"] button').nth(3).click();

    // Trigger PDF export and capture the download
    const downloadPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Сохранить как PDF' }).click();
    const download = await downloadPromise;

    const downloadPath = await download.path();
    expect(downloadPath).not.toBeNull();

    const buffer = await readFile(downloadPath!);
    const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(buffer) }).promise;

    // The estimate is on page 3 (план 2D / вид 3D / смета)
    expect(pdf.numPages).toBeGreaterThanOrEqual(3);

    const estimatePage = await pdf.getPage(3);
    const textContent = await estimatePage.getTextContent();
    const text = textContent.items.map((item) => ('str' in item ? item.str : '')).join(' ');

    expect(text).toContain('Стяжка пола');
  });
});
