import { useEffect, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { useProjectStore } from '../../store/projectStore';
import { TILE_SIZE } from '../../domain/geometry/tiles';
import { ProjectScene, ROOM_HEIGHT_M } from './ProjectScene';
import styles from './View3D.module.css';

/**
 * F7.6.1 (v1.15.0) — сигналит готовность сцены родителю после первого
 * фрейма. Использует `useFrame` (R3F-хук, выполняется в render-loop'е
 * родительской `<Canvas>`). Без этого e2e-тесты, читающие пиксели через
 * `getImageData`, ловили пустой framebuffer (F6.2.7 flake в Firefox).
 */
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

export function View3D() {
  const { layout } = useProjectStore();
  const [ready, setReady] = useState(false);

  // Сбрасываем готовность при размонтировании — следующее монтирование
  // (например, после переключения «Посмотреть в 3D» обратно) должно
  // дождаться нового первого фрейма.
  useEffect(() => () => setReady(false), []);

  if (!layout) return null;

  const totalW = layout.gridWidth * TILE_SIZE;
  const totalD = layout.gridHeight * TILE_SIZE;

  return (
    <div className={styles.container} data-testid="view3d" data-3d-ready={ready ? '1' : '0'}>
      <Canvas
        // Камера на стороне отрицательного Z — это сторона, которая в 2D
        // соответствует ВЕРХУ экрана (View2D инвертирует Y: high tile.y →
        // top of canvas, а в three.js сцене high tile.y = high Z). Чтобы
        // 3D-вид совпадал с 2D-планом «по сторонам света», камера должна
        // смотреть с Z<0 в сторону Z+.
        camera={{
          position: [totalW / 2, totalW * 0.8, -totalW * 0.5],
          fov: 50,
          near: 0.1,
          far: 100,
        }}
        gl={{ preserveDrawingBuffer: true }}
      >
        <FirstFrameSignal onReady={() => setReady(true)} />
        <ProjectScene />
        <OrbitControls
          target={[totalW / 2, ROOM_HEIGHT_M / 2, totalD / 2]}
          maxPolarAngle={Math.PI / 2}
        />
      </Canvas>
    </div>
  );
}
