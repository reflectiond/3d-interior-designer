import { useEffect, useState } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { useProjectStore } from '../../store/projectStore';
import { TILE_SIZE } from '../../domain/geometry/tiles';
import { ProjectScene } from '../../views/View3D/ProjectScene';
import { registerR3FHandles } from '../snapshots';

const SNAPSHOT_WIDTH = 1200;
const SNAPSHOT_HEIGHT = 900;

/**
 * F7.6.1 (v1.15.0) — после регистрации хендлов форсим первый `gl.render()`,
 * чтобы framebuffer был непустым. Затем сигналим «готово» родителю —
 * это снимает race в e2e и в `capture3DSnapshot`: `toDataURL` стабильно
 * возвращает PNG с пиксельными данными, а не прозрачную пустоту.
 *
 * Раньше первый рендер случался только внутри `capture3DSnapshot()` (при
 * клике «Сохранить как PDF»). В Firefox+headless это давало флэйкующие
 * результаты — иногда `r3fHandles` ещё `null` к моменту вызова, иногда
 * рендер не успевал заполнить буфер.
 */
function HandleRegistrar({ onReady }: { onReady: () => void }) {
  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);
  const camera = useThree((s) => s.camera);

  useEffect(() => {
    registerR3FHandles({ gl, scene, camera });
    // Сцена смонтирована (children R3F-канвы — синхронные мемо без async-load),
    // вызываем рендер сразу. Если в будущем появятся async-ассеты (glTF и т.п.),
    // готовность нужно будет привязывать к их Suspense-разрешению.
    gl.render(scene, camera);
    onReady();
    return () => registerR3FHandles(null);
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
        frameloop="never"
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
