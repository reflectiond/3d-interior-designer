import type { jsPDF } from 'jspdf';

export const PT_SANS_FAMILY = 'PTSans';

const REGULAR_URL = '/fonts/PT_Sans/PTSans-Regular.ttf';
const BOLD_URL = '/fonts/PT_Sans/PTSans-Bold.ttf';

let regularBase64: string | null = null;
let boldBase64: string | null = null;

async function fetchAsBase64(url: string): Promise<string> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`PT Sans font fetch failed: ${url} (${response.status})`);
  }
  const buffer = await response.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

export async function loadPTSans(): Promise<{ regular: string; bold: string }> {
  if (regularBase64 === null) {
    regularBase64 = await fetchAsBase64(REGULAR_URL);
  }
  if (boldBase64 === null) {
    boldBase64 = await fetchAsBase64(BOLD_URL);
  }
  return { regular: regularBase64, bold: boldBase64 };
}

export async function registerPTSans(doc: jsPDF): Promise<void> {
  const { regular, bold } = await loadPTSans();
  doc.addFileToVFS('PTSans-Regular.ttf', regular);
  doc.addFont('PTSans-Regular.ttf', PT_SANS_FAMILY, 'normal');
  doc.addFileToVFS('PTSans-Bold.ttf', bold);
  doc.addFont('PTSans-Bold.ttf', PT_SANS_FAMILY, 'bold');
  doc.setFont(PT_SANS_FAMILY, 'normal');
}

export function _resetPTSansCacheForTests(): void {
  regularBase64 = null;
  boldBase64 = null;
}
