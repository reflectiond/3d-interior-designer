import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { useProjectStore } from '../../store/projectStore';
import { PALETTE } from '../../theme/palette';
import { TILE_SIZE } from '../../domain/geometry/tiles';
import type { Room, CeilingType } from '../../domain/geometry/types';
import styles from './View3D.module.css';

const ROOM_HEIGHT = 2.7;

function roomFloorColor(): string {
  return PALETTE.floor.screed;
}

function ceilingColor(type: CeilingType): string {
  return type === 'drywall' ? PALETTE.ceiling.drywall : PALETTE.ceiling.stretch;
}

function RoomMesh({ room, ceilingType }: { room: Room; ceilingType: CeilingType }) {
  const w = room.rect.width * TILE_SIZE;
  const d = room.rect.height * TILE_SIZE;
  const cx = room.rect.x * TILE_SIZE + w / 2;
  const cz = room.rect.y * TILE_SIZE + d / 2;

  return (
    <group>
      {/* Floor */}
      <mesh position={[cx, 0, cz]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[w, d]} />
        <meshStandardMaterial color={roomFloorColor()} />
      </mesh>
      {/* Ceiling */}
      <mesh position={[cx, ROOM_HEIGHT, cz]} rotation={[Math.PI / 2, 0, 0]}>
        <planeGeometry args={[w, d]} />
        <meshStandardMaterial color={ceilingColor(ceilingType)} />
      </mesh>
    </group>
  );
}

function WallMeshes({ room }: { room: Room }) {
  const r = room.rect;
  const x0 = r.x * TILE_SIZE;
  const z0 = r.y * TILE_SIZE;
  const w = r.width * TILE_SIZE;
  const d = r.height * TILE_SIZE;
  const h = ROOM_HEIGHT;
  const wallColor = PALETTE.walls.plaster;

  return (
    <group>
      {/* Back wall (z=z0) */}
      <mesh position={[x0 + w / 2, h / 2, z0]}>
        <planeGeometry args={[w, h]} />
        <meshStandardMaterial color={wallColor} side={2} />
      </mesh>
      {/* Front wall (z=z0+d) */}
      <mesh position={[x0 + w / 2, h / 2, z0 + d]} rotation={[0, Math.PI, 0]}>
        <planeGeometry args={[w, h]} />
        <meshStandardMaterial color={wallColor} side={2} />
      </mesh>
      {/* Left wall (x=x0) */}
      <mesh position={[x0, h / 2, z0 + d / 2]} rotation={[0, Math.PI / 2, 0]}>
        <planeGeometry args={[d, h]} />
        <meshStandardMaterial color={wallColor} side={2} />
      </mesh>
      {/* Right wall (x=x0+w) */}
      <mesh position={[x0 + w, h / 2, z0 + d / 2]} rotation={[0, -Math.PI / 2, 0]}>
        <planeGeometry args={[d, h]} />
        <meshStandardMaterial color={wallColor} side={2} />
      </mesh>
    </group>
  );
}

function WireSegments() {
  const { electricalRoutes } = useProjectStore();

  return (
    <group>
      {electricalRoutes.map((route) =>
        route.path.map((tile, i) => {
          if (i === 0) return null;
          const prev = route.path[i - 1];
          const x1 = (prev.x + 0.5) * TILE_SIZE;
          const z1 = (prev.y + 0.5) * TILE_SIZE;
          const x2 = (tile.x + 0.5) * TILE_SIZE;
          const z2 = (tile.y + 0.5) * TILE_SIZE;
          const mx = (x1 + x2) / 2;
          const mz = (z1 + z2) / 2;
          const len = Math.sqrt((x2 - x1) ** 2 + (z2 - z1) ** 2);
          const angle = Math.atan2(z2 - z1, x2 - x1);

          return (
            <mesh
              key={`${route.pointId}-${i}`}
              position={[mx, ROOM_HEIGHT - 0.01, mz]}
              rotation={[0, -angle, Math.PI / 2]}
            >
              <cylinderGeometry args={[0.01, 0.01, len, 6]} />
              <meshStandardMaterial color={PALETTE.electrical.wire} />
            </mesh>
          );
        }),
      )}
    </group>
  );
}

export function View3D() {
  const { layout, rooms, ceiling } = useProjectStore();

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
      >
        <ambientLight intensity={0.6} />
        <directionalLight position={[totalW, 10, totalD]} intensity={0.8} />

        {rooms.map((room) => (
          <RoomMesh key={room.id} room={room} ceilingType={ceiling[room.id] ?? 'stretch'} />
        ))}

        {rooms.map((room) => (
          <WallMeshes key={`wall-${room.id}`} room={room} />
        ))}

        <WireSegments />

        <OrbitControls
          target={[totalW / 2, ROOM_HEIGHT / 2, totalD / 2]}
          maxPolarAngle={Math.PI / 2}
        />
      </Canvas>
    </div>
  );
}
