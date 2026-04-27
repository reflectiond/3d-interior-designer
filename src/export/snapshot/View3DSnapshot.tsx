import { useEffect } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { useProjectStore } from '../../store/projectStore';
import { TILE_SIZE } from '../../domain/geometry/tiles';
import { ProjectScene } from '../../views/View3D/ProjectScene';
import { registerR3FHandles } from '../snapshots';

const SNAPSHOT_WIDTH = 1200;
const SNAPSHOT_HEIGHT = 900;

function HandleRegistrar() {
  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);
  const camera = useThree((s) => s.camera);

  useEffect(() => {
    registerR3FHandles({ gl, scene, camera });
    return () => registerR3FHandles(null);
  }, [gl, scene, camera]);

  return null;
}

export function View3DSnapshot() {
  const { layout } = useProjectStore();
  if (!layout) return null;

  const totalW = layout.gridWidth * TILE_SIZE;
  const totalD = layout.gridHeight * TILE_SIZE;

  return (
    <div
      aria-hidden="true"
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
        <HandleRegistrar />
        <ProjectScene />
      </Canvas>
    </div>
  );
}
