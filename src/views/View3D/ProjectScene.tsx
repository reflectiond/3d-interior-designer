import { useMemo } from 'react';
import { CanvasTexture, RepeatWrapping, SRGBColorSpace } from 'three';
import { useProjectStore } from '../../store/projectStore';
import { PALETTE } from '../../theme/palette';
import { TILE_SIZE } from '../../domain/geometry/tiles';
import { getEffectiveSize } from '../../domain/furniture/placement';
import type { CatalogItem } from '../../domain/furniture/placement';
import type { Room, CeilingType, FloorType, FloorCovering } from '../../domain/geometry/types';
import { getFloorPatternCanvas, getPatternUnitSize } from '../floorPatterns';
import catalogData from '../../data/furniture-catalog.json';

const catalogMap = new Map<string, CatalogItem>();
for (const item of catalogData as CatalogItem[]) {
  catalogMap.set(item.id, item);
}

const ROOM_HEIGHT = 2.7;

function roomFloorColor(): string {
  return PALETTE.floor.screed;
}

function ceilingColor(type: CeilingType): string {
  return type === 'drywall' ? PALETTE.ceiling.drywall : PALETTE.ceiling.stretch;
}

function useFloorTexture(covering: FloorCovering | undefined, w: number, d: number) {
  return useMemo(() => {
    if (!covering) return null;
    const canvas = getFloorPatternCanvas(covering);
    const tex = new CanvasTexture(canvas);
    tex.wrapS = RepeatWrapping;
    tex.wrapT = RepeatWrapping;
    tex.colorSpace = SRGBColorSpace;
    const { widthM, heightM } = getPatternUnitSize(covering);
    tex.repeat.set(w / widthM, d / heightM);
    tex.needsUpdate = true;
    return tex;
  }, [covering, w, d]);
}

function RoomMesh({
  room,
  ceilingType,
  flooringType,
  floorCoveringType,
}: {
  room: Room;
  ceilingType: CeilingType;
  flooringType: FloorType;
  floorCoveringType: FloorCovering | undefined;
}) {
  const w = room.rect.width * TILE_SIZE;
  const d = room.rect.height * TILE_SIZE;
  const cx = room.rect.x * TILE_SIZE + w / 2;
  const cz = room.rect.y * TILE_SIZE + d / 2;
  const isHeated = flooringType === 'screed_heated';
  const heatProps = isHeated
    ? { emissive: PALETTE.heated_floor.icon, emissiveIntensity: 0.08 }
    : {};

  const floorTexture = useFloorTexture(floorCoveringType, w, d);

  return (
    <group>
      <mesh position={[cx, 0, cz]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[w, d]} />
        {floorTexture ? (
          <meshStandardMaterial map={floorTexture} {...heatProps} />
        ) : (
          <meshStandardMaterial color={roomFloorColor()} {...heatProps} />
        )}
      </mesh>
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
      <mesh position={[x0 + w / 2, h / 2, z0]}>
        <planeGeometry args={[w, h]} />
        <meshStandardMaterial color={wallColor} side={2} />
      </mesh>
      <mesh position={[x0 + w / 2, h / 2, z0 + d]} rotation={[0, Math.PI, 0]}>
        <planeGeometry args={[w, h]} />
        <meshStandardMaterial color={wallColor} side={2} />
      </mesh>
      <mesh position={[x0, h / 2, z0 + d / 2]} rotation={[0, Math.PI / 2, 0]}>
        <planeGeometry args={[d, h]} />
        <meshStandardMaterial color={wallColor} side={2} />
      </mesh>
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

function FurnitureMeshes() {
  const { furniture } = useProjectStore();

  return (
    <group>
      {furniture.map((f) => {
        const item = catalogMap.get(f.catalogId);
        if (!item) return null;
        const { w, h } = getEffectiveSize(item, f.rotation);
        const wm = w * TILE_SIZE;
        const dm = h * TILE_SIZE;
        const hm = item.height_m;
        const cx = f.position.x * TILE_SIZE + wm / 2;
        const cz = f.position.y * TILE_SIZE + dm / 2;
        const colorKey = item.color_key as keyof typeof PALETTE.furniture;
        const color = PALETTE.furniture[colorKey] ?? PALETTE.furniture.chair;
        return (
          <mesh key={f.id} position={[cx, hm / 2, cz]}>
            <boxGeometry args={[wm, hm, dm]} />
            <meshStandardMaterial color={color} />
          </mesh>
        );
      })}
    </group>
  );
}

export function ProjectScene() {
  const { layout, rooms, ceiling, flooring, floorCovering } = useProjectStore();
  if (!layout) return null;

  const totalW = layout.gridWidth * TILE_SIZE;
  const totalD = layout.gridHeight * TILE_SIZE;

  return (
    <>
      <ambientLight intensity={0.6} />
      <directionalLight position={[totalW, 10, totalD]} intensity={0.8} />

      {rooms.map((room) => (
        <RoomMesh
          key={room.id}
          room={room}
          ceilingType={ceiling[room.id] ?? 'stretch'}
          flooringType={flooring[room.id] ?? 'screed'}
          floorCoveringType={floorCovering[room.id]}
        />
      ))}

      {rooms.map((room) => (
        <WallMeshes key={`wall-${room.id}`} room={room} />
      ))}

      <WireSegments />
      <FurnitureMeshes />
    </>
  );
}

export const ROOM_HEIGHT_M = ROOM_HEIGHT;
