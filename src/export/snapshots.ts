import type Konva from 'konva';
import type { WebGLRenderer, Scene, Camera } from 'three';

let konvaStage: Konva.Stage | null = null;
let r3fHandles: { gl: WebGLRenderer; scene: Scene; camera: Camera } | null = null;

export function registerKonvaStage(stage: Konva.Stage | null): void {
  konvaStage = stage;
}

export function registerR3FHandles(
  handles: { gl: WebGLRenderer; scene: Scene; camera: Camera } | null,
): void {
  r3fHandles = handles;
}

export function capture2DSnapshot(): string | null {
  if (!konvaStage) return null;
  return konvaStage.toDataURL({ pixelRatio: 2, mimeType: 'image/png' });
}

export function capture3DSnapshot(): string | null {
  if (!r3fHandles) return null;
  const { gl, scene, camera } = r3fHandles;
  gl.render(scene, camera);
  return gl.domElement.toDataURL('image/png');
}

export function _resetSnapshotsForTests(): void {
  konvaStage = null;
  r3fHandles = null;
}
