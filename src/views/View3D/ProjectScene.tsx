import { useMemo } from 'react';
import { CanvasTexture, RepeatWrapping, SRGBColorSpace } from 'three';
import { useProjectStore } from '../../store/projectStore';
import { PALETTE } from '../../theme/palette';
import { TILE_SIZE } from '../../domain/geometry/tiles';
import { getEffectiveSize } from '../../domain/furniture/placement';
import type { CatalogItem } from '../../domain/furniture/placement';
import type { Room, CeilingType, FloorType, FloorCovering } from '../../domain/geometry/types';
import { getFloorPatternCanvas, getPatternUnitSize } from '../floorPatterns';
import { buildWallGeometry, holesForWall, Z_OFFSET_INTO_ROOM } from './wallOpenings';
import { FurnitureModel } from './FurnitureModel';
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
    // F3.1.3 (v1.9.0): `none` falls back to the bare screed floor in 3D, just
    // like an unset covering.
    if (!covering || covering === 'none') return null;
    // 3D needs the base floor color baked into the texture — no room fill renders
    // beneath the floor mesh. 2D uses the same factory without `withBackground` so
    // the pattern is overlay-only there (F6.2.8).
    const canvas = getFloorPatternCanvas(covering, { withBackground: true });
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
        {ceilingType === 'stretch' ? (
          // F6.3.4 — glossy stretch ceiling
          <meshPhysicalMaterial color={ceilingColor(ceilingType)} roughness={0.2} clearcoat={0.5} />
        ) : (
          // F6.3.5 — matte drywall
          <meshStandardMaterial color={ceilingColor(ceilingType)} roughness={0.95} />
        )}
      </mesh>
    </group>
  );
}

function WallMeshes({ room }: { room: Room }) {
  const r = room.rect;
  const { layout } = useProjectStore();
  const x0 = r.x * TILE_SIZE;
  const z0 = r.y * TILE_SIZE;
  const w = r.width * TILE_SIZE;
  const d = r.height * TILE_SIZE;
  const h = ROOM_HEIGHT;
  const wallColor = PALETTE.walls.plaster;

  // F7.5.1, F7.5.2 (v1.15.0) — стены строятся как ShapeGeometry с вырезами
  // под окна и двери. Двери становятся пустыми проёмами (door-mesh убран),
  // окна — стекло, смещённое на ε внутрь комнаты (рисуется отдельно).
  const openings = useMemo(
    () => ({
      windows: layout?.windows ?? [],
      doors: layout?.doors ?? [],
    }),
    [layout?.windows, layout?.doors],
  );

  const wallSides = useMemo(() => {
    const north = buildWallGeometry(w, h, holesForWall('north', room, openings));
    const south = buildWallGeometry(w, h, holesForWall('south', room, openings));
    const west = buildWallGeometry(d, h, holesForWall('west', room, openings));
    const east = buildWallGeometry(d, h, holesForWall('east', room, openings));
    return { north, south, west, east };
  }, [room, openings, w, d, h]);

  return (
    <group>
      <mesh position={[x0 + w / 2, h / 2, z0]} geometry={wallSides.north}>
        <meshStandardMaterial color={wallColor} side={2} />
      </mesh>
      <mesh
        position={[x0 + w / 2, h / 2, z0 + d]}
        rotation={[0, Math.PI, 0]}
        geometry={wallSides.south}
      >
        <meshStandardMaterial color={wallColor} side={2} />
      </mesh>
      <mesh
        position={[x0, h / 2, z0 + d / 2]}
        rotation={[0, Math.PI / 2, 0]}
        geometry={wallSides.west}
      >
        <meshStandardMaterial color={wallColor} side={2} />
      </mesh>
      <mesh
        position={[x0 + w, h / 2, z0 + d / 2]}
        rotation={[0, -Math.PI / 2, 0]}
        geometry={wallSides.east}
      >
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

function WindowMeshes() {
  const { layout, rooms } = useProjectStore();
  if (!layout || layout.windows.length === 0) return null;

  // F7.5.1, F7.5.3 (v1.15.0) — окно как стеклянная плоскость, смещённая
  // на ε внутрь комнаты от плоскости стены, чтобы избежать z-fighting
  // (стекло и стена компланарны без сдвига). Сторона смещения определяется
  // тем, в какой комнате лежит соседний тайл: если окно горизонтальное
  // (start.y === end.y), стена тянется вдоль оси X на y=start.y; комната
  // примыкает либо со стороны y-1, либо y+1.
  return (
    <group>
      {layout.windows.map((win) => {
        const cx = ((win.start.x + win.end.x) / 2) * TILE_SIZE;
        const cz = ((win.start.y + win.end.y) / 2) * TILE_SIZE;
        const lengthM =
          (Math.abs(win.start.x - win.end.x) + Math.abs(win.start.y - win.end.y)) * TILE_SIZE;
        const cy = win.sill_height_m + win.height_m / 2;
        const isVertical = win.start.x === win.end.x;
        const rotY = isVertical ? Math.PI / 2 : 0;
        const offset = computeOpeningOffset(win, rooms);
        const dx = isVertical ? offset : 0;
        const dz = isVertical ? 0 : offset;
        return (
          <mesh key={win.id} position={[cx + dx, cy, cz + dz]} rotation={[0, rotY, 0]}>
            <planeGeometry args={[lengthM, win.height_m]} />
            <meshStandardMaterial
              color={PALETTE.openings.window_glass}
              transparent
              opacity={0.5}
              side={2}
            />
          </mesh>
        );
      })}
    </group>
  );
}

/**
 * F7.5.1 — найти, в какую сторону относительно линии проёма (start.y или
 * start.x в зависимости от ориентации) сместить плоскость окна, чтобы она
 * оказалась НА ε ВНУТРИ примыкающей комнаты. Если комнаты по обе стороны
 * (внутреннее окно), смещаем в любую — выбираем «+».
 */
function computeOpeningOffset(
  o: { start: { x: number; y: number }; end: { x: number; y: number } },
  rooms: Room[],
): number {
  const horizontal = o.start.y === o.end.y;
  const sampleAlong = (offsetSide: number): { x: number; y: number } => {
    if (horizontal) {
      const ox = (o.start.x + o.end.x) / 2;
      return { x: Math.floor(ox), y: o.start.y + offsetSide };
    }
    const oy = (o.start.y + o.end.y) / 2;
    return { x: o.start.x + offsetSide, y: Math.floor(oy) };
  };
  const tileInRoom = (t: { x: number; y: number }) =>
    rooms.some((r) => r.tiles.some((rt) => rt.x === t.x && rt.y === t.y));
  // Знак: для горизонтального проёма (на оси X) комната «+» = y возрастает
  // (z-в мире), значит cz должен быть смещён на +ε. «−» = y убывает.
  const plusInRoom = tileInRoom(sampleAlong(0));
  const minusInRoom = tileInRoom(sampleAlong(-1));
  if (plusInRoom) return Z_OFFSET_INTO_ROOM;
  if (minusInRoom) return -Z_OFFSET_INTO_ROOM;
  return Z_OFFSET_INTO_ROOM;
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
        // F8.2.3 — scaleX={[-1, 1, 1]} mirrors around the box centre. The geometry
        // is symmetric so visually identical pieces do not change, but asymmetric
        // future models will reflect correctly.
        // F15.3 (v1.16.0) — `<FurnitureModel>` рисует glTF-модель из
        // item.model3d.url через Suspense; пока модель грузится или
        // если её нет — fallback на box-геометрию (старое поведение).
        return (
          <group key={f.id} position={[cx, hm / 2, cz]} scale={[f.mirrored ? -1 : 1, 1, 1]}>
            <FurnitureModel
              widthM={wm}
              heightM={hm}
              depthM={dm}
              color={color}
              model3d={item.model3d}
            />
          </group>
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

      {/* F7.5 (v1.15.0) — стены теперь несут вырезы под проёмы (см.
          buildWallGeometry в wallOpenings.ts). Двери — это пустые проёмы
          (никаких mesh), окна — стеклянная плоскость со смещением ε
          внутрь комнаты, чтобы избежать z-fighting со стеной. */}
      <WindowMeshes />

      <WireSegments />
      <FurnitureMeshes />
    </>
  );
}

export const ROOM_HEIGHT_M = ROOM_HEIGHT;
