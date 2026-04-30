import { useEffect, useState } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { useProjectStore } from '../../store/projectStore';
import { TILE_SIZE } from '../../domain/geometry/tiles';
import { ProjectScene } from '../../views/View3D/ProjectScene';
import { registerR3FHandles } from '../snapshots';

const SNAPSHOT_WIDTH = 1200;
const SNAPSHOT_HEIGHT = 900;

/**
 * F7.6.1 (v1.15.0) — после mount'а R3F-канвы:
 *
 *  1) Регистрируем gl/scene/camera в синглтон.
 *  2) Через два `requestAnimationFrame` вызываем `gl.render(scene, camera)`
 *     и сигналим родителю готовность.
 *
 * Двойной rAF нужен потому, что в Firefox+headless WebGL context для
 * offscreen-канвы (`left: -10000`) инициализируется лениво — первый rAF
 * даёт браузеру layout, второй гарантирует, что WebGL готов отрисовать.
 *
 * Раньше использовался `frameloop="never"` + синхронный `gl.render()` в
 * useEffect — в Firefox это давало пустой framebuffer (флаг `data-3d-ready`
 * выставлялся, но `toDataURL()` отдавал прозрачный PNG). Затем пробовали
 * `frameloop="demand"` + `useFrame`-сигнал — в Firefox `useFrame` не
 * срабатывал (invalidate-ed кадр уходил до того, как FirstFrameSignal
 * подписывался). Текущий подход объединяет всё в одном месте.
 */
function HandleRegistrar({ onReady }: { onReady: () => void }) {
  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);
  const camera = useThree((s) => s.camera);

  useEffect(() => {
    registerR3FHandles({ gl, scene, camera });
    let cancelled = false;
    requestAnimationFrame(() => {
      if (cancelled) return;
      requestAnimationFrame(() => {
        if (cancelled) return;
        try {
          gl.render(scene, camera);
        } catch (err) {
          console.warn('[F7.6] first gl.render() threw:', err);
        }
        onReady();
      });
    });
    return () => {
      cancelled = true;
      registerR3FHandles(null);
    };
  }, [gl, scene, camera, onReady]);

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
        // Камера на +Z; Z-инверсия делается в ProjectScene по tile.y.
        camera={{
          position: [totalW / 2, totalW * 0.8, totalD + totalW * 0.5],
          fov: 50,
          near: 0.1,
          far: 100,
        }}
        gl={{ preserveDrawingBuffer: true, antialias: true }}
        style={{ width: SNAPSHOT_WIDTH, height: SNAPSHOT_HEIGHT }}
      >
        <HandleRegistrar onReady={() => setReady(true)} />
        <ProjectScene />
      </Canvas>
    </div>
  );
}
