import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { jsPDF } from 'jspdf';
import {
  registerPTSans,
  loadPTSans,
  PT_SANS_FAMILY,
  _resetPTSansCacheForTests,
} from '../../src/export/fonts/ptSans';

function makeFakeDoc() {
  return {
    addFileToVFS: vi.fn(),
    addFont: vi.fn(),
    setFont: vi.fn(),
  } as unknown as jsPDF & {
    addFileToVFS: ReturnType<typeof vi.fn>;
    addFont: ReturnType<typeof vi.fn>;
    setFont: ReturnType<typeof vi.fn>;
  };
}

function mockFetchOk(payload = new Uint8Array([0, 1, 2, 3]).buffer) {
  return vi.fn().mockResolvedValue({
    ok: true,
    status: 200,
    arrayBuffer: () => Promise.resolve(payload),
  } as unknown as Response);
}

describe('registerPTSans', () => {
  beforeEach(() => {
    _resetPTSansCacheForTests();
  });

  it('fetches both weights and registers them in jsPDF', async () => {
    global.fetch = mockFetchOk();
    const doc = makeFakeDoc();

    await registerPTSans(doc);

    expect(global.fetch).toHaveBeenCalledTimes(2);
    expect(global.fetch).toHaveBeenCalledWith('/fonts/PT_Sans/PTSans-Regular.ttf');
    expect(global.fetch).toHaveBeenCalledWith('/fonts/PT_Sans/PTSans-Bold.ttf');

    expect(doc.addFileToVFS).toHaveBeenCalledTimes(2);
    expect(doc.addFileToVFS).toHaveBeenCalledWith('PTSans-Regular.ttf', expect.any(String));
    expect(doc.addFileToVFS).toHaveBeenCalledWith('PTSans-Bold.ttf', expect.any(String));

    expect(doc.addFont).toHaveBeenCalledTimes(2);
    expect(doc.addFont).toHaveBeenCalledWith('PTSans-Regular.ttf', PT_SANS_FAMILY, 'normal');
    expect(doc.addFont).toHaveBeenCalledWith('PTSans-Bold.ttf', PT_SANS_FAMILY, 'bold');

    expect(doc.setFont).toHaveBeenCalledWith(PT_SANS_FAMILY, 'normal');
  });

  it('caches font payloads across calls', async () => {
    global.fetch = mockFetchOk();

    await loadPTSans();
    await loadPTSans();

    expect(global.fetch).toHaveBeenCalledTimes(2);
  });

  it('throws if a weight cannot be fetched', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
      arrayBuffer: () => Promise.reject(new Error('not called')),
    } as unknown as Response);

    await expect(loadPTSans()).rejects.toThrow(/PT Sans font fetch failed/);
  });
});
