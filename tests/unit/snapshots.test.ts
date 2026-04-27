import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  registerKonvaStage,
  registerR3FHandles,
  capture2DSnapshot,
  capture3DSnapshot,
  _resetSnapshotsForTests,
} from '../../src/export/snapshots';

const PNG_DATA_URL = 'data:image/png;base64,FAKE_PNG';

describe('snapshots registry', () => {
  beforeEach(() => {
    _resetSnapshotsForTests();
  });

  it('returns null for 2D snapshot when no stage registered', () => {
    expect(capture2DSnapshot()).toBeNull();
  });

  it('returns null for 3D snapshot when no R3F handles registered', () => {
    expect(capture3DSnapshot()).toBeNull();
  });

  it('captures 2D via Konva.Stage.toDataURL with pixelRatio 2', () => {
    const toDataURL = vi.fn().mockReturnValue(PNG_DATA_URL);
    registerKonvaStage({ toDataURL } as never);

    const result = capture2DSnapshot();

    expect(result).toBe(PNG_DATA_URL);
    expect(toDataURL).toHaveBeenCalledWith({ pixelRatio: 2, mimeType: 'image/png' });
  });

  it('captures 3D by rendering scene then reading domElement.toDataURL', () => {
    const render = vi.fn();
    const toDataURL = vi.fn().mockReturnValue(PNG_DATA_URL);
    const gl = { render, domElement: { toDataURL } };
    const scene = {} as never;
    const camera = {} as never;
    registerR3FHandles({ gl: gl as never, scene, camera });

    const result = capture3DSnapshot();

    expect(result).toBe(PNG_DATA_URL);
    expect(render).toHaveBeenCalledWith(scene, camera);
    expect(toDataURL).toHaveBeenCalledWith('image/png');
  });

  it('unregisters by passing null', () => {
    registerKonvaStage({ toDataURL: () => PNG_DATA_URL } as never);
    registerKonvaStage(null);
    expect(capture2DSnapshot()).toBeNull();

    registerR3FHandles({
      gl: { render: () => {}, domElement: { toDataURL: () => PNG_DATA_URL } } as never,
      scene: {} as never,
      camera: {} as never,
    });
    registerR3FHandles(null);
    expect(capture3DSnapshot()).toBeNull();
  });
});
