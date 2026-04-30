import { useEffect, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { useProjectStore } from '../../store/projectStore';
import { TILE_SIZE } from '../../domain/geometry/tiles';
import { ProjectScene } from '../../views/View3D/ProjectScene';
import { registerR3FHandles } from '../snapshots';

const SNAPSHOT_WIDTH = 1200;
const SNAPSHOT_HEIGHT = 900;

/**
 * F7.6.1 (v1.15.0) — двух-частный сигнал готовности офскрин 3D-канвы:
 *
 *  1) `HandleRegistrar` регистрирует gl/scene/camera в синглтон и вызывает
 *     `invalidate()` — это просит R3F (`frameloop="demand"`) отрисовать
 *     один кадр.
 *  2) `FirstFrameSignal` слушает `useFrame` и сигналит родителю после
 *     первого реального рендера. К этому моменту WebGL framebuffer
 *     гарантированно содержит пиксели, а `gl.domElement.toDataURL()` в
 *     `capture3DSnapshot()` отдаёт непустой PNG.
 *
 * Раньше использовался `frameloop="never"` + ручной `gl.render()` в
 * useEffect. В Firefox+headless это давало flake'и: иногда useEffect
 * срабатывал до того, как WebGL контекст был полностью инициализирован,
 * и первый кадр оставался прозрачным.
 */
function HandleRegistrar() {
  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);
  const camera = useThree((s) => s.camera);
  const invalidate = useThree((s) => s.invalidate);

  useEffect(() => {
    registerR3FHandles({ gl, scene, camera });
    invalidate();
    return () => registerR3FHandles(null);
  }, [gl, scene, camera, invalidate]);

  return null;
}

function FirstFrameSignal({ onReady }: { onReady: () => void }) {
  const [signaled, setSignaled] = useState(false);
  useFrame(() => {
    if (!signaled) {
      setSignaled(true);
      onReady();
    }
  });
  return null;
}

export function View3DSnapshot() {
  const { layout } = useProjectStore();
  const [ready, setReady] = useState(false);
  if (!layout) return null;

  const totalW = layout.gridWidth * TILE_SIZE;
  const totalD = layout.gridHeight * TILE_SIZE;

  return (
    <div
      aria-hidden="true"
      // F7.6.1 (v1.15.0) — флаг готовности виден из e2e через
      // `[data-3d-ready="1"]`. Заполняется после первого `gl.render()`.
      data-3d-ready={ready ? '1' : '0'}
      style={{
        position: 'absolute',
        left: -10000,
        top: -10000,
        width: SNAPSHOT_WIDTH,
        height: SNAPSHOT_HEIGHT,
        pointerEvents: 'none',
      }}
      data-testid="view3d-snapshot"
    >
      <Canvas
        frameloop="demand"
        camera={{
          position: [totalW / 2, totalW * 0.8, totalD + totalW * 0.5],
          fov: 50,
          near: 0.1,
          far: 100,
        }}
        gl={{ preserveDrawingBuffer: true, antialias: true }}
        style={{ width: SNAPSHOT_WIDTH, height: SNAPSHOT_HEIGHT }}
      >
        <HandleRegistrar />
        <FirstFrameSignal onReady={() => setReady(true)} />
        <ProjectScene />
      </Canvas>
    </div>
  );
}
