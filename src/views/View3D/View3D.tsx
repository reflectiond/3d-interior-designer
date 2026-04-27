import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { useProjectStore } from '../../store/projectStore';
import { TILE_SIZE } from '../../domain/geometry/tiles';
import { ProjectScene, ROOM_HEIGHT_M } from './ProjectScene';
import styles from './View3D.module.css';

export function View3D() {
  const { layout } = useProjectStore();

  if (!layout) return null;

  const totalW = layout.gridWidth * TILE_SIZE;
  const totalD = layout.gridHeight * TILE_SIZE;

  return (
    <div className={styles.container}>
      <Canvas
        camera={{
          position: [totalW / 2, totalW * 0.8, totalD + totalW * 0.5],
          fov: 50,
          near: 0.1,
          far: 100,
        }}
        gl={{ preserveDrawingBuffer: true }}
      >
        <ProjectScene />
        <OrbitControls
          target={[totalW / 2, ROOM_HEIGHT_M / 2, totalD / 2]}
          maxPolarAngle={Math.PI / 2}
        />
      </Canvas>
    </div>
  );
}
